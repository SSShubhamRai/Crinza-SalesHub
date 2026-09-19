const express = require("express");
const router = express.Router();
const multer = require("multer");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const axios = require("axios"); 
const Notification = require("../models/Notification");
const User = require("../models/User");
const Lead = require("../models/Lead");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const Candidate = require("../models/Candidate");
const SalespersonPoint = require("../models/SalespersonPoint");
const verifyToken = require("../middleware/authMiddleware");
const { scanGmailForLeaves } = require("../controllers/gmailSyncController");
const { scanGmailForCandidates } = require("../controllers/candidateGmailSyncController");
const JobDescription = require("../models/JobDescription");

// 🌟 1. CLOUDINARY CONFIGURATION FOR HR POLICIES
const cloudinary = require("cloudinary").v2;

// ✉️ Nodemailer Transporter Setup for Email Notifications
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 📄 Company Document Schema
const companyDocumentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  fileUrl: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  targetAudience: { type: String, default: "ALL" },
  createdAt: { type: Date, default: Date.now }
});
const CompanyDocument = mongoose.model("CompanyDocument", companyDocumentSchema);

// 📁 2. MEMORY STORAGE FOR BUFFER STREAMING
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed!"), false);
    }
  }
});

const uploadBufferToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "crinza_policies",
        resource_type: "raw", 
      },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    stream.end(buffer);
  });
};

// 1. Upload & Broadcast Policy PDF
router.post("/upload-policy", verifyToken, upload.single("policyFile"), async (req, res) => {
  try {
    const { title, description, targetAudience } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please select a valid PDF file." });
    }

    const cloudinaryResult = await uploadBufferToCloudinary(req.file.buffer);
    const fileUrl = cloudinaryResult.secure_url;

    if (!fileUrl) {
      return res.status(400).json({ success: false, message: "Cloudinary upload failed." });
    }

    const userIdentifier = req.user._id || req.user.id || req.user.userId;
    const hrUser = await User.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(userIdentifier) ? userIdentifier : null },
        { userId: userIdentifier }
      ]
    });

    if (!hrUser) {
      return res.status(401).json({ success: false, message: "Authorized HR user not found." });
    }

    let query = { role: { $ne: 'hr' } };
    if (targetAudience && targetAudience !== 'ALL') {
      query.role = targetAudience;
    }
    const targetUsers = await User.find(query);

    const notifications = targetUsers.map(user => ({
      userId: user._id,
      title: title || "New Company Policy",
      message: description || `HR uploaded a new policy document: "${title}".`,
      fileUrl: fileUrl,
      isRead: false
    }));

    await Notification.insertMany(notifications);

    const newDoc = new CompanyDocument({
      title: title || "New Policy",
      description,
      fileUrl,
      uploadedBy: hrUser._id,
      targetAudience: targetAudience || "ALL"
    });
    await newDoc.save();

    res.json({ success: true, message: "Policy uploaded successfully to Cloudinary and broadcasted!" });
  } catch (err) {
    console.error("Upload policy error:", err);
    res.status(500).json({ success: false, message: "Failed to upload policy", error: err.message });
  }
});

// 2. Send Direct Message to Employee
router.post("/send-message", verifyToken, async (req, res) => {
  try {
    const { recipientId, title, message } = req.body;
    if (!recipientId || !message) {
      return res.status(400).json({ success: false, message: "Recipient and message required." });
    }

    const senderUser = await User.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(req.user.userId || req.user.id) ? (req.user.userId || req.user.id) : null },
        { userId: req.user.userId || req.user.id }
      ]
    });

    const recipient = await User.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(recipientId) ? recipientId : null },
        { userId: recipientId }
      ]
    });

    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient employee not found." });
    }

    const notif = new Notification({
      userId: recipient._id,
      title: title || "HR Direct Note",
      message,
      priority: "important",
      sender: senderUser ? senderUser._id : undefined
    });
    await notif.save();

    const io = req.app.get("io");
    if (io) {
      io.to(recipient._id.toString()).emit("new_notification", notif);
    }

    res.json({ success: true, message: "Direct message sent successfully!" });
  } catch (err) {
    console.error("Error sending direct message:", err);
    res.status(500).json({ success: false, message: "Failed to send message.", error: err.message });
  }
});

