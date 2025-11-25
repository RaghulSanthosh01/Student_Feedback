document.addEventListener("DOMContentLoaded", async () => {
  const userStr = localStorage.getItem("user");
  
  // 1. Authorization Check
  if (!userStr) {
    window.location.href = "index.html";
    return;
  }

  const user = JSON.parse(userStr);
  if (user.role !== "admin") {
    window.location.href = "index.html";
    return;
  }
  
  // Define API URL and DOM elements
  // 💡 NOTE: The URL below MUST match your deployed backend's root URL.
  // Use the base URL of your deployed backend (Azure App Service)
  const baseUrl = "https://student-feedback-bd-ajc8acbgdtadcvaw.eastasia-01.azurewebsites.net"; 
  const apiUrl = `${baseUrl}/api/getFeedback`;
  const tbody = document.querySelector("#feedbackTable tbody");

  try {
    console.log("Fetching feedback data from API...");

    // 2. API Fetch
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
        throw new Error(`Failed to fetch feedback: HTTP status ${response.status}`);
    }

    const feedbackList = await response.json();
    tbody.innerHTML = ""; // Clear existing content

    // Helper function to safely create a text-based table data cell
    const createTextCell = (text) => {
        const td = document.createElement("td");
        td.textContent = text || 'N/A';
        return td;
    };
    
    // 3. Populate Table with Security and Sentiment Styling
    feedbackList.forEach(item => {
      const tr = document.createElement("tr");
      
      // Basic text cells
      tr.appendChild(createTextCell(item.Course));
      tr.appendChild(createTextCell(item.Teacher));
      tr.appendChild(createTextCell(item.FeedbackText)); 
      
      // Sentiment Cell
      const sentimentValue = (item.Sentiment || 'neutral').toLowerCase(); // Default to 'neutral'
      const sentimentClass = `sentiment-${sentimentValue}`;
      const sentimentCell = document.createElement("td");
      
      // Injecting the styled badge defined in admin.html CSS
      sentimentCell.innerHTML = 
          `<span class="sentiment-badge ${sentimentClass}">${sentimentValue.toUpperCase()}</span>`;
      tr.appendChild(sentimentCell);

      // Submitted At cell
      tr.appendChild(createTextCell(new Date(item.SubmittedAt).toLocaleString()));

      tbody.appendChild(tr);
    });
    
    console.log(`Successfully loaded ${feedbackList.length} feedback items.`);
    
  } catch (err) {
    console.error("Error loading feedback:", err.message);
    
    // 4. Error Display
    const errorRow = document.createElement('tr');
    errorRow.innerHTML = 
        `<td colspan="5" style="text-align:center;color:red;font-weight:600;">
            ❌ Failed to load feedback. Check API connection and CORS settings. (${err.message})
        </td>`;
    tbody.innerHTML = ''; 
    tbody.appendChild(errorRow);
  }
});