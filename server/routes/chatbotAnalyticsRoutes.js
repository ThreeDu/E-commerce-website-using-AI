/**
 * chatbotAnalyticsRoutes.js — Analytics endpoints for chatbot usage tracking
 */

const express = require('express');
const router = express.Router();
const ChatbotEvent = require('../models/ChatbotEvent');
const ChatSession = require('../models/ChatSession');
const Product = require('../models/Product');
const { requireAdmin } = require('./helpers/authHelpers');

/**
 * GET /api/admin/chatbot-analytics/overview
 */
router.get('/overview', requireAdmin, async (req, res) => {
  try {
    const totalSessions = await ChatSession.countDocuments();
    const totalEvents = await ChatbotEvent.countDocuments();
    const impressions = await ChatbotEvent.countDocuments({ eventType: 'impression' });
    const clicks = await ChatbotEvent.countDocuments({ eventType: 'click' });
    // Enum của ChatbotEvent dùng 'cart' cho thêm giỏ ('add_to_cart' không bao giờ có nên trước đây luôn ra 0)
    const addToCarts = await ChatbotEvent.countDocuments({ eventType: 'cart' });

    // shortcut: gom nhóm bằng JS trên toàn bộ sự kiện có câu hỏi / sản phẩm (Firestore không có aggregate)
    const events = await ChatbotEvent.find({}).select('queryText product');
    const tally = (keyOf) => {
      const counts = new Map();
      events.forEach((e) => {
        const key = keyOf(e);
        if (key) counts.set(key, (counts.get(key) || 0) + 1);
      });
      return [...counts].sort((a, b) => b[1] - a[1]);
    };

    const topQueries = tally((e) => e.queryText).slice(0, 10).map(([_id, count]) => ({ _id, count }));

    const topProductCounts = tally((e) => (e.product ? String(e.product) : null)).slice(0, 5);
    const productInfos = await Product.find({ _id: { $in: topProductCounts.map(([id]) => id) } });
    const infoById = new Map(productInfos.map((p) => [String(p._id), p]));
    const topProducts = topProductCounts
      .filter(([id]) => infoById.has(id))
      .map(([_id, impressions]) => ({ _id, impressions, productInfo: infoById.get(_id) }));

    return res.json({
      success: true,
      data: {
        totalSessions,
        totalEvents,
        impressions,
        clicks,
        addToCarts,
        ctr: impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) + '%' : '0%',
        conversionRate: impressions > 0 ? ((addToCarts / impressions) * 100).toFixed(2) + '%' : '0%',
        topQueries,
        topProducts,
      },
    });
  } catch (error) {
    console.error('[ChatbotAnalytics] Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
