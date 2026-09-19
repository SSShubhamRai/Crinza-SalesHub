const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  }, // 🌟 Unique constraint to completely block duplicate entries
  phone: { type: String },
  appliedFor: { type: String, required: true },
  resumeUrl: { type: String, default: "" }, // Made optional for Google Sheet imports
  
  // Professional Candidate Fields
  experienceType: { 
    type: String, 
    enum: ["Fresher", "Experienced"], 
    default: "Fresher" 
  },
  highestQualification: { type: String },
  currentSalary: { type: String },
  expectedSalary: { type: String },
  willingToRelocate: { 
    type: String, 
    enum: ["Yes", "No"], 
    default: "Yes" 
  },

  // 🌟 Dynamic Google Form Responses Mapping (Zero HR Headache)
  formResponses: { 
    type: Map, 
    of: String, 
    default: {} 
  },

  // 🌟 AI Resume Screening & Match Score Fields
  aiMatchScore: { type: String, default: "N/A" },
  aiInsights: { type: String, default: "" },

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