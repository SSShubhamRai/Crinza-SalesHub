const express = require("express");
const router = express.Router();
const multer = require("multer");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
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

// Helper function to upload buffer stream to Cloudinary as public document (resource_type: "auto")
const uploadBufferToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "crinza_policies",
        resource_type: "raw", // 🌟 PDFs ke liye 'raw' hi sabse sahi hai
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
    
    // 1. File check karein
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please select a valid PDF file." });
    }

    // 2. Upload buffer to Cloudinary and get secure URL
    const cloudinaryResult = await uploadBufferToCloudinary(req.file.buffer);
    const fileUrl = cloudinaryResult.secure_url;

    if (!fileUrl) {
      return res.status(400).json({ success: false, message: "Cloudinary upload failed." });
    }

    // 3. Find logged-in HR user securely
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

    // 4. Target users find karein
    let query = { role: { $ne: 'hr' } };
    if (targetAudience && targetAudience !== 'ALL') {
      query.role = targetAudience;
    }
    const targetUsers = await User.find(query);

    // 5. Notifications create karein
    const notifications = targetUsers.map(user => ({
      userId: user._id,
      title: title || "New Company Policy",
      message: description || `HR uploaded a new policy document: "${title}".`,
      fileUrl: fileUrl,
      isRead: false
    }));

    await Notification.insertMany(notifications);

    // 6. CompanyDocument mein save karein
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

// 4. Get Team Performance Summary (Sirf Salespersons ke liye)
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

// 6. Get All Salespersons Attendance (Daily Tracking with Date Filter)
router.get("/attendance", verifyToken, async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }

    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    // 🌟 0. Check if the selected date is a Future Date
    if (targetDate > todayStr) {
      return res.json({
        success: true,
        isFuture: true, // Frontend banner reuse karne ke liye isHoliday ko true rakha hai
        holidayTitle: "Future Date Selection",
        holidayDescription: "Attendance tracking is not available for future dates. Please select today or a past date.",
        date: targetDate
      });
    }

    // 🌟 1. Check if the selected date is a Sunday (0 stands for Sunday)
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

    // 🌟 2. Check if this targetDate is an official Company Holiday
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

    // 3. Normal Attendance Logic for regular working days
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

// 8. Update Leave Status (Approve / Reject with Email Notification & Rejection Reason)
router.put("/leaves/:id/status", verifyToken, async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied!" });
    }

    const { status, rejectionReason } = req.body; // status: 'Approved' or 'Rejected'
    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    // Find leave request using findById to avoid Mongoose deprecation warnings
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    leave.status = status;
    if (status === "Rejected" && rejectionReason) {
      leave.rejectionReason = rejectionReason;
    }
    await leave.save();

    // Find employee user to send notification email
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
      console.log(`Email successfully sent to ${employee.email} for leave status: ${status}`);
    } else {
      console.log("Employee email address not found for email notification.");
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
      return res.status(403).json({ success: false, message: "Access denied!" });
    }

    // Trigger the Gmail scanning function
    await scanGmailForLeaves();

    res.json({ success: true, message: "Gmail inbox scanned and leaves synchronized successfully!" });
  } catch (err) {
    console.error("Error syncing Gmail leaves:", err);
    res.status(500).json({ success: false, message: "Failed to sync leaves from Gmail", error: err.message });
  }
});



// 1. Get All Candidates
router.get("/candidates", verifyToken, async (req, res) => {
  try {
    if (!["boss", "admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied!" });
    }
    const candidates = await Candidate.find().sort({ createdAt: -1 });
    res.json({ success: true, candidates });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch candidates" });
  }
});

