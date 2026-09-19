const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");

const User = require("../models/User");
const Notification = require("../models/Notification");
const Invoice = require("../models/Invoice");
const Lead = require("../models/Lead");
const Task = require("../models/Task");
const CallLog = require("../models/CallLog");
const DaySession = require("../models/DaySession");
const Broadcast = require("../models/Broadcast");
const mongoose = require("mongoose");

const { addSalespersonPoints } = require("../utils/salespersonPoints");
const { calculateDistance } = require("../utils/distanceHelper");

const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const { calculateLeadScore } = require("../utils/leadScorer");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: { folder: "crinza_uploads", allowed_formats: ["jpg", "jpeg", "png", "webp", "heic", "heif"] },
});

const callRecordingStorage = new CloudinaryStorage({
  cloudinary,
  params: { folder: "crinza_call_recordings", resource_type: "video" },
});

const upload = multer({ storage: storage });
const uploadCallRecording = multer({ storage: callRecordingStorage });

// --- 🌟 SAVE FCM TOKEN ---
router.post("/save-fcm-token", verifyToken, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ message: "FCM token is required" });
    await User.findOneAndUpdate({ userId: req.user.userId }, { $set: { fcmToken } });
    res.json({ success: true, message: "FCM Token saved successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Failed to save FCM token", error: err.message });
  }
});

// --- ⏱️ SHIFT / DAY CONTROL ---
router.get("/day-status", verifyToken, async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const session = await DaySession.findOne({ salespersonId: req.user.userId, date: today });
    if (!session) return res.json({ status: "NOT_STARTED", session: null });
    res.json({ status: session.status, startAddress: session.startAddress || "", session });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch day status", error: err.message });
  }
});

router.post("/start-day", verifyToken, async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const existing = await DaySession.findOne({ salespersonId: req.user.userId, date: today });

    if (existing && existing.status === "STARTED") {
      return res.status(400).json({ message: "Working day has already been started today!" });
    }
    if (existing && existing.status === "ENDED") {
      return res.status(400).json({ message: "You have already ended your day today. Cannot restart." });
    }

    const { latitude, longitude, startAddress } = req.body;
    const newSession = new DaySession({
      salespersonId: req.user.userId,
      date: today,
      status: "STARTED",
      startTime: new Date(),
      startLocation: { latitude: Number(latitude) || 0, longitude: Number(longitude) || 0 },
      startAddress: startAddress || "",
      distancePoints: [{ type: "START", referenceId: null, latitude: Number(latitude) || 0, longitude: Number(longitude) || 0, timestamp: new Date(), distanceFromPreviousKm: 0, totalDistanceKm: 0 }],
      totalDistanceKm: 0
    });

    await newSession.save();
    res.status(201).json({ success: true, message: "Day started successfully!", startAddress: newSession.startAddress, session: newSession });
  } catch (err) {
    res.status(500).json({ message: "Failed to start day", error: err.message });
  }
});

router.post("/end-day", verifyToken, async (req, res) => {
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const session = await DaySession.findOne({ salespersonId: req.user.userId, date: today, status: "STARTED" });
    if (!session) return res.status(400).json({ message: "No active day session found to end!" });

    const { latitude, longitude } = req.body;
    const endTimeDate = new Date();
    
    session.status = "ENDED";
    session.endTime = endTimeDate;
    session.endLocation = { latitude: Number(latitude) || 0, longitude: Number(longitude) || 0 };
    await session.save();

    // ⏱️ 1. Format Start & End Time (12-hour format with AM/PM)
    const startTimeFormatted = new Date(session.startTime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: '2-digit', minute: '2-digit' });
    const endTimeFormatted = endTimeDate.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: '2-digit', minute: '2-digit' });

    // ⏳ 2. Calculate Working Hours
    const workingHoursNum = ((endTimeDate - new Date(session.startTime)) / (1000 * 60 * 60)).toFixed(1);
    const workingHours = `${workingHoursNum} hrs`;

    // 📍 3. Calculate Total Visits (Leads created today)
    const totalVisits = await Lead.countDocuments({
      salespersonId: req.user.userId,
      leadDate: today
    });

    // 💰 4. Calculate Total Collections (Invoices paid today by this salesperson)
    const invoicesToday = await Invoice.find({
      salespersonId: req.user.userId,
      status: { $ne: 'rejected' },
      createdAt: { 
        $gte: new Date(`${today}T00:00:00.000Z`), 
        $lte: new Date(`${today}T23:59:59.999Z`) 
      }
    });
    const totalCollected = invoicesToday.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

    // 🛣️ 5. Total Distance (Fallback to session totalDistanceKm or 0)
    const totalDistanceKm = session.totalDistanceKm || 0;

    res.json({ 
      success: true, 
      message: "Day ended successfully.", 
      summary: { 
        startTime: startTimeFormatted,
        endTime: endTimeFormatted,
        workingHours, 
        totalVisits,
        totalCollected,
        totalDistanceKm
      } 
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to end day", error: err.message });
  }
});

