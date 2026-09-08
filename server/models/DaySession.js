const mongoose = require('mongoose');

const daySessionSchema = new mongoose.Schema({
  salespersonId: {
    type: String,
    required: true,
    index: true
  },

  date: {
    type: String,
    required: true,
    index: true
  }, // YYYY-MM-DD

  status: {
    type: String,
    enum: ["STARTED", "ENDED"],
    default: "STARTED"
  },

  startTime: {
    type: Date,
    default: Date.now
  },

  // 📍 Start Day Location - Point A
  startLocation: {
    latitude: Number,
    longitude: Number,
  },

  startAddress: {
    type: String,
    default: ""
  },

  // 📍 All important activity locations
  distancePoints: [
    {
      type: {
        type: String,
        enum: ["START", "LEAD", "INVOICE", "END", "GPS_PING", "REVISIT"],
        required: true
      },

      referenceId: {
        type: String,
        default: null
      },

      latitude: {
        type: Number,
        required: true
      },

      longitude: {
        type: Number,
        required: true
      },

      timestamp: {
        type: Date,
        default: Date.now
      },

      distanceFromPreviousKm: {
        type: Number,
        default: 0
      },

      totalDistanceKm: {
        type: Number,
        default: 0
      }
    }
  ],

  // 📍 End Day Location - final point
  endTime: {
    type: Date
  },

  endLocation: {
    latitude: Number,
    longitude: Number,
  },

  // 🔢 Final/Current total distance
  totalDistanceKm: {
    type: Number,
    default: 0
  },
});

module.exports = mongoose.models.DaySession || mongoose.model("DaySession", daySessionSchema);