// 2. Add Candidate Manually (Quick Add Form with Resume PDF upload)
router.post("/candidates/add", verifyToken, upload.single("resume"), async (req, res) => {
  try {
    const { name, email, phone, appliedFor } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Resume PDF is required." });
    }

    // Upload resume buffer to Cloudinary
    const cloudinaryResult = await uploadBufferToCloudinary(req.file.buffer);
    const resumeUrl = cloudinaryResult.secure_url;

    const newCandidate = new Candidate({
      name,
      email,
      phone,
      appliedFor,
      resumeUrl
    });

    await newCandidate.save();
    res.json({ success: true, message: "Candidate added successfully!", candidate: newCandidate });
  } catch (err) {
    console.error("Error adding candidate:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// 3. Update Candidate Status / Schedule Interview & Send Email Notification
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

    // Nodemailer Email Notification to Candidate
let mailSubject = `Job Application Update: ${candidate.appliedFor} - Crinza`;
let mailBody = `Dear ${candidate.name},\n\n`;

if (status === "Shortlisted") {
  mailBody += `Great news! We have reviewed your application and are thrilled to inform you that your profile has been shortlisted for the ${candidate.appliedFor} role at Crinza.\n\n` +
    `Our talent acquisition team was impressed with your background and would love to take the next steps with you. We will reach out to you within the next 2-3 business days to coordinate interview details.\n\n` +
    `Thank you once again for your interest in growing your career with us.\n\n` +
    `Warm regards,\n\n` +
    `Talent Acquisition Team\n` +
    `Crinza`;

} else if (status === "Interview Scheduled") {
  mailBody += `We are excited to invite you to the next stage of our hiring process for the ${candidate.appliedFor} position at Crinza.\n\n` +
    `Here are your interview details:\n` +
    `• Date: ${interviewDate}\n` +
    `• Time: ${interviewTime}\n` +
    `• Mode/Link: ${interviewMode || "Virtual / Video Call (link will be shared shortly)"}\n\n` +
    `Please ensure you join a few minutes prior to the scheduled time. If you need to reschedule due to an emergency, kindly let us know at least 24 hours in advance.\n\n` +
    `Best of luck!\n\n` +
    `Warm regards,\n\n` +
    `Talent Acquisition Team\n` +
    `Crinza`;

} else if (status === "Selected") {
  mailBody += `Congratulations and welcome aboard!\n\n` +
    `Following your stellar performance throughout our interview process, we are absolutely delighted to offer you the position of ${candidate.appliedFor} at Crinza.\n\n` +
    `We believe your skills and expertise will be a fantastic addition to our team. Our HR team will send over your formal official offer letter along with the onboarding details shortly.\n\n` +
    `Congratulations once again on this milestone. We are thrilled at the prospect of working together!\n\n` +
    `Warm regards,\n\n` +
    `HR Department\n` +
    `Crinza`;

} else if (status === "Rejected") {
  mailBody += `Thank you for taking the time to speak with our team and for your interest in the ${candidate.appliedFor} role at Crinza. We truly appreciate the effort you put into the application and interview process.\n\n` +
    `While we were deeply impressed by your credentials, we have decided to move forward with other candidates whose profiles more closely align with our current requirements for this specific opening.\n\n` +
    `Feedback from our evaluation: "${hrReview || "You have a strong profile, but we found a closer match for this specific role at this time."}"\n\n` +
    `We will keep your resume in our talent pool for future opportunities that might be a better fit. We wish you the absolute best in your job search and professional career.\n\n` +
    `Warm regards,\n\n` +
    `Talent Acquisition Team\n` +
    `Crinza`;
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
      return res.status(403).json({ success: false, message: "Access denied!" });
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
    const { month, year } = req.query; // e.g., month="09", year="2026"
    if (!month || !year) {
      return res.status(400).json({ success: false, message: "Month and year are required." });
    }

    const employees = await User.find({ role: { $ne: "boss" } });
    
    // Holiday model check
    const Holiday = mongoose.models.Holiday || mongoose.model("Holiday", new mongoose.Schema({
      title: String,
      date: String,
      description: String
    }));

    const holidays = await Holiday.find({
      date: { $regex: `^${year}-${month}` }
    });
    const holidayDates = holidays.map(h => h.date);

    // Dynamic DaySession model for attendance
    const DaySession = mongoose.models.DaySession || mongoose.model("DaySession", new mongoose.Schema({}, { strict: false }), "daysessions");
    const allSessionsInMonth = await DaySession.find({
      date: { $regex: `^${year}-${month}` }
    });

    let summary = [];

    // Current date details for future-proofing absent calculation
    const today = new Date();
    const currentYear = String(today.getFullYear());
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentDay = today.getDate();

    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Agar selected month current month hai, toh calculation sirf aaj (currentDay) tak hogi
    // Agar past month hai, toh poore mahine ke din count honge. Agar future month hai, toh 0 working days.
    let targetDaysCount = daysInMonth;
    if (year === currentYear && month === currentMonth) {
      targetDaysCount = currentDay;
    } else if (new Date(`${year}-${month}-01`) > today) {
      targetDaysCount = 0; // Future month
    }

    for (const emp of employees) {
      // Filter sessions up to today for this specific employee
      const empSessions = allSessionsInMonth.filter(s => {
        const isMatchUser = (s.salespersonId === emp.userId || s.salespersonId === emp._id.toString());
        // Sirf aaj ya past ki attendance count ho
        const isPastOrToday = s.date <= new Date().toISOString().split('T')[0];
        return isMatchUser && isPastOrToday;
      });

      // Present count (status "ENDED", "ACTIVE", "Present", "Late" sabko include karein)
      const presentDays = empSessions.filter(s => 
        s.status === "ENDED" || s.status === "ACTIVE" || s.status === "Present" || s.status === "Late"
      ).length;

      // 2. Fetch approved leaves for this user up to target days
      const approvedLeaves = await Leave.find({
        userId: emp.userId,
        status: "Approved"
      });

      let leaveDays = 0;
      approvedLeaves.forEach(leave => {
        if (leave.fromDate && leave.fromDate.startsWith(`${year}-${month}`)) {
          // Check if leave date is not in future
          if (leave.fromDate <= new Date().toISOString().split('T')[0]) {
            leaveDays += 1;
          }
        }
      });

      // Calculate Sundays up to targetDaysCount
      let totalSundays = 0;
      let totalHolidaysCount = 0;

      for (let day = 1; day <= targetDaysCount; day++) {
        const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
        const d = new Date(dateStr);
        
        // Count Sunday
        if (d.getDay() === 0) {
          totalSundays++;
        }
        
        // Count Holiday if falling in this range
        if (holidayDates.includes(dateStr)) {
          totalHolidaysCount++;
        }
      }
      
      // Absent calculation: Target Days tak mein se Present + Leaves + Sundays + Holidays minus karein
      let absentDays = Math.max(0, targetDaysCount - (presentDays + leaveDays + totalSundays + totalHolidaysCount));

      summary.push({
        userId: emp.userId,
        name: emp.name,
        role: emp.role,
        presentDays,
        leaveDays,
        sundays: totalSundays,
        holidays: totalHolidaysCount,
        absentDays
      });
    }

    res.json({ success: true, summary });
  } catch (err) {
    console.error("Error generating attendance summary:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


router.post("/holidays", verifyToken, async (req, res) => {
  try {
    const { title, date, description } = req.body;
    const Holiday = mongoose.models.Holiday || mongoose.model("Holiday", new mongoose.Schema({
      title: String,
      date: String,
      description: String
    }));
    const newHoliday = new Holiday({ title, date, description });
    await newHoliday.save();
    res.json({ success: true, message: "Holiday added successfully!", holiday: newHoliday });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const Holiday = require("../models/Holiday");

// Get Holidays
router.get("/holidays", verifyToken, async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    res.json({ success: true, holidays });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add Holiday
router.post("/holidays", verifyToken, async (req, res) => {
  try {
    const { title, date, description } = req.body;
    const newHoliday = new Holiday({ title, date, description });
    await newHoliday.save();
    res.json({ success: true, message: "Holiday added successfully!", holiday: newHoliday });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;