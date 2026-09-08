const mongoose = require('mongoose');

const technicalTaskSchema = new mongoose.Schema({
  projectId: { type: String, unique: true },
  invoiceId: { type: String, required: true },
  instituteName: { type: String, required: true },
  appName: { type: String, required: true },
  packageValidity: { type: String, default: "1 Year" },
  addons: { type: Object, default: {} },
  logoProof: { type: String, default: "" },
  assignedTechId: { type: String, default: "" },
  assignedTechName: { type: String, default: "" },
  status: {
    type: String,
    enum: ["Unassigned", "Assigned", "In Progress", "Testing", "Delivered"],
    default: "Unassigned"
  },
  assignedAt: { type: Date },
  deliveredAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.TechnicalTask || mongoose.model("TechnicalTask", technicalTaskSchema);