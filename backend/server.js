// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const FormData = require('form-data');
const Mailgun = require('mailgun.js');
const PDFDocument = require('pdfkit');
const { format } = require('date-fns');
const rateLimit = require('express-rate-limit'); // Rate Limiting
const pool = require('./db'); // Import the database pool
const session = require('express-session'); // Add session require
const passport = require('passport'); // Add passport require
require('./config/passport-setup'); // Add this line to execute the passport config

// --- Import Routes & Middleware ---
const authRoutes = require('./routes/auth'); // Import the auth router
const analysisRoutes = require('./routes/analysis'); // Import the analysis router
const userRoutes = require('./routes/users'); // Import the user router
const authMiddleware = require('./middleware/authMiddleware'); // Import the middleware

// --- Configuration ---

// AWS S3
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// Mailgun
const mailgun = new Mailgun(FormData);
const mg = mailgun.client({username: 'api', key: process.env.MAILGUN_API_KEY});
const FROM_EMAIL = process.env.FROM_EMAIL;
const MAILGUN_DOMAIN = 'sandbox47a73d27a48448629f7f866e86ebcda7.mailgun.org';

// Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    generationConfig: { responseMimeType: "application/json" },
    // Consider safety settings if needed
});

// Express App
const app = express();
const PORT = process.env.PORT || 5001;

// CORS
const corsOptions = {
    origin: 'http://localhost:5173', // Update if frontend runs elsewhere
    credentials: true, // Add credentials: true if using sessions/cookies with CORS
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json()); // Add middleware to parse JSON request bodies

// --- Session Setup (MUST be before Passport initialize) ---
app.use(session({
    secret: process.env.SESSION_SECRET, // Use the secret from .env
    resave: false,
    saveUninitialized: false, // Don't save sessions until something is stored
    cookie: {
        // secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (requires HTTPS)
        secure: false, // For http://localhost testing
        maxAge: 24 * 60 * 60 * 1000 // Cookie expiration (e.g., 1 day) - independent of JWT expiration
    }
}));

// --- Passport Initialize ---
app.use(passport.initialize()); // Initialize Passport
app.use(passport.session());    // Allow Passport to use express-session

// Rate Limiter for Uploads
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 upload requests per windowMs
    message: 'Too many uploads created from this IP, please try again after an hour',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req, res) => req.user?.userId || req.ip // Rate limit based on authenticated user ID or IP if not logged in
});

// Multer (Temporary Local Storage)
const tempUploadDir = path.join(__dirname, 'temp-uploads');
const tempReportsDir = path.join(__dirname, 'temp-reports');
[tempUploadDir, tempReportsDir].forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir); });

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, tempUploadDir); },
    filename: function (req, file, cb) {
        const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        cb(null, Date.now() + '-' + safeOriginalName);
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: function (req, file, cb) {
        const allowedExtensions = /\.(ppt|pptx)$/i;
        if (!allowedExtensions.test(path.extname(file.originalname))) {
            return cb(new Error('Only .ppt and .pptx files are allowed!'), false);
        }
        cb(null, true);
    }
}).single('pitchDeck'); // Frontend field name must be 'pitchDeck'


// --- Helper Functions ---

async function uploadToS3(localFilePath, s3Key, contentType) {
    console.log(`Uploading ${s3Key} to S3...`);
    const fileStream = fs.createReadStream(localFilePath);
    const putObjectParams = { Bucket: BUCKET_NAME, Key: s3Key, Body: fileStream, ContentType: contentType };
    try {
        await s3Client.send(new PutObjectCommand(putObjectParams));
        console.log(`Successfully uploaded ${s3Key} to S3.`);
        return true;
    } catch (s3Err) {
        console.error(`S3 upload failed for ${s3Key}:`, s3Err);
        throw new Error(`S3 upload failed: ${s3Err.message}`);
    } finally {
         if (fileStream && !fileStream.closed) { fileStream.close(); }
    }
}

