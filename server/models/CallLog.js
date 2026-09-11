const mongoose = require("mongoose");

const callLogSchema = new mongoose.Schema(
  {
    // =========================================================
    // 👤 SALESPERSON
    // =========================================================

    salespersonId: {
      type: String,
      required: true,
      index: true,
    },

    // =========================================================
    // 👤 LEAD / CUSTOMER
    // =========================================================

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

    // =========================================================
    // 📱 CALL SOURCE
    // =========================================================
    // CRM  = Call started from CRM
    // DEVICE = Call detected from Android phone call log
    // =========================================================

    source: {
      type: String,
      enum: ["CRM", "DEVICE"],
      default: "CRM",
      index: true,
    },

    // =========================================================
    // 📱 ANDROID DEVICE CALL LOG ID
    // =========================================================
    // Android CallLog.Calls._ID
    // Used to prevent the same device call from being inserted
    // multiple times during synchronization.
    // =========================================================

    deviceCallLogId: {
      type: String,
      default: null,
      index: true,
    },

    // =========================================================
    // 📅 ORIGINAL DEVICE CALL TIMESTAMP
    // =========================================================

    deviceTimestamp: {
      type: Date,
      default: null,
      index: true,
    },

    // =========================================================
    // 📞 CALL STATUS
    // =========================================================

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

    // =========================================================
    // 🕐 CALL TIMINGS
    // =========================================================

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

    // =========================================================
    // ⏱️ CALL DURATION
    // =========================================================

    durationSeconds: {
      type: Number,
      default: 0,
    },

    // =========================================================
    // 🎙️ RECORDING
    // =========================================================

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

// =============================================================
// 📊 EXISTING INDEXES
// =============================================================

callLogSchema.index({
  salespersonId: 1,
  dialedAt: -1,
});

callLogSchema.index({
  salespersonId: 1,
  phoneNumber: 1,
  dialedAt: -1,
});

// =============================================================
// 📱 DEVICE CALL DEDUPLICATION INDEX
// =============================================================
// Same Android call should not be inserted twice for the same
// salesperson.
//
// NOTE:
// deviceCallLogId is nullable, so we use a partial index.
// =============================================================

callLogSchema.index(
  {
    salespersonId: 1,
    deviceCallLogId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      deviceCallLogId: {
        $type: "string",
      },
    },
  }
);

// =============================================================
// 📦 EXPORT
// =============================================================

module.exports =
  mongoose.models.CallLog ||
  mongoose.model("CallLog", callLogSchema);