const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");

const Lead = require("../models/Lead");
const DaySession = require("../models/DaySession");

// 1. Get Telecaller Leads
router.get("/leads", verifyToken, async (req, res) => {
  try {
    const leads = await Lead.find({
      $or: [
        { telecallerId: req.user.userId },
        { createdBy: req.user.userId }
      ]
    }).sort({ createdAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch leads", error: err.message });
  }
});

// 2. Create a new lead from Telecaller Portal (Guarded by active shift check)
router.post("/leads", verifyToken, async (req, res) => {
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const session = await DaySession.findOne({ salespersonId: req.user.userId, date: today, status: "STARTED" });
    
    if (!session) {
      return res.status(403).json({ message: "Action Blocked: You must start your working day first!" });
    }

    const { instituteName, contactPerson, mobileNo, email, address, city, state, pincode, notes } = req.body;
    
    if (!mobileNo || !instituteName || !city || !state) {
      return res.status(400).json({ message: "Required fields are missing!" });
    }

    const timeStr = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: '2-digit', minute: '2-digit' });

    const newLead = new Lead({
      instituteName,
      contactPerson: contactPerson || "N/A",
      mobileNo: mobileNo.trim(),
      email: email || "",
      address: address || "",
      city,
      state,
      pincode: pincode || "",
      notes: `[Telecaller Entry - ${req.user.userId}]: ${notes || 'New Lead Created'}`,
      leadDate: today,
      leadTime: timeStr,
      telecallerId: req.user.userId,
      createdBy: req.user.userId,
      salespersonId: null,
      leadStatus: "Active",
      demoStatus: "Not Given",
      latitude: 0,
      longitude: 0
    });

    const savedLead = await newLead.save();
    return res.status(201).json({ success: true, message: "Lead created successfully!", lead: savedLead });
  } catch (err) {
    console.error("🔥 Telecaller Lead Creation Error:", err);
    return res.status(500).json({ message: "Failed to create lead", error: err.message });
  }
});

// 3. Assign Lead to Specific Salesperson (Guarded by active shift check)
router.put("/leads/:id/assign", verifyToken, async (req, res) => {
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const session = await DaySession.findOne({ salespersonId: req.user.userId, date: today, status: "STARTED" });
    
    if (!session) {
      return res.status(403).json({ message: "Action Blocked: You must start your working day first!" });
    }

    const { salespersonId, requirementType, followUpDate, followUpTime, followUpAction } = req.body;
    if (!salespersonId) {
      return res.status(400).json({ message: "Salesperson ID is required!" });
    }

    const updateFields = { 
      salespersonId: salespersonId,
      assignedBy: req.user.name || req.user.userId, 
      requirementType: requirementType || "Demo"
    };

    if (followUpDate) updateFields.followUpDate = followUpDate;
    if (followUpTime) updateFields.followUpTime = followUpTime;
    if (followUpAction) updateFields.followUpAction = followUpAction;

    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { returnDocument: "after" }
    );

    if (!updatedLead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    res.json({ success: true, message: `Lead successfully assigned!`, lead: updatedLead });
  } catch (err) {
    res.status(500).json({ message: "Failed to assign lead", error: err.message });
  }
});

// 🌟 Admin/Boss Route: Track all telecaller activities and metrics
router.get("/admin/telecaller-activity", verifyToken, async (req, res) => {
  try {
    const allLeads = await Lead.find({});
    const telecallerMap = {};

    allLeads.forEach(lead => {
      const isTelecallerLead = lead.createdBy || lead.telecallerId || (lead.notes && lead.notes.includes("[Telecaller Entry"));
      if (!isTelecallerLead) return;

      let telecallerKey = lead.createdBy || lead.telecallerId;
      if (!telecallerKey && lead.notes) {
        const match = lead.notes.match(/\[Telecaller Entry - (.*?)\]/);
        if (match && match[1]) telecallerKey = match[1];
      }

      const finalTelecallerId = telecallerKey || "Unknown Telecaller";
      
      if (!telecallerMap[finalTelecallerId]) {
        telecallerMap[finalTelecallerId] = {
          telecallerId: finalTelecallerId,
          totalCreated: 0,
          totalAssigned: 0,
          totalPending: 0,
          assignedDetails: []
        };
      }

      telecallerMap[finalTelecallerId].totalCreated += 1;

      if (lead.salespersonId) {
        telecallerMap[finalTelecallerId].totalAssigned += 1;
        telecallerMap[finalTelecallerId].assignedDetails.push({
          leadId: lead._id,
          instituteName: lead.instituteName,
          salespersonId: lead.salespersonId,
          assignedBy: lead.assignedBy,
          requirementType: lead.requirementType,
          followUpDate: lead.followUpDate,
          followUpTime: lead.followUpTime,
          updatedAt: lead.updatedAt
        });
      } else {
        telecallerMap[finalTelecallerId].totalPending += 1;
      }
    });

    const activityReport = Object.values(telecallerMap);

    res.json({
      success: true,
      totalLeadsCount: allLeads.length,
      telecallerActivity: activityReport
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch telecaller activity logs", 
      error: err.message 
    });
  }
});

router.get("/day-status", verifyToken, async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const session = await DaySession.findOne({ salespersonId: req.user.userId, date: today });

    if (!session) {
      return res.json({ status: "NOT_STARTED", session: null });
    }
    res.json({
      status: session.status,
      startAddress: session.startAddress || "",
      session
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch day status", error: err.message });
  }
});

// --- ⏱️ START DAY ROUTE ---
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
      startLocation: {
        latitude: Number(latitude) || 0,
        longitude: Number(longitude) || 0
      },
      startAddress: startAddress || "",
      distancePoints: [
        {
          type: "START",
          referenceId: null,
          latitude: Number(latitude) || 0,
          longitude: Number(longitude) || 0,
          timestamp: new Date(),
          distanceFromPreviousKm: 0,
          totalDistanceKm: 0
        }
      ],
      totalDistanceKm: 0
    });

    await newSession.save();
    res.status(201).json({ success: true, message: "Day started successfully!", startAddress: newSession.startAddress, session: newSession });
  } catch (err) {
    res.status(500).json({ message: "Failed to start day", error: err.message });
  }
});

// --- ⏱️ END DAY ROUTE ---
router.post("/end-day", verifyToken, async (req, res) => {
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const session = await DaySession.findOne({ salespersonId: req.user.userId, date: today, status: "STARTED" });

    if (!session) {
      return res.status(400).json({ message: "No active day session found to end!" });
    }

    const { latitude, longitude } = req.body;
    const endTimeDate = new Date();

    session.status = "ENDED";
    session.endTime = endTimeDate;
    session.endLocation = {
      latitude: Number(latitude) || 0,
      longitude: Number(longitude) || 0,
    };
    await session.save();

    const workingMilliseconds = endTimeDate - new Date(session.startTime);
    const workingHours = (workingMilliseconds / (1000 * 60 * 60)).toFixed(1);

    res.json({
      success: true,
      message: "Day ended successfully.",
      summary: {
        startTime: new Date(session.startTime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: '2-digit', minute: '2-digit', hour12: true }),
        endTime: endTimeDate.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: '2-digit', minute: '2-digit', hour12: true }),
        workingHours: `${workingHours} hrs`,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to end day", error: err.message });
  }
});

module.exports = router;