// --- 📞 CALL TRACKING & ANALYTICS ---
router.post("/calls/start", verifyToken, async (req, res) => {
  try {
    const { leadId, customerName, phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ message: "Phone number is required" });

    const normalizedPhone = String(phoneNumber).replace(/\D/g, "").slice(-10);
    if (!normalizedPhone) return res.status(400).json({ message: "Invalid phone number" });

    const call = await CallLog.create({
      salespersonId: req.user.userId,
      leadId: leadId || null,
      customerName: customerName || "",
      phoneNumber: normalizedPhone,
      status: "INITIATED",
      dialedAt: new Date(),
    });

    await addSalespersonPoints(req.user.userId, "DIAL_CALL");
    res.status(201).json({ success: true, message: "Call initiated and tracked", call });
  } catch (err) {
    res.status(500).json({ message: "Failed to track call", error: err.message });
  }
});

router.patch("/calls/:callId/connected", verifyToken, async (req, res) => {
  try {
    const call = await CallLog.findOne({ _id: req.params.callId, salespersonId: req.user.userId });
    if (!call) return res.status(404).json({ message: "Call record not found" });

    if (call.status !== "CONNECTED") {
      call.status = "CONNECTED";
      call.connectedAt = new Date();
      await call.save();
      await addSalespersonPoints(req.user.userId, "CALL_CONNECTED");
    }
    res.json({ success: true, message: "Call marked as connected", call });
  } catch (err) {
    res.status(500).json({ message: "Failed to update connected call", error: err.message });
  }
});

router.put("/calls/:id/end", verifyToken, async (req, res) => {
  try {
    const {
      status,
      durationSeconds,
      connectedAt,
    } = req.body;

    const call = await CallLog.findOne({
      _id: req.params.id,
      salespersonId: req.user.userId,
    });

    if (!call) {
      return res.status(404).json({
        message: "Call record not found",
      });
    }

    // Check whether this call was already counted as connected
    const wasAlreadyConnected =
      call.status === "CONNECTED" ||
      call.status === "ENDED";

    const newStatus = status || "ENDED";
    const duration = Number(durationSeconds) || 0;

    // ---------------------------------------------------------
    // UPDATE CALL STATUS
    // ---------------------------------------------------------

    call.status = newStatus;

    // ---------------------------------------------------------
    // CONNECTED AT
    // ---------------------------------------------------------

    if (connectedAt) {
      call.connectedAt = new Date(connectedAt);
    } else if (
      !call.connectedAt &&
      (newStatus === "CONNECTED" || newStatus === "ENDED") &&
      duration > 0
    ) {
      // Estimate connection time from end time - duration
      call.connectedAt = new Date(
        Date.now() - duration * 1000
      );
    }

    // ---------------------------------------------------------
    // ENDED AT
    // ---------------------------------------------------------

    call.endedAt = new Date();

    // ---------------------------------------------------------
    // DURATION
    // ---------------------------------------------------------

    call.durationSeconds = duration;

    await call.save();

    // ---------------------------------------------------------
    // SALESPERSON POINTS
    // ---------------------------------------------------------
    // Count connected call only once.

    if (
      (newStatus === "CONNECTED" ||
        newStatus === "ENDED") &&
      !wasAlreadyConnected
    ) {
      await addSalespersonPoints(
        req.user.userId,
        "CALL_CONNECTED"
      );
    }

    return res.json({
      success: true,
      message: "Call updated successfully",
      call,
    });

  } catch (err) {
    console.error(
      "❌ Failed to update call:",
      err
    );

    return res.status(500).json({
      message: "Failed to update call",
      error: err.message,
    });
  }
});

