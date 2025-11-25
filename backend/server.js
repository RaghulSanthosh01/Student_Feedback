import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import sql from "mssql";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();

// ---------------------- Middleware ----------------------
app.use(bodyParser.json());

// ---------------------- CORS ----------------------
// Ensure this URL matches your Azure Static Web App URL
const frontendUrl = "https://green-hill-0857a6400.1.azurestaticapps.net"; 
app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);

// ---------------------- SQL Server config ----------------------
// Reads environment variables from the .env file
const config = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  options: { 
    encrypt: true, 
    trustServerCertificate: true // Crucial for Azure SQL connections
  },
};

// ---------------------- Gemini Client ----------------------
if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY is not set.");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------------------- Sentiment Analysis Function (FIXED) ----------------------
async function getSentiment(feedbackText) {
  try {
    const prompt = `
      You are a highly restrictive sentiment analysis assistant.
      Analyze the feedback below and respond with ONLY ONE WORD, strictly from the list:
      "positive", "negative", or "neutral". Do not include any punctuation, quotes, or other words.
      Feedback: "${feedbackText}"
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    
    // 1. Get raw text
    let sentiment = result.response.text();

    // 2. CRITICAL FIX: Strip all non-alphabetic characters (e.g., quotes, periods, newlines, spaces) 
    sentiment = sentiment.trim().toLowerCase().replace(/[^a-z]/g, '');

    // 3. Match against clean keywords
    if (sentiment.includes("positive")) return "positive";
    if (sentiment.includes("negative")) return "negative";
    if (sentiment.includes("neutral")) return "neutral";
    
    console.warn("Unexpected sentiment response from Gemini (after cleaning):", sentiment);
    return "unknown"; // Returns 'unknown' if analysis fails or is ambiguous
  } catch (error) {
    console.error("Gemini API Error:", error.message);
    return "unknown";
  }
}

// ---------------------- POST: Save Feedback (Data Submission Endpoint) ----------------------
app.post("/api/saveFeedback", async (req, res) => {
  const { studentEmail, course, teacher, feedback } = req.body;

  if (!studentEmail || !course || !teacher || !feedback) {
    return res.status(400).json({ message: "Missing required fields in request body" });
  }

  let pool;
  try {
    // 1. Analyze sentiment
    const sentiment = await getSentiment(feedback);

    // 2. Connect to SQL database
    pool = await sql.connect(config);
    
    // 3. Save to SQL database using prepared inputs for security and reliability
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
    
    // 4. Close connection after successful operation
    pool.close();

    // 5. Return the determined sentiment to the frontend for confirmation message
    res.status(201).json({ message: "Feedback saved successfully", sentiment });
  } catch (err) {
    console.error("Database or Server Error saving feedback:", err);
    if (pool) pool.close(); // Ensure pool is closed even on error
    res.status(500).json({ message: "Error saving feedback. Check server logs." });
  }
});

// ---------------------- GET: Fetch Feedback (Admin Dashboard Endpoint) ----------------------
app.get("/api/getFeedback", async (req, res) => {
    let pool;
  try {
    pool = await sql.connect(config);
    
    // Selects the columns required by the admin dashboard
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