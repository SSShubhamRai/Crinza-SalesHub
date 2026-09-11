const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");

const User = require("../models/User");
const Invoice = require("../models/Invoice");
const Lead = require("../models/Lead");
const Task = require("../models/Task");
const Coupon = require("../models/Coupon");
const Broadcast = require("../models/Broadcast");
const CallLog = require("../models/CallLog");
const TechnicalTask = require("../models/TechnicalTask");
const DaySession = require("../models/DaySession");
const LocationLog = require("../models/LocationLog");
const SalespersonPoint = require("../models/SalespersonPoint");
const axios = require("axios");

// 1. Broadcast Route
router.post("/broadcast", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied! Admin privileges required." });
    }

    const { title, message, priority } = req.body;
    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required!" });
    }

    const newBroadcast = new Broadcast({
      adminId: req.user.userId,
      title,
      message,
      priority: priority || "normal",
      deletedFor: []
    });

    await newBroadcast.save();

    try {
      const adminSDK = require("firebase-admin");
      const salespersons = await User.find({ role: "salesperson", fcmToken: { $exists: true, $ne: null } });
      for (const sp of salespersons) {
        if (sp.fcmToken) {
          const pushMessage = {
            token: sp.fcmToken,
            notification: {
              title: `📢 ${title}`,
              body: message
            },
            android: { notification: { sound: 'default', priority: 'high' } }
          };
          await adminSDK.messaging().send(pushMessage);
        }
      }
      console.log("✅ Push notifications pushed to all active devices!");
    } catch (pushErr) {
      console.error("🔥 Error pushing notifications:", pushErr);
    }

    res.status(201).json({ success: true, message: "Broadcast sent & pushed successfully to all devices!" });
  } catch (err) {
    res.status(500).json({ message: "Failed to send broadcast", error: err.message });
  }
});

// 2. Salesperson Call Analytics
router.get("/salesperson-call-analytics/:salespersonId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "boss") {
      return res.status(403).json({ message: "Access denied!" });
    }

    const { salespersonId } = req.params;
    const { from, to } = req.query;

    const match = { salespersonId };

    if (from || to) {
      match.dialedAt = {};
      if (from) match.dialedAt.$gte = new Date(`${from}T00:00:00`);
      if (to) match.dialedAt.$lte = new Date(`${to}T23:59:59.999`);
    }

    const logs = await CallLog.find(match).sort({ dialedAt: -1 });
    const totalDials = logs.length;
    const uniquePhones = new Set(logs.map((call) => call.phoneNumber));

    const connectedCalls = logs.filter(
      (call) => call.status === "CONNECTED" || call.status === "ENDED"
    ).length;

    const notConnectedCalls = logs.filter(
      (call) =>
        call.status === "NOT_CONNECTED" ||
        call.status === "MISSED" ||
        call.status === "REJECTED" ||
        call.status === "FAILED"
    ).length;

    const totalDurationSeconds = logs.reduce(
      (sum, call) => sum + (Number(call.durationSeconds) || 0),
      0
    );

    const averageDurationSeconds =
      connectedCalls > 0 ? Math.floor(totalDurationSeconds / connectedCalls) : 0;
    const duplicateDials = totalDials - uniquePhones.size;

    return res.json({
      success: true,
      salespersonId,
      analytics: {
        totalDials,
        uniqueDials: uniquePhones.size,
        duplicateDials,
        connectedCalls,
        notConnectedCalls,
        totalDurationSeconds,
        averageDurationSeconds,
      },
    });
  } catch (err) {
    console.error("Admin salesperson call analytics error:", err);
    return res.status(500).json({
      message: "Failed to fetch salesperson call analytics",
      error: err.message,
    });
  }
});