function runTextExtraction(s3Key) {
    return new Promise((resolve, reject) => {
        const pythonExecutable = 'python'; // Adjust if needed ('python3', 'python3.11', etc.)
        console.log(`Executing: ${pythonExecutable} extract_text.py ${s3Key}`);
        const pythonProcess = spawn(pythonExecutable, ['extract_text.py', s3Key], { cwd: __dirname });
        let scriptOutput = ""; let scriptError = "";

        pythonProcess.stdout.on('data', (data) => { scriptOutput += data.toString(); });
        pythonProcess.stderr.on('data', (data) => { scriptError += data.toString(); });

        pythonProcess.on('close', (code) => {
            console.log(`Python script exited with code ${code}`);
            if (code === 0) {
                try {
                    const result = JSON.parse(scriptOutput);
                    if (result.error) { reject(new Error(`Extraction script error: ${result.error}`)); }
                    else { resolve(result.data); }
                } catch (e) { reject(new Error(`Failed to parse extraction script output: ${e.message}`)); }
            } else {
                 try { const errJson = JSON.parse(scriptError); if (errJson.error) { reject(new Error(`Extraction script failed: ${errJson.error}`)); return; } } catch(e) {}
                reject(new Error(`Python script failed (code ${code}). Stderr: ${scriptError || 'None'}`));
            }
        });
        pythonProcess.on('error', (error) => reject(new Error(`Failed to start extraction script: ${error.message}`)));
    });
}

