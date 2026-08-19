const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['salesperson', 'accountant', 'boss', 'admin', 'technical'], // 👈 Yahan 'technical' add kar diya gaya hai
    default: 'salesperson',
    index: true
  },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  
  // 🌟 Biometric / WebAuthn Devices Array for Fingerprint & Face ID
  devices: [{
    credentialID: Buffer,
    credentialPublicKey: Buffer,
    counter: Number,
    transports: [String]
  }]
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);