// 3. Get Policies List
router.get("/policies", verifyToken, async (req, res) => {
  try {
    const docs = await CompanyDocument.find().sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch policies." });
  }
});

// 4. Get Team Performance Summary
router.get("/summary-performance", verifyToken, async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }

    const { from, to } = req.query;
    let dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) dateFilter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    const staffMembers = await User.find({
      role: "salesperson" 
    }).select("userId name email role");

    const performanceSummary = await Promise.all(
      staffMembers.map(async (emp) => {
        const leadQuery = { salespersonId: emp.userId, ...dateFilter };
        const leadsCreatedCount = await Lead.countDocuments(leadQuery);

        const demoQuery = { salespersonId: emp.userId, demoStatus: "Completed", ...dateFilter };
        const demosDoneCount = await Lead.countDocuments(demoQuery);

        let pointMatch = { salespersonId: emp.userId };
        if (from || to) {
          pointMatch.date = {};
          if (from) pointMatch.date.$gte = from;
          if (to) pointMatch.date.$lte = to;
        }

        const pointsDoc = await SalespersonPoint.aggregate([
          { $match: pointMatch },
          { $group: { _id: null, totalPoints: { $sum: "$totalPoints" } } }
        ]);
        const salesPoints = pointsDoc[0]?.totalPoints || 0;

        return {
          id: emp._id,
          userId: emp.userId,
          name: emp.name,
          role: emp.role,
          leadsCreated: leadsCreatedCount,
          demosDone: demosDoneCount,
          salesPoints: salesPoints,
        };
      })
    );

    res.json({ success: true, performance: performanceSummary });
  } catch (err) {
    console.error("Failed to fetch summary performance:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// 5. Get Employees List for Messaging Dropdown
router.get("/employees", verifyToken, async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }

    const employees = await User.find({
      role: { $in: ["salesperson", "accountant", "technical", "telecaller", "hr"] }
    }).select("-password");
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch employees", error: err.message });
  }
});

// 6. Get All Salespersons Attendance
router.get("/attendance", verifyToken, async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }

    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    if (targetDate > todayStr) {
      return res.json({
        success: true,
        isFuture: true,
        holidayTitle: "Future Date Selection",
        holidayDescription: "Attendance tracking is not available for future dates. Please select today or a past date.",
        date: targetDate
      });
    }

    const selectedDateObj = new Date(targetDate);
    const isSunday = selectedDateObj.getDay() === 0;

    if (isSunday) {
      return res.json({
        success: true,
        isHoliday: true,
        holidayTitle: "Weekly Off (Sunday)",
        holidayDescription: "No attendance tracking required on Sundays as it is a weekly holiday.",
        date: targetDate
      });
    }

    const Holiday = mongoose.models.Holiday || mongoose.model("Holiday", new mongoose.Schema({ title: String, date: String, description: String }));
    const holiday = await Holiday.findOne({ date: targetDate });
    if (holiday) {
      return res.json({
        success: true,
        isHoliday: true,
        holidayTitle: holiday.title,
        holidayDescription: holiday.description || "Company Declared Holiday",
        date: targetDate
      });
    }

    const salespersons = await User.find({ role: "salesperson" }).select("userId name email role");
    const DaySession = mongoose.models.DaySession || mongoose.model("DaySession", new mongoose.Schema({}, { strict: false }), "daysessions");
    const sessions = await DaySession.find({ date: targetDate });

    const combinedAttendance = salespersons.map(sp => {
      const session = sessions.find(s => s.salespersonId === sp.userId || s.salespersonId === sp._id.toString());

      const formatTime = (isoString) => {
        if (!isoString) return null;
        return new Date(isoString).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        });
      };

      return {
        _id: session ? session._id : sp._id,
        userId: sp.userId,
        name: sp.name,
        role: sp.role,
        date: targetDate,
        startTime: session && session.startTime ? formatTime(session.startTime) : "Not Started",
        endTime: session && session.endTime ? formatTime(session.endTime) : (session && session.status === "ACTIVE" ? "Running..." : "Not Ended"),
        status: session ? (session.status === "ENDED" ? "Present" : "Active") : "Absent"
      };
    });

    res.json({ success: true, isHoliday: false, attendance: combinedAttendance });
  } catch (err) {
    console.error("Error fetching attendance from daysessions:", err);
    res.status(500).json({ success: false, message: "Failed to fetch attendance" });
  }
});

