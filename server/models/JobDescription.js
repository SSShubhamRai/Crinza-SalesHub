const mongoose = require("mongoose");

const jobDescriptionSchema = new mongoose.Schema({
  role: { type: String, required: true, unique: true, lowercase: true, trim: true }, // e.g. "bdm", "sales executive"
  title: { type: String, required: true },
  jdPdf: {
    data: Buffer,
    contentType: String
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("JobDescription", jobDescriptionSchema);