async function analyzeWithGemini(extractedSlides) {
    // Validate input
    if (!extractedSlides || !Array.isArray(extractedSlides) || extractedSlides.length < 5) {
        throw new Error("Invalid slides: Minimum 5 slides required");
    }
    
    if (extractedSlides.length > 20) {
        console.warn("Warning: More than 20 slides provided, which exceeds recommendations");
    }
    
    // Format slides for analysis
    let fullDeckText = extractedSlides.map(slide =>
        `Slide ${slide.slide}:\nText: ${slide.text || 'No text'}\nNotes: ${slide.notes || 'No notes'}\n---`
    ).join('\n\n');
    
    // Add timestamp in required format
    const now = new Date();
    const timestamp = now.toISOString().replace(/T/, ' ').replace(/\..+/, ' UTC');
    
    // Enhanced prompt with all required fields and EXACT category names emphasized
    const analysisPrompt = `
You are an expert venture capital analyst evaluating a startup pitch deck. 
The pitch deck will be evaluated against the following nine categories with fixed weights and precise criteria:

1. Problem Statement (Weight: 10%)
   - Criteria: Clarity of problem, evidence of customer pain (e.g., stats, quotes), scope of impact.
   - Scoring: 0 (no problem stated) to 10 (well-defined with data validation).

2. Solution/Product (Weight: 15%)
   - Criteria: Feasibility, innovation, alignment with problem, clarity of explanation.
   - Scoring: 0 (no solution) to 10 (unique, practical, well-articulated).

3. Market Opportunity (Weight: 20%)
   - Criteria: TAM/SAM/SOM defined, realism of estimates, evidence of demand (e.g., trends, surveys).
   - Scoring: 0 (no market data) to 10 (specific, credible, data-backed).

4. Business Model (Weight: 15%)
   - Criteria: Revenue streams, scalability, customer acquisition plan, pricing clarity.
   - Scoring: 0 (no model) to 10 (detailed, sustainable, logical).

5. Competitive Landscape (Weight: 10%)
   - Criteria: Identification of competitors, strength of UVP, defensibility of position.
   - Scoring: 0 (no mention) to 10 (detailed analysis with strong differentiation).

6. Team (Weight: 15%)
   - Criteria: Relevant experience, completeness of roles, evidence of execution ability.
   - Scoring: 0 (no team info) to 10 (experienced, balanced, proven track record).

7. Traction/Milestones (Weight: 10%)
   - Criteria: Metrics (e.g., revenue, users), achieved milestones, alignment with funding ask.
   - Scoring: 0 (no traction) to 10 (quantifiable, impressive progress).

8. Financial Projections (Weight: 10%)
   - Criteria: 3-5 year forecasts, transparency of assumptions, realism of growth rates.
   - Scoring: 0 (no financials) to 10 (detailed, reasonable, supported).

9. Clarity and Presentation (Weight: 5%)
   - Criteria: Logical flow, visual design, grammar, conciseness (max 20 slides).
   - Scoring: 0 (incoherent, sloppy) to 10 (polished, professional, concise).

For each category, provide:
1. 'score' (integer 0-10, 0=missing, 10=excellent).
2. 'qualitative_feedback' (string 50-150 words summarizing category strengths/weaknesses based only on text).

Additionally, provide:
* 'overall_strengths': Bullet list (3-5 points) of significant positive findings.
* 'overall_weaknesses': Bullet list (3-5 points) of significant risks/gaps.
* 'recommendation': ONE of: "Strong Buy", "Hold", or "Pass".
* 'confidence_score': Integer (0-100) AI certainty based only on text completeness/coherence.
* 'recommendations': 100-200 words of actionable advice for due diligence or further investigation.
* 'processing_date': "${timestamp}"

Return the entire analysis strictly as a single JSON object with these EXACT category names as keys (do not modify or add suffixes like "Text only"):
"Problem Statement", "Solution/Product", "Market Opportunity", "Business Model", "Competitive Landscape", "Team", "Traction/Milestones", "Financial Projections", "Clarity and Presentation".

Pitch Deck Text:
\`\`\`
${fullDeckText}
\`\`\`
    `;
    
    console.log("Sending request to Gemini API...");
    try {
        // Call API with retry logic
        const responseText = await callGeminiWithRetry(analysisPrompt);
        
        try {
            let analysisResult = JSON.parse(responseText);
            
            // Handle potential numeric key structure
            const numericCategoryKeys = Object.keys(analysisResult).filter(k => /^\d+$/.test(k) && analysisResult[k]?.category);
            if (numericCategoryKeys.length > 0) {
                const convertedResult = {};
                // Copy non-numeric keys
                for (const key of Object.keys(analysisResult)) {
                    if (!/^\d+$/.test(key)) {
                        convertedResult[key] = analysisResult[key];
                    }
                }
                // Use the 'category' field as the key for each numeric entry
                for (const numKey of numericCategoryKeys) {
                    const catName = analysisResult[numKey].category;
                    convertedResult[catName] = analysisResult[numKey];
                }
                analysisResult = convertedResult;
            }
            
            // Define category aliases for validation
            const categoryAliases = {
                "Clarity and Presentation (Text only)": "Clarity and Presentation",
                "Clarity and Presentation (Text Only)": "Clarity and Presentation"
            };
            
            // Enhanced validation
            const requiredCategories = [
                "Problem Statement", "Solution/Product", "Market Opportunity", "Business Model", 
                "Competitive Landscape", "Team", "Traction/Milestones", 
                "Financial Projections", "Clarity and Presentation"
            ];

            const requiredFields = [
                "recommendation", "overall_strengths", "overall_weaknesses", 
                "confidence_score", "recommendations"
            ];

            // Validate all categories have proper scores, accounting for aliases
            const missingCategories = requiredCategories.filter(cat => {
                // Check both direct name and aliases
                const hasDirectCategory = analysisResult[cat] && 
                                        typeof analysisResult[cat].score === 'number';
                
                // Check aliases
                const hasAlias = Object.entries(categoryAliases)
                                    .some(([alias, canonicalName]) => 
                                        canonicalName === cat && 
                                        analysisResult[alias] && 
                                        typeof analysisResult[alias].score === 'number');
                
                return !(hasDirectCategory || hasAlias);
            });
            
            // Validate all required top-level fields exist
            const missingFields = requiredFields.filter(field => 
                analysisResult[field] === undefined
            );

            if (missingCategories.length > 0 || missingFields.length > 0) {
                console.error("Missing categories:", missingCategories);
                console.error("Missing fields:", missingFields);
                throw new Error(`Analysis validation failed - missing required data`);
            }
            
            // Normalize category names if aliases were used
            for (const [alias, canonicalName] of Object.entries(categoryAliases)) {
                if (analysisResult[alias] && !analysisResult[canonicalName]) {
                    analysisResult[canonicalName] = analysisResult[alias];
                    delete analysisResult[alias];
                    console.log(`Normalized category name from "${alias}" to "${canonicalName}"`);
                }
            }
            
            // Track category scores for debugging
            const categoryScoresUsed = {};
            for (const cat of requiredCategories) {
                if (analysisResult[cat] && typeof analysisResult[cat].score === 'number') {
                    categoryScoresUsed[cat] = analysisResult[cat].score;
                } else {
                    categoryScoresUsed[cat] = 'missing';
                }
            }
            
            // Calculate overall score
            const calculatedScore = calculateOverallScore(analysisResult);
            analysisResult.overall_score = calculatedScore;
            
            console.log("Category scores used:", JSON.stringify(categoryScoresUsed));
            console.log("Overall score calculated:", calculatedScore);
            
            // If there's a pre-computed score in the response, compare them
            if (typeof analysisResult.original_overall_score === 'number') {
                const difference = Math.abs(analysisResult.original_overall_score - calculatedScore);
                if (difference > 1) { // Allow for minor rounding differences
                    console.warn(`Score discrepancy detected: calculated ${calculatedScore}, response had ${analysisResult.original_overall_score}`);
                }
            }
            
            console.log("Gemini analysis parsed and validated successfully.");
            return analysisResult;
        } catch (e) {
             console.error("Failed to parse Gemini JSON:", responseText);
             throw new Error(`Could not parse LLM JSON response: ${e.message}`);
        }
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error(`LLM analysis failed: ${error.message}`);
    }
}

