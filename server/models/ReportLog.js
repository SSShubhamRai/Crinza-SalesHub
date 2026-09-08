const mongoose = require('mongoose');

const reportLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Weekly", "Monthly"],
      required: true,
    },

    period: {
      type: String,
      required: true,
    },

    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Same report ko duplicate send hone se rokega
reportLogSchema.index(
  { type: 1, period: 1 },
  { unique: true }
);

module.exports = mongoose.models.ReportLog || mongoose.model("ReportLog", reportLogSchema);