router.get("/calls", verifyToken, async (req, res) => {
  try {
    const calls = await CallLog.find({ salespersonId: req.user.userId }).sort({ dialedAt: -1 }).limit(100).lean();
    res.json(calls);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch call history", error: err.message });
  }
});

router.get("/call-analytics", verifyToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    const now = new Date();
    let startDate, endDate;

    if (from || to) {
      startDate = new Date(`${from}T00:00:00`);
      endDate = new Date(`${to}T23:59:59.999`);
    } else {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    }

    const salespersonId = req.user.userId;

    // MongoDB Aggregation to get total count, total duration, and breakdown by status/type
    const summary = await CallLog.aggregate([
      { 
        $match: { 
          salespersonId, 
          dialedAt: { $gte: startDate, $lte: endDate } 
        } 
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalDuration: { $sum: "$durationSeconds" }
        }
      }
    ]);

    const totalCalls = summary.reduce((acc, curr) => acc + curr.count, 0);
    const totalDurationAll = summary.reduce((acc, curr) => acc + curr.totalDuration, 0);

    res.json({
      success: true,
      analytics: {
        totalCalls,
        totalDurationAll,
        breakdown: summary,
        dateRange: { from: startDate, to: endDate }
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to calculate call analytics", error: err.message });
  }
});

// --- 📊 CALL ANALYTICS SUMMARY (Cally App Style Dashboard) ---
router.get("/calls/analytics-summary", verifyToken, async (req, res) => {
  try {
    const salespersonId = req.user.userId;
    const { from, to } = req.query;

    let matchQuery = { salespersonId };
    
    // Optional date filter support
    if (from || to) {
      matchQuery.dialedAt = {};
      if (from) matchQuery.dialedAt.$gte = new Date(`${from}T00:00:00`);
      if (to) matchQuery.dialedAt.$lte = new Date(`${to}T23:59:59.999`);
    }

    // MongoDB Aggregation Pipeline to calculate status counts and total durations
    const summary = await CallLog.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalDuration: { $sum: "$durationSeconds" }
        }
      }
    ]);

    const totalCalls = summary.reduce((acc, curr) => acc + curr.count, 0);
    const totalDurationAll = summary.reduce((acc, curr) => acc + curr.totalDuration, 0);

    res.json({
      success: true,
      totalCalls,
      totalDurationAll,
      breakdown: summary
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch call analytics summary", 
      error: err.message 
    });
  }
});

// --- 🗂️ LEADS, DEALS & TASKS ---
// router.get("/my-leads", verifyToken, async (req, res) => {
//   try {
//     const leads = await Lead.find({ salespersonId: req.user.userId }).sort({ createdAt: -1 });
//     res.json(leads);
//   } catch (err) {
//     res.status(500).json({ message: "Failed to fetch leads history", error: err.message });
//   }
// });

router.get("/my-deals", verifyToken, async (req, res) => {
  try {
    const rawDeals = await Invoice.find({ salespersonId: req.user.userId, status: { $ne: 'rejected' } }).sort({ createdAt: 1 });
    res.json(rawDeals);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch deals history", error: err.message });
  }
});