async function callGeminiWithRetry(prompt, maxRetries = 2) {
    let retries = 0;
    
    while (retries <= maxRetries) {
        try {
            const result = await geminiModel.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            retries++;
            console.error(`API call failed (attempt ${retries}/${maxRetries+1}):`, error);
            
            if (retries > maxRetries) {
                throw new Error(`Failed to analyze after ${maxRetries+1} attempts: ${error.message}`);
            }
            
            // Exponential backoff before retry
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries-1)));
        }
    }
}

function calculateOverallScore(analysisResult) {
    // Fixed weights as per requirements
    const weights = {
        "Problem Statement": 0.10,
        "Solution/Product": 0.15,
        "Market Opportunity": 0.20,
        "Business Model": 0.15,
        "Competitive Landscape": 0.10,
        "Team": 0.15,
        "Traction/Milestones": 0.10,
        "Financial Projections": 0.10,
        "Clarity and Presentation": 0.05
    };
    
    // Category aliases that might be used
    const categoryAliases = {
        "Clarity and Presentation (Text only)": "Clarity and Presentation",
        "Clarity and Presentation (Text Only)": "Clarity and Presentation"
    };
    
    let totalScore = 0;
    let totalWeightUsed = 0;
    const categoryScoresUsed = {};
    
    // Process each category
    for (const category in weights) {
        let categoryData = analysisResult[category];
        
        // Check for aliases if the main category name isn't found
        if (!categoryData) {
            for (const [alias, canonicalName] of Object.entries(categoryAliases)) {
                if (canonicalName === category && analysisResult[alias]) {
                    categoryData = analysisResult[alias];
                    break;
                }
            }
        }
        
        // If we have a valid score for this category, add it to the total
        if (categoryData && typeof categoryData.score === 'number') {
            let score = Math.max(0, Math.min(10, categoryData.score));
            totalScore += score * weights[category];
            totalWeightUsed += weights[category];
            categoryScoresUsed[category] = score;
        } else {
            // Missing category - count as zero
            console.warn(`Category '${category}' score missing, counting as 0`);
            categoryScoresUsed[category] = 0;
            // Still count the weight
            totalWeightUsed += weights[category];
        }
    }

    // If no categories were processed at all, return 0
    if (totalWeightUsed === 0) return 0;
    
    // Calculate weighted average and convert to 0-100 scale
    const overall = Math.round((totalScore / totalWeightUsed) * 10);
    
    // Log detailed calculation for debugging
    console.log("Category scores used in calculation:", JSON.stringify(categoryScoresUsed));
    console.log(`Weighted sum: ${totalScore}, Total weight: ${totalWeightUsed}`);
    console.log(`Calculation: (${totalScore} / ${totalWeightUsed}) * 10 = ${overall}`);
    
    return Math.max(0, Math.min(100, overall));
}

