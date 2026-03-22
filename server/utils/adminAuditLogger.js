const AuditLog = require("../models/AuditLog");

function getRequestIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}

function logAdminAction({ req, adminUser, action, resource, resourceId, details = {} }) {
  const logPayload = {
    timestamp: new Date(),
    action,
    resource,
    resourceId: resourceId ? String(resourceId) : null,
    adminId: adminUser?._id ? String(adminUser._id) : null,
    adminEmail: adminUser?.email || null,
    method: req?.method || null,
    path: req?.originalUrl || req?.url || null,
    ip: getRequestIp(req),
    userAgent: req?.headers?.["user-agent"] || null,
    details,
  };

  AuditLog.create(logPayload).catch((error) => {
    console.error("[ADMIN_AUDIT][DB_WRITE_FAILED]", error.message);
  });

  console.info("[ADMIN_AUDIT]", JSON.stringify({ ...logPayload, timestamp: logPayload.timestamp.toISOString() }));
}

module.exports = {
  logAdminAction,
};