router.post("/leads", verifyToken, upload.single("meetingPhoto"), async (req, res) => {
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const session = await DaySession.findOne({ salespersonId: req.user.userId, date: today });
    if (!session || session.status !== "STARTED") {
      return res.status(403).json({ message: "Action Blocked: Start your working day first!" });
    }

    const { instituteName, contactPerson, mobileNo, email, address, city, state, pincode, notes, latitude, longitude, followUpDate, followUpTime, followUpAction } = req.body;
    if (!mobileNo || !city || !state) return res.status(400).json({ message: "Required fields missing!" });

    const newLead = new Lead({
      instituteName: instituteName || "Unknown Institute",
      contactPerson: contactPerson || "N/A",
      mobileNo: mobileNo.trim(),
      email: email || "",
      address: address || "",
      pincode: pincode || "",
      city, state, notes: notes || "",
      meetingPhoto: req.file ? req.file.path : "",
      latitude: Number(latitude) || 0,
      longitude: Number(longitude) || 0,
      leadDate: today,
      leadTime: new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: '2-digit', minute: '2-digit', hour12: false }),
      salespersonId: req.user.userId,
    });

    await newLead.save();
    await addSalespersonPoints(req.user.userId, "LEAD_CREATED");
    res.status(201).json({ success: true, message: "Lead recorded successfully!", lead: newLead });
  } catch (err) {
    res.status(500).json({ message: "Failed to save lead", error: err.message });
  }
});

// router.put("/leads/:id", verifyToken, upload.single("meetingPhoto"), async (req, res) => {
//   try {
//     const updatedLead = await Lead.findByIdAndUpdate(req.params.id, { $set: req.body }, { returnDocument: "after" });
//     if (!updatedLead) return res.status(404).json({ message: "Lead not found" });
//     res.json({ message: "Lead updated successfully!", lead: updatedLead });
//   } catch (err) {
//     res.status(500).json({ message: "Failed to update lead", error: err.message });
//   }
// });

router.put("/leads/:id", verifyToken, upload.single("meetingPhoto"), async (req, res) => {
  try {
    const { leadStatus, demoStatus, demoCompletedAt, demoDoneDate, notes, followUpDate, followUpTime, followUpAction } = req.body;
    
    // 1. Find existing lead
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    // 🌟 2. Normalize and check if it's newly completed (case-insensitive)
    const isNewDemoCompleted = demoStatus && demoStatus.toLowerCase() === "completed";
    const wasAlreadyCompleted = lead.demoStatus && lead.demoStatus.toLowerCase() === "completed";

    // 3. Map update fields
    const updateFields = {};
    if (leadStatus) updateFields.leadStatus = leadStatus;
    if (demoStatus) updateFields.demoStatus = demoStatus;
    if (notes) updateFields.notes = notes;
    if (followUpDate) updateFields.followUpDate = followUpDate;
    if (followUpTime) updateFields.followUpTime = followUpTime;
    if (followUpAction) updateFields.followUpAction = followUpAction;

    // 4. If Demo Completed, save the selected date
    if (isNewDemoCompleted) {
      updateFields.demoCompletedAt = demoCompletedAt || demoDoneDate || new Date();
    }

    // 5. If a meeting photo was uploaded
    if (req.file) {
      updateFields.meetingPhoto = req.file.path;
    }

    // 6. Execute database update
    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );

    // 🌟 7. If it wasn't completed before and is now completed, add points!
    if (isNewDemoCompleted && !wasAlreadyCompleted) {
      const targetDate = updateFields.demoCompletedAt 
        ? new Date(updateFields.demoCompletedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) 
        : undefined;

      await addSalespersonPoints(req.user.userId, "DEMO_DONE", targetDate);
    }

    res.json({ success: true, message: "Lead updated successfully!", lead: updatedLead });
  } catch (err) {
    res.status(500).json({ message: "Failed to update lead", error: err.message });
  }
});