function prepareReportData(analysisResult) {
    // Try to extract startup name from slides or use default
    let startupName = extractStartupName(analysisResult) || "Startup";
    
    // Format date for filename (DDMMYYYY)
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}${(today.getMonth()+1).toString().padStart(2, '0')}${today.getFullYear()}`;
    
    return {
        reportData: analysisResult,
        filename: `Investment_Thesis_${startupName}_${dateStr}.pdf`
    };
}

// Helper function to attempt extracting startup name
function extractStartupName(analysisResult) {
    // Look for startup name in various possible locations
    
    // Check if there's an explicit startup_name field
    if (analysisResult.startup_name) {
        return analysisResult.startup_name;
    }
    
    // Try to extract from startup description in Problem Statement or Solution
    for (const category of ["Problem Statement", "Solution/Product"]) {
        if (analysisResult[category]?.qualitative_feedback) {
            const feedback = analysisResult[category].qualitative_feedback;
            
            // Look for company name patterns like "XYZ is a..." or "At XYZ, we..."
            const companyPatterns = [
                /([A-Z][A-Za-z0-9]+(?:\s[A-Z][A-Za-z0-9]+)*)\s+is\s+a/,
                /At\s+([A-Z][A-Za-z0-9]+(?:\s[A-Z][A-Za-z0-9]+)*)/
            ];
            
            for (const pattern of companyPatterns) {
                const match = feedback.match(pattern);
                if (match && match[1]) {
                    return match[1].trim();
                }
            }
        }
    }
    
    // Default fallback
    return null;
}

function prepareReportData(analysisResult) {
    // Try to extract startup name from slides (would need actual implementation)
    let startupName = "Startup";
    
    // Format date for filename (DDMMYYYY)
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}${(today.getMonth()+1).toString().padStart(2, '0')}${today.getFullYear()}`;
    
    return {
        reportData: analysisResult,
        filename: `Investment_Thesis_${startupName}_${dateStr}.pdf`
    };
}

// Modify saveAnalysisToDB to include original_filename and initial status
async function saveAnalysisToDB(s3Key, analysisResult, userId = null, originalFilename = null) {
    const overallScore = calculateOverallScore(analysisResult);
    const recommendation = analysisResult?.recommendation || null;
    const confidence = analysisResult?.confidence_score || null;

    const query = `
        INSERT INTO analysis_results
        (s3_key, user_id, original_filename, analysis_data, overall_score, recommendation, confidence_score, processing_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) -- Added original_filename and initial status
        RETURNING id;
    `;
    const values = [
        s3Key,
        userId,
        originalFilename, // Save original name
        analysisResult,
        overallScore,
        recommendation,
        confidence,
        'COMPLETED' // Assume complete *if analysis finished*. Set earlier if needed.
    ];
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(query, values);
        console.log(`Analysis results saved to DB with ID: ${result.rows[0].id}`);
        return result.rows[0].id;
    } catch (error) {
        console.error("Error saving analysis to DB:", error.stack);
        throw new Error("Failed to save analysis results to DB.");
    } finally {
        if (client) client.release();
    }
}

// Modify updatePdfKeyInDB to also set status to 'COMPLETED'
async function updatePdfKeyInDB(analysisId, pdfS3Key) {
    const query = `
        UPDATE analysis_results
        SET pdf_s3_key = $1, processing_status = 'COMPLETED', updated_at = NOW()
        WHERE id = $2;
    `;
    const values = [pdfS3Key, analysisId];
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(query, values);
        if (result.rowCount > 0) {
            console.log(`Updated PDF S3 Key in DB for analysis ID: ${analysisId}`);
            return true;
        } else {
            console.warn(`Analysis ID ${analysisId} not found for PDF key update.`);
            return false;
        }
    } catch (error) {
        console.error(`Error updating PDF Key for ID ${analysisId}:`, error.stack);
        throw new Error("Failed to update PDF location in database.");
    } finally {
        if (client) client.release();
    }
}

// Optional: Add function to update status only
async function updateAnalysisStatus(analysisId, status, failureReason = null) {
    const query = `
        UPDATE analysis_results
        SET processing_status = $1,
            updated_at = NOW()
        WHERE id = $2;
    `;
    const values = [status, analysisId];
    let client;
    try {
        client = await pool.connect();
        await client.query(query, values);
        console.log(`Updated status for Analysis ID ${analysisId} to ${status}`);
    } catch (error) {
        console.error(`Error updating status for Analysis ID ${analysisId}:`, error.stack);
    } finally {
        if (client) client.release();
    }
}

async function updateEmailStatus(analysisId, status, failureReason = null) {
    const query = `
        UPDATE analysis_results
        SET email_status = $1,
            email_failure_reason = $2,
            updated_at = NOW()
        WHERE id = $3;
    `;
    const values = [status, failureReason, analysisId];
    let client;
    try {
        client = await pool.connect();
        await client.query(query, values);
        console.log(`Updated email status for Analysis ID ${analysisId} to ${status}`);
        return true;
    } catch (error) {
        console.error(`Error updating email status for Analysis ID ${analysisId}:`, error.stack);
        return false;
    } finally {
        if (client) client.release();
    }
}

