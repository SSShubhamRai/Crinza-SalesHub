const { google } = require("googleapis");
const Leave = require("../models/Leave");
const User = require("../models/User");

// Setup OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

// Helper function to extract full email body recursively from parts
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

// Function to scan emails for leave requests (works for both read/unread & same-day)
const scanGmailForLeaves = async () => {
  try {
    // Search emails with subject 'Leave Request' for today/recent (newer_than:1d)
    const response = await gmail.users.messages.list({
      userId: "me",
      q: 'subject:"Leave Request" newer_than:1d',
    });

    const messages = response.data.messages;
    if (!messages || messages.length === 0) {
      console.log("No new leave emails found for today.");
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
      
      // Extract sender email address (e.g. ssubhamkumar776@gmail.com)
      const emailMatch = senderHeader.match(/<(.+?)>/) || [null, senderHeader];
      const senderEmail = emailMatch[1];

      // Get full email body text instead of just snippet
      const fullBody = getEmailBody(emailDetails.data.payload);

      // Find user in database by email
      const employee = await User.findOne({ email: senderEmail });
      if (employee) {
        // Check if leave request already exists to avoid duplicates
        const existingLeave = await Leave.findOne({
          userId: employee.userId,
          reason: { $regex: subject, $options: "i" },
        });

        if (!existingLeave) {
          // Create new Leave Request automatically with full email content
          const newLeave = new Leave({
            userId: employee.userId,
            name: employee.name,
            role: employee.role,
            fromDate: new Date().toISOString().split("T")[0],
            toDate: new Date().toISOString().split("T")[0],
            reason: `[Email: ${subject}] - ${fullBody}`,
            status: "Pending", // HR review ke liye pending rahega
          });

          await newLeave.save();
          console.log(`Successfully imported leave request for ${employee.name} from email.`);
        }
      }
    }
  } catch (err) {
    console.error("Error scanning Gmail for leaves:", err);
  }
};

module.exports = { scanGmailForLeaves };