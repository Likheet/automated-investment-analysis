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
const PDFDocument = require('pdfkit');
const { format } = require('date-fns');
const rateLimit = require('express-rate-limit');
const pool = require('./db');
const session = require('express-session');
const passport = require('passport');
const nodemailer = require('nodemailer');
require('./config/passport-setup');

const authRoutes = require('./routes/auth');
const analysisRoutes = require('./routes/analysis');
const userRoutes = require('./routes/users');
const authMiddleware = require('./middleware/authMiddleware');

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    generationConfig: { responseMimeType: "application/json" },
});

const app = express();
const PORT = process.env.PORT || 5001;

const corsOptions = {
    origin: 'http://localhost:5173',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set true for HTTPS production
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many uploads requested, please try again after an hour',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => req.user?.userId || req.ip
});

const tempUploadDir = path.join(__dirname, 'temp-uploads');
const tempReportsDir = path.join(__dirname, 'temp-reports');
[tempUploadDir, tempReportsDir].forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, tempUploadDir); },
    filename: function (req, file, cb) {
        const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        cb(null, Date.now() + '-' + safeOriginalName);
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const allowedExtensions = /\.(ppt|pptx)$/i;
        if (!allowedExtensions.test(path.extname(file.originalname))) {
            return cb(new Error('Only .ppt and .pptx files are allowed!'), false);
        }
        cb(null, true);
    }
}).single('pitchDeck');


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
        const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python';
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
                } catch (e) { reject(new Error(`Failed to parse extraction script output: ${e.message}\nOutput: ${scriptOutput}`)); }
            } else {
                 try {
                    const errJson = JSON.parse(scriptError);
                    if (errJson.error) { reject(new Error(`Extraction script failed: ${errJson.error}`)); return; }
                 } catch(e) { /* Ignore */ }
                reject(new Error(`Python script failed (code ${code}). Stderr: ${scriptError || 'None'}. Stdout: ${scriptOutput || 'None'}`));
            }
        });
        pythonProcess.on('error', (error) => reject(new Error(`Failed to start extraction script: ${error.message}`)));
    });
}

