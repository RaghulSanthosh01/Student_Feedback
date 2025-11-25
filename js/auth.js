function handleLogin(response) {
  const data = jwt_decode(response.credential);
  const email = data.email;

  // Admin emails
  const adminEmails = ["hodrajalakshmi01@gmail.com"];

  if (adminEmails.includes(email)) {
    // Store admin in localS
    const adminData = { email: email, role: "admin" };
    localStorage.setItem("user", JSON.stringify(adminData));
    window.location.href = "admin.html";
  } 
  else if (email.endsWith("@rajalakshmi.edu.in")) {
    // Store student in localStorage
    const studentData = { email: email, role: "student" };
    localStorage.setItem("user", JSON.stringify(studentData));
    window.location.href = "feedback.html";
  } 
  else {
    // Changed alert() to console log and prevented redirect
    console.error("Login failed: Email not authorized.");
  }
}

// Load JWT decode library
(function loadJwtDecode() {
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/jwt-decode@3.1.2/build/jwt-decode.min.js";
  document.head.appendChild(script);
})();