// 7. Get All Leave Requests
router.get("/leaves", verifyToken, async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }

    const leaves = await Leave.find().sort({ createdAt: -1 });
    res.json({ success: true, leaves });
  } catch (err) {
    console.error("Error fetching leaves:", err);
    res.status(500).json({ success: false, message: "Failed to fetch leaves" });
  }
});

// 8. Update Leave Status
router.put("/leaves/:id/status", verifyToken, async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }

    const { status, rejectionReason } = req.body; 
    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    leave.status = status;
    if (status === "Rejected" && rejectionReason) {
      leave.rejectionReason = rejectionReason;
    }
    await leave.save();

    const employee = await User.findOne({ userId: leave.userId });
    if (employee && employee.email) {
      let mailSubject = `Leave Request Update: ${status}`;
      let mailBody = "";

      if (status === "Approved") {
        mailBody = `Dear ${employee.name},\n\nYour leave request from ${leave.fromDate} to ${leave.toDate} has been successfully GRANTED / APPROVED by HR.\n\nBest regards,\nHR Department`;
      } else if (status === "Rejected") {
        mailBody = `Dear ${employee.name},\n\nWe regret to inform you that your leave request from ${leave.fromDate} to ${leave.toDate} has been REJECTED.\n\nReason given by HR:\n"${rejectionReason || "Not specified"}"\n\nBest regards,\nHR Department`;
      }

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: employee.email,
        subject: mailSubject,
        text: mailBody,
      });
    }

    res.json({ 
      success: true, 
      message: `Leave request ${status.toLowerCase()} successfully and email sent!`, 
      leave 
    });
  } catch (err) {
    console.error("Error updating leave status:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

router.post("/sync-gmail-leaves", verifyToken, async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }
    await scanGmailForLeaves();
    res.json({ success: true, message: "Gmail inbox scanned and leaves synchronized successfully!" });
  } catch (err) {
    console.error("Error syncing Gmail leaves:", err);
    res.status(500).json({ success: false, message: "Failed to sync leaves from Gmail", error: err.message });
  }
});

// 🌟 1. Get All Candidates (Sorted by AI Match Score Descending)
router.get("/candidates", verifyToken, async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }
    // Sort by aiMatchScore descending so highest score appears first
    const candidates = await Candidate.find().sort({ aiMatchScore: -1, createdAt: -1 });
    res.json({ success: true, candidates });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch candidates" });
  }
});