async function analyzeWithGemini(extractedSlides) {
    if (!extractedSlides || !Array.isArray(extractedSlides) || extractedSlides.length === 0) {
        throw new Error("Invalid slides: No slides extracted or data is malformed.");
    }
     if (extractedSlides.length < 3) {
        console.warn(`Warning: Only ${extractedSlides.length} slides extracted. Minimum 5 recommended for full analysis.`);
    }
    if (extractedSlides.length > 30) {
        console.warn("Warning: More than 30 slides provided, analysis quality may be impacted.");
    }

    let fullDeckText = extractedSlides.map((slide, index) =>
        `Slide ${index + 1}:\nText: ${slide.text || 'No text detected'}\nNotes: ${slide.notes || 'No notes detected'}\n---`
    ).join('\n\n');

    const now = new Date();
    const timestamp = now.toISOString().replace(/T/, ' ').replace(/\..+/, ' UTC');

    const analysisPrompt = `
You are an expert venture capital analyst evaluating a startup pitch deck based *only* on the provided text and notes from its slides.
Analyze the following pitch deck content against these nine categories using the defined criteria and weights.

1.  **Problem Statement** (Weight: 10%)
    *   Criteria: Clear problem definition? Evidence of customer pain (stats, quotes)? Significant impact shown?
    *   Scoring: 0 (absent/unclear) to 10 (well-defined, validated pain, significant scope).
2.  **Solution/Product** (Weight: 15%)
    *   Criteria: Feasible solution? Innovative? Directly addresses problem? Explained clearly?
    *   Scoring: 0 (absent/incoherent) to 10 (unique, practical, well-articulated solution).
3.  **Market Opportunity** (Weight: 20%)
    *   Criteria: TAM/SAM/SOM defined? Realistic estimates? Evidence of demand (trends, surveys)?
    *   Scoring: 0 (absent/vague) to 10 (specific, credible, data-backed market sizing).
4.  **Business Model** (Weight: 15%)
    *   Criteria: Clear revenue streams? Scalable model? Customer acquisition strategy outlined? Pricing logical?
    *   Scoring: 0 (absent/unclear) to 10 (detailed, sustainable, logical business model).
5.  **Competitive Landscape** (Weight: 10%)
    *   Criteria: Competitors identified? Unique Value Proposition (UVP) clear? Defensible position discussed?
    *   Scoring: 0 (absent/ignored) to 10 (thorough analysis with strong, defensible differentiation).
6.  **Team** (Weight: 10%)
    *   Criteria: Relevant team experience presented? Key roles covered? Evidence of execution ability (past success)?
    *   Scoring: 0 (absent/irrelevant) to 10 (experienced, balanced team with proven capabilities).
7.  **Traction/Milestones** (Weight: 10%)
    *   Criteria: Quantifiable progress shown (revenue, users, partnerships)? Key milestones achieved? Progress aligns with goals?
    *   Scoring: 0 (absent/negligible) to 10 (impressive, quantifiable progress demonstrated).
8.  **Financial Projections** (Weight: 5%)
    *   Criteria: 3-5 year realistic forecasts included? Key assumptions stated? Growth rates justified? Funding need explained?
    *   Scoring: 0 (absent/unrealistic) to 10 (detailed, reasonable, well-supported financial plan).
9.  **Clarity and Presentation** (Weight: 5%)
    *   Criteria: Logical flow of information? Text concise and understandable? Free of major grammatical errors? (Assessment based *only* on extracted text, not visuals). Maximum 20 slides recommended.
    *   Scoring: 0 (incoherent, poorly written) to 10 (clear, concise, professional language).

For each category, provide:
1.  'score': An integer from 0 to 10. Score 0 if the category is entirely missing or impossible to assess from the text.
2.  'qualitative_feedback': A string (50-150 words) summarizing the strengths and weaknesses observed *for that category based solely on the provided text*. Be specific.

Additionally, provide these top-level fields:
*   'overall_strengths': A bulleted list (as a JSON array of strings, 3-5 points) of the most significant positive aspects identified across the entire deck text.
*   'overall_weaknesses': A bulleted list (as a JSON array of strings, 3-5 points) of the most critical risks, gaps, or areas needing improvement identified across the entire deck text.
*   'recommendation': ONE of the following strings: "Strong Buy", "Hold", or "Pass", based on the overall assessment.
*   'confidence_score': An integer (0-100) reflecting your certainty in this analysis, considering the completeness and coherence of the provided text. Higher score means more confidence based on available text.
*   'recommendations_for_investor': A string (100-200 words) suggesting key questions or areas for the investor to probe further during due diligence based *only* on this text analysis.
*   'processing_date': "${timestamp}"

Return the entire analysis STRICTLY as a single, valid JSON object. Use the EXACT category names listed above (e.g., "Problem Statement", "Solution/Product", etc.) as keys for the category objects. Ensure all requested fields are present.

Pitch Deck Text Content:
\`\`\`
${fullDeckText}
\`\`\`
`;

    console.log("Sending request to Gemini API...");
    try {
        const responseText = await callGeminiWithRetry(analysisPrompt);
        console.log("Raw Gemini Response Text Received.");

        try {
            let analysisResult = JSON.parse(responseText);

             const requiredCategories = [
                "Problem Statement", "Solution/Product", "Market Opportunity", "Business Model",
                "Competitive Landscape", "Team", "Traction/Milestones",
                "Financial Projections", "Clarity and Presentation"
            ];

            const requiredTopLevelFields = [
                "overall_strengths", "overall_weaknesses", "recommendation",
                "confidence_score", "recommendations_for_investor", "processing_date"
            ];

             const missingCategories = [];
             const categoriesWithInvalidScores = [];
             const missingTopLevelFields = [];

            requiredCategories.forEach(cat => {
                const categoryData = analysisResult[cat];
                if (!categoryData) {
                    missingCategories.push(cat);
                } else if (typeof categoryData.score !== 'number' || categoryData.score < 0 || categoryData.score > 10) {
                    categoriesWithInvalidScores.push(`${cat} (Score: ${categoryData.score})`);
                 }
             });

             requiredTopLevelFields.forEach(field => {
                if (analysisResult[field] === undefined || analysisResult[field] === null) {
                    missingTopLevelFields.push(field);
                }
             });

             let validationErrors = [];
            if (missingCategories.length > 0) validationErrors.push(`Missing categories: ${missingCategories.join(', ')}`);
            if (categoriesWithInvalidScores.length > 0) validationErrors.push(`Invalid scores: ${categoriesWithInvalidScores.join(', ')}`);
            if (missingTopLevelFields.length > 0) validationErrors.push(`Missing top-level fields: ${missingTopLevelFields.join('; ')}`);

             if (categoriesWithInvalidScores.length > 0 || missingTopLevelFields.length > 0) {
                 console.error("Gemini response validation failed:", validationErrors.join('; '));
                 console.error("Problematic JSON received:", JSON.stringify(analysisResult, null, 2));
                throw new Error(`Analysis validation failed: ${validationErrors.join('; ')}`);
             }
             if (missingCategories.length > 0) {
                console.warn(`Warning: Gemini response missing categories: ${missingCategories.join(', ')}. These will be scored as 0.`);
             }

            analysisResult.overall_score = calculateOverallScore(analysisResult);

            console.log("Gemini analysis parsed, validated, and overall score calculated successfully.");
            return analysisResult;

        } catch (parseError) {
            console.error("Failed to parse Gemini JSON response:", parseError);
            console.error("Raw response that failed parsing:\n", responseText);
            throw new Error(`Could not parse LLM JSON response: ${parseError.message}`);
        }
    } catch (error) {
        console.error("Error interacting with Gemini API:", error);
        throw new Error(`LLM analysis failed: ${error.message}`);
    }
}


