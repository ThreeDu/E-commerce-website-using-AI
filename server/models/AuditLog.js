const { defineModel, NOW, EMPTY_OBJECT } = require("../db/model");

module.exports = defineModel("AuditLog", {
  collection: "auditlogs",
  timestamps: false,
  defaults: {
    timestamp: NOW, resourceId: null, adminId: null, adminEmail: null, method: null,
    path: null, ip: null, userAgent: null, details: EMPTY_OBJECT,
  },
  trim: ["action", "resource", "resourceId", "adminId", "adminEmail", "method", "path", "ip", "userAgent"],
});
