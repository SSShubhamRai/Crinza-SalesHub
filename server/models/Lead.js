const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  instituteName: { type: String, required: true },
  contactPerson: { type: String, required: true },
  mobileNo: { type: String, required: true },
  email: { type: String }, 
  address: { type: String },
  pincode: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  notes: { type: String },
  meetingPhoto: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  followUpDate: { type: Date },
  followUpTime: { type: String },
  followUpAction: { type: String, enum: ['Call', 'Next Meeting', 'Demo', 'Closed'], default: 'Call' },
  
  // Pipeline Fields
  demoStatus: { type: String, enum: ['Not Given', 'Scheduled', 'Completed', 'Interested'], default: 'Not Given' },
  leadStatus: { type: String, enum: ['Active', 'Call Back', 'Follow Up', 'Not Interested', 'Deal Close'], default: 'Active', index: true },

  salespersonId: { type: String, required: true, index: true },
  status: { type: String, default: 'Active' }
}, { timestamps: true });

// 🛡️ Prevent duplicate leads based on Salesperson & Mobile Number
leadSchema.index({ salespersonId: 1, mobileNo: 1 }, { unique: true });

module.exports = mongoose.models.Lead || mongoose.model('Lead', leadSchema);