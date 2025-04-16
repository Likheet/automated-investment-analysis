const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    generationConfig: { responseMimeType: "application/json" },
});

// Function to sanitize and fix common JSON issues
function sanitizeJsonString(jsonString) {
    // If it's not a string, return it as is
    if (typeof jsonString !== 'string') return jsonString;
    
    try {
        // First check if it's already valid JSON
        JSON.parse(jsonString);
        return jsonString;
    } catch (e) {
        console.log("Attempting to sanitize malformed JSON...");
        
        // Remove any non-printable ASCII characters
        let sanitized = jsonString.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        
        // Fix issues with escaped quotes within strings
        sanitized = sanitized.replace(/(\\*")(.*?)(")/g, (match, p1, p2, p3) => {
            // If quotes are already properly escaped, leave them
            if (p1 === '\\"' && p3 === '\\"') return match;
            // Otherwise, ensure content inside quotes is properly escaped
            const escaped = p2.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            return `"${escaped}"`;
        });
        
        // Fix JSON structure issues by ensuring property names are quoted
        sanitized = sanitized.replace(/(\s*?{\s*?|\s*?,\s*?)(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '$1"$3":');
        
        // Try to parse the sanitized string
        try {
            JSON.parse(sanitized);
            console.log("JSON successfully sanitized.");
            return sanitized;
        } catch (e) {
            // If still failing, extract JSON from the response text (in case there's extra content)
            console.log("First-level sanitization failed, attempting to extract JSON...");
            const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const extractedJson = jsonMatch[0];
                    JSON.parse(extractedJson);
                    return extractedJson;
                } catch (e) {
                    console.error("Failed to extract valid JSON:", e);
                    throw new Error(`Unable to sanitize malformed JSON: ${e.message}`);
                }
            }
            console.error("No valid JSON structure found in the response");
            throw new Error(`Unable to extract valid JSON structure: ${e.message}`);
        }
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
    const weights = {
        "Problem Statement": 0.10,
        "Solution/Product": 0.15,
        "Market Opportunity": 0.20,
        "Business Model": 0.15,
        "Competitive Landscape": 0.10,
        "Team": 0.10,
        "Traction/Milestones": 0.10,
        "Financial Projections": 0.05,
        "Clarity and Presentation": 0.05
    };
    let totalScore = 0;
    let totalWeightUsed = 0;
    for (const category in weights) {
        const categoryData = analysisResult[category];
        const weight = weights[category];
        if (categoryData && typeof categoryData.score === 'number' && categoryData.score >= 0 && categoryData.score <= 10) {
            totalScore += categoryData.score * weight;
        } else {
            totalScore += 0 * weight;
        }
        totalWeightUsed += weight;
    }
    if (Math.abs(totalWeightUsed - 1.0) > 0.001) {
        if (totalWeightUsed === 0) return 0;
    }
    const effectiveTotalWeight = 1.0;
    const overall = Math.round((totalScore / effectiveTotalWeight) * 10);
    return Math.max(0, Math.min(100, overall));
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
            // Apply the JSON sanitizer before parsing
            const sanitizedResponse = sanitizeJsonString(responseText);
            let analysisResult = JSON.parse(sanitizedResponse);
            
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

module.exports = { analyzeWithGemini };