router.get("/tasks", verifyToken, async (req, res) => {
  try {
    const tasks = await Task.find({ salespersonId: req.user.userId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch tasks", error: err.message });
  }
});

router.get("/points/today", verifyToken, async (req, res) => {
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const SalespersonPoint = require("../models/SalespersonPoint");
    const points = await SalespersonPoint.findOne({ salespersonId: req.user.userId, date: today }).lean();
    res.json({ success: true, totalPoints: points?.totalPoints || 0, breakdown: points || {} });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch points", error: err.message });
  }
});

router.get("/broadcasts", verifyToken, async (req, res) => {
  try {
    const userIdStr = req.user.userId;
    const userObjId = req.user._id || req.user.id;

    // User document find karein taaki dismissedBroadcasts array mil sake
    const currentUser = await User.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(userObjId) ? userObjId : null },
        { userId: userIdStr }
      ]
    });

    const dismissedIds = currentUser?.dismissedBroadcasts || [];

    // Woh broadcasts fetch karein jo na toh 'deletedFor' mein hon aur na hi user ki 'dismissedBroadcasts' list mein
    const broadcasts = await Broadcast.find({
      _id: { $nin: dismissedIds },
      deletedFor: { $ne: userIdStr }
    }).sort({ createdAt: -1 });

    res.json(broadcasts);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch broadcasts", error: err.message });
  }
});
router.get("/notifications", verifyToken, async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // 1. Fetch Task-based reminders
    const tasks = await Task.find({
      salespersonId: req.user.userId,
      status: "pending",
      $or: [
        { dueDate: { $exists: false } },
        { dueDate: null },
        { dueDate: "" },
        { dueDate: { $lte: today } }
      ]
    }).sort({ createdAt: -1 });

    const taskNotifications = tasks.map((t) => ({
      _id: t._id,
      title: `${t.taskType ? t.taskType.toUpperCase() : 'TASK'} Reminder`,
      message: `Pending task for institute: ${t.instituteName} (Due: ${t.dueDate || 'N/A'})`,
      isRead: false,
      createdAt: t.createdAt,
      dueDate: t.dueDate,
      type: "task" // 👈 Type "task"
    }));

    // 2. Fetch HR Direct Messages & Broadcast Notifications
    const currentUser = await User.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(req.user.userId || req.user.id) ? (req.user.userId || req.user.id) : null },
        { userId: req.user.userId || req.user.id }
      ]
    });

    let dbNotifications = [];
    if (currentUser) {
      dbNotifications = await Notification.find({
        userId: currentUser._id,
        isRead: false
      }).sort({ createdAt: -1 });
    }

const hrNotifications = dbNotifications.map((n) => {
  // 🌟 Agar fileUrl nahi hai, toh message text ke andar se koi URL dhoondne ki koshish karo
  let extractedUrl = n.fileUrl || n.documentUrl || n.file || n.attachment || n.document || null;
  
  if (!extractedUrl && n.message) {
    const urlMatch = n.message.match(/(https?:\/\/[^\s]+)/g);
    if (urlMatch) extractedUrl = urlMatch[0];
  }

  return {
    _id: n._id,
    title: n.title || "HR Notification",
    message: n.message,
    fileUrl: extractedUrl,
    isRead: n.isRead || false,
    createdAt: n.createdAt,
    dueDate: n.dueDate || null,
    type: "hr_message"
  };
});

    // Send both categories separately to frontend
    res.json({
      success: true,
      tasks: taskNotifications,
      hrMessages: hrNotifications
    });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ message: "Failed to fetch notifications", error: err.message });
  }
});

// 2. Dismiss / Mark Notification as Read
router.put("/notifications/:id/dismiss", verifyToken, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true, message: "Notification dismissed" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to dismiss notification" });
  }
});

router.post("/broadcasts/:id/dismiss", verifyToken, async (req, res) => {
  try {
    const broadcastId = req.params.id;
    const userObjId = req.user._id || req.user.id;
    const userIdStr = req.user.userId;

    console.log("🔍 Dismissing broadcast:", broadcastId, "for user:", userIdStr || userObjId);

    // 1. Pehle user ko dhoondhein
    const currentUser = await User.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(userObjId) ? userObjId : null },
        { userId: userIdStr }
      ]
    });

    if (!currentUser) {
      console.log("❌ User not found for broadcast dismiss!");
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 2. Array mein push karein aur save karein
    if (!currentUser.dismissedBroadcasts) {
      currentUser.dismissedBroadcasts = [];
    }

    // Check karein ki pehle se added toh nahi hai
    if (!currentUser.dismissedBroadcasts.includes(broadcastId)) {
      currentUser.dismissedBroadcasts.push(broadcastId);
      await currentUser.save();
      console.log("✅ Broadcast permanently saved to user dismissed list!");
    }

    res.json({ success: true, message: "Broadcast permanently dismissed" });
  } catch (err) {
    console.error("🔥 Error dismissing broadcast:", err);
    res.status(500).json({ success: false, message: "Failed to dismiss broadcast", error: err.message });
  }
});

