const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    resource: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    resourceId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    adminId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    adminEmail: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    method: {
      type: String,
      default: null,
      trim: true,
    },
    path: {
      type: String,
      default: null,
      trim: true,
    },
    ip: {
      type: String,
      default: null,
      trim: true,
    },
    userAgent: {
      type: String,
      default: null,
      trim: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    versionKey: false,
  }
);

auditLogSchema.index({ resource: 1, action: 1, timestamp: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
