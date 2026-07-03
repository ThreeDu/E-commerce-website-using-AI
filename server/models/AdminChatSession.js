const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'tool', 'confirmation'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  toolName: {
    type: String,
    default: null,
  },
  confirmationData: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  }
});

const adminChatSessionSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  messages: [messageSchema],
}, {
  timestamps: true,
});

module.exports = mongoose.model('AdminChatSession', adminChatSessionSchema);