// 3. Salesperson Points Analytics (FIXED & MERGED WORKING DAYS)
router.get("/salesperson-points/:salespersonId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "boss") {
      return res.status(403).json({ success: false, message: "Access denied!" });
    }

    const { salespersonId } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ success: false, message: "from and to dates are required" });
    }

    const fromDate = new Date(`${from}T00:00:00+05:30`);
    const toDate = new Date(`${to}T23:59:59.999+05:30`);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date range" });
    }

    if (fromDate > toDate) {
      return res.status(400).json({ success: false, message: "From date cannot be after To date" });
    }

    // 1. Fetch points records
    const pointRecords = await SalespersonPoint.find({
      salespersonId,
      date: { $gte: from, $lte: to },
    }).sort({ date: 1 }).lean();

    // 2. Find days where the shift was explicitly started
    const workingDayRecords = await DaySession.find({
      salespersonId,
      date: { $gte: from, $lte: to },
      status: "STARTED",
    }).lean();

    // 3. Find days where points/actions were recorded (fallback for missed shift clicks)
    const pointRecordsForWorkDays = await SalespersonPoint.find({
      salespersonId,
      date: { $gte: from, $lte: to },
      totalPoints: { $gt: 0 },
    }).lean();

    // 4. Merge unique dates from both collections to accurately calculate working days
    const workingDates = [
      ...new Set([
        ...workingDayRecords.map((s) => s.date),
        ...pointRecordsForWorkDays.map((p) => p.date),
      ]),
    ];

    const workingDays = workingDates.length;

    // 5. Generate all dates in range for daily breakdown
    let startDate = new Date(from);
    let endDate = new Date(to);
    let allDatesInRange = [];
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      allDatesInRange.push(d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
    }

    const totalPoints = pointRecords.reduce(
      (sum, record) => sum + (Number(record.totalPoints) || 0),
      0
    );

    const averagePoints = workingDays > 0 ? Number((totalPoints / workingDays).toFixed(2)) : 0;
    const pointsByDate = {};

    pointRecords.forEach((record) => {
      pointsByDate[record.date] = (pointsByDate[record.date] || 0) + (Number(record.totalPoints) || 0);
    });

    const dailyBreakdown = allDatesInRange.map((date) => {
      const pointRecord = pointRecords.find((record) => record.date === date);
      const sessionRecord = workingDayRecords.find((session) => session.date === date) || pointRecordsForWorkDays.find((p) => p.date === date);
      
      return {
        date,
        startedDay: Boolean(sessionRecord),
        totalPoints: pointsByDate[date] || 0,
        breakdown: {
          leadsCreated: pointRecord?.leadsCreated || 0,
          revisits: pointRecord?.revisits || 0,
          demosDone: pointRecord?.demosDone || 0,
          dealsClosed: pointRecord?.dealsClosed || 0,
          callsConnected: pointRecord?.callsConnected || 0,
          dialCalls: pointRecord?.dialCalls || 0,
        },
      };
    });

    return res.json({
      success: true,
      salespersonId,
      dateRange: { from, to },
      summary: {
        totalPoints,
        workingDays,
        averagePoints,
        targetPerDay: 100,
        targetAchievement:
          workingDays > 0 ? Number(((totalPoints / (workingDays * 100)) * 100).toFixed(2)) : 0,
      },
      dailyBreakdown,
    });
  } catch (err) {
    console.error("❌ Salesperson points analytics error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch salesperson points analytics",
      error: err.message,
    });
  }
});

// 4. Salesperson Call History
router.get("/salesperson-call-history/:salespersonId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "boss") {
      return res.status(403).json({ message: "Access denied!" });
    }

    const { salespersonId } = req.params;
    const { from, to } = req.query;
    const query = { salespersonId };

    if (from || to) {
      query.dialedAt = {};
      if (from) query.dialedAt.$gte = new Date(`${from}T00:00:00`);
      if (to) query.dialedAt.$lte = new Date(`${to}T23:59:59.999`);
    }

    const calls = await CallLog.find(query).sort({ dialedAt: -1 }).limit(500);
    return res.json({ success: true, salespersonId, calls });
  } catch (err) {
    console.error("Admin salesperson call history error:", err);
    return res.status(500).json({
      message: "Failed to fetch salesperson call history",
      error: err.message,
    });
  }
});

