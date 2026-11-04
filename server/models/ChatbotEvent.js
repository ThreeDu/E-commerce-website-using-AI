const { defineModel, NOW, EMPTY_OBJECT } = require("../db/model");

module.exports = defineModel("ChatbotEvent", {
  collection: "chatbotevents",
  defaults: { user: null, product: null, category: "", queryText: "", metadata: EMPTY_OBJECT },
  trim: ["sessionId", "category", "queryText"],
  refs: { user: "User", product: "Product" },
});