async function callGeminiWithRetry(prompt, maxRetries = 2) {
    let retries = 0;
    while (retries <= maxRetries) {
        try {
            const result = await geminiModel.generateContent(prompt);
            if (!result.response) {
                throw new Error("API returned no response object.");
            }
             const candidate = result.response.candidates?.[0];
            if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
                 console.warn(`Gemini response finishReason: ${candidate.finishReason}. Safety ratings: ${JSON.stringify(candidate.safetyRatings)}`);
            }
             if (!result.response.text) {
                if (candidate?.content?.parts?.[0]?.text) {
                     console.warn("Using text from candidate content parts as response.text() was empty.");
                     return candidate.content.parts[0].text;
                }
                 throw new Error("API response text is empty or undefined.");
            }
            return result.response.text();
        } catch (error) {
            retries++;
            console.error(`Gemini API call failed (attempt ${retries}/${maxRetries+1}):`, error.message || error);
            if (retries > maxRetries) {
                throw new Error(`Failed to get valid Gemini analysis after ${maxRetries + 1} attempts: ${error.message}`);
            }
            const delay = 1500 * Math.pow(2, retries - 1);
            console.log(`Retrying Gemini API call in ${delay / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
     throw new Error(`Gemini analysis failed after all retries.`);
}


function calculateOverallScore(analysisResult) {
    // --- Weights corrected to sum to 1.0 ---
    const weights = {
        "Problem Statement": 0.10,       // 10%
        "Solution/Product": 0.15,        // 15%
        "Market Opportunity": 0.20,      // 20%
        "Business Model": 0.15,          // 15%
        "Competitive Landscape": 0.10,   // 10%
        "Team": 0.10,                    // 10% (Adjusted from 0.15)
        "Traction/Milestones": 0.10,     // 10%
        "Financial Projections": 0.05,   // 5% (Adjusted from 0.10)
        "Clarity and Presentation": 0.05 // 5%
        // --- TOTAL: 1.00 (100%) ---
    };

    let totalScore = 0;
    let totalWeightUsed = 0;
    const categoryScoresForDebug = {};

    for (const category in weights) {
        const categoryData = analysisResult[category];
        const weight = weights[category];

        if (categoryData && typeof categoryData.score === 'number' && categoryData.score >= 0 && categoryData.score <= 10) {
             const score = categoryData.score;
             totalScore += score * weight;
            categoryScoresForDebug[category] = score;
        } else {
            console.warn(`Category '${category}' missing or score invalid (${categoryData?.score}), using score 0 for calculation.`);
             totalScore += 0 * weight;
            categoryScoresForDebug[category] = 0;
        }
         totalWeightUsed += weight;
     }

     if (Math.abs(totalWeightUsed - 1.0) > 0.001) {
         console.warn(`Corrected weights logic error: Total weight used (${totalWeightUsed.toFixed(2)}) is not 1.0. Re-check weights definition.`);
         if (totalWeightUsed === 0) return 0; // Avoid division by zero if all weights somehow became 0
     }

     const effectiveTotalWeight = 1.0; // We now assume weights are correctly defined to sum to 1.0

    const overall = Math.round((totalScore / effectiveTotalWeight) * 10); // Scale to 0-100

    console.log("Score Calculation Details:", JSON.stringify(categoryScoresForDebug), `WeightedSum: ${totalScore.toFixed(2)}`, `TotalWeight: ${effectiveTotalWeight.toFixed(2)}`, `Final Score: ${overall}`);

     return Math.max(0, Math.min(100, overall)); // Clamp score between 0 and 100
}


function prepareReportData(analysisResult, originalFileName, analysisId) {
     let startupName = "Startup";
    if (originalFileName) {
        try {
             startupName = path.basename(originalFileName, path.extname(originalFileName))
                              .replace(/[^a-zA-Z0-9\-_ ]/g, '')
                              .replace(/ /g, '_')
                              .substring(0, 50);
            if (!startupName) startupName = `Analysis_${analysisId}`;
        } catch (e) {
             console.warn("Could not derive startup name from filename:", e);
             startupName = `Analysis_${analysisId}`;
         }
     } else {
        startupName = `Analysis_${analysisId}`;
     }

     const today = new Date();
     const dateStr = format(today, 'ddMMyyyy');

     return {
        reportData: analysisResult,
        filename: `Investment_Thesis_${startupName}_${dateStr}.pdf`
    };
}


async function saveAnalysisToDB(s3Key, analysisResult, userId = null, originalFilename = null) {
    // Calculate initial score (will be 0 if analysisResult is empty)
    const overallScore = Object.keys(analysisResult).length > 0 ? calculateOverallScore(analysisResult) : 0;
    const recommendation = analysisResult?.recommendation || null;
    const confidence = analysisResult?.confidence_score || null;

    const query = `
        INSERT INTO analysis_results
        (s3_key, user_id, original_filename, analysis_data, overall_score, recommendation, confidence_score, processing_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id;
    `;
    const values = [
        s3Key, userId, originalFilename,
        analysisResult || {}, // Store empty object if not provided yet
        overallScore, recommendation, confidence, 'PENDING' // Start as pending
    ];
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(query, values);
        console.log(`Initial analysis record saved to DB with ID: ${result.rows[0].id}`);
        return result.rows[0].id;
    } catch (error) {
        console.error("Error saving initial analysis record to DB:", error.stack);
        throw new Error("Failed to create analysis record in DB.");
    } finally {
        if (client) client.release();
    }
}

async function updateAnalysisResultInDB(analysisId, analysisResult) {
     const overallScore = calculateOverallScore(analysisResult);
    const recommendation = analysisResult?.recommendation || null;
    const confidence = analysisResult?.confidence_score || null;

    const query = `
        UPDATE analysis_results SET
            analysis_data = $1,
            overall_score = $2,
            recommendation = $3,
            confidence_score = $4,
            updated_at = NOW()
            -- Status is updated separately by updateAnalysisStatus
        WHERE id = $5;
    `;
    const values = [
        analysisResult, overallScore, recommendation, confidence, analysisId
    ];

    let client;
    try {
        client = await pool.connect();
        const result = await client.query(query, values);
        if (result.rowCount === 0) {
            console.warn(`Attempted to update analysis data for non-existent ID: ${analysisId}`);
        } else {
             console.log(`Successfully updated analysis data in DB for ID: ${analysisId}`);
         }
    } catch (error) {
        console.error(`Error updating analysis data in DB for ID ${analysisId}:`, error.stack);
         throw new Error("Failed to update analysis details in database.");
    } finally {
        if (client) client.release();
    }
}


async function updatePdfKeyAndComplete(analysisId, pdfS3Key) {
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
            console.log(`Updated PDF S3 Key and marked COMPLETED in DB for analysis ID: ${analysisId}`);
            return true;
        } else {
            console.warn(`Analysis ID ${analysisId} not found for PDF key/completion update.`);
            return false;
        }
    } catch (error) {
        console.error(`Error updating PDF Key/completion for ID ${analysisId}:`, error.stack);
        throw new Error("Failed to finalize PDF location in database.");
    } finally {
        if (client) client.release();
    }
}

async function updateAnalysisStatus(analysisId, status, failureReason = null) {
    const query = `
        UPDATE analysis_results
        SET processing_status = $1,
            failure_reason = $2, -- Attempt to update, relies on column existing
            updated_at = NOW()
        WHERE id = $3;
    `;
     const reasonToStore = (status === 'FAILED' && failureReason) ? failureReason.substring(0, 500) : null;
    const values = [status, reasonToStore, analysisId];
    let client;
    try {
        client = await pool.connect();
        await client.query(query, values);
        // Log success only if the query succeeds
        console.log(`Updated status for Analysis ID ${analysisId} to ${status}` + (reasonToStore ? ` (Reason recorded)` : ''));
    } catch (error) {
         // Log the specific error if the update fails (e.g., column missing)
        console.error(`Error updating status for Analysis ID ${analysisId} to ${status}:`, error.message);
         // Do not throw here unless status update is absolutely critical to halt the process
    } finally {
        if (client) client.release();
    }
}


async function updateEmailStatus(analysisId, status, failureReason = null) {
    const query = `
        UPDATE analysis_results
        SET email_status = $1,
            email_failure_reason = $2, -- Assumes this column exists too
            updated_at = NOW()
        WHERE id = $3;
    `;
     const reasonToStore = (status === 'FAILED' && failureReason) ? failureReason.substring(0, 255) : null;
    const values = [status, reasonToStore, analysisId];
    let client;
    try {
        client = await pool.connect();
        await client.query(query, values);
        console.log(`Updated email status for Analysis ID ${analysisId} to ${status}`);
        return true;
    } catch (error) {
        // If this fails, assume the column email_failure_reason might also be missing
        console.error(`Error updating email status for Analysis ID ${analysisId} to ${status}:`, error.message);
        console.error(`Please ensure 'email_status' (VARCHAR) and 'email_failure_reason' (VARCHAR) columns exist in 'analysis_results'.`);
        return false; // Indicate failure
    } finally {
        if (client) client.release();
    }
}


async function generateInvestmentThesisPDF(analysisData, analysisId, originalFileName) {
     return new Promise((resolve, reject) => {
         let pdfTempPath = null;
         try {
             const reportDetails = prepareReportData(analysisData, originalFileName, analysisId);
             const pdfFilename = reportDetails.filename;
            pdfTempPath = path.join(tempReportsDir, pdfFilename);

             if (!fs.existsSync(tempReportsDir)) {
                 fs.mkdirSync(tempReportsDir, { recursive: true });
             }
             console.log(`Generating PDF for analysis ID: ${analysisId} at path: ${pdfTempPath}`);

             const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 60, right: 60 }, bufferPages: true });
             const writeStream = fs.createWriteStream(pdfTempPath);

             doc.pipe(writeStream);

             writeStream.on('error', (err) => {
                 console.error(`Error writing PDF stream for ${analysisId}:`, err);
                 try { doc.end(); } catch (e) {}
                 if (pdfTempPath && fs.existsSync(pdfTempPath)) {
                     try { fs.unlinkSync(pdfTempPath); } catch (unlinkErr) { console.error("Error cleaning up partial PDF:", unlinkErr); }
                 }
                 reject(new Error(`Failed to write PDF stream: ${err.message}`));
             });

             writeStream.on('finish', () => {
                 console.log(`PDF stream finished for ${analysisId}. File should be complete: ${pdfTempPath}`);
                 if (!fs.existsSync(pdfTempPath) || fs.statSync(pdfTempPath).size === 0) {
                      reject(new Error(`PDF file writing finished, but file is missing or empty: ${pdfTempPath}`));
                 } else {
                      resolve({ localPath: pdfTempPath, reportFilename: pdfFilename });
                 }
             });


            const H1 = 14, H2 = 12, P = 10, Font = 'Helvetica', FontBold = 'Helvetica-Bold', FontItalic = 'Helvetica-Oblique';
             const lineGap = 3;
             const paragraphGap = 6;
             const sectionGap = 1;

             const addH1 = (txt) => doc.font(FontBold).fontSize(H1).text(txt, { paragraphGap }).moveDown(sectionGap * 0.5);
             const addH2 = (txt, options={}) => doc.font(FontBold).fontSize(H2).text(txt, { paragraphGap: paragraphGap * 0.8, underline: options.underline || false }).moveDown(sectionGap * 0.3);
             const addSubHeading = (txt) => doc.font(FontBold).fontSize(P).text(txt, { paragraphGap: lineGap, continued: false }).moveDown(0);
             const addP = (txt, options={}) => doc.font(Font).fontSize(P).text(txt || 'N/A', { paragraphGap, align: options.align || 'justify', indent: options.indent || 0, oblique: options.oblique || false }).moveDown(sectionGap * 0.5);
             const addBullet = (txt) => addP(`•  ${txt || 'N/A'}`, { indent: 15, paragraphGap: lineGap * 1.5 });


             const startupName = reportDetails.filename.split('_')[2] || 'Startup';
             const analysisDateStr = format(new Date(analysisData.processing_date || Date.now()), 'MMMM dd, yyyy HH:mm:ss \'UTC\'');
             const overallScore = calculateOverallScore(analysisData);

             addH1("Investment Thesis Summary");
             addP(`Startup Reference: ${startupName}`, { paragraphGap: lineGap });
             addP(`Analysis Date: ${analysisDateStr}`, { paragraphGap: lineGap });
             doc.moveDown(0.5)
             addSubHeading("Overall Recommendation:");
             addP(analysisData?.recommendation || "Not Available", { indent: 20 });
             addSubHeading("Calculated Overall Score:");
             addP(`${overallScore} / 100`, { indent: 20 });
              addSubHeading("AI Confidence Score:");
              addP(`${analysisData?.confidence_score ?? 'N/A'} / 100`, { indent: 20 });
              addP("Note: Confidence reflects AI certainty based on text completeness/coherence, not investment success.", { indent: 20, oblique: true, paragraphGap: paragraphGap *1.5});


             addH1("Category Analysis");
             const categoryOrder = [
                 "Problem Statement", "Solution/Product", "Market Opportunity", "Business Model",
                 "Competitive Landscape", "Team", "Traction/Milestones",
                 "Financial Projections", "Clarity and Presentation"
             ];
            // Use corrected weights from calculateOverallScore function
             const categoryWeights = {
                "Problem Statement": 0.10, "Solution/Product": 0.15, "Market Opportunity": 0.20,
                "Business Model": 0.15, "Competitive Landscape": 0.10, "Team": 0.10,
                "Traction/Milestones": 0.10, "Financial Projections": 0.05, "Clarity and Presentation": 0.05
            };

             for (const category of categoryOrder) {
                 const catData = analysisData[category];
                 const weight = categoryWeights[category] * 100; // Display as percentage
                 addH2(`${category} (${weight.toFixed(0)}%)`);
                 if (catData) {
                     addSubHeading("Score:");
                     addP(`${catData.score ?? 'N/A'} / 10`, { indent: 20, paragraphGap: lineGap });
                     addSubHeading("Feedback:");
                     addP(catData.qualitative_feedback || "No specific feedback provided.", { indent: 20 });
                 } else {
                     addP("Analysis data missing for this category.", { indent: 20, oblique: true });
                 }
                 doc.moveDown(sectionGap * 0.7);
             }

             addH1("Overall Strengths & Weaknesses");
             addSubHeading("Identified Strengths:");
             if (Array.isArray(analysisData?.overall_strengths) && analysisData.overall_strengths.length > 0) {
                 analysisData.overall_strengths.forEach(s => addBullet(s));
             } else {
                 addBullet("None explicitly identified in the analysis.");
             }
             doc.moveDown(0.5);

             addSubHeading("Identified Weaknesses / Gaps:");
             if (Array.isArray(analysisData?.overall_weaknesses) && analysisData.overall_weaknesses.length > 0) {
                 analysisData.overall_weaknesses.forEach(w => addBullet(w));
             } else {
                 addBullet("None explicitly identified in the analysis.");
             }
             doc.moveDown(1);

             addH1("Recommendations for Investor Due Diligence");
             addP(analysisData?.recommendations_for_investor || "No specific recommendations provided beyond the category feedback.");
             doc.moveDown(1);

             const range = doc.bufferedPageRange();
             for (let i = range.start; i <= range.start + range.count - 1; i++) {
                 doc.switchToPage(i);
                 doc.font(FontItalic).fontSize(9)
                    .text(`Page ${i + 1} of ${range.count}`,
                          doc.page.margins.left,
                          doc.page.height - doc.page.margins.bottom + 10,
                          { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
                     );
             }

             doc.end();

         } catch (error) {
             console.error(`Fatal error during PDF generation setup for ${analysisId}:`, error);
              if (pdfTempPath && fs.existsSync(pdfTempPath)) {
                 try { fs.unlinkSync(pdfTempPath); } catch (unlinkErr) { console.error("Error cleaning up partial PDF after setup error:", unlinkErr); }
             }
             reject(error);
         }
     });
}


// Create a Gmail SMTP transporter without OAuth2
function createGmailTransporter() {
  try {
    console.log("Setting up Gmail transporter with direct SMTP");
    
    // Create transporter with direct SMTP authentication
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // TLS
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD // Using app password instead of OAuth
      },
      tls: {
        rejectUnauthorized: false // Helps with certain connection issues
      },
      debug: true // Enable for detailed logs
    });
    
    return transporter;
  } catch (error) {
    console.error("Error creating Gmail transporter:", error);
    throw new Error(`Gmail configuration failed: ${error.message}`);
  }
}


async function sendCompletionEmail(recipientEmail, analysisId, deckOriginalFilename, pdfS3Key) {
    // Check essential Gmail API config first
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.warn("Gmail API config missing, skipping email notification.");
        await updateEmailStatus(analysisId, 'FAILED', 'Gmail API configuration missing in server');
        return false;
    }
    
    // Then check for recipient and key needed for the email content
    if (!recipientEmail) {
        console.warn(`No recipient email found for analysis ${analysisId}, cannot send email.`);
        await updateEmailStatus(analysisId, 'FAILED', 'Recipient email address missing');
        return false;
    }
    
    if (!pdfS3Key) {
        console.warn(`PDF S3 Key missing for analysis ${analysisId}, cannot generate download link for email.`);
        await updateEmailStatus(analysisId, 'FAILED', 'PDF S3 Key missing');
        return false;
    }

    let downloadUrl = '#';
    try {
        const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: pdfS3Key });
        downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // Expires in 1 hour
        console.log(`Generated pre-signed S3 URL for ${pdfS3Key} (expires in 1 hour)`);
    } catch (urlError) {
        console.error(`Failed to generate pre-signed URL for ${pdfS3Key}:`, urlError);
        await updateEmailStatus(analysisId, 'FAILED', `Failed to generate report download link: ${urlError.message}`);
        return false;
    }

    const safeFilename = (deckOriginalFilename || `analysis_${analysisId}`).replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const subject = `Pitch Deck Analysis Ready - ${deckOriginalFilename}`;
    const bodyText = `Analysis for your pitch deck "${deckOriginalFilename || 'N/A'}" (Analysis ID: ${analysisId}) is complete.\n\nDownload the PDF report using this secure link (expires in 1 hour):\n${downloadUrl}\n\nIf the link expires, please request a new one through your dashboard.\n\nThank you for using InvestAnalyzer!`;
    const bodyHtml = `
        <p>Hello,</p>
        <p>The analysis for your pitch deck "<strong>${deckOriginalFilename || '<em>N/A</em>'}</strong>" (Analysis ID: ${analysisId}) is complete.</p>
        <p>You can download the PDF report using the secure link below. Please note, this link will expire in <strong>1 hour</strong>.</p>
        <p style="text-align: center; margin: 20px 0;">
            <a href="${downloadUrl}" style="display: inline-block; padding: 12px 25px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Download Analysis Report (PDF)</a>
        </p>
        <p>If you have trouble clicking the button, copy and paste this URL into your browser:</p>
        <p><a href="${downloadUrl}">${downloadUrl}</a></p>
        <p>If the link has expired, you can usually regenerate it from your analysis history dashboard.</p>
        <p>Thank you for using InvestAnalyzer!</p>
        <p><small><em>InvestAnalyzer Team</em></small></p>`;

    await updateEmailStatus(analysisId, 'SENDING'); // Mark as sending before attempt
    
    try {
        // Create transporter with Gmail SMTP authentication
        const transporter = createGmailTransporter();
        
        // Set up email options
        const mailOptions = {
            from: `InvestAnalyzer <${process.env.GMAIL_USER}>`,
            to: recipientEmail,
            subject: subject,
            text: bodyText,
            html: bodyHtml
        };
        
        // Send the email
        const info = await transporter.sendMail(mailOptions);
        console.log(`Completion email sent to ${recipientEmail} via Gmail SMTP for Analysis ID: ${analysisId}. Message ID: ${info.messageId}`);
        await updateEmailStatus(analysisId, 'SENT');
        return true;
    } catch (error) {
        console.error(`Gmail SMTP failed to send email to ${recipientEmail} for Analysis ID ${analysisId}:`, error);
        const errorMessage = error.message || 'Unknown Gmail SMTP error';
        await updateEmailStatus(analysisId, 'FAILED', `Gmail SMTP Error: ${errorMessage}`);
        return false;
    }
}

app.use('/api/auth', authRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
    res.send('InvestAnalyzer Backend API is running.');
});

app.post('/api/analysis/upload', authMiddleware, uploadLimiter, (req, res) => {

    upload(req, res, async function (uploadError) {
        if (uploadError) {
            console.error('Multer upload error:', uploadError.message);
            let statusCode = 400;
             if (uploadError.code === 'LIMIT_FILE_SIZE') { statusCode = 413; }
            return res.status(statusCode).json({ message: `Upload failed: ${uploadError.message}` });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded. Please attach a .ppt or .pptx file.' });
        }
        if (!req.user || !req.user.userId || !req.user.email) {
             console.error("Critical: User info missing in authenticated route /api/analysis/upload");
             if (req.file && fs.existsSync(req.file.path)) { try { fs.unlinkSync(req.file.path); } catch (e) { console.error("Failed to cleanup upload on auth error:", e)} }
             return res.status(401).json({ message: 'Authentication error: User details not found.' });
         }

        const userId = req.user.userId;
        const userEmail = req.user.email;
        const originalFileName = req.file.originalname;
        const localFilePath = req.file.path;
        const s3KeyDeck = req.file.filename;
        let analysisId = null;
        let analysisResult = null;
        let pdfS3Key = null;
        let pdfLocalPath = null;
        let currentStage = "Initiating";

        try {
             currentStage = "Database Initialization";
             analysisId = await saveAnalysisToDB(s3KeyDeck, {}, userId, originalFileName);

             currentStage = "Deck Upload to S3";
             await updateAnalysisStatus(analysisId, 'UPLOADING_DECK');
             await uploadToS3(localFilePath, s3KeyDeck, req.file.mimetype);
             console.log(`Deck ${s3KeyDeck} uploaded for analysis ${analysisId}. Deleting local temp file.`);
             try { fs.unlinkSync(localFilePath); } catch (e) { console.warn(`Non-critical: Failed to delete local temp upload ${localFilePath}:`, e); }

             currentStage = "Text Extraction";
             await updateAnalysisStatus(analysisId, 'EXTRACTING_TEXT');
             const extractedTextData = await runTextExtraction(s3KeyDeck);
            if (!Array.isArray(extractedTextData) || extractedTextData.length === 0) {
                 throw new Error("Text extraction yielded no slides or invalid data.");
            }
             const slideCount = extractedTextData.length;
             console.log(`Extracted text from ${slideCount} slides for analysis ${analysisId}.`);
              if (slideCount < 3 || slideCount > 30) {
                console.warn(`Analysis ${analysisId}: Slide count (${slideCount}) outside recommended range (3-30).`);
              }


             currentStage = "AI Analysis";
             await updateAnalysisStatus(analysisId, 'ANALYZING_AI');
             analysisResult = await analyzeWithGemini(extractedTextData);
             console.log(`AI analysis completed for analysis ${analysisId}. Recommendation: ${analysisResult?.recommendation}`);


             currentStage = "Saving Analysis Results";
             await updateAnalysisStatus(analysisId, 'SAVING_ANALYSIS');
             await updateAnalysisResultInDB(analysisId, analysisResult);


             currentStage = "PDF Generation";
             await updateAnalysisStatus(analysisId, 'GENERATING_PDF');
             const { localPath, reportFilename } = await generateInvestmentThesisPDF(analysisResult, analysisId, originalFileName);
            pdfLocalPath = localPath;
             pdfS3Key = `reports/${reportFilename}`;
             console.log(`PDF report generated locally for analysis ${analysisId}: ${pdfLocalPath}`);


             currentStage = "PDF Upload to S3";
             await updateAnalysisStatus(analysisId, 'UPLOADING_PDF');
             await uploadToS3(pdfLocalPath, pdfS3Key, 'application/pdf');
             console.log(`PDF report ${pdfS3Key} uploaded for analysis ${analysisId}. Deleting local temp report.`);
             try { if (pdfLocalPath && fs.existsSync(pdfLocalPath)) fs.unlinkSync(pdfLocalPath); pdfLocalPath = null; } catch (e) { console.warn(`Non-critical: Failed to delete local temp report ${pdfLocalPath}:`, e); }


             currentStage = "Finalizing Database Record";
             await updatePdfKeyAndComplete(analysisId, pdfS3Key); // Sets status to COMPLETED


             currentStage = "Email Notification";
             await sendCompletionEmail(userEmail, analysisId, originalFileName, pdfS3Key);


             console.log(`Analysis process fully completed for ID: ${analysisId}`);
             res.status(200).json({
                 message: "Analysis complete. Report generated and notification potentially sent.", // Updated msg
                 analysisId: analysisId,
                 s3KeyDeck: s3KeyDeck,
                 pdfReportKey: pdfS3Key,
                 recommendation: analysisResult?.recommendation || "N/A",
                 overallScore: analysisResult?.overall_score ?? 'N/A'
             });

         } catch (error) {
            console.error(`PROCESSING FAILED [Analysis ID: ${analysisId || 'N/A'}, User: ${userId}] at Stage [${currentStage}]:`, error);
             const clientErrorMessage = `Processing failed during '${currentStage}'. Please check server logs for details. Error: ${error.message}`; // Give slightly more info


             if (analysisId) {
                 // Pass error message for potential logging if DB column exists
                 await updateAnalysisStatus(analysisId, 'FAILED', error.message);
             }

             if (localFilePath && fs.existsSync(localFilePath)) {
                 try { fs.unlinkSync(localFilePath); console.log("Cleaned up temp upload file after error."); } catch (e) { console.error("Error cleaning up temp upload file:", e)}
             }
             if (pdfLocalPath && fs.existsSync(pdfLocalPath)) {
                  try { fs.unlinkSync(pdfLocalPath); console.log("Cleaned up temp report file after error."); } catch (e) { console.error("Error cleaning up temp report file:", e)}
             }

             res.status(500).json({
                message: clientErrorMessage,
                analysisId: analysisId,
                stageFailed: currentStage
            });
        }
    });
});

app.post('/api/analysis/validate-slides', authMiddleware, (req, res) => {
  upload(req, res, async function(uploadError) {
    if (uploadError) {
      console.error('Validation upload error:', uploadError.message);
      let statusCode = 400;
      if (uploadError.code === 'LIMIT_FILE_SIZE') {
        statusCode = 413;
      }
      return res.status(statusCode).json({ 
        error: true, 
        message: `Upload failed: ${uploadError.message}` 
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        error: true, 
        message: 'No file uploaded. Please attach a .ppt or .pptx file.' 
      });
    }

    const localFilePath = req.file.path;
    console.log(`Validating slide count for ${req.file.originalname} at ${localFilePath}`);

    try {
      // Execute Python script to count slides only
      const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python';
      console.log(`Executing Python extract_text.py for file: ${localFilePath} (count only: true)`);
      
      const pythonProcess = spawn(pythonExecutable, ['extract_text.py', localFilePath, 'count_only'], { cwd: __dirname });
      
      let scriptOutput = "";
      let scriptError = "";
      
      pythonProcess.stdout.on('data', (data) => {
        scriptOutput += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        scriptError += data.toString();
        // We'll still log stderr, as it might contain debugging info
        console.log("Python stderr:", scriptError);
      });

      pythonProcess.on('close', async (code) => {
        console.log(`Python process exited with code ${code}`);
        
        // Clean up the uploaded file regardless of outcome
        try {
          if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
          }
        } catch (cleanupErr) {
          console.warn(`Non-critical: Failed to delete temp file ${localFilePath}:`, cleanupErr);
        }
        
        if (code === 0) {
          try {
            // Parse the JSON output from Python
            const result = JSON.parse(scriptOutput);
            
            if (result.error) {
              return res.status(400).json({ 
                error: true, 
                message: `Slide validation failed: ${result.error}` 
              });
            }
            
            if (!result.data || typeof result.data.slideCount !== 'number') {
              return res.status(400).json({ 
                error: true, 
                message: 'Invalid response format from slide validation'
              });
            }
            
            const slideCount = result.data.slideCount;
            console.log(`Slide count for ${req.file.originalname}: ${slideCount}`);
            
            // Return success response
            return res.status(200).json({
              error: false,
              slideCount: slideCount,
              message: `Slide validation complete. File has ${slideCount} slides.`
            });
          } catch (e) {
            console.error("Failed to parse Python script output:", e, "\nOutput was:", scriptOutput);
            return res.status(500).json({ 
              error: true, 
              message: `Failed to parse validation result: ${e.message}`
            });
          }
        } else {
          console.error(`Python script failed with code ${code}. Stderr: ${scriptError}`);
          return res.status(500).json({ 
            error: true, 
            message: 'Failed to validate slides. Python script error.'
          });
        }
      });
      
      pythonProcess.on('error', (error) => {
        console.error(`Failed to start Python process: ${error.message}`);
        // Clean up the uploaded file
        try {
          if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
          }
        } catch (cleanupErr) {
          console.warn(`Non-critical: Failed to delete temp file ${localFilePath}:`, cleanupErr);
        }
        
        return res.status(500).json({ 
          error: true, 
          message: `Failed to start slide validation process: ${error.message}` 
        });
      });
      
    } catch (error) {
      console.error(`Slide validation failed:`, error);
      // Clean up the uploaded file
      try {
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
        }
      } catch (cleanupErr) {
        console.warn(`Non-critical: Failed to delete temp file ${localFilePath}:`, cleanupErr);
      }
      
      return res.status(500).json({ 
        error: true, 
        message: `Server error during slide validation: ${error.message}` 
      });
    }
  });
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: Closing HTTP server and DB pool.');
  app.close(() => { // Assuming 'app' is the server instance returned by app.listen() if needed
      console.log('HTTP server closed.');
      pool.end(() => {
        console.log('Database pool closed.');
        process.exit(0);
      });
  });

  setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit.');
    process.exit(1);
   }, 5000);
});