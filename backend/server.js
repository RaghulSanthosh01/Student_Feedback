import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import sql from "mssql";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

// ---------------------- Middleware ----------------------
app.use(bodyParser.json());

// ---------------------- CORS ----------------------
const frontendUrl = "https://green-hill-0857a6400.1.azurestaticapps.net"; 
app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);

// ---------------------- SQL Server config ----------------------
const config = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  options: { 
    encrypt: true, 
    trustServerCertificate: true 
  },
};

// ---------------------- Gemini Client ----------------------
if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY is not set.");
}
const genAI = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY}); 

// ---------------------- Sentiment Analysis Function (FIXED with JSON Mode) ----------------------
const MAX_RETRIES = 3;
const DELAY_MS = 1000;

async function getSentiment(feedbackText) {
    const textLower = feedbackText.toLowerCase();

    // --- START: EXPANDED KEYWORD OVERRIDE ---
    
    const positiveKeywords = ['good', 'great', 'excellent', 'amazing', 'fantastic', 'love', 'helpful', 'best'];
    const negativeKeywords = ['bad', 'poor', 'terrible', 'awful', 'hate', 'disappointing', 'worst'];
    
    // Check for positive keywords
    for (const keyword of positiveKeywords) {
        if (textLower.includes(keyword)) {
            return 'positive';
        }
    }
    
    // Check for negative keywords
    for (const keyword of negativeKeywords) {
        if (textLower.includes(keyword)) {
            return 'negative';
        }
    }
    
    // --- END: EXPANDED KEYWORD OVERRIDE ---

    // --- FALLBACK: GEMINI AI ANALYSIS ---

    // Model usage is slightly different with the new SDK, using ai.models
    const model = genAI.models.getGenerativeModel({ model: "gemini-1.5-flash" }); 
    
    // Use JSON mode to force a predictable, structured response
    const generationConfig = {
        responseMimeType: "application/json",
        responseSchema: {
            type: "OBJECT",
            properties: {
                sentiment: {
                    type: "STRING",
                    description: "The sentiment of the feedback, must be 'positive', 'negative', or 'neutral'."
                }
            },
            required: ["sentiment"]
        }
    };
    
    const prompt = `
        Analyze the following student feedback and determine its core sentiment.
        Feedback: "${feedbackText}"
    `;

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: generationConfig,
            });

            const jsonResponseText = result.text.trim();
            const parsedJson = JSON.parse(jsonResponseText);
            
            // Check if the sentiment is one of the allowed values
            const sentiment = parsedJson.sentiment ? parsedJson.sentiment.toLowerCase() : 'unknown';
            if (['positive', 'negative', 'neutral'].includes(sentiment)) {
                return sentiment;
            }
            
            console.warn("Gemini returned invalid structured sentiment:", sentiment);
            return 'unknown';

        } catch (error) {
            console.error(`Attempt ${i + 1} failed. Gemini API Error or JSON Parse Error:`, error.message);
            if (i < MAX_RETRIES - 1) {
                // Exponential backoff
                const delay = DELAY_MS * Math.pow(2, i);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                return "unknown"; 
            }
        }
    }
    return "unknown"; 
}

// ---------------------- POST: Save Feedback (Data Submission Endpoint) ----------------------
app.post("/api/saveFeedback", async (req, res) => {
  const { studentEmail, course, teacher, feedback } = req.body;

  if (!studentEmail || !course || !teacher || !feedback) {
    return res.status(400).json({ message: "Missing required fields in request body" });
  }

  let pool;
  try {
    // 1. Analyze sentiment (now includes keyword override)
    const sentiment = await getSentiment(feedback);

    // 2. Connect to SQL database
    pool = await sql.connect(config);
    
    // 3. Save to SQL database 
    await pool.request()
      .input("StudentEmail", sql.NVarChar, studentEmail)
      .input("Course", sql.NVarChar, course)
      .input("Teacher", sql.NVarChar, teacher)
      .input("FeedbackText", sql.NVarChar, feedback)
      .input("Sentiment", sql.NVarChar, sentiment)
      .query(`
        INSERT INTO Feedback (StudentEmail, Course, Teacher, FeedbackText, Sentiment, SubmittedAt)
        VALUES (@StudentEmail, @Course, @Teacher, @FeedbackText, @Sentiment, GETDATE())
      `);
    
    pool.close();

    res.status(201).json({ message: "Feedback saved successfully", sentiment });
  } catch (err) {
    console.error("Database or Server Error saving feedback:", err);
    if (pool) pool.close(); 
    res.status(500).json({ message: "Error saving feedback. Check server logs." });
  }
});

// ---------------------- GET: Fetch Feedback (Admin Dashboard Endpoint) ----------------------
app.get("/api/getFeedback", async (req, res) => {
    let pool;
  try {
    pool = await sql.connect(config);
    
    const result = await pool.request().query(
      `
        SELECT 
            Course, 
            Teacher, 
            FeedbackText, 
            Sentiment, 
            SubmittedAt 
        FROM Feedback 
        ORDER BY SubmittedAt DESC
      `
    );
    pool.close();
    
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("Error fetching feedback:", err);
    if (pool) pool.close();
    res.status(500).json({ message: "Error fetching feedback" });
  }
});

// ---------------------- Start Server ----------------------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});