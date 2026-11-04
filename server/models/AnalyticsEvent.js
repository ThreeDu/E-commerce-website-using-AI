const { defineModel, NOW, EMPTY_OBJECT } = require("../db/model");

module.exports = defineModel("AnalyticsEvent", {
  collection: "analyticsevents",
  defaults: { userId: null, anonymousId: "", sessionId: "", pagePath: "", source: "web", metadata: EMPTY_OBJECT, occurredAt: NOW },
  trim: ["eventName", "anonymousId", "sessionId", "pagePath", "source"],
  refs: { userId: "User" },
});
