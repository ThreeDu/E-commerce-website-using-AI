/**
 * chatbotAnalyticsRoutes.js — Analytics endpoints for chatbot usage tracking
 */

const express = require('express');
const router = express.Router();
const ChatbotEvent = require('../chatbot-service/models/ChatbotEvent');
const ChatSession = require('../chatbot-service/models/ChatSession');
const { verifyAdminRequest } = require('./helpers/authHelpers');

/**
 * GET /api/admin/chatbot-analytics/overview
 */
router.get('/overview', async (req, res) => {
  try {
    const admin = await verifyAdminRequest(req, res);
    if (!admin) return;

    const totalSessions = await ChatSession.countDocuments();
    const totalEvents = await ChatbotEvent.countDocuments();
    const impressions = await ChatbotEvent.countDocuments({ eventType: 'impression' });
    const clicks = await ChatbotEvent.countDocuments({ eventType: 'click' });
    const addToCarts = await ChatbotEvent.countDocuments({ eventType: 'add_to_cart' });

    // Popular search topics
    const topQueries = await ChatbotEvent.aggregate([
      { $match: { queryText: { $exists: true, $ne: '' } } },
      { $group: { _id: '$queryText', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Top recommended products
    const topProducts = await ChatbotEvent.aggregate([
      { $match: { product: { $exists: true } } },
      { $group: { _id: '$product', impressions: { $sum: 1 } } },
      { $sort: { impressions: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: '$productInfo' },
    ]);

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
