const User = require("../models/User");
const DaySession = require("../models/DaySession");
const LocationLog = require("../models/LocationLog");
const ReportLog = require("../models/ReportLog");
const Invoice = require("../models/Invoice");
const Lead = require("../models/Lead");
const Task = require("../models/Task");
const { getActualRoadDistance, calculateValidDistance } = require("./distanceHelper");
const { Parser } = require('json2csv');
const axios = require("axios");
const FormData = require("form-data");

// =========================================================
// 🌙 1. AUTOMATIC SHIFT END (Har raat 11:00 PM par chalega)
// =========================================================
setInterval(async () => {
  try {
    const now = new Date();
    const istTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
    const [currentHour] = istTimeStr.split(':').map(Number);

    if (currentHour >= 23) {
      const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      const activeSessions = await DaySession.find({
        status: "STARTED",
        date: today
      });

      for (const session of activeSessions) {
        const endTimeDate = new Date();
        let finalSegmentDist = 0;

        if (session.distancePoints && session.distancePoints.length > 0) {
          const lastPoint = session.distancePoints[session.distancePoints.length - 1];
          const lastLog = await LocationLog.findOne({
            salespersonId: session.salespersonId,
            date: session.date,
          }).sort({ timestamp: -1 });

          if (lastLog) {
            const rawDist = await getActualRoadDistance(
              Number(lastPoint.latitude),
              Number(lastPoint.longitude),
              Number(lastLog.latitude),
              Number(lastLog.longitude)
            );
            if (rawDist >= 0.02 && rawDist <= 50) {
              finalSegmentDist = rawDist;
            }
          }
        }

        const previousTotal = Number(session.totalDistanceKm) || 0;
        const autoEndedTotalDistance = previousTotal + finalSegmentDist;

        if (!Array.isArray(session.distancePoints)) {
          session.distancePoints = [];
        }

        const lastKnownLat = session.distancePoints.length > 0 ? session.distancePoints[session.distancePoints.length - 1].latitude : 0;
        const lastKnownLng = session.distancePoints.length > 0 ? session.distancePoints[session.distancePoints.length - 1].longitude : 0;

        session.distancePoints.push({
          type: "END",
          referenceId: null,
          latitude: lastKnownLat,
          longitude: lastKnownLng,
          timestamp: endTimeDate,
          distanceFromPreviousKm: Number(finalSegmentDist.toFixed(3)),
          totalDistanceKm: Number(autoEndedTotalDistance.toFixed(3))
        });

        session.status = "ENDED";
        session.endTime = endTimeDate;
        session.totalDistanceKm = Number(autoEndedTotalDistance.toFixed(3));
        
        await session.save();
        console.log(`🌙 Auto-Ended Shift for Salesperson: ${session.salespersonId} | Total Distance: ${session.totalDistanceKm} km`);
      }
    }
  } catch (err) {
    console.error("🔥 Auto-End Day Job Error:", err.message);
  }
}, 5 * 60 * 1000);

// =========================================================
// 📊 2. HELPER: GENERATE PERFORMANCE DATA FOR REPORT
// =========================================================
async function generatePerformanceData(startDateStr, endDateStr) {
  const salespersons = await User.find({ role: "salesperson" });
  const reportSummary = [];

  for (const emp of salespersons) {
    const empId = emp.userId;

    const totalDemos = await Task.countDocuments({
      salespersonId: empId,
      taskType: "demo",
      createdAt: { $gte: new Date(startDateStr), $lte: new Date(endDateStr + "T23:59:59.999Z") }
    });

    const totalCalls = await Task.countDocuments({
      salespersonId: empId,
      taskType: "call",
      createdAt: { $gte: new Date(startDateStr), $lte: new Date(endDateStr + "T23:59:59.999Z") }
    });

    const totalLeads = await Lead.countDocuments({
      salespersonId: empId,
      createdAt: { $gte: new Date(startDateStr), $lte: new Date(endDateStr + "T23:59:59.999Z") }
    });

    const approvedDeals = await Invoice.find({
      salespersonId: empId,
      status: "approved",
      updatedAt: { $gte: new Date(startDateStr), $lte: new Date(endDateStr + "T23:59:59.999Z") }
    });

    const dealsClosedCount = approvedDeals.length;
    const totalRevenue = approvedDeals.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
    const totalCollected = approvedDeals.reduce((acc, inv) => acc + (inv.paidAmount || 0), 0);

    const locationLogs = await LocationLog.find({
      salespersonId: empId,
      date: { $gte: startDateStr, $lte: endDateStr }
    }).sort({ timestamp: 1 });

    const distanceKm = calculateValidDistance(locationLogs);

    const activeDays = await DaySession.countDocuments({
      salespersonId: empId,
      date: { $gte: startDateStr, $lte: endDateStr }
    });

    reportSummary.push({
      employeeId: empId,
      name: emp.name,
      activeDays,
      totalLeads,
      totalDemos,
      totalCalls,
      dealsClosed: dealsClosedCount,
      totalRevenue: `₹${totalRevenue.toLocaleString("en-IN")}`,
      totalCollected: `₹${totalCollected.toLocaleString("en-IN")}`,
      distanceKm: `${distanceKm} km`
    });
  }

  return reportSummary;
}

