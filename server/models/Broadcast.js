const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
  adminId: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  priority: { type: String, enum: ["normal", "important", "urgent"], default: "normal" },
  deletedFor: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Broadcast || mongoose.model("Broadcast", broadcastSchema);