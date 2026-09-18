const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  fileUrl: { type: String, default: null },
  priority: { type: String, enum: ["normal", "important", "urgent"], default: "normal" },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notification", notificationSchema);