// 5. Technical Projects Admin Routes
router.get("/technical-projects", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const projects = await TechnicalTask.find().sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch technical projects", error: err.message });
  }
});

router.put("/technical-projects/assign/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const { techId, techName } = req.body;

    const updated = await TechnicalTask.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          assignedTechId: techId,
          assignedTechName: techName,
          status: "Assigned",
          assignedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    res.json({ success: true, message: `Project successfully assigned to ${techName}!`, project: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to assign project", error: err.message });
  }
});

// 6. Employees List & Performance
router.get("/employees", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin" && req.user.role !== "telecaller") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const employees = await User.find({
      role: { $in: ["salesperson", "accountant", "technical", "telecaller"] },
    }).select("-password");
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch employees", error: err.message });
  }
});

router.get("/performance", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }

    const stats = await Invoice.aggregate([
      {
        $match: {
          salespersonId: { $exists: true, $ne: null, $ne: "" },
          status: { $ne: "rejected" }
        },
      },
      {
        $group: {
          _id: "$salespersonId",
          salespersonId: { $first: "$salespersonId" },
          totalDeals: { $sum: 1 },
          approvedDeals: {
            $sum: { $cond: [{ $ne: ["$status", "rejected"] }, 1, 0] },
          },
          pendingDeals: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          rejectedDeals: {
            $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
          },
          totalBusiness: {
            $sum: {
              $cond: [{ $ne: ["$status", "rejected"] }, "$totalAmount", 0],
            },
          },
          totalPaid: {
            $sum: {
              $cond: [{ $ne: ["$status", "rejected"] }, "$paidAmount", 0],
            },
          },
        },
      },
    ]);

    res.json(stats);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch performance stats",
      error: err.message,
    });
  }
});

router.get("/employee-details/:salespersonId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const queryId =
      req.params.salespersonId === "null"
        ? { $in: [null, ""] }
        : req.params.salespersonId;
    const deals = await Invoice.find({ salespersonId: queryId }).sort({
      createdAt: -1,
    });
    res.json(deals);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch employee deals",
      error: err.message,
    });
  }
});

router.get("/employee-leads/:salespersonId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }

    let queryId = req.params.salespersonId;
    let queryCondition;

    if (queryId === "null" || !queryId) {
      queryCondition = { $in: [null, ""] };
    } else {
      const targetUser = await User.findOne({
        $or: [
          { userId: queryId },
          { _id: queryId.match(/^[0-9a-fA-F]{24}$/) ? queryId : null }
        ]
      }).catch(() => null);

      if (targetUser) {
        queryCondition = { $in: [targetUser.userId, targetUser._id.toString(), queryId] };
      } else {
        queryCondition = queryId;
      }
    }

    const leads = await Lead.find({ salespersonId: queryCondition }).sort({
      createdAt: -1,
    });
    res.json(leads);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch employee leads",
      error: err.message,
    });
  }
});

router.get("/tasks", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch tasks", error: err.message });
  }
});

// 7. Coupons Management & Creation
router.get("/coupons", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch coupons", error: err.message });
  }
});

router.post(["/create-coupon", "/coupons"], verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const { code, discountType, discountValue, expiryDate } = req.body;
    if (!code || !discountValue || !discountType) {
      return res.status(400).json({ message: "All required coupon fields must be filled!" });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: "Coupon code already exists!" });
    }

    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      discountType,
      discountValue: Number(discountValue),
      expiryDate: expiryDate || null,
      createdBy: req.user.userId,
    });

    await newCoupon.save();
    res.status(201).json({ message: "Coupon created successfully!", coupon: newCoupon });
  } catch (err) {
    res.status(500).json({ message: "Failed to create coupon", error: err.message });
  }
});

router.delete("/coupons/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: "Coupon deleted successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete coupon", error: err.message });
  }
});