async function generateInvestmentThesisPDF(analysisData, analysisId, originalFileName) {
     return new Promise((resolve, reject) => {
         try {
             let startupName = path.basename(originalFileName, path.extname(originalFileName)).replace(/[^a-zA-Z0-9\-_ ]/g, '_').replace(/ /g, '_');
             startupName = (!startupName || startupName.length > 50) ? `StartupAnalysis_${analysisId}` : startupName;
             const processingDate = new Date();
             const formattedDate = format(processingDate, 'dd-MM-yyyy HH:mm:ss \'UTC\'');
             const reportDateFilename = format(processingDate, 'ddMMyyyy');
             const pdfFilename = `Investment_Thesis_${startupName}_${reportDateFilename}.pdf`;
             const pdfTempPath = path.join(tempReportsDir, pdfFilename);

             // Make sure the temporary directory exists
             if (!fs.existsSync(tempReportsDir)) {
                 fs.mkdirSync(tempReportsDir, { recursive: true });
                 console.log(`Created temporary reports directory: ${tempReportsDir}`);
             }

             console.log(`Generating PDF for analysis ID: ${analysisId} at path: ${pdfTempPath}`);

             const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 60, right: 60 }, bufferPages: true });
             const writeStream = fs.createWriteStream(pdfTempPath);
             doc.pipe(writeStream);
             
             writeStream.on('error', (err) => { 
                 console.error(`Error writing PDF to ${pdfTempPath}:`, err);
                 doc.end(); 
                 reject(new Error(`Failed to write PDF: ${err.message}`)); 
             });
             
             writeStream.on('finish', () => { 
                 console.log(`PDF written successfully to: ${pdfTempPath}`); 
                 resolve({ localPath: pdfTempPath, reportFilename: pdfFilename }); 
             });

             // Styles & Helpers
             const H1 = 14, H2 = 12, P = 11, Font = 'Helvetica', FontBold = 'Helvetica-Bold';
             const addH1 = (txt) => doc.font(FontBold).fontSize(H1).text(txt, { paragraphGap: 5 }).moveDown(0.5);
             const addH2 = (txt) => doc.font(FontBold).fontSize(H2).text(txt, { paragraphGap: 3 }).moveDown(0.3);
             const addSubHeading = (txt) => doc.font(FontBold).fontSize(P).text(txt, { paragraphGap: 2 }).moveDown(0.2);
             const addP = (txt, opts={}) => doc.font(Font).fontSize(P).text(txt, { paragraphGap: 3, align: opts.align || 'justify', indent: opts.indent || 0, ...opts }).moveDown(0.5);
             const addBullet = (txt) => addP(`• ${txt}`, {indent: 0});

             // --- PDF Content Sections ---

             // Summary
             addH1("Investment Thesis Summary");
             addP(`Startup: ${startupName}`);
             addP(`Processing Date: ${formattedDate}`);
             addSubHeading("Recommendation:"); addP(analysisData?.recommendation || "N/A", { indent: 20 });
             addSubHeading("Overall Score:"); addP(`${calculateOverallScore(analysisData)} / 100`, { indent: 20 });
             doc.moveDown(1);

              // Categories
              addH1("Category Analysis");
              const categoryWeights = { "Problem Statement": 10, "Solution/Product": 15, "Market Opportunity": 20, "Business Model": 15, "Competitive Landscape": 10, "Team": 15, "Traction/Milestones": 10, "Financial Projections": 10, "Clarity and Presentation (Text only)": 5 };
              for (const category in categoryWeights) {
                  const catData = analysisData?.[category];
                  addH2(`${category} (${categoryWeights[category]}%)`, { underline: true });
                  if (catData) {
                      addSubHeading("Score:"); addP(`${catData.score ?? 'N/A'} / 10`, { indent: 20 });
                      addSubHeading("Feedback:"); addP(catData.qualitative_feedback || "No feedback.", { indent: 20 });
                  } else { addP("Analysis data missing for this category.", { indent: 20, oblique: true }); }
                   doc.moveDown(0.7);
              }
              doc.moveDown(1);

              // Strengths & Weaknesses
              addH1("Overall Strengths & Weaknesses");
              addSubHeading("Strengths:"); 
              if (Array.isArray(analysisData?.overall_strengths) && analysisData.overall_strengths.length > 0) {
                  analysisData.overall_strengths.forEach(s => addBullet(s));
              } else {
                  addBullet("None explicitly identified.");
              }
              doc.moveDown(0.5);
              
              addSubHeading("Weaknesses:"); 
              if (Array.isArray(analysisData?.overall_weaknesses) && analysisData.overall_weaknesses.length > 0) {
                  analysisData.overall_weaknesses.forEach(w => addBullet(w));
              } else {
                  addBullet("None explicitly identified.");
              }
              doc.moveDown(1);

              // Recommendations
              addH1("Detailed Recommendations");
              addP(analysisData?.recommendations || analysisData?.recommendation || "No specific recommendations provided beyond the overall guidance.");
              doc.moveDown(1);

             // Footer (Page Numbers)
             const range = doc.bufferedPageRange();
             for (let i = range.start; i <= (range.start + range.count - 1); i++) {
                doc.switchToPage(i);
                doc.font(Font).fontSize(9).text(`Page ${i + 1} of ${range.count}`, 50, doc.page.height - 40, { align: 'center' });
             }

             // Finalize
             doc.end();
         } catch (error) {
             console.error(`Error generating PDF for analysis ${analysisId}:`, error);
             reject(error);
         }
     }); // End Promise
}

