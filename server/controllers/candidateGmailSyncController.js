const { google } = require("googleapis");
const Candidate = require("../models/Candidate");

// Setup OAuth2 client (Same credentials as leaves sync)
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

// Helper function to extract email body recursively
const getEmailBody = (payload) => {
  if (!payload) return "";
  let body = "";
  if (payload.body && payload.body.data) {
    body = Buffer.from(payload.body.data, 'base64').toString('utf8');
  } else if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf8');
        break;
      } else if (part.parts) {
        body = getEmailBody(part);
        if (body) break;
      }
    }
  }
  return body || payload.snippet || "";
};

// Function to scan emails for Job Applications / Resumes
const scanGmailForCandidates = async () => {
  try {
    // Search emails with subject or keywords related to Job Application
    const response = await gmail.users.messages.list({
      userId: "me",
      q: 'subject:"Job Application" OR subject:"Resume" OR subject:"Applying" newer_than:2d',
    });

    const messages = response.data.messages;
    if (!messages || messages.length === 0) {
      console.log("No new candidate application emails found.");
      return;
    }

    for (const msg of messages) {
      const emailDetails = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
      });

      const headers = emailDetails.data.payload.headers;
      const subject = headers.find((h) => h.name === "Subject")?.value || "";
      const senderHeader = headers.find((h) => h.name === "From")?.value || "";
      
      // Extract sender name and email (e.g., "Rahul Sharma <rahul@gmail.com>")
      let name = senderHeader.split("<")[0].replace(/"/g, "").trim() || "Applicant";
      const emailMatch = senderHeader.match(/<(.+?)>/) || [null, senderHeader];
      const senderEmail = emailMatch[1];

      // Get full email body text
      const fullBody = getEmailBody(emailDetails.data.payload);

      // Check if candidate already exists by email to avoid duplicates
      const existingCandidate = await Candidate.findOne({ email: senderEmail });
      
      if (!existingCandidate) {
        // Extract role applied from subject if possible (e.g., "Job Application for Sales Executive")
        let appliedRole = "General Role";
        if (subject.toLowerCase().includes("for")) {
          appliedRole = subject.split(/for/i)[1].trim();
        }

        const newCandidate = new Candidate({
          name: name,
          email: senderEmail,
          appliedFor: appliedRole,
          resumeUrl: "https://res.cloudinary.com/demo/image/upload/sample.pdf", // Default placeholder or attachment link
          status: "Applied",
          hrReview: `[Email Subject: ${subject}] - ${fullBody.substring(0, 200)}...`,
        });

        await newCandidate.save();
        console.log(`Successfully imported candidate ${name} (${senderEmail}) from Gmail.`);
      }
    }
  } catch (err) {
    console.error("Error scanning Gmail for candidates:", err);
    throw err;
  }
};

module.exports = { scanGmailForCandidates };