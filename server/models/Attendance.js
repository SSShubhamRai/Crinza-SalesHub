const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // e.g. CRZ-011 or ObjectId string
  name: { type: String, required: true },
  date: { type: String, required: true }, // Format: 'YYYY-MM-DD'
  startTime: { type: String }, // e.g. '09:30 AM'
  endTime: { type: String },   // e.g. '06:30 PM'
  status: { type: String, enum: ["Present", "Absent", "Half-Day"], default: "Present" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Attendance", attendanceSchema);