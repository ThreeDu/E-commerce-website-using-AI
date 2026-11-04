const { defineModel, NOW, EMPTY_OBJECT } = require("../db/model");

// expireAt = updatedAt + 7 ngày: bật TTL policy trên field expireAt (collection chatsessions) trong Firebase Console
module.exports = defineModel("ChatSession", {
  collection: "chatsessions",
  defaults: { userId: null, context: EMPTY_OBJECT },
  subdocArrays: ["messages"],
  arrays: ["messages"],
  subDefaults: { messages: { content: "", toolName: null, timestamp: NOW } },
  refs: { userId: "User" },
  unique: [["sessionId"]],
  ttl: { field: "updatedAt", seconds: 7 * 24 * 60 * 60 },
});
