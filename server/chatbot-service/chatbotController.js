/**
 * chatbotController.js — Request handling & response formatting
 */

const jwt = require('jsonwebtoken');
const { processMessage, processMessageStream } = require('./chatbotService');
const { callLLMWithImage } = require('./llmHelper');
const { executeTool } = require('./chatbotToolExecutor');
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

/**
 * POST /api/chatbot/message/stream — SSE streaming endpoint
 */
async function chatWithAssistantStream(req, res) {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const userId = extractUserId(req);
    const { message, sessionId, context } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      sendEvent('error', { message: 'Tin nhắn không được để trống.' });
      res.end();
      return;
    }

    const result = await processMessageStream({
      message: message.trim(),
      sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId,
      context: context || {},
      onChunk: (text) => sendEvent('token', { text }),
      onProducts: (meta) => sendEvent('products', meta),
    });

    sendEvent('done', { sessionId: result.sessionId, cartUpdated: result.cartUpdated });
  } catch (error) {
    console.error('[Chatbot-Stream] Error:', error.message);
    sendEvent('error', { message: 'Xin lỗi, tôi đang gặp sự cố. Vui lòng thử lại sau.' });
  } finally {
    res.end();
  }
}

/**
 * POST /api/chatbot/message/image — Image recognition endpoint
 */
async function chatWithImage(req, res) {
  try {
    const userId = extractUserId(req);
    const { message, imageBase64, mimeType, sessionId } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu ảnh.' });
    }

    const systemPrompt = `Bạn là trợ lý tư vấn bán hàng AI của cửa hàng điện tử.
Nhìn vào ảnh này và mô tả sản phẩm bạn thấy. Xác định:
- Loại sản phẩm (điện thoại, laptop, tablet, v.v.)
- Thương hiệu nếu nhận ra được
- Các đặc điểm nổi bật
Sau đó đưa ra gợi ý tìm kiếm sản phẩm tương tự trong cửa hàng.
Trả lời bằng tiếng Việt.`;

    const userMsg = message || 'Hãy nhận diện sản phẩm trong ảnh này và tìm sản phẩm tương tự trong cửa hàng.';

    const visionResult = await callLLMWithImage(systemPrompt, userMsg, imageBase64, mimeType || 'image/jpeg');

    // Try to auto-search for similar products
    let products = [];
    const searchMatch = visionResult.content.match(/(?:tìm|search|keyword)[:\s]+"?([^"\n]+)"?/i);
    if (searchMatch) {
      const searchResult = await executeTool('searchProducts', { keyword: searchMatch[1].trim() }, userId);
      if (searchResult.products) products = searchResult.products;
    }

    return res.json({
      reply: visionResult.content,
      products,
      quickReplies: ['Tìm sản phẩm tương tự', 'Xem chi tiết', 'So sánh giá'],
      sessionId: sessionId || null,
      cartUpdated: false,
    });
  } catch (error) {
    console.error('[Chatbot-Image] Error:', error.message);
    return res.status(500).json({
      reply: 'Xin lỗi, tôi chưa thể xử lý ảnh lúc này. Vui lòng thử lại sau.',
      products: [],
      quickReplies: [],
      sessionId: req.body?.sessionId || null,
      cartUpdated: false,
    });
  }
}

module.exports = { chatWithAssistant, chatWithAssistantStream, chatWithImage, trackEvent };
