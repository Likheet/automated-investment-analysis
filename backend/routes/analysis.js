// backend/routes/analysis.js
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
require('dotenv').config({ path: '../.env' });

const router = express.Router();

const s3Client = new S3Client({ region: process.env.AWS_REGION }); // Ensure AWS creds loaded
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// DELETE /api/analysis/record/:analysisId - Delete a specific analysis record
// Note: This more specific route needs to come before other routes with path parameters
router.delete('/record/:analysisId', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    const analysisId = parseInt(req.params.analysisId, 10);
    
    if (isNaN(analysisId)) {
        return res.status(400).json({ message: "Invalid Analysis ID." });
    }
    
    console.log(`Deleting analysis record ID: ${analysisId} for User ID: ${userId}`);
    
    let client;
    try {
        client = await pool.connect();
        
        // Verify the record belongs to the user before deleting
        const checkQuery = 'SELECT id FROM analysis_results WHERE id = $1 AND user_id = $2';
        const checkResult = await client.query(checkQuery, [analysisId, userId]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ 
                message: 'Record not found or you do not have permission to delete it.'
            });
        }
        
        // Delete the record
        const deleteQuery = 'DELETE FROM analysis_results WHERE id = $1 AND user_id = $2';
        await client.query(deleteQuery, [analysisId, userId]);
        
        console.log(`Successfully deleted analysis record ID: ${analysisId} for User ID: ${userId}`);
        res.status(200).json({ 
            message: 'Analysis record deleted successfully',
            deletedId: analysisId
        });
    } catch (error) {
        console.error(`Error deleting analysis record ID ${analysisId}:`, error);
        res.status(500).json({ message: 'Server error deleting analysis record.' });
    } finally {
        if (client) client.release();
    }
});

router.get('/history', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    console.log(`Fetching analysis history for User ID: ${userId}`);
    
    // --- Added original_filename and processing_status ---
    const query = `
        SELECT id, s3_key, original_filename, pdf_s3_key,
               overall_score, recommendation, processing_status, created_at
        FROM analysis_results WHERE user_id = $1 ORDER BY created_at DESC;
    `;
    
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(query, [userId]);
        
        // Debug log to see what's being returned from the database
        console.log(`Found ${result.rows.length} analysis records for User ID: ${userId}`);
        if (result.rows.length > 0) {
            result.rows.forEach(row => {
                console.log(`Record ID: ${row.id}, Status: ${row.processing_status}, PDF Key: ${row.pdf_s3_key || 'null'}`);
            });
        }
        
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(`Error fetching analysis history for User ID ${userId}:`, error);
        res.status(500).json({ message: 'Server error fetching analysis history.' });
    } finally {
        if (client) client.release();
    }
});

// DELETE /api/analysis/history/unavailable - Remove all records with FILE_UNAVAILABLE status
router.delete('/history/unavailable', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    console.log(`Removing FILE_UNAVAILABLE records for User ID: ${userId}`);
    
    let client;
    try {
        client = await pool.connect();
        
        // First get the count of records to be deleted
        const countQuery = 'SELECT COUNT(*) FROM analysis_results WHERE user_id = $1 AND processing_status = $2';
        const countResult = await client.query(countQuery, [userId, 'FILE_UNAVAILABLE']);
        const count = parseInt(countResult.rows[0].count);
        
        // Delete the records
        const deleteQuery = 'DELETE FROM analysis_results WHERE user_id = $1 AND processing_status = $2';
        await client.query(deleteQuery, [userId, 'FILE_UNAVAILABLE']);
        
        console.log(`Removed ${count} FILE_UNAVAILABLE records for User ID: ${userId}`);
        res.status(200).json({ 
            message: `Successfully removed ${count} unavailable records`,
            removedCount: count
        });
    } catch (error) {
        console.error(`Error removing unavailable records for User ID ${userId}:`, error);
        res.status(500).json({ message: 'Server error removing unavailable records.' });
    } finally {
        if (client) client.release();
    }
});

// GET /api/analysis/report/:analysisId/download - Triggers PDF generation / fetches URL
router.get('/report/:analysisId/download', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    const analysisId = parseInt(req.params.analysisId, 10);
    if (isNaN(analysisId)) return res.status(400).json({ message: "Invalid Analysis ID." });

    console.log(`Download request for Analysis ID: ${analysisId} by User ID: ${userId}`);
    let client;
    try {
        client = await pool.connect();
        const result = await client.query( 'SELECT pdf_s3_key FROM analysis_results WHERE id = $1 AND user_id = $2', [analysisId, userId]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Report not found or access denied.' });

        const pdfS3Key = result.rows[0].pdf_s3_key;
        if (!pdfS3Key) return res.status(404).json({ message: 'Report PDF not available yet.' });

        // Check if the file exists in S3 before generating a URL
        try {
            // Use HeadObject to check if the file exists without downloading it
            const { HeadObjectCommand } = require("@aws-sdk/client-s3");
            await s3Client.send(new HeadObjectCommand({
                Bucket: BUCKET_NAME,
                Key: pdfS3Key
            }));
        } catch (s3Error) {
            // File doesn't exist in S3
            console.error(`File ${pdfS3Key} not found in S3:`, s3Error);
            
            // Update the database to mark this report as unavailable
            try {
                await client.query(
                    'UPDATE analysis_results SET processing_status = $1 WHERE id = $2', 
                    ['FILE_UNAVAILABLE', analysisId]
                );
                console.log(`Marked Analysis ID ${analysisId} as FILE_UNAVAILABLE`);
            } catch (dbError) {
                console.error(`Failed to update status for Analysis ID ${analysisId}:`, dbError);
            }
            
            return res.status(404).json({ 
                message: 'Report file has been deleted from storage.',
                errorType: 'FILE_DELETED'
            });
        }

        // Use a distinct name for download if desired
        const downloadFilename = `KaroStartup_Thesis_Report_${analysisId}.pdf`;

        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: pdfS3Key,
            ResponseContentDisposition: `attachment; filename="${downloadFilename}"` // Force download prompt
        });
        const expiresIn = 300; // 5 minutes
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
        console.log(`Generated download URL for ${pdfS3Key}`);

        // Return the signed URL instead of redirecting
        res.json({ 
            downloadUrl: signedUrl,
            filename: downloadFilename,
            expiresIn: expiresIn
        });

    } catch (error) {
        console.error(`Error processing download for Analysis ID ${analysisId}:`, error);
        res.status(500).json({ message: 'Server error processing download.' });
    } finally { if (client) client.release(); }
});

module.exports = router;