// 8. Employee Management & Transfer
router.delete("/delete-employee/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Employee deleted successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete employee", error: err.message });
  }
});

router.post("/transfer-leads", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const { fromSalesperson, toSalesperson } = req.body;
    if (!fromSalesperson || !toSalesperson) {
      return res.status(400).json({ message: "Source and Target salespersons are required!" });
    }

    let fromUser = await User.findById(fromSalesperson).catch(() => null);
    if (!fromUser) {
      fromUser = await User.findOne({ userId: fromSalesperson }).catch(() => null);
    }
    const sourceQuery = fromUser ? { $in: [fromUser.userId, fromUser._id.toString(), fromSalesperson] } : fromSalesperson;

    let toUser = await User.findById(toSalesperson).catch(() => null);
    if (!toUser) {
      toUser = await User.findOne({ userId: toSalesperson }).catch(() => null);
    }
    const targetUserId = toUser ? toUser.userId : toSalesperson;

    await Invoice.updateMany({ salespersonId: sourceQuery }, { $set: { salespersonId: targetUserId } });
    await Lead.updateMany({ salespersonId: sourceQuery }, { $set: { salespersonId: targetUserId } });
    await Task.updateMany({ salespersonId: sourceQuery }, { $set: { salespersonId: targetUserId } });

    res.json({ message: `Successfully transferred leads & invoices to ${targetUserId}!` });
  } catch (err) {
    res.status(500).json({ message: "Transfer failed", error: err.message });
  }
});

router.post("/transfer-single-deal", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const { dealId, newSalespersonId } = req.body;
    if (!dealId || !newSalespersonId) {
      return res.status(400).json({ message: "Deal ID and Target Salesperson are required!" });
    }

    const updatedDeal = await Invoice.findByIdAndUpdate(
      dealId,
      { $set: { salespersonId: newSalespersonId } },
      { returnDocument: 'after' }
    );

    if (!updatedDeal) return res.status(404).json({ message: "Deal not found" });
    res.json({ success: true, message: `Deal successfully reassigned to ${newSalespersonId}!` });
  } catch (err) {
    res.status(500).json({ message: "Failed to transfer deal", error: err.message });
  }
});

// 9. Travel History & Shift Info
router.get("/salesperson-travel/:salespersonId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }

    const { salespersonId } = req.params;
    const { date, startDate, endDate } = req.query;
    const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    let selectedStartDate = startDate || date || todayIST;
    let selectedEndDate = endDate || date || todayIST;

    const logs = await LocationLog.find({
      salespersonId,
      date: { $gte: selectedStartDate, $lte: selectedEndDate },
    }).sort({ timestamp: 1 }).lean();

    const lastLiveLog = await LocationLog.findOne({
      salespersonId,
      date: selectedEndDate,
    }).sort({ timestamp: -1 }).lean();

    let lastLiveLocation = lastLiveLog ? {
      latitude: Number(lastLiveLog.latitude),
      longitude: Number(lastLiveLog.longitude),
      timestamp: lastLiveLog.timestamp,
    } : null;

    const sessions = await DaySession.find({
      salespersonId,
      date: { $gte: selectedStartDate, $lte: selectedEndDate },
    }).lean();

    let totalDistanceKm = 0;
    let allDistancePoints = [];
    let latestSession = sessions[sessions.length - 1] || null;

    sessions.forEach((sess) => {
      totalDistanceKm += Number(sess.totalDistanceKm) || 0;
      if (sess.distancePoints && Array.isArray(sess.distancePoints)) {
        allDistancePoints = allDistancePoints.concat(sess.distancePoints);
      }
    });

    return res.json({
      success: true,
      salespersonId,
      startDate: selectedStartDate,
      endDate: selectedEndDate,
      totalDistanceKm: Number(totalDistanceKm.toFixed(3)),
      lastLiveLocation,
      sessionStatus: latestSession?.status || null,
      startTime: latestSession?.startTime || null,
      endTime: latestSession?.endTime || null,
      startLocation: latestSession?.startLocation || null,
      endLocation: latestSession?.endLocation || null,
      distancePoints: allDistancePoints,
      routePoints: logs,
    });
  } catch (err) {
    console.error("❌ Failed to fetch salesperson travel:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch travel history", error: err.message });
  }
});

