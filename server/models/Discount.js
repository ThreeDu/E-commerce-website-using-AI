const { defineModel, NOW, EMPTY_OBJECT } = require("../db/model");

module.exports = defineModel("Discount", {
  collection: "discounts",
  defaults: {
    type: "percent", minOrderValue: 0, maxDiscountValue: 0, usageLimit: 0,
    usedCount: 0, usageLimitPerUser: 0, allowedUsers: [], isActive: true,
  },
  upper: ["code"],
  trim: ["code"],
  arrays: ["allowedUsers"],
  refs: { allowedUsers: "User" },
  unique: [["code"]],
});
