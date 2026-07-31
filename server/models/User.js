const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['salesperson', 'accountant', 'boss', 'admin'], 
    default: 'salesperson',
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);