async function sendCompletionEmail(recipientEmail, analysisId, deckS3Key, pdfS3Key) {
    if (!FROM_EMAIL) { 
        console.warn("FROM_EMAIL not set, skipping email notification.");
        await updateEmailStatus(analysisId, 'FAILED', 'FROM_EMAIL not configured');
        return false; 
    }
    if (!recipientEmail) { 
        console.warn(`No recipient email found for analysis ${analysisId}, skipping.`);
        await updateEmailStatus(analysisId, 'FAILED', 'Recipient email missing');
        return false; 
    }

    // Create a download URL that points to our redirect endpoint
    const backendBaseUrl = 'http://localhost:5001';
    const downloadLink = `${backendBaseUrl}/api/analysis/report/${analysisId}/download`;

    const subject = `KaroStartup: Your Pitch Deck Analysis is Ready (ID: ${analysisId})`;
    const bodyText = `Your pitch deck analysis (Original Key: ${deckS3Key}) is complete.\n\nYou can download the PDF report here:\n${downloadLink}\n\nThank you for using KaroStartup!`;
    const bodyHtml = `<p>Your pitch deck analysis (Original Key: ${deckS3Key}) is complete.</p><p>You can download the PDF report using the button below (link expires in 5 minutes from generation time):</p><p><a href="${downloadLink}" style="padding:10px 15px; background-color:#007bff; color:white; text-decoration:none; border-radius:5px;">Download Report PDF</a></p><p><br/>Or copy this link: ${downloadLink}</p><p>Thank you for using KaroStartup!</p>`;

    try {
        await mg.messages.create(MAILGUN_DOMAIN, {
            from: `KaroStartup <${FROM_EMAIL}>`,
            to: [recipientEmail],
            subject: subject,
            text: bodyText,
            html: bodyHtml
        });
        console.log(`Completion email sent to ${recipientEmail} for Analysis ID: ${analysisId}`);
        await updateEmailStatus(analysisId, 'SENT');
        return true;
    } catch (error) {
        console.error(`Failed to send completion email to ${recipientEmail} for Analysis ID ${analysisId}:`, error);
        await updateEmailStatus(analysisId, 'FAILED', error.message);
        return false;
    }
}

// --- API Routes ---
app.use('/api/auth', authRoutes); // Auth routes (public)
app.use('/api/analysis', analysisRoutes); // Analysis routes (protected within the router)
app.use('/api/users', userRoutes); // User routes (protected within the router)

app.get('/', (req, res) => {
    res.send('KaroStartup Backend API is running.');
});

