// feedback.js
document.addEventListener("DOMContentLoaded", () => {
  const userStr = localStorage.getItem("user");
  
  // 1. Authorization Check
  if (!userStr) {
    window.location.href = "index.html";
    return;
  }

  const user = JSON.parse(userStr);
  if (user.role !== "student") {
    alert("❌ You do not have permission to access this page.");
    window.location.href = "index.html";
    return;
  }

  const form = document.getElementById("feedbackForm");
  const submitButton = form.querySelector('button[type="submit"]');
  const messageDiv = document.getElementById("feedbackMessage");
  
  // Define API URL once
  const BACKEND_URL =
    "https://student-feedback-bd-ajc8acbgdtadcvaw.eastasia-01.azurewebsites.net/api/saveFeedback";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const feedbackData = {
      studentEmail: user.email,
      course: document.getElementById("course").value.trim(),
      teacher: document.getElementById("teacher").value.trim(),
      feedback: document.getElementById("feedback").value.trim(),
    };

    if (!feedbackData.course || !feedbackData.teacher || !feedbackData.feedback) {
      messageDiv.textContent = "❌ Please fill in all fields.";
      messageDiv.style.color = "red";
      return;
    }
    
    // UX improvement: Disable button and show loading state
    submitButton.disabled = true; 
    messageDiv.textContent = "Submitting feedback and analyzing sentiment...";
    messageDiv.style.color = "blue"; 

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedbackData),
      });

      if (res.ok) {
        const result = await res.json();

        // Determine color based on sentiment from the backend
        let sentimentColor = "black";
        if (result.sentiment === "positive") sentimentColor = "green";
        else if (result.sentiment === "negative") sentimentColor = "red";
        else if (result.sentiment === "neutral") sentimentColor = "orange";
        
        // Show success message
        messageDiv.textContent = `✅ Feedback submitted successfully! Sentiment: ${result.sentiment.toUpperCase()}`;
        messageDiv.style.color = sentimentColor;

        form.reset();
        // Clear message after 5 seconds
        setTimeout(() => (messageDiv.textContent = ""), 5000);
      } else {
        const errorData = await res.json().catch(() => ({ message: res.statusText }));
        messageDiv.textContent = `❌ Error submitting feedback: ${errorData.message}`;
        messageDiv.style.color = "red";
      }
    } catch (err) {
      console.error("Network error:", err);
      messageDiv.textContent = "❌ Network error. Please check your connection and try again.";
      messageDiv.style.color = "red";
    } finally {
        // Always re-enable the button regardless of success or failure
        submitButton.disabled = false;
    }
  });
});