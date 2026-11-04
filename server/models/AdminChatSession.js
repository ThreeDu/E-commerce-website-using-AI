const { defineModel, NOW, EMPTY_OBJECT } = require("../db/model");

module.exports = defineModel("AdminChatSession", {
  collection: "adminchatsessions",
  trim: ["title"],
  subdocArrays: ["messages"],
  arrays: ["messages"],
  subDefaults: { messages: { content: "", timestamp: NOW, toolName: null, confirmationData: null } },
  refs: { adminId: "User" },
  unique: [["sessionId"]],
});
