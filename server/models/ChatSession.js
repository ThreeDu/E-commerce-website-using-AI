const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'tool'],
    required: true,
  },
  content: {
    type: String,
    default: '',
  },
  toolName: {
    type: String,
    default: null,
  },
  // Sản phẩm gợi ý kèm câu trả lời của assistant, để dựng lại thẻ sản phẩm khi khôi phục lịch sử
  productIds: {
    type: [String],
    default: undefined,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const chatSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    messages: [chatMessageSchema],
    context: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// TTL index: auto-delete sessions after 7 days of inactivity
chatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
