const mongoose = require("mongoose");

const analyticsEventSchema = new mongoose.Schema(
  {
    eventName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    anonymousId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    sessionId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    pagePath: {
      type: String,
      default: "",
      trim: true,
    },
    source: {
      type: String,
      default: "web",
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("AnalyticsEvent", analyticsEventSchema);