// 2. Add Candidate Manually
router.post("/candidates/add", verifyToken, upload.single("resume"), async (req, res) => {
  try {
    const { name, email, phone, appliedFor } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Resume PDF is required." });
    }

    const cloudinaryResult = await uploadBufferToCloudinary(req.file.buffer);
    const resumeUrl = cloudinaryResult.secure_url;

    // Optional manual add AI evaluation lookup
    let aiMatchScore = "N/A";
    let aiInsights = "Manual entry, evaluation pending.";

    try {
      const matchedJd = await JobDescription.findOne({ role: appliedFor.toLowerCase().trim() });
      let contentsArray = [];
      if (matchedJd && matchedJd.jdPdf && matchedJd.jdPdf.data) {
        contentsArray.push({
          inlineData: {
            data: matchedJd.jdPdf.data.toString("base64"),
            mimeType: matchedJd.jdPdf.contentType || "application/pdf"
          }
        });
      }
      contentsArray.push({
        text: `You are an expert HR recruitment AI. Evaluate the candidate profile for '${appliedFor}'. Candidate: ${name}, Resume Link: ${resumeUrl}. Provide match score percentage (e.g. '85%') and brief insight. Format strictly: SCORE|INSIGHT`
      });

      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: contentsArray,
      });

      const aiText = geminiResponse.text || (geminiResponse.candidates && geminiResponse.candidates[0]?.content?.parts[0]?.text);
      if (aiText && aiText.includes("|")) {
        const parts = aiText.split("|");
        aiMatchScore = parts[0].trim();
        aiInsights = parts[1].trim();
      }
    } catch (e) {
      console.error("Manual add AI evaluation error:", e.message);
    }

    const newCandidate = new Candidate({
      name,
      email,
      phone,
      appliedFor,
      resumeUrl,
      aiMatchScore,
      aiInsights
    });

    await newCandidate.save();
    res.json({ success: true, message: "Candidate added successfully!", candidate: newCandidate });
  } catch (err) {
    console.error("Error adding candidate:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// 3. Update Candidate Status
router.put("/candidates/:id/action", verifyToken, async (req, res) => {
  try {
    const { status, interviewDate, interviewTime, hrReview } = req.body;
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({ success: false, message: "Candidate not found" });
    }

    candidate.status = status;
    if (interviewDate) candidate.interviewDate = interviewDate;
    if (interviewTime) candidate.interviewTime = interviewTime;
    if (hrReview) candidate.hrReview = hrReview;

    await candidate.save();

    let mailSubject = `Job Application Update: ${candidate.appliedFor} - Crinza`;
    let mailBody = `Dear ${candidate.name},\n\n`;

    if (status === "Shortlisted") {
      mailBody += `Great news! Your profile has been shortlisted for the ${candidate.appliedFor} role at Crinza.\n\nWarm regards,\nTalent Team\nCrinza`;
    } else if (status === "Interview Scheduled") {
      mailBody += `Your interview is scheduled for ${interviewDate} at ${interviewTime}.\n\nBest of luck!\nCrinza`;
    } else if (status === "Selected") {
      mailBody += `Congratulations! You are selected for the position of ${candidate.appliedFor} at Crinza.\n\nHR Team\nCrinza`;
    } else if (status === "Rejected") {
      mailBody += `Thank you for your interest in Crinza. We are moving forward with other candidates at this time.\n\nBest wishes,\nCrinza`;
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: candidate.email,
      subject: mailSubject,
      text: mailBody,
    });

    res.json({ success: true, message: `Candidate status updated to ${status} and email sent successfully!` });
  } catch (err) {
    console.error("Error updating candidate action:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

router.post("/sync-gmail-candidates", verifyToken, async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }
    await scanGmailForCandidates();
    res.json({ success: true, message: "Gmail scanned and candidates synchronized successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to sync candidates", error: err.message });
  }
});

// Monthly Attendance Summary API
router.get("/attendance-summary", verifyToken, async (req, res) => {
  try {
    const { month, year } = req.query; 
    if (!month || !year) {
      return res.status(400).json({ success: false, message: "Month and year are required." });
    }

    const employees = await User.find({ role: { $ne: "boss" } });
    const Holiday = mongoose.models.Holiday || mongoose.model("Holiday", new mongoose.Schema({ title: String, date: String, description: String }));

    const holidays = await Holiday.find({ date: { $regex: `^${year}-${month}` } });
    const holidayDates = holidays.map(h => h.date);

    const DaySession = mongoose.models.DaySession || mongoose.model("DaySession", new mongoose.Schema({}, { strict: false }), "daysessions");
    const allSessionsInMonth = await DaySession.find({ date: { $regex: `^${year}-${month}` } });

    let summary = [];
    const today = new Date();
    const currentYear = String(today.getFullYear());
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentDay = today.getDate();

    const daysInMonth = new Date(year, month, 0).getDate();
    let targetDaysCount = daysInMonth;
    if (year === currentYear && month === currentMonth) {
      targetDaysCount = currentDay;
    } else if (new Date(`${year}-${month}-01`) > today) {
      targetDaysCount = 0; 
    }

    for (const emp of employees) {
      const empSessions = allSessionsInMonth.filter(s => {
        const isMatchUser = (s.salespersonId === emp.userId || s.salespersonId === emp._id.toString());
        const isPastOrToday = s.date <= new Date().toISOString().split('T')[0];
        return isMatchUser && isPastOrToday;
      });

      const presentDays = empSessions.filter(s => s.status === "ENDED" || s.status === "ACTIVE" || s.status === "Present" || s.status === "Late").length;
      const approvedLeaves = await Leave.find({ userId: emp.userId, status: "Approved" });

      let leaveDays = 0;
      approvedLeaves.forEach(leave => {
        if (leave.fromDate && leave.fromDate.startsWith(`${year}-${month}`)) {
          if (leave.fromDate <= new Date().toISOString().split('T')[0]) leaveDays += 1;
        }
      });

      let totalSundays = 0;
      let totalHolidaysCount = 0;

      for (let day = 1; day <= targetDaysCount; day++) {
        const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
        const d = new Date(dateStr);
        if (d.getDay() === 0) totalSundays++;
        if (holidayDates.includes(dateStr)) totalHolidaysCount++;
      }
      
      let absentDays = Math.max(0, targetDaysCount - (presentDays + leaveDays + totalSundays + totalHolidaysCount));

      summary.push({ userId: emp.userId, name: emp.name, role: emp.role, presentDays, leaveDays, sundays: totalSundays, holidays: totalHolidaysCount, absentDays });
    }

    res.json({ success: true, summary });
  } catch (err) {
    console.error("Error generating attendance summary:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Holidays
router.get("/holidays", verifyToken, async (req, res) => {
  try {
    const Holiday = mongoose.models.Holiday || mongoose.model("Holiday", new mongoose.Schema({ title: String, date: String, description: String }));
    const holidays = await Holiday.find().sort({ date: 1 });
    res.json({ success: true, holidays });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/holidays", verifyToken, async (req, res) => {
  try {
    const { title, date, description } = req.body;
    const Holiday = mongoose.models.Holiday || mongoose.model("Holiday", new mongoose.Schema({ title: String, date: String, description: String }));
    const newHoliday = new Holiday({ title, date, description });
    await newHoliday.save();
    res.json({ success: true, message: "Holiday added successfully!", holiday: newHoliday });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/manage-employees", verifyToken, async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }
    const employees = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({ success: true, employees });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch employees" });
  }
});

router.put("/manage-employees/:id", verifyToken, async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }
    const { name, email, phone, role, joiningDate, salary, status } = req.body;
    const employee = await User.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    if (name) employee.name = name;
    if (email) employee.email = email;
    if (phone) employee.phone = phone;
    if (role) employee.role = role;
    if (joiningDate) employee.joiningDate = joiningDate;
    if (salary !== undefined) employee.salary = salary;
    if (status) employee.status = status;

    await employee.save();
    res.json({ success: true, message: "Employee updated successfully!", employee });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

router.post("/manage-employees/send-document", verifyToken, upload.single("pdfFile"), async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }
    const { employeeId, docType, monthYear, customMessage } = req.body; 
    const employee = await User.findById(employeeId);
    if (!employee || !employee.email) return res.status(404).json({ success: false, message: "Employee/email not found." });

    let subject = docType === "OfferLetter" ? `Official Offer Letter - Crinza` : `Salary Slip for ${monthYear} - Crinza`;
    let body = `Dear ${employee.name},\n\nPlease find your document attached.\n\n${customMessage || ""}\n\nBest regards,\nCrinza`;
    let attachments = req.file ? [{ filename: `${docType}.pdf`, content: req.file.buffer, contentType: "application/pdf" }] : [];

    await transporter.sendMail({ from: process.env.EMAIL_USER, to: employee.email, subject, text: body, attachments });
    res.json({ success: true, message: "Document sent successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to send email.", error: err.message });
  }
});

router.post("/manage-employees/add", verifyToken, async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }
    const { name, email, phone, role, password, joiningDate, salary } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ success: false, message: "Required fields missing." });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: "Email already exists." });

    const count = await User.countDocuments();
    const userId = `CRZ-${String(count + 101).padStart(3, '0')}`;
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);

    const newEmployee = new User({ userId, name, email, phone, role, password: hashedPassword, joiningDate: joiningDate || new Date().toISOString().split('T')[0], salary: salary ? Number(salary) : 0, status: "active" });
    await newEmployee.save();

    res.json({ success: true, message: "Employee added successfully!", employee: newEmployee });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// 🌟 Google Gemini AI Instance
