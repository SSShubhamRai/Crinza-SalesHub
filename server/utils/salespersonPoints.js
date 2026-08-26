const SalespersonPoint = require("../models/SalespersonPoint");

const POINTS = {
  LEAD_CREATED: 10,
  REVISIT: 5,
  DEMO_DONE: 25,
  DEAL_CLOSED: 40,
  CALL_CONNECTED: 2,
  DIAL_CALL: 1,
};

const DAILY_POINT_TARGET = 100;

const addSalespersonPoints = async (
  salespersonId,
  activity,
  date = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  })
) => {
  try {
    // ---------------------------------------
    // 1. Validate activity
    // ---------------------------------------
    const points = POINTS[activity];

    console.log("🏆 POINT TEST:", {
      salespersonId,
      activity,
      points,
      date,
    });

    if (!points) {
      throw new Error(`Invalid point activity: ${activity}`);
    }

    // ---------------------------------------
    // 2. Prepare daily update
    // ---------------------------------------
    const update = {
      $inc: {
        totalPoints: points,
      },
    };

    // ---------------------------------------
    // 3. Activity counters
    // ---------------------------------------
    switch (activity) {
      case "LEAD_CREATED":
        update.$inc.leadsCreated = 1;
        break;

      case "REVISIT":
        update.$inc.revisits = 1;
        break;

      case "DEMO_DONE":
        update.$inc.demosDone = 1;
        break;

      case "DEAL_CLOSED":
        update.$inc.dealsClosed = 1;
        break;

      case "CALL_CONNECTED":
        update.$inc.callsConnected = 1;
        break;

      case "DIAL_CALL":
        update.$inc.dialCalls = 1;
        break;
    }

    // ---------------------------------------
    // 4. Save / update today's points
    // ---------------------------------------
    const dailyPoints = await SalespersonPoint.findOneAndUpdate(
      {
        salespersonId: String(salespersonId),
        date,
      },
      update,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    // ---------------------------------------
    // 5. Confirm saved result
    // ---------------------------------------
    console.log("✅ POINT SAVED:", {
      salespersonId: dailyPoints.salespersonId,
      date: dailyPoints.date,
      totalPoints: dailyPoints.totalPoints,
      leadsCreated: dailyPoints.leadsCreated,
      revisits: dailyPoints.revisits,
      demosDone: dailyPoints.demosDone,
      dealsClosed: dailyPoints.dealsClosed,
      callsConnected: dailyPoints.callsConnected,
      dialCalls: dailyPoints.dialCalls,
    });

    return dailyPoints;
  } catch (error) {
    console.error("❌ Failed to add salesperson points:", error);

    console.error("❌ Point Error Details:", {
      salespersonId,
      activity,
      date,
      message: error.message,
    });

    throw error;
  }
};

module.exports = {
  POINTS,
  DAILY_POINT_TARGET,
  addSalespersonPoints,
};