// =============================================================
// 📞 SYNC ANDROID DEVICE CALL LOGS
// =============================================================
// This endpoint receives calls read directly from the Android
// device call history and stores them in CRM.
//
// Frontend:
// POST /api/salesperson/calls/sync
//
// Body:
// {
//   calls: [
//     {
//       deviceCallLogId,
//       phoneNumber,
//       type,
//       timestamp,
//       durationSeconds,
//       connected
//     }
//   ]
// }
// =============================================================
router.post("/calls/sync", verifyToken, async (req, res) => {
  try {
    const { calls } = req.body;

    // ---------------------------------------------------------
    // Validate request
    // ---------------------------------------------------------

    if (!Array.isArray(calls)) {
      return res.status(400).json({
        success: false,
        message: "calls must be an array",
      });
    }

    const salespersonId = req.user.userId;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    // 🌟 1. Check if the salesperson has an active started day session today
    const activeSession = await DaySession.findOne({
      salespersonId,
      date: today,
      status: "STARTED"
    });

    // Agar salesperson ne aaj "Start Day" nahi kiya hai, toh saare calls skip kar do!
    if (!activeSession || !activeSession.startTime) {
      return res.json({
        success: true,
        message: "Call sync skipped: Working day not started yet today.",
        inserted: 0,
        skipped: calls.length,
        updated: 0,
      });
    }

    // 🌟 2. Exact timestamp jab salesperson ne day start kiya tha
    const shiftStartTime = new Date(activeSession.startTime).getTime();

    if (calls.length === 0) {
      return res.json({
        success: true,
        message: "No device calls to sync.",
        inserted: 0,
        skipped: 0,
        updated: 0,
      });
    }

    let inserted = 0;
    let skipped = 0;
    let updated = 0;

    const syncedCalls = [];

    // ---------------------------------------------------------
    // Process every Android call
    // ---------------------------------------------------------

    for (const deviceCall of calls) {
      try {
        const {
          deviceCallLogId,
          phoneNumber,
          type,
          timestamp,
          durationSeconds,
          connected,
        } = deviceCall;

        // -----------------------------------------------------
        // Basic validation
        // -----------------------------------------------------

        if (!deviceCallLogId || !phoneNumber) {
          skipped++;
          continue;
        }

        // -----------------------------------------------------
        // Validate timestamp
        // -----------------------------------------------------

        const timestampNumber = Number(timestamp);

        if (
          !Number.isFinite(timestampNumber) ||
          timestampNumber <= 0
        ) {
          skipped++;
          continue;
        }

        // 🌟 3. SHIFT START TIME CHECK: Agar call "Start Day" time se pehle ki hai, toh skip karo!
        if (timestampNumber < shiftStartTime) {
          skipped++;
          continue;
        }

        const deviceDate = new Date(timestampNumber);

        if (Number.isNaN(deviceDate.getTime())) {
          skipped++;
          continue;
        }

        // -----------------------------------------------------
        // Normalize phone number (last 10 digits)
        // -----------------------------------------------------

        const normalizedPhone = String(phoneNumber)
          .replace(/\D/g, "")
          .slice(-10);

        if (!normalizedPhone || normalizedPhone.length < 10) {
          skipped++;
          continue;
        }

        // -----------------------------------------------------
        // Find existing call using Android Call Log ID
        // -----------------------------------------------------

        const existingDeviceCall =
          await CallLog.findOne({
            salespersonId,
            deviceCallLogId: String(deviceCallLogId),
          });

        // -----------------------------------------------------
        // Already synced
        // -----------------------------------------------------

        if (existingDeviceCall) {
          skipped++;
          syncedCalls.push(existingDeviceCall);
          continue;
        }

        // -----------------------------------------------------
        // 🌟 FIND MATCHING LEAD & APPLY SAME-DAY / PRIOR VALIDATION
        // -----------------------------------------------------

        let lead = null;
        const callDateStr = deviceDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

        try {
          // Search for lead matching the 10-digit phone number across possible fields
          const matchingLeads = await Lead.find({
            $or: [
              { phoneNumber: { $regex: new RegExp(normalizedPhone + "$") } },
              { phone: { $regex: new RegExp(normalizedPhone + "$") } },
              { mobile: { $regex: new RegExp(normalizedPhone + "$") } },
              { mobileNumber: { $regex: new RegExp(normalizedPhone + "$") } },
              { contactNumber: { $regex: new RegExp(normalizedPhone + "$") } },
              { mobileNo: { $regex: new RegExp(normalizedPhone + "$") } },
            ],
          }).lean();

          // Filter leads to ensure lead creation date <= call date (Same-day or prior lead creation)
          for (const candidateLead of matchingLeads) {
            const leadCreatedAt = candidateLead.createdAt || candidateLead.leadDate || candidateLead._id.getTimestamp();
            const leadDateStr = new Date(leadCreatedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

            if (leadDateStr <= callDateStr) {
              lead = candidateLead;
              break;
            }
          }
        } catch (leadError) {
          console.warn(
            "Lead phone matching warning:",
            leadError.message
          );
        }

        // If no valid lead found created on or before the call date, skip this call (Personal / unrelated call)
        if (!lead) {
          skipped++;
          continue;
        }

        // -----------------------------------------------------
        // Customer name
        // -----------------------------------------------------

        let customerName = "";

        if (lead) {
          customerName =
            lead.customerName ||
            lead.name ||
            lead.instituteName ||
            lead.schoolName ||
            lead.contactPerson ||
            "";
        }

        // -----------------------------------------------------
        // Determine call status
        // -----------------------------------------------------

        let callStatus = "NOT_CONNECTED";

        const normalizedType = String(
          type || ""
        ).toUpperCase();

        if (normalizedType === "MISSED") {
          callStatus = "MISSED";
        } else if (normalizedType === "REJECTED") {
          callStatus = "REJECTED";
        } else if (normalizedType === "BLOCKED") {
          callStatus = "FAILED";
        } else if (
          normalizedType === "OUTGOING" ||
          normalizedType === "INCOMING"
        ) {
          if (
            Boolean(connected) ||
            Number(durationSeconds) > 0
          ) {
            callStatus = "ENDED";
          } else {
            callStatus = "NOT_CONNECTED";
          }
        } else {
          if (Number(durationSeconds) > 0) {
            callStatus = "ENDED";
          } else {
            callStatus = "NOT_CONNECTED";
          }
        }

        const duration = Math.max(
          0,
          Number(durationSeconds) || 0
        );

        let connectedAt = null;

        if (
          callStatus === "ENDED" &&
          duration > 0
        ) {
          connectedAt = new Date(
            deviceDate.getTime()
          );
        }

        let endedAt = null;

        if (duration > 0) {
          endedAt = new Date(
            deviceDate.getTime() +
              duration * 1000
          );
        } else if (
          callStatus === "MISSED" ||
          callStatus === "REJECTED" ||
          callStatus === "NOT_CONNECTED"
        ) {
          endedAt = deviceDate;
        }

        // -----------------------------------------------------
        // Create CRM CallLog
        // -----------------------------------------------------

        const newCall = await CallLog.create({
          salespersonId,

          leadId: lead._id,

          customerName,

          phoneNumber: normalizedPhone,

          source: "DEVICE",

          deviceCallLogId:
            String(deviceCallLogId),

          deviceTimestamp: deviceDate,

          status: callStatus,

          dialedAt: deviceDate,

          connectedAt,

          endedAt,

          durationSeconds: duration,

          recordingUrl: "",

          recordingConsent: false,
        });

        // 🌟 4. POINT SAFEGUARD: Points sirf tabhi add honge jab call valid lead se match ho aur shift start hone ke baad ki ho
        try {
          await addSalespersonPoints(salespersonId, "DIAL_CALL");
          if (callStatus === "ENDED" || callStatus === "CONNECTED" || duration > 0) {
            await addSalespersonPoints(salespersonId, "CALL_CONNECTED");
          }
        } catch (pointErr) {
          console.error("Failed to add points for synced call:", pointErr);
        }

        inserted++;

        syncedCalls.push(newCall);

      } catch (callError) {
        console.error(
          "Device call item error:",
          callError
        );

        skipped++;
      }
    }

    // ---------------------------------------------------------
    // Return result
    // ---------------------------------------------------------

    return res.json({
      success: true,

      message: "Device call logs synced successfully with lead & same-day validation.",

      inserted,
      updated,
      skipped,

      totalReceived: calls.length,

      calls: syncedCalls,
    });

  } catch (err) {
    console.error(
      "🔥 Device call sync error:",
      err
    );

    return res.status(500).json({
      success: false,
      message: "Failed to sync device call logs.",
      error: err.message,
    });
  }
});

// --- 🗂️ LEADS, DEALS & TASKS ---
router.get("/my-leads", verifyToken, async (req, res) => {
  try {
    const leads = await Lead.find({ salespersonId: req.user.userId }).sort({ createdAt: -1 }).lean();

    // 🌟 Har lead ke sath scoring attach karna zaroori hai
    const enrichedLeads = await Promise.all(
      leads.map(async (lead) => {
        const scoring = await calculateLeadScore(lead);
        return {
          ...lead,
          aiScore: scoring.score,
          aiPriority: scoring.priority
        };
      })
    );

    enrichedLeads.sort((a, b) => b.aiScore - a.aiScore);

    res.json(enrichedLeads);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch leads history", error: err.message });
  }
});

// =========================================================================
// --- 🤖 AI SMART FOLLOW-UP TIME PREDICTOR ENDPOINT ---
// =========================================================================
router.get("/calls/best-time/:leadId", verifyToken, async (req, res) => {
  try {
    const { leadId } = req.params;
    
    // 1. Pehle lead ki details nikal lo taaki uska mobile number mil sake
    const lead = await Lead.findById(leadId);
    let searchCriteria = [{ leadId }];

    if (lead && lead.mobileNo) {
      const cleanPhone = String(lead.mobileNo).replace(/\D/g, "").slice(-10);
      // Phone number ke alag-alag formats (jaise 91xxxx ya sirf 10 digits) match karne ke liye
      searchCriteria.push({ phoneNumber: { $regex: cleanPhone } });
    }

    // 2. Ab leadId YA phone number dono mein se kisi se bhi match hone wale call logs nikal lo
    const calls = await CallLog.find({ 
      $or: searchCriteria,
      salespersonId: req.user.userId,
      status: { $in: ["CONNECTED", "ENDED"] } 
    });

    if (!calls || calls.length === 0) {
      return res.json({ 
        success: true, 
        hasData: false, 
        suggestion: "Best: 11:00 AM (Default)" 
      });
    }

    // 3. Ghanto (Hours) ki frequency count karein
    const hourCounts = {};
    calls.forEach(call => {
      const callTimestamp = call.dialedAt || call.timestamp;
      if (callTimestamp) {
        const hour = new Date(Number(callTimestamp) || callTimestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });

    let bestHour = 11;
    let maxCalls = 0;
    
    for (const [hour, count] of Object.entries(hourCounts)) {
      if (count > maxCalls) {
        maxCalls = count;
        bestHour = Number(hour);
      }
    }

    const amPm = bestHour >= 12 ? "PM" : "AM";
    const displayHour = bestHour > 12 ? bestHour - 12 : (bestHour === 0 ? 12 : bestHour);

    res.json({
      success: true,
      hasData: true,
      bestHour,
      suggestion: `Best: ${displayHour}:00 ${amPm} (${maxCalls} past calls)`
    });

  } catch (err) {
    console.error("AI Prediction Error:", err);
    res.status(500).json({ success: false, message: "Failed to calculate best calling time" });
  }
});

// --- 🎟️ VERIFY COUPON ROUTE ---
router.post("/coupons/verify", verifyToken, async (req, res) => {
  try {
    const Coupon = require("../models/Coupon");
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Coupon code required" });

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) {
      return res.status(404).json({ message: "Invalid coupon code!" });
    }

    if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate)) {
      return res.status(400).json({ message: "This coupon has expired!" });
    }

    res.json({
      success: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error verifying coupon", error: err.message });
  }
});


module.exports = router;