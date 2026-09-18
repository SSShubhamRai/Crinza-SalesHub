const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String },
  fromDate: { type: String, required: true },
  toDate: { type: String, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Leave", leaveSchema);