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
    
    // 1. Existing lead ko find karein
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    // 🌟 2. Check karein ki kya pehle se demo completed tha ya abhi naya complete hua hai
    const wasAlreadyCompleted = lead.demoStatus === "Completed";

    // 3. Update fields map karein
    const updateFields = {};
    if (leadStatus) updateFields.leadStatus = leadStatus;
    if (demoStatus) updateFields.demoStatus = demoStatus;
    if (notes) updateFields.notes = notes;
    if (followUpDate) updateFields.followUpDate = followUpDate;
    if (followUpTime) updateFields.followUpTime = followUpTime;
    if (followUpAction) updateFields.followUpAction = followUpAction;

    // 4. Agar Demo Completed hai, toh user ki select ki hui date save karein
    if (demoStatus === "Completed") {
      updateFields.demoCompletedAt = demoCompletedAt || demoDoneDate || new Date();
    }

    // 5. Agar meeting photo upload hui hai
    if (req.file) {
      updateFields.meetingPhoto = req.file.path;
    }

    // 6. Database update execute karein
    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );

    // 🌟 7. Agar pehle completed nahi tha aur ab successfully "Completed" ho gaya, toh points add karein
    if (demoStatus === "Completed" && !wasAlreadyCompleted) {
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

    if (calls.length === 0) {
      return res.json({
        success: true,
        message: "No device calls to sync.",
        inserted: 0,
        skipped: 0,
        updated: 0,
      });
    }

    const salespersonId = req.user.userId;

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
        // Normalize phone number
        // Same normalization used by CRM calls.
        // -----------------------------------------------------

        const normalizedPhone = String(phoneNumber)
          .replace(/\D/g, "")
          .slice(-10);

        if (!normalizedPhone) {
          skipped++;
          continue;
        }

        // -----------------------------------------------------
        // Validate timestamp
        // Android gives milliseconds.
        // -----------------------------------------------------

        const timestampNumber = Number(timestamp);

        if (
          !Number.isFinite(timestampNumber) ||
          timestampNumber <= 0
        ) {
          skipped++;
          continue;
        }

        const deviceDate = new Date(timestampNumber);

        if (Number.isNaN(deviceDate.getTime())) {
          skipped++;
          continue;
        }

        // -----------------------------------------------------
        // Duration
        // -----------------------------------------------------

        const duration = Math.max(
          0,
          Number(durationSeconds) || 0
        );

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
        // Find matching Lead
        // -----------------------------------------------------
        // We use the same normalized phone number.
        //
        // IMPORTANT:
        // Your Lead schema must contain the actual phone field
        // used by your CRM. The existing project uses Lead data,
        // so this first checks common fields safely.
        // -----------------------------------------------------

        let lead = null;

        try {
          lead = await Lead.findOne({
            $or: [
              { phoneNumber: normalizedPhone },
              { phone: normalizedPhone },
              { mobile: normalizedPhone },
              { mobileNumber: normalizedPhone },
              { contactNumber: normalizedPhone },
            ],
          }).lean();
        } catch (leadError) {
          console.warn(
            "Lead phone matching warning:",
            leadError.message
          );
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
            "";
        }

        // -----------------------------------------------------
        // Determine call status
        // -----------------------------------------------------

        let callStatus = "NOT_CONNECTED";

        const normalizedType = String(
          type || ""
        ).toUpperCase();

        // -----------------------------------------------------
        // MISSED
        // -----------------------------------------------------

        if (normalizedType === "MISSED") {
          callStatus = "MISSED";
        }

        // -----------------------------------------------------
        // REJECTED
        // -----------------------------------------------------

        else if (normalizedType === "REJECTED") {
          callStatus = "REJECTED";
        }

        // -----------------------------------------------------
        // BLOCKED
        // -----------------------------------------------------

        else if (normalizedType === "BLOCKED") {
          callStatus = "FAILED";
        }

        // -----------------------------------------------------
        // OUTGOING / INCOMING
        // duration > 0 means call was connected
        // -----------------------------------------------------

        else if (
          normalizedType === "OUTGOING" ||
          normalizedType === "INCOMING"
        ) {
          if (
            Boolean(connected) ||
            duration > 0
          ) {
            callStatus = "ENDED";
          } else {
            callStatus = "NOT_CONNECTED";
          }
        }

        // -----------------------------------------------------
        // Unknown type fallback
        // -----------------------------------------------------

        else {
          if (duration > 0) {
            callStatus = "ENDED";
          } else {
            callStatus = "NOT_CONNECTED";
          }
        }

        // -----------------------------------------------------
        // Connected time
        // -----------------------------------------------------

        let connectedAt = null;

        if (
          callStatus === "ENDED" &&
          duration > 0
        ) {
          connectedAt = new Date(
            deviceDate.getTime()
          );
        }

        // -----------------------------------------------------
        // End time
        // -----------------------------------------------------

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

          leadId: lead?._id || null,

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

        inserted++;

        syncedCalls.push(newCall);

      } catch (callError) {
        console.error(
          "Device call sync item error:",
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

      message: "Device call logs synced successfully.",

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



module.exports = router;