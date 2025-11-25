import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import sql from "mssql";
import dotenv from "dotenv";

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

// --- UPDATED Sentiment Analysis Function (KEYWORD ONLY) ---
const positiveKeywords = [
    'good', 'great', 'excellent', 'amazing', 'fantastic', 
    'love', 'helpful', 'best', 'clear', 'engaging', 
    'understanding', 'explaining', 'knowledgeable', 'organized', 
    'patient', 'effective', 'inspiring', 'fun', 'enjoyable',
    'easy' // Added 'easy' for good explanation
];
const negativeKeywords = [
    'bad', 'poor', 'terrible', 'awful', 'hate', 
    'disappointing', 'worst', 'confusing', 'boring', 
    'unhelpful', 'unclear', 'difficult' // Added teaching-specific negatives
];

async function getSentiment(feedbackText) {
    const textLower = feedbackText.toLowerCase();

    // 1. Count keyword occurrences
    let negativeCount = 0;
    for (const keyword of negativeKeywords) {
        if (textLower.includes(keyword)) {
            negativeCount++;
        }
    }

    let positiveCount = 0;
    for (const keyword of positiveKeywords) {
        if (textLower.includes(keyword)) {
            positiveCount++;
        }
    }

    // 2. Determine sentiment based on counts
    if (positiveCount > 0 && negativeCount === 0) {
        console.log(`Sentiment: 'positive' via keyword matches: ${positiveCount}`);
        return 'positive';
    } 
    
    if (negativeCount > 0 && positiveCount === 0) {
        console.log(`Sentiment: 'negative' via keyword matches: ${negativeCount}`);
        return 'negative';
    } 
    
    if (positiveCount > 0 && negativeCount > 0) {
        // Mixed sentiment (e.g., "Good class but the explaining was confusing")
        console.log("Mixed keywords found. Defaulting to 'neutral'.");
        return 'neutral';
    }
    
    // 3. Default to neutral if no clear keywords are found
    console.log("No clear keyword found. Defaulting to 'neutral'.");
    return "neutral";
}
// ----------------------------------------------------------------------------------

// ---------------------- POST: Save Feedback (Data Submission Endpoint) ----------------------
app.post("/api/saveFeedback", async (req, res) => {
  const { studentEmail, course, teacher, feedback } = req.body;

  if (!studentEmail || !course || !teacher || !feedback) {
    return res.status(400).json({ message: "Missing required fields in request body" });
  }

  let pool;
  let sentiment = 'unknown'; 
  try {
    // 1. Analyze sentiment (using keyword logic)
    sentiment = await getSentiment(feedback);

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
    res.status(500).json({ message: "Error saving feedback. Check server logs.", calculatedSentiment: sentiment });
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