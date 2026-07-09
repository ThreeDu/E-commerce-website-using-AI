/**
 * chatbotController.js — Request handling & response formatting
 */

const jwt = require('jsonwebtoken');
const { processMessage } = require('./chatbotService');
const ChatbotEvent = require('./models/ChatbotEvent');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Extract optional userId from Authorization header.
 * Chatbot works for both anonymous and authenticated users.
 */
function extractUserId(req) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId || decoded.id || null;
  } catch {
    return null;
  }
}

/**
 * POST /api/chatbot/message
 */
async function chatWithAssistant(req, res) {
  try {
    const userId = extractUserId(req);
    const { message, sessionId, history, context } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tin nhắn không được để trống.',
      });
    }

    const result = await processMessage({
      message: message.trim(),
      sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId,
      history: Array.isArray(history) ? history : [],
      context: context || {},
    });

    return res.json(result);
  } catch (error) {
    console.error('[Chatbot] Controller error:', error.message);
    return res.status(500).json({
      reply: 'Xin lỗi, tôi đang gặp sự cố. Vui lòng thử lại sau.',
      products: [],
      quickReplies: [],
      sessionId: req.body?.sessionId || null,
      cartUpdated: false,
    });
  }
}

/**
 * POST /api/chatbot/event
 */
async function trackEvent(req, res) {
  try {
    const userId = extractUserId(req);
    const { sessionId, eventType, productId, category, queryText, metadata } = req.body;

    if (!sessionId || !eventType) {
      return res.status(400).json({ success: false, message: 'sessionId and eventType are required.' });
    }

    await ChatbotEvent.create({
      sessionId,
      user: userId || undefined,
      eventType,
      product: productId || undefined,
      category: category || undefined,
      queryText: queryText || undefined,
      metadata: metadata || undefined,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('[Chatbot] Event tracking error:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi khi ghi nhận sự kiện.' });
  }
}

module.exports = { chatWithAssistant, trackEvent };
