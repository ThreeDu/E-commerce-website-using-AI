const { defineModel, NOW, EMPTY_OBJECT } = require("../db/model");

// expireAt = createdAt + 30 ngày: bật TTL policy trên field expireAt (collection notifications) trong Firebase Console
module.exports = defineModel("Notification", {
  collection: "notifications",
  defaults: { isRead: false, createdAt: NOW },
  refs: { user: "User" },
  ttl: { field: "createdAt", seconds: 30 * 24 * 60 * 60 },
});
