// server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import sql from "mssql";
import dotenv from "dotenv";
// ✅ Correction: Import the specific class
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
  options: { encrypt: true },
};

// ---------------------- Gemini Client ----------------------
// ✅ Correction: Initialize the client directly using the imported class
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ---------------------- Sentiment Analysis Function ----------------------
async function getSentiment(feedbackText) {
  try {
    const prompt = `
      You are a sentiment analysis assistant.
      Analyze the feedback below and respond with only ONE WORD:
      "positive", "negative", or "neutral".
      Feedback: "${feedbackText}"
    `;

    // 🛑 CORRECTION APPLIED HERE:
    // The generateContent method is called directly on the genAI instance.
    const result = await genAI.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt, // Pass the prompt string directly
    });

    const sentiment = result.text.trim().toLowerCase(); // Use .text for the main response

    // Check if the response contains one of the keywords
    if (sentiment.includes("positive")) return "positive";
    if (sentiment.includes("negative")) return "negative";
    if (sentiment.includes("neutral")) return "neutral";
    
    // Fallback if the model gives an unexpected response
    console.warn("Unexpected sentiment response from Gemini:", sentiment);
    return "unknown"; 
    
  } catch (error) {
    // ⚠️ Check this error! It often means a missing or invalid GEMINI_API_KEY
    console.error("Gemini API Error:", error.message);
    return "unknown";
  }
}

// ---------------------- POST: Save feedback ----------------------
app.post("/api/saveFeedback", async (req, res) => {
  const { studentEmail, course, teacher, feedback } = req.body;
  if (!studentEmail || !course || !teacher || !feedback) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    // 1️⃣ Get sentiment using Gemini
    const sentiment = await getSentiment(feedback);

    // 2️⃣ Save to database
    const pool = await sql.connect(config);
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

    res.status(201).json({ message: "Feedback saved successfully", sentiment });
  } catch (err) {
    console.error("Error saving feedback:", err);
    res.status(500).json({ message: "Error saving feedback" });
  }
});

// ---------------------- GET: Fetch feedback ----------------------
app.get("/api/getFeedback", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(
      "SELECT * FROM Feedback ORDER BY SubmittedAt DESC"
    );
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("Error fetching feedback:", err);
    res.status(500).json({ message: "Error fetching feedback" });
  }
});

// ---------------------- Start server ----------------------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});