const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 🌟 100% Zero-Headache Dynamic Google Form Sheet Sync + Gemini AI Resume Screening Route
router.post("/sync-sheet", verifyToken, upload.single("jdPdf"), async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied!" });
    }

    const { sheetUrl, role } = req.body;
    const jdFile = req.file; // Uploaded JD PDF file buffer from Multer

    if (!sheetUrl || !role) {
      return res.status(400).json({ success: false, message: "Google Sheet URL and Role are required." });
    }

    const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      return res.status(400).json({ success: false, message: "Invalid Google Sheet URL format." });
    }
    const spreadsheetId = match[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

    const response = await axios.get(csvUrl);
    const csvData = response.data;

    // Split CSV rows handling commas properly
    const rows = csvData.split("\n").map(row => {
      return row.split(",").map(val => val.trim().replace(/^"|"$/g, ""));
    });

    if (rows.length < 2) {
      return res.status(400).json({ success: false, message: "Google Sheet is empty or headers are missing." });
    }

    const headers = rows[0]; 
    const dataRows = rows.slice(1);

    const emailIdx = headers.findIndex(h => h.toLowerCase().includes("email"));
    const nameIdx = headers.findIndex(h => h.toLowerCase().includes("name") || h.toLowerCase().includes("full name"));

    if (emailIdx === -1 || nameIdx === -1) {
      return res.status(400).json({ success: false, message: "Google Sheet must contain 'Name' and 'Email' columns." });
    }

    let addedCount = 0;
    let duplicateCount = 0;

    // 🌟 Check if there's a stored JD in database for this role as a fallback
    const roleKey = role.toLowerCase().trim();
    const storedJdDoc = await JobDescription.findOne({ role: roleKey });

    for (let row of dataRows) {
      if (!row[emailIdx]) continue; 

      const name = row[nameIdx];
      const email = row[emailIdx].toLowerCase();

      const formResponses = {};
      headers.forEach((header, index) => {
        if (header && row[index] !== undefined) {
          formResponses[header] = row[index];
        }
      });

      const phoneIdx = headers.findIndex(h => h.toLowerCase().includes("phone") || h.toLowerCase().includes("contact") || h.toLowerCase().includes("number"));
      const resumeIdx = headers.findIndex(h => h.toLowerCase().includes("resume") || h.toLowerCase().includes("cv") || h.toLowerCase().includes("drive") || h.toLowerCase().includes("file"));

      const phone = phoneIdx !== -1 ? row[phoneIdx] : "";
      const resumeUrl = resumeIdx !== -1 ? row[resumeIdx] : "";

      const existingCandidate = await Candidate.findOne({ email });
      if (existingCandidate) {
        duplicateCount++;
        continue;
      }

      // 🌟 AI Resume Screening & Match Score via Google Gemini API with Dynamic JD Lookup
      let aiMatchScore = "N/A";
      let aiInsights = "AI evaluation pending.";

      try {
        const candidateDetailsText = `Candidate Name: ${name}, Role Applied: ${role}, Form Responses & Details: ${JSON.stringify(formResponses)}, Resume Link: ${resumeUrl}`;
        
        let contentsArray = [];
        
        // Priority 1: User uploaded a fresh JD PDF in modal
        // Priority 2: Fallback to stored Job Description PDF from database for this role
        if (jdFile) {
          contentsArray.push({
            inlineData: {
              data: jdFile.buffer.toString("base64"),
              mimeType: "application/pdf"
            }
          });
        } else if (storedJdDoc && storedJdDoc.jdPdf && storedJdDoc.jdPdf.data) {
          contentsArray.push({
            inlineData: {
              data: storedJdDoc.jdPdf.data.toString("base64"),
              mimeType: storedJdDoc.jdPdf.contentType || "application/pdf"
            }
          });
        }

        contentsArray.push({
          text: `You are an expert HR recruitment AI. ${(jdFile || (storedJdDoc && storedJdDoc.jdPdf)) ? "Analyze the attached Job Description PDF and" : ""} evaluate the following candidate profile for the role of '${role}'.
          Candidate Info: ${candidateDetailsText}
          Provide a match score percentage (e.g., '85%') and a brief 1-2 line professional insight/review.
          Format your response strictly as: SCORE|INSIGHT (Example: 88%|Strong technical skills, good project experience, highly recommended.)`
        });

        const geminiResponse = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: contentsArray,
        });

        const aiText = geminiResponse.text || (geminiResponse.candidates && geminiResponse.candidates[0]?.content?.parts[0]?.text);
        if (aiText && aiText.includes("|")) {
          const parts = aiText.split("|");
          aiMatchScore = parts[0].trim();
          aiInsights = parts[1].trim();
        } else if (aiText) {
          aiInsights = aiText.trim();
        }
      } catch (aiErr) {
        console.error("Gemini AI evaluation error for candidate:", email, aiErr.message);
      }

      const newCandidate = new Candidate({
        name,
        email,
        phone,
        appliedFor: role,
        resumeUrl,
        formResponses, 
        aiMatchScore,  
        aiInsights,    
        status: "Applied"
      });

      await newCandidate.save();
      addedCount++;
    }

    res.status(200).json({
      success: true,
      message: `Sync & AI Screening completed! Added ${addedCount} new candidates. Skipped ${duplicateCount} duplicates.`
    });

  } catch (err) {
    console.error("Error syncing Google Sheet with AI:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to sync sheet and run AI screening. Ensure the Google Sheet is public and Gemini API key is valid." 
    });
  }
});

