const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  instituteName: { type: String, required: true },
  contactPerson: { type: String, required: true },
  mobileNo: { type: String, required: true, index: true },
  email: { type: String }, 
  address: { type: String },
  pincode: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  notes: { type: String },
  meetingPhoto: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  
  // 🕒 Visit & Tracking Fields
  leadDate: { type: String },
  leadTime: { type: String },
  visitCount: { type: Number, default: 1 },

  followUpDate: { type: Date },
  followUpTime: { type: String },
  followUpAction: { type: String, enum: ['Call', 'Next Meeting', 'Demo', 'Closed'], default: 'Call' },
  
  // Pipeline Fields
  demoStatus: { type: String, enum: ['Not Given', 'Scheduled', 'Completed', 'Interested'], default: 'Not Given' },
  leadStatus: { type: String, enum: ['Active', 'Call Back', 'Follow Up', 'Not Interested', 'Deal Close'], default: 'Active', index: true },

  // 🌟 Unassigned lead support
  salespersonId: { type: String, default: null, index: true },
  status: { type: String, default: 'Active' },

  // ==========================================
  // 🌟 Telecaller & Recording Support Fields
  // ==========================================
  telecallerId: { 
    type: String, 
    default: null,
    index: true 
  },
  
  // Call Recording & Anti-Cheat Metadata
  durationSeconds: { type: Number, default: 0 },
  recordingUrl: { type: String }, 
  recordingConsent: { type: Boolean, default: false },

  // Meeting / Demo Scheduling by Telecaller (Physical or Virtual)
  meetingType: { type: String, enum: ['PHYSICAL', 'VIRTUAL_DEMO', 'NONE'], default: 'NONE' },
  meetingDateTime: { type: Date },

  // Salesperson Live Assignment & Status Tracking
  assignedSalespersonId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null 
  },
  salespersonStatus: {
    type: String,
    enum: ['PENDING_ACCEPTANCE', 'ACCEPTED', 'DEMO_SCHEDULED', 'DEAL_CLOSED', 'REJECTED'],
    default: 'PENDING_ACCEPTANCE'
  },
  salespersonNotes: { type: String },

  // 🌟 Naye fields: Telecaller Assignment Tracker for Salesperson UI
  assignedBy: { type: String, default: null },
  requirementType: { type: String, enum: ['Demo', 'Meeting', 'NONE'], default: 'Demo' }

}, { timestamps: true });

// Note: Unique index on salespersonId + mobileNo was removed 
// so salespeople can save multiple visits for the same mobile number.

module.exports = mongoose.models.Lead || mongoose.model('Lead', leadSchema);