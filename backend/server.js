// ---------------------- Imports ----------------------
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
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------------------- Sentiment Analysis Function ----------------------
async function getSentiment(feedbackText) {
  try {
    const prompt = `
      You are a sentiment analysis assistant.
      Analyze the feedback below and respond with only ONE WORD:
      "positive", "negative", or "neutral".
      Feedback: "${feedbackText}"
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const sentiment = result.response.text().trim().toLowerCase();

    if (sentiment.includes("positive")) return "positive";
    if (sentiment.includes("negative")) return "negative";
    if (sentiment.includes("neutral")) return "neutral";
    console.warn("Unexpected sentiment response from Gemini:", sentiment);
    return "unknown";
  } catch (error) {
    console.error("Gemini API Error:", error.message);
    return "unknown";
  }
}

// ---------------------- POST: Save Feedback ----------------------
app.post("/api/saveFeedback", async (req, res) => {
  const { studentEmail, course, teacher, feedback } = req.body;

  if (!studentEmail || !course || !teacher || !feedback) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    // 1️⃣ Analyze sentiment using Gemini
    const sentiment = await getSentiment(feedback);

    // 2️⃣ Save to SQL database
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

// ---------------------- GET: Fetch Feedback ----------------------
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

// ---------------------- Start Server ----------------------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
