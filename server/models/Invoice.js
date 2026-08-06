const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceId: { type: String, required: true, unique: true, index: true },
  salespersonId: { type: String, required: true, index: true },
  approvedBy: { type: String, default: '' },
  instituteName: { type: String, required: true },
  appName: { type: String, required: true },
  mobileNo: { type: String, required: true },
  email: { type: String, required: true, index: true },
  
  // Address Fields
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  pincode: { type: String, required: true },
  gstNo: { type: String, default: '' },
  
  // GPS Location Fields
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },

  packageValidity: { type: String, required: true },
  
  // Add-on Packages Field
  addons: {
    testModule: { type: Boolean, default: false },
    windowApp: { type: Boolean, default: false },
    iosApp: { type: Boolean, default: false }
  },

  // Pricing & Coupon Fields
  baseAmount: { type: Number, default: 0 },
  couponCode: { type: String, default: '' },
  discountAmount: { type: Number, default: 0 },
  previousDueBalance: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, required: true },
  dueAmount: { type: Number, required: true },

  // 🌟 NEW: Payment Mode & Offline Transaction Details
  paymentMode: { 
    type: String, 
    enum: ['ONLINE', 'CASH', 'CHEQUE'], 
    default: 'ONLINE' 
  },
  utrNumber: { type: String, default: '' },
  receiptNo: { type: String, default: '' },
  chequeNo: { type: String, default: '' },
  bankName: { type: String, default: '' },

  // 🌟 NEW: AI OCR Verification Status Fields
  ocrStatus: { 
    type: String, 
    enum: ['PENDING', 'GREEN', 'YELLOW', 'RED'], 
    default: 'PENDING' 
  },
  ocrMessage: { type: String, default: '' },

  termsAndConditions: { type: String, required: true },
  paymentProof: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending',
    index: true 
  },
  rejectionReason: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);