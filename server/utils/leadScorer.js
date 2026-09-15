const CallLog = require("../models/CallLog");

async function calculateLeadScore(lead) {
  let score = 0;

  try {
    // 1. Demo Status Progression (Max 40 Points)
    // Aapke schema ke enum ke mutabiq: "Completed", "Scheduled", "Interested"
    const demoStatus = (lead.demoStatus || "").trim().toLowerCase();
    
    if (demoStatus === "completed") {
      score += 40; // Demo done par solid 40 points
    } else if (demoStatus === "interested" || demoStatus === "scheduled") {
      score += 25;
    }

    // 2. Call Engagement / Connected Calls (Max 30 Points)
    if (lead._id) {
      const calls = await CallLog.find({
        leadId: lead._id,
        status: { $in: ["CONNECTED", "ENDED"] }
      }).lean();

      const connectedCallsCount = calls.length;
      let totalDurationSeconds = calls.reduce((acc, call) => acc + (call.durationSeconds || 0), 0);

      score += Math.min(connectedCallsCount * 10, 15);
      if (totalDurationSeconds > 60) {
        score += 15;
      }
    }

    // 3. Active Follow-up Tracking (Max 15 Points)
    if (lead.followUpDate) {
      score += 15;
    }

    // 4. Requirement Clarity / Notes (Max 15 Points)
    if (lead.notes && lead.notes.trim() !== "") {
      score += 15;
    }
  } catch (err) {
    console.error("🔥 Scoring Error:", err);
  }

  // Total score max 100 cap
  const finalScore = Math.min(score, 100);

  // Dynamic Priority Thresholds
  let priorityTag = "COLD";
  if (finalScore >= 40) {
    priorityTag = "HOT"; // Agar demo completed hai (40 pts) toh turant HOT ban jayega!
  } else if (finalScore >= 20) {
    priorityTag = "WARM";
  }

  // Debugging log terminal ke liye
  console.log(`🎯 Lead: ${lead.instituteName} | Demo: ${lead.demoStatus} | Final Score: ${finalScore} | Priority: ${priorityTag}`);

  return {
    score: finalScore,
    priority: priorityTag
  };
}

module.exports = { calculateLeadScore };