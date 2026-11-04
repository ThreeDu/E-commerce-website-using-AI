const { defineModel, NOW, EMPTY_OBJECT } = require("../db/model");

module.exports = defineModel("RewardTier", {
  collection: "rewardtiers",
  defaults: { discountType: "fixed", maxDiscountValue: 0, minOrderValue: 0, voucherValidDays: 30, isActive: true },
  trim: ["name"],
});
