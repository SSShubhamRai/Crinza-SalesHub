const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema(
  {
    salespersonId: {
      type: String,
      required: true,
      index: true,
    },

    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
      index: true,
    },

    customerName: {
      type: String,
      default: "",
    },

    phoneNumber: {
      type: String,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "INITIATED",
        "CONNECTED",
        "ENDED",
        "NOT_CONNECTED",
        "MISSED",
        "REJECTED",
        "FAILED",
      ],
      default: "INITIATED",
      index: true,
    },

    dialedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    connectedAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    durationSeconds: {
      type: Number,
      default: 0,
    },

    recordingUrl: {
      type: String,
      default: "",
    },

    recordingConsent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

callLogSchema.index({
  salespersonId: 1,
  dialedAt: -1,
});

callLogSchema.index({
  salespersonId: 1,
  phoneNumber: 1,
  dialedAt: -1,
});

module.exports = mongoose.models.CallLog || mongoose.model("CallLog", callLogSchema);