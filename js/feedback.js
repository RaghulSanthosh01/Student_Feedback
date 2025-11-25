document.addEventListener("DOMContentLoaded", () => {
    const userStr = localStorage.getItem("user");
    
    // Elements
    const form = document.getElementById("feedbackForm");
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;
    const messageDiv = document.getElementById("feedbackMessage");
    
    // Define API URL once
    const BACKEND_URL =
        "https://student-feedback-bd-ajc8acbgdtadcvaw.eastasia-01.azurewebsites.net/api/saveFeedback";

    // 1. Authorization Check (Enhanced) 🔒
    if (!userStr) {
        // No user data found
        window.location.href = "index.html";
        return;
    }

    let user;
    try {
        user = JSON.parse(userStr);
    } catch (e) {
        // Invalid JSON in localStorage
        console.error("Invalid user JSON in localStorage", e);
        localStorage.removeItem("user"); // Clear bad data
        window.location.href = "index.html";
        return;
    }

    if (user.role !== "student") {
        // User is logged in but has the wrong role (e.g., 'admin')
        console.warn(`Unauthorized role access: ${user.role}`);
        localStorage.removeItem("user"); // Clear the unauthorized login data
        window.location.href = "index.html";
        return;
    }

    // 2. Form Submission Handler Function
    const handleFeedbackSubmission = async (e) => {
        e.preventDefault();

        if (!form || !submitButton || !messageDiv) return; // Guard for missing elements

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
                // Robustly handle reading JSON body
                const result = await res.json().catch(() => ({ sentiment: 'unknown' })); 

                // Determine color based on sentiment from the backend
                let sentimentColor = "black";
                const sentimentStr = result.sentiment ? result.sentiment.toLowerCase() : 'unknown';
                
                if (sentimentStr === "positive") sentimentColor = "green";
                else if (sentimentStr === "negative") sentimentColor = "red";
                else if (sentimentStr === "neutral") sentimentColor = "orange";
                
                // Show success message
                messageDiv.textContent = `✅ Feedback submitted successfully! Sentiment: ${sentimentStr.toUpperCase()}`;
                messageDiv.style.color = sentimentColor;

                form.reset();
                // Clear message after 5 seconds
                setTimeout(() => (messageDiv.textContent = ""), 5000);
            } else {
                const errorData = await res.json().catch(() => ({ message: res.statusText || `HTTP Status ${res.status}` }));
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
    };
    
    // Attach the submission handler
    if (form) {
        form.addEventListener("submit", handleFeedbackSubmission);
    }
});