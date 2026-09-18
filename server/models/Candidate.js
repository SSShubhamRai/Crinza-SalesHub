const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  appliedFor: { type: String, required: true },
  resumeUrl: { type: String, required: true }, 
  status: { 
    type: String, 
    enum: ["Applied", "Shortlisted", "Interview Scheduled", "Rejected", "Selected"], 
    default: "Applied" 
  },
  interviewDate: { type: String },
  interviewTime: { type: String },
  hrReview: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Candidate", candidateSchema);