router.get("/salesperson-shift/:salespersonId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }

    const { salespersonId } = req.params;
    const queryDate = req.query.date || new Date().toISOString().split("T")[0];

    const session = await DaySession.findOne({ salespersonId, date: queryDate });
    res.json({ success: true, session: session || null });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch shift details", error: err.message });
  }
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

router.get("/reverse-geocode", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ message: "Lat and Lon are required" });
    }

    await delay(1000);
    const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
      headers: { 'User-Agent': 'CrinzaInvoicePortal/1.0' }
    });

    res.json({ displayName: response.data.display_name || "Unknown Location" });
  } catch (err) {
    res.json({ displayName: "Location name unavailable (Rate Limited)" });
  }
});

router.get("/kpi-summary", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }

    const totalInvoices = await Invoice.aggregate([
      { $match: { status: { $ne: "rejected" } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalCollected: { $sum: "$paidAmount" }
        }
      }
    ]);

    const activeLeadsCount = await Lead.countDocuments();
    const activeEmployeesCount = await User.countDocuments({ role: "salesperson" });

    res.json({
      totalRevenue: totalInvoices[0]?.totalRevenue || 0,
      totalCollected: totalInvoices[0]?.totalCollected || 0,
      activeLeadsCount,
      activeEmployeesCount
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch KPI summary", error: err.message });
  }
});

// --- 📊 ADMIN LEADS REPORT ENDPOINT (WITH DATE & STATUS FILTER) ---
router.get("/leads-report", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }

    const { from, to, salespersonId, demoStatus, leadStatus } = req.query;
    let query = {};

    // 1. Salesperson Filter
    if (salespersonId && salespersonId !== "all" && salespersonId !== "null") {
      const targetUser = await User.findOne({
        $or: [
          { userId: salespersonId },
          { _id: salespersonId.match(/^[0-9a-fA-F]{24}$/) ? salespersonId : null }
        ]
      }).catch(() => null);

      if (targetUser) {
        query.salespersonId = { $in: [targetUser.userId, targetUser._id.toString(), salespersonId] };
      } else {
        query.salespersonId = salespersonId;
      }
    }

    // 2. Status Filters
    if (leadStatus) {
      query.leadStatus = leadStatus;
    }
    if (demoStatus) {
      query.demoStatus = demoStatus;
    }

    // 3. Robust Date Range Filter Logic
    if (from || to) {
      let startDateStr = from || "2000-01-01";
      let endDateStr = to || "2100-12-31";
      let startDateObj = new Date(`${startDateStr}T00:00:00.000Z`);
      let endDateObj = new Date(`${endDateStr}T23:59:59.999Z`);

      if (demoStatus === "Completed") {
        query.$or = [
          { demoCompletedAt: { $gte: startDateObj, $lte: endDateObj } },
          { demoCompletedAt: { $gte: startDateStr, $lte: endDateStr } },

          { 
            $and: [
              { demoCompletedAt: { $exists: false } },
              { updatedAt: { $gte: startDateObj, $lte: endDateObj } }
            ]
          }
        ];
      } else {
        query.$or = [
          { leadDate: { $gte: startDateStr, $lte: endDateStr } },
          { createdAt: { $gte: startDateObj, $lte: endDateObj } }
        ];
      }
    }

    const leads = await Lead.find(query).sort({ updatedAt: -1, createdAt: -1 });
    return res.json({ success: true, count: leads.length, leads });
  } catch (err) {
    console.error("❌ Failed to fetch leads report:", err);
    return res.status(500).json({ message: "Failed to fetch leads report", error: err.message });
  }
});

module.exports = router;