const express = require("express");
const jwt = require("jsonwebtoken");
const { createAnalyticsEvent } = require("../controllers/analyticsController");
const {
  getPersonalizedRecommendations,
  getAnonymousRecommendations,
  getTrendingProducts,
} = require("../services/recommendationService");
const { getTokenFromHeader } = require("./helpers/authHelpers");

const router = express.Router();

router.post("/events", createAnalyticsEvent);

// @route   GET /api/analytics/recommendations
// @desc    Return personalized product recommendations
// @access  Public (quality improves when authenticated)
router.get("/recommendations", async (req, res) => {
  try {
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 8), 20);
    const anonymousId = String(req.query.anonymousId || "").trim();

    // Parse cart product IDs (comma-separated)
    const rawCartIds = String(req.query.cartProductIds || "").trim();
    const cartProductIds = rawCartIds
      ? rawCartIds.split(",").map((id) => id.trim()).filter(Boolean)
      : [];

    // Try to extract userId from token
    let userId = null;
    const token = getTokenFromHeader(req);
    if (token) {
      try {
        const secret = process.env.JWT_SECRET || "dev_secret_change_me";
        const decoded = jwt.verify(token, secret);
        userId = decoded?.userId || null;
      } catch {
        // Invalid token — continue as anonymous
      }
    }

    let products;
    let strategy;

    if (userId) {
      products = await getPersonalizedRecommendations(userId, limit, cartProductIds);
      strategy = "personalized";
    } else if (anonymousId) {
      products = await getAnonymousRecommendations(anonymousId, limit, cartProductIds);
      strategy = "anonymous";
    } else {
      products = await getTrendingProducts(limit);
      strategy = "trending";
    }

    return res.json({
      products: products || [],
      strategy,
      count: (products || []).length,
    });
  } catch (error) {
    console.error("Recommendation error:", error.message);
    return res.status(500).json({ message: error.message, products: [] });
  }
});

module.exports = router;