// Update the main upload route to include status updates
app.post('/api/analysis/upload', authMiddleware, uploadLimiter, (req, res) => {
    const userId = req.user.userId;
    const userEmail = req.user.email;

    upload(req, res, async function (err) {
        if (err) {
            console.error('Multer error:', err.message);
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        const originalFileName = req.file.originalname;
        const localFilePath = req.file.path;
        const s3KeyDeck = req.file.filename;
        let analysisId = null;
        let analysisResult = null;
        let pdfS3Key = null;
        let stage = "Starting";

        let preInsertClient;
        try {
            preInsertClient = await pool.connect();
            const preInsertQuery = `
                INSERT INTO analysis_results 
                (user_id, s3_key, original_filename, processing_status, analysis_data)
                VALUES ($1, $2, $3, 'PENDING', '{}') RETURNING id;
            `;
            const preResult = await preInsertClient.query(preInsertQuery, [userId, s3KeyDeck, originalFileName]);
            analysisId = preResult.rows[0].id;
            console.log(`Created initial analysis record ID: ${analysisId} with status PENDING.`);
        } catch (dbError) {
            console.error("FATAL: Failed to create initial analysis record in DB:", dbError);
            if (fs.existsSync(localFilePath)) try { fs.unlinkSync(localFilePath); } catch (e) {}
            return res.status(500).json({ message: "Failed to initiate analysis process in database." });
        } finally {
            if (preInsertClient) preInsertClient.release();
        }

        try {
            stage = "S3 PPT Upload";
            await updateAnalysisStatus(analysisId, 'UPLOADING_DECK');
            await uploadToS3(localFilePath, s3KeyDeck, req.file.mimetype);
            try { fs.unlinkSync(localFilePath); } catch (e) {}

            stage = "Text Extraction";
            await updateAnalysisStatus(analysisId, 'EXTRACTING_TEXT');
            const extractedTextData = await runTextExtraction(s3KeyDeck);
            const slideCount = extractedTextData.length;
            if (slideCount < 5 || slideCount > 20) throw new Error(`Invalid slide count: ${slideCount}. Must be 5-20.`);

            stage = "AI Analysis";
            await updateAnalysisStatus(analysisId, 'ANALYZING_AI');
            analysisResult = await analyzeWithGemini(extractedTextData);

            stage = "Database Update (Analysis Data)";
            await updateAnalysisStatus(analysisId, 'SAVING_ANALYSIS');
            const overallScore = calculateOverallScore(analysisResult);
            const recommendation = analysisResult?.recommendation || null;
            const confidence = analysisResult?.confidence_score || null;
            const updateQuery = `
                UPDATE analysis_results SET
                    analysis_data = $1, overall_score = $2, recommendation = $3,
                    confidence_score = $4, processing_status = 'GENERATING_PDF', updated_at = NOW()
                WHERE id = $5;
            `;
            let updateClient;
            try {
                updateClient = await pool.connect();
                await updateClient.query(updateQuery, [analysisResult, overallScore, recommendation, confidence, analysisId]);
                console.log(`Updated analysis data in DB for ID: ${analysisId}`);
            } catch (updateErr) {
                console.error("DB Update analysis failed:", updateErr);
                throw new Error("Failed to save analysis details to database.");
            } finally {
                if (updateClient) updateClient.release();
            }

            stage = "PDF Generation";
            const { localPath: pdfLocalPath, reportFilename: pdfReportFilename } = await generateInvestmentThesisPDF(analysisResult, analysisId, originalFileName);

            stage = "S3 PDF Upload";
            await updateAnalysisStatus(analysisId, 'UPLOADING_PDF');
            pdfS3Key = `reports/${pdfReportFilename}`;
            await uploadToS3(pdfLocalPath, pdfS3Key, 'application/pdf');
            try { fs.unlinkSync(pdfLocalPath); } catch (e) {}

            stage = "Database Update (PDF Key & Complete)";
            await updatePdfKeyInDB(analysisId, pdfS3Key);

            stage = "Email Notification";
            await sendCompletionEmail(userEmail, analysisId, s3KeyDeck, pdfS3Key);

            console.log(`Process completed for Analysis ID: ${analysisId}`);
            res.status(200).json({
                message: `File processed, analyzed, and report generated successfully. Notification sent to ${userEmail}.`,
                s3KeyDeck: s3KeyDeck,
                analysisId: analysisId,
                pdfReportKey: pdfS3Key,
                recommendation: analysisResult?.recommendation || "N/A"
            });

        } catch (error) {
            console.error(`PROCESSING FAILED [ID: ${analysisId}, User: ${userId}] at stage [${stage}]:`, error);
            if (analysisId) {
                await updateAnalysisStatus(analysisId, 'FAILED');
            }
            if (fs.existsSync(localFilePath)) { try { fs.unlinkSync(localFilePath); } catch (e) {} }
            res.status(500).json({ message: `Processing failed during ${stage}: ${error.message}`, analysisId: analysisId });
        }
    });
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

// Optional: Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