// 🌟 Upload or Update Job Description for any Role
router.post("/upload-jd", verifyToken, upload.single("jdPdf"), async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied!" });
    }

    const { role, title } = req.body;
    const jdFile = req.file;

    if (!role || !title) {
      return res.status(400).json({ success: false, message: "Role and Title are required." });
    }

    let updateData = { title, role: role.toLowerCase().trim() };
    if (jdFile) {
      updateData.jdPdf = {
        data: jdFile.buffer,
        contentType: jdFile.mimetype
      };
    }

    const jdDoc = await JobDescription.findOneAndUpdate(
      { role: role.toLowerCase().trim() },
      updateData,
      { upsert: true, new: true }
    );

    res.status(200).json({ 
      success: true, 
      message: `Job Description for '${role}' saved successfully!`, 
      jdId: jdDoc._id 
    });

  } catch (err) {
    console.error("Error saving Job Description:", err);
    res.status(500).json({ success: false, message: "Failed to save Job Description." });
  }
});

// 🌟 Re-evaluate / Screen all N/A Candidates based on current database JDs
router.post("/candidates/re-evaluate-ai", verifyToken, async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied!" });
    }

    // Un sabhi candidates ko uthao jinka score N/A hai aur resume URL maujud hai
    const candidatesToScreen = await Candidate.find({ 
      $or: [{ aiMatchScore: "N/A" }, { aiMatchScore: { $exists: false } }],
      resumeUrl: { $ne: "" }
    });

    let updatedCount = 0;

    for (let cand of candidatesToScreen) {
      const roleKey = cand.appliedFor ? cand.appliedFor.toLowerCase().trim() : "";
      
      // Database se role ke hisaab se JD dhoondo (agar exact match na ho toh general/intern try karo)
      let matchedJd = await JobDescription.findOne({ role: roleKey });
      if (!matchedJd) {
        // Fallback: Agar role "Intern" hai toh "full stack" ya "technical" JD utha lo
        matchedJd = await JobDescription.findOne({ role: { $regex: roleKey,$options: 'i' } });
      }

      if (!matchedJd) continue; // Agar koi bhi JD nahi mila toh skip karo

      try {
        let contentsArray = [];
        if (matchedJd.jdPdf && matchedJd.jdPdf.data) {
          contentsArray.push({
            inlineData: {
              data: matchedJd.jdPdf.data.toString("base64"),
              mimeType: matchedJd.jdPdf.contentType || "application/pdf"
            }
          });
        }

        contentsArray.push({
          text: `You are an expert HR recruitment AI. Analyze the attached Job Description PDF and evaluate this candidate profile for the role of '${cand.appliedFor}'.
          Candidate Name: ${cand.name}, Resume Link: ${cand.resumeUrl}, Form Details: ${JSON.stringify(cand.formResponses || {})}.
          Provide a match score percentage (e.g., '85%') and a brief 1-2 line professional insight/review.
          Format your response strictly as: SCORE|INSIGHT (Example: 88%|Strong technical skills, highly recommended.)`
        });

        const geminiResponse = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: contentsArray,
        });

        const aiText = geminiResponse.text || (geminiResponse.candidates && geminiResponse.candidates[0]?.content?.parts[0]?.text);
        if (aiText && aiText.includes("|")) {
          const parts = aiText.split("|");
          cand.aiMatchScore = parts[0].trim();
          cand.aiInsights = parts[1].trim();
          await cand.save();
          updatedCount++;
        }
      } catch (evalErr) {
        console.error("Error re-evaluating candidate:", cand.email, evalErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully re-evaluated ${updatedCount} candidates using database JDs!`
    });

  } catch (err) {
    console.error("Re-evaluate AI error:", err);
    res.status(500).json({ success: false, message: "Failed to re-evaluate candidates." });
  }
});

module.exports = router;