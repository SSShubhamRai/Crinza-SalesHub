const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    // =========================================================
    // 🏫 BASIC LEAD INFORMATION
    // =========================================================

    instituteName: {
      type: String,
      required: true,
      trim: true,
    },

    contactPerson: {
      type: String,
      required: true,
      trim: true,
    },

    mobileNo: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    email: {
      type: String,
      trim: true,
      default: "",
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    pincode: {
      type: String,
      trim: true,
      default: "",
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
    },

    notes: {
      type: String,
      default: "",
    },

    meetingPhoto: {
      type: String,
      default: "",
    },

    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },

    // =========================================================
    // 🕒 VISIT & TRACKING
    // =========================================================

    leadDate: {
      type: String,
      default: "",
    },

    leadTime: {
      type: String,
      default: "",
    },

    visitCount: {
      type: Number,
      default: 1,
    },

    followUpDate: {
      type: Date,
      default: null,
    },

    followUpTime: {
      type: String,
      default: "",
    },

    followUpAction: {
      type: String,
      enum: ["Call", "Next Meeting", "Demo", "Closed"],
      default: "Call",
    },

    // =========================================================
    // 📊 PIPELINE FIELDS
    // =========================================================

    demoStatus: {
      type: String,
      enum: [
        "Not Given",
        "Scheduled",
        "Completed",
        "Interested",
      ],
      default: "Not Given",
    },

    leadStatus: {
      type: String,
      enum: [
        "Active",
        "Call Back",
        "Follow Up",
        "Not Interested",
        "Deal Close",
      ],
      default: "Active",
      index: true,
    },

    // =========================================================
    // 🎯 DEMO COMPLETION TRACKING
    // =========================================================

    demoCompletedAt: {
      type: Date,
      default: null,
    },

    demoReviewNotes: {
      type: String,
      default: "",
    },

    // =========================================================
    // 👨‍💼 SALESPERSON ASSIGNMENT
    // =========================================================

    salespersonId: {
      type: String,
      default: null,
      index: true,
    },

    assignedSalespersonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    salespersonStatus: {
      type: String,
      enum: [
        "PENDING_ACCEPTANCE",
        "ACCEPTED",
        "DEMO_SCHEDULED",
        "DEAL_CLOSED",
        "REJECTED",
      ],
      default: "PENDING_ACCEPTANCE",
    },

    salespersonNotes: {
      type: String,
      default: "",
    },

    assignedBy: {
      type: String,
      default: null,
    },

    // =========================================================
    // 📞 TELECALLER
    // =========================================================

    telecallerId: {
      type: String,
      default: null,
      index: true,
    },

    // =========================================================
    // 📞 CALL / RECORDING SUPPORT
    // =========================================================

    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },

    recordingUrl: {
      type: String,
      default: "",
    },

    recordingConsent: {
      type: Boolean,
      default: false,
    },

    // =========================================================
    // 📅 MEETING / DEMO
    // =========================================================

    meetingType: {
      type: String,
      enum: ["PHYSICAL", "VIRTUAL_DEMO", "NONE"],
      default: "NONE",
    },

    meetingDateTime: {
      type: Date,
      default: null,
    },

    requirementType: {
      type: String,
      enum: ["Demo", "Meeting", "NONE"],
      default: "Demo",
    },

    // =========================================================
    // 🔘 GENERAL STATUS
    // =========================================================

    status: {
      type: String,
      default: "Active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// =============================================================
// 📌 COMPOUND INDEXES
// =============================================================

// Salesperson + phone number lookup
// Useful for matching a device call to the salesperson's lead.
leadSchema.index({
  salespersonId: 1,
  mobileNo: 1,
});

// Assigned salesperson + phone number lookup
leadSchema.index({
  assignedSalespersonId: 1,
  mobileNo: 1,
});

// =============================================================
// 📌 MODEL
// =============================================================

module.exports =
  mongoose.models.Lead ||
  mongoose.model("Lead", leadSchema);