const generateExcelReportBuffer = async (startDateStr, endDateStr) => {
  const performanceData = await generatePerformanceData(startDateStr, endDateStr);
  const fields = [
    { label: 'Employee ID', value: 'employeeId' },
    { label: 'Salesperson Name', value: 'name' },
    { label: 'Active Working Days', value: 'activeDays' },
    { label: 'Total Visits/Leads', value: 'totalLeads' },
    { label: 'Total Demos Conducted', value: 'totalDemos' },
    { label: 'Total Calls Made', value: 'totalCalls' },
    { label: 'Deals Closed', value: 'dealsClosed' },
    { label: 'Total Revenue', value: 'totalRevenue' },
    { label: 'Total Collected', value: 'totalCollected' },
    { label: 'Travel Distance', value: 'distanceKm' }
  ];

  const json2csvParser = new Parser({ fields });
  const csvString = json2csvParser.parse(performanceData);
  return Buffer.from(csvString, 'utf-8');
};

const sendPerformanceReport = async (reportType, startDateStr, endDateStr, periodKey) => {
  try {
    const alreadySent = await ReportLog.findOne({ type: reportType, period: periodKey });
    if (alreadySent) return;

    const bossUser = await User.findOne({ role: { $in: ["boss", "admin"] } });
    if (!bossUser || !bossUser.email) return;

    const excelBuffer = await generateExcelReportBuffer(startDateStr, endDateStr);
    const form = new FormData();
    form.append("sendTo", bossUser.email);
    form.append("message", `<h3>Crinza ${reportType} Performance Excel Report</h3><p>Period: ${startDateStr} to ${endDateStr}</p>`);
    form.append("attachments", excelBuffer, {
      filename: `Crinza_${reportType}_Report_${startDateStr}_to_${endDateStr}.csv`,
      contentType: "text/csv",
    });

    await axios.post("https://api.crinza.com/api/v1/contact/message", form, {
      headers: { ...form.getHeaders(), Origin: "https://crinza.com" },
    });

    await ReportLog.create({ type: reportType, period: periodKey, sentAt: new Date() });
    console.log(`✅ ${reportType} report successfully sent to ${bossUser.email}`);
  } catch (err) {
    console.error(`🔥 ${reportType} Performance Report Error:`, err.message);
  }
};

const checkPerformanceReports = async () => {
  try {
    const now = new Date();
    const istDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const dayOfWeek = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(now);
    const [year, month, day] = istDate.split("-");

    if (dayOfWeek === "Mon") {
      const currentDate = new Date(`${year}-${month}-${day}T00:00:00`);
      const previousMonday = new Date(currentDate);
      previousMonday.setDate(previousMonday.getDate() - 7);
      const previousSunday = new Date(currentDate);
      previousSunday.setDate(previousSunday.getDate() - 1);

      await sendPerformanceReport("Weekly", previousMonday.toISOString().split("T")[0], previousSunday.toISOString().split("T")[0], `Weekly_${istDate}`);
    }

    if (day === "01") {
      const currentDate = new Date(`${year}-${month}-${day}T00:00:00`);
      const previousMonthEnd = new Date(currentDate);
      previousMonthEnd.setDate(0);
      const previousMonthStart = new Date(previousMonthEnd.getFullYear(), previousMonthEnd.getMonth(), 1);

      await sendPerformanceReport("Monthly", previousMonthStart.toISOString().split("T")[0], previousMonthEnd.toISOString().split("T")[0], `Monthly_${istDate}`);
    }
  } catch (err) {
    console.error("🔥 Performance Scheduler Error:", err.message);
  }
};

checkPerformanceReports();
setInterval(checkPerformanceReports, 5 * 60 * 1000);