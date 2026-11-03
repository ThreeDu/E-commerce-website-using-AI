const mongoose = require("mongoose");

const chatbotEventSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: ["message", "impression", "view", "click", "cart"],
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },
    category: {
      type: String,
      trim: true,
      default: "",
    },
    queryText: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

chatbotEventSchema.index({ createdAt: -1 });
chatbotEventSchema.index({ sessionId: 1, createdAt: -1 });
chatbotEventSchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model("ChatbotEvent", chatbotEventSchema);
