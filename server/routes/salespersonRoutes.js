const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");

const User = require("../models/User");
const Invoice = require("../models/Invoice");
const Lead = require("../models/Lead");
const Task = require("../models/Task");
const CallLog = require("../models/CallLog");
const DaySession = require("../models/DaySession");
const Broadcast = require("../models/Broadcast");

const { addSalespersonPoints } = require("../utils/salespersonPoints");
const { calculateDistance } = require("../utils/distanceHelper");

const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

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

    const workingHours = ((endTimeDate - new Date(session.startTime)) / (1000 * 60 * 60)).toFixed(1);
    res.json({ success: true, message: "Day ended successfully.", summary: { workingHours: `${workingHours} hrs` } });
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
    const { status, durationSeconds, connectedAt } = req.body;
    const call = await CallLog.findOne({ _id: req.params.id, salespersonId: req.user.userId });
    if (!call) return res.status(404).json({ message: "Call record not found" });

    const wasAlreadyConnected = call.status === "CONNECTED" || call.status === "ENDED";
    call.status = status || "ENDED";
    call.endedAt = new Date();
    call.durationSeconds = Number(durationSeconds) || 0;
    await call.save();

    if ((status === "CONNECTED" || status === "ENDED") && !wasAlreadyConnected) {
      await addSalespersonPoints(req.user.userId, "CALL_CONNECTED");
    }
    res.json({ success: true, message: "Call updated successfully", call });
  } catch (err) {
    res.status(500).json({ message: "Failed to update call", error: err.message });
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
    }

    const calls = await CallLog.find({ salespersonId: req.user.userId, dialedAt: { $gte: startDate, $lte: endDate } }).lean();
    res.json({ success: true, analytics: { totalDials: calls.length } });
  } catch (err) {
    res.status(500).json({ message: "Failed to calculate call analytics", error: err.message });
  }
});

// --- 🗂️ LEADS, DEALS & TASKS ---
router.get("/my-leads", verifyToken, async (req, res) => {
  try {
    const leads = await Lead.find({ salespersonId: req.user.userId }).sort({ createdAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch leads history", error: err.message });
  }
});

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

router.put("/leads/:id", verifyToken, upload.single("meetingPhoto"), async (req, res) => {
  try {
    const updatedLead = await Lead.findByIdAndUpdate(req.params.id, { $set: req.body }, { returnDocument: "after" });
    if (!updatedLead) return res.status(404).json({ message: "Lead not found" });
    res.json({ message: "Lead updated successfully!", lead: updatedLead });
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
    const broadcasts = await Broadcast.find({ deletedFor: { $ne: req.user.userId } }).sort({ createdAt: -1 });
    res.json(broadcasts);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch broadcasts", error: err.message });
  }
});

router.get("/notifications", verifyToken, async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
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

    const formattedNotifications = tasks.map((t) => ({
      _id: t._id,
      title: `${t.taskType.toUpperCase()} Reminder`,
      message: `Pending task for institute: ${t.instituteName} (Due: ${t.dueDate || 'N/A'})`,
      isRead: false,
      createdAt: t.createdAt,
      dueDate: t.dueDate,
    }));
    res.json(formattedNotifications);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch notifications", error: err.message });
  }
});



module.exports = router;