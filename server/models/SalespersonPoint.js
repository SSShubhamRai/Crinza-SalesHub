const mongoose = require("mongoose");

const salespersonPointSchema = new mongoose.Schema(
  {
    salespersonId: {
      type: String,
      required: true,
      index: true,
    },

    date: {
      type: String,
      required: true,
      index: true,
    },

    leadsCreated: {
      type: Number,
      default: 0,
    },

    revisits: {
      type: Number,
      default: 0,
    },

    demosDone: {
      type: Number,
      default: 0,
    },

    dealsClosed: {
      type: Number,
      default: 0,
    },

    callsConnected: {
      type: Number,
      default: 0,
    },

    dialCalls: {
      type: Number,
      default: 0,
    },

    totalPoints: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

salespersonPointSchema.index(
  { salespersonId: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "SalespersonPoint",
  salespersonPointSchema
);