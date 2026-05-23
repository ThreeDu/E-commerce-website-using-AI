const mongoose = require("mongoose");

const rewardTierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    pointsRequired: {
      type: Number,
      required: true,
      min: 1,
    },
    discountType: {
      type: String,
      required: true,
      enum: ["percent", "fixed"],
      default: "fixed",
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    voucherValidDays: {
      type: Number,
      default: 30,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("RewardTier", rewardTierSchema);
