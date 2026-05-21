const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["order_status", "product_discount", "new_coupon", "system"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      orderId: mongoose.Schema.Types.ObjectId,
      productId: mongoose.Schema.Types.ObjectId,
      productName: String,
      discountPercent: Number,
      discountCode: String,
      orderStatus: String,
    },
    link: {
      type: String,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying notifications by user
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

// TTL index to automatically delete notifications after 30 days
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

module.exports = mongoose.model("Notification", notificationSchema);
