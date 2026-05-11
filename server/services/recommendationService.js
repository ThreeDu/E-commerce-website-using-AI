/**
 * Recommendation Service — Personalized product suggestions.
 *
 * Uses analytics events (product_view, add_to_cart, wishlist_add),
 * order history, wishlist data, **current cart items**, and **ML churn
 * scores** to suggest relevant products for each user.
 *
 * Falls back to trending products when no behavioral data is available.
 *
 * Strategy tiers:
 *   Tier 1 — Authenticated user → personalized by behavior + ML churn boost
 *   Tier 2 — Anonymous visitor  → session-based + cart-based suggestions
 *   Tier 3 — No data fallback   → trending / popular products
 */

const mongoose = require("mongoose");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const Product = require("../models/Product");
const User = require("../models/User");
const Order = require("../models/Order");

const WINDOW_DAYS = 30;
const DEFAULT_LIMIT = 8;
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";

// ── Helpers ──

function windowStart() {
  return new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

function toObjectId(value) {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ── ML Service Integration ──

/**
 * Fetch churn score for a specific user from the ML service.
 * Returns { churn_score, churn_level, potential_score } or null if unavailable.
 */
async function fetchUserChurnData(userId) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(
      `${ML_SERVICE_URL}/api/intelligence/customers?sort=churn_score&order=desc&limit=200&page=1`,
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    if (!data?.models_ready || !Array.isArray(data?.customers)) return null;

    const userIdStr = String(userId);
    const customer = data.customers.find((c) => String(c._id) === userIdStr);
    return customer || null;
  } catch {
    // ML service unavailable — gracefully degrade
    return null;
  }
}

/**
 * Apply churn-aware boosting to recommendation strategy.
 *
 * For high-churn users: prioritize discounted products, best-sellers,
 * and top-rated items to increase engagement and retention.
 */
function applyChurnBoost(candidates, churnData) {
  if (!churnData || !Array.isArray(candidates) || candidates.length === 0) {
    return candidates;
  }

  const churnScore = Number(churnData.churn_score || 0);

  // Only boost for medium-to-high churn risk (score >= 31)
  if (churnScore < 31) {
    return candidates;
  }

  return candidates
    .map((product) => {
      let boostScore = 0;

      // High churn (>=61): strongly prefer discounts + popular items
      // Medium churn (31-60): mildly prefer popular items
      const intensity = churnScore >= 61 ? 1.0 : 0.5;

      // Boost discounted products (deals attract at-risk users)
      const discountPercent = Number(product.discountPercent || 0);
      if (discountPercent > 0) {
        boostScore += discountPercent * 0.8 * intensity;
      }

      // Boost best-sellers (social proof)
      const purchases = Number(product.totalPurchases || 0);
      if (purchases > 0) {
        boostScore += Math.min(30, Math.log10(purchases + 1) * 15) * intensity;
      }

      // Boost highly-rated products
      const rating = Number(product.averageRating || 0);
      if (rating >= 4.0) {
        boostScore += (rating - 3) * 10 * intensity;
      }

      return {
        ...product,
        _churnBoost: boostScore,
      };
    })
    .sort((a, b) => (b._churnBoost || 0) - (a._churnBoost || 0));
}

// ── Cart-based signal extraction ──

/**
 * Extract category and brand hints from cart product IDs.
 */
async function extractCartSignals(cartProductIds = []) {
  const validIds = cartProductIds.map(toObjectId).filter(Boolean);
  if (validIds.length === 0) {
    return { cartCategories: new Set(), cartBrands: new Set(), cartExcludeIds: new Set() };
  }

  const cartProducts = await Product.find({ _id: { $in: validIds } })
    .select("category brand")
    .lean();

  const cartCategories = new Set();
  const cartBrands = new Set();
  const cartExcludeIds = new Set(cartProductIds.map(String));

  for (const p of cartProducts) {
    if (p.category) cartCategories.add(String(p.category).trim());
    if (p.brand) cartBrands.add(String(p.brand).trim().toLowerCase());
  }

  return { cartCategories, cartBrands, cartExcludeIds };
}

// ── Tier 1: Personalized for authenticated users ──

async function getPersonalizedRecommendations(userId, limit = DEFAULT_LIMIT, cartProductIds = []) {
  const uid = toObjectId(userId);
  if (!uid) return getTrendingProducts(limit);

  const since = windowStart();

  // 1. Gather behavioral signals + ML churn data in parallel
  const [viewEvents, cartEvents, user, recentOrders, churnData, cartSignals] = await Promise.all([
    AnalyticsEvent.find({
      userId: uid,
      eventName: "product_view",
      occurredAt: { $gte: since },
    })
      .sort({ occurredAt: -1 })
      .limit(50)
      .lean(),

    AnalyticsEvent.find({
      userId: uid,
      eventName: "add_to_cart",
      occurredAt: { $gte: since },
    })
      .sort({ occurredAt: -1 })
      .limit(20)
      .lean(),

    User.findById(uid).select("wishlist").lean(),

    Order.find({
      user: uid,
      status: { $ne: "cancelled" },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("orderItems")
      .lean(),

    fetchUserChurnData(userId),

    extractCartSignals(cartProductIds),
  ]);

  // 2. Collect product IDs the user has already interacted with
  const interactedProductIds = new Set();
  const categoryHints = new Set();
  const brandHints = new Set();

  // Extract from view events
  for (const event of viewEvents) {
    const pid = String(event.metadata?.productId || "").trim();
    if (pid) interactedProductIds.add(pid);

    const cat = String(event.metadata?.category || "").trim();
    if (cat) categoryHints.add(cat);
  }

  // Extract from cart events
  for (const event of cartEvents) {
    const pid = String(event.metadata?.productId || "").trim();
    if (pid) interactedProductIds.add(pid);

    const cat = String(event.metadata?.category || "").trim();
    if (cat) categoryHints.add(cat);
  }

  // Extract from orders
  for (const order of recentOrders) {
    const items = Array.isArray(order.orderItems) ? order.orderItems : [];
    for (const item of items) {
      if (item.product) interactedProductIds.add(String(item.product));
    }
  }

  // Wishlist product IDs
  const wishlistIds = Array.isArray(user?.wishlist)
    ? user.wishlist.map((id) => String(id))
    : [];
  for (const wid of wishlistIds) {
    interactedProductIds.add(wid);
  }

  // 3. Merge cart signals into hints
  for (const cat of cartSignals.cartCategories) {
    categoryHints.add(cat);
  }
  for (const brand of cartSignals.cartBrands) {
    brandHints.add(brand);
  }
  for (const cid of cartSignals.cartExcludeIds) {
    interactedProductIds.add(cid);
  }

  // 4. Resolve categories/brands from interacted products
  const interactedIdArray = [...interactedProductIds]
    .map(toObjectId)
    .filter(Boolean);

  if (interactedIdArray.length > 0) {
    const interactedProducts = await Product.find({
      _id: { $in: interactedIdArray },
    })
      .select("category brand")
      .lean();

    for (const p of interactedProducts) {
      if (p.category) categoryHints.add(String(p.category).trim());
      if (p.brand) brandHints.add(String(p.brand).trim().toLowerCase());
    }
  }

  // 5. If we have no behavioral signals at all, use trending
  if (categoryHints.size === 0 && brandHints.size === 0) {
    return getTrendingProducts(limit);
  }

  // 6. Find recommended products: same category/brand, excluding seen ones
  const excludeIds = interactedIdArray;

  const filter = {
    stock: { $gt: 0 },
  };

  if (excludeIds.length > 0) {
    filter._id = { $nin: excludeIds };
  }

  // Build $or conditions for category and brand matches
  const orConditions = [];
  if (categoryHints.size > 0) {
    orConditions.push({ category: { $in: [...categoryHints] } });
  }
  if (brandHints.size > 0) {
    orConditions.push({ brand: { $in: [...brandHints] } });
  }
  if (orConditions.length > 0) {
    filter.$or = orConditions;
  }

  let candidates = await Product.find(filter)
    .sort({ totalPurchases: -1, averageRating: -1, totalViews: -1 })
    .limit(limit * 3)
    .lean();

  // 7. Apply ML churn-aware boosting for at-risk users
  candidates = applyChurnBoost(candidates, churnData);

  // Shuffle to add variety, then trim to limit
  candidates = shuffle(candidates).slice(0, limit);

  // 8. If not enough, pad with trending products
  if (candidates.length < limit) {
    const existingIds = new Set([
      ...candidates.map((p) => String(p._id)),
      ...interactedProductIds,
    ]);
    const padding = await getTrendingProducts(limit - candidates.length, existingIds);
    candidates = [...candidates, ...padding];
  }

  return candidates;
}

// ── Tier 2: Anonymous session-based ──

async function getAnonymousRecommendations(anonymousId, limit = DEFAULT_LIMIT, cartProductIds = []) {
  if (!anonymousId) return getTrendingProducts(limit);

  const since = windowStart();

  const [viewEvents, cartSignals] = await Promise.all([
    AnalyticsEvent.find({
      anonymousId: String(anonymousId).trim(),
      eventName: "product_view",
      occurredAt: { $gte: since },
    })
      .sort({ occurredAt: -1 })
      .limit(30)
      .lean(),

    extractCartSignals(cartProductIds),
  ]);

  const viewedProductIds = new Set();
  const categoryHints = new Set();

  for (const event of viewEvents) {
    const pid = String(event.metadata?.productId || "").trim();
    if (pid) viewedProductIds.add(pid);

    const cat = String(event.metadata?.category || "").trim();
    if (cat) categoryHints.add(cat);
  }

  // Merge cart signals
  for (const cat of cartSignals.cartCategories) {
    categoryHints.add(cat);
  }
  for (const cid of cartSignals.cartExcludeIds) {
    viewedProductIds.add(cid);
  }

  // Resolve categories from products if metadata doesn't have them
  if (categoryHints.size === 0) {
    const productIds = [...viewedProductIds].map(toObjectId).filter(Boolean);
    if (productIds.length > 0) {
      const products = await Product.find({ _id: { $in: productIds } })
        .select("category brand")
        .lean();
      for (const p of products) {
        if (p.category) categoryHints.add(String(p.category).trim());
      }
    }
  }

  if (categoryHints.size === 0) {
    return getTrendingProducts(limit);
  }

  const excludeIds = [...viewedProductIds].map(toObjectId).filter(Boolean);

  const orConditions = [{ category: { $in: [...categoryHints] } }];
  if (cartSignals.cartBrands.size > 0) {
    orConditions.push({ brand: { $in: [...cartSignals.cartBrands] } });
  }

  const filter = {
    $or: orConditions,
    stock: { $gt: 0 },
  };

  if (excludeIds.length > 0) {
    filter._id = { $nin: excludeIds };
  }

  let candidates = await Product.find(filter)
    .sort({ totalPurchases: -1, averageRating: -1 })
    .limit(limit * 3)
    .lean();

  candidates = shuffle(candidates).slice(0, limit);

  if (candidates.length < limit) {
    const existingIds = new Set([
      ...candidates.map((p) => String(p._id)),
      ...viewedProductIds,
    ]);
    const padding = await getTrendingProducts(limit - candidates.length, existingIds);
    candidates = [...candidates, ...padding];
  }

  return candidates;
}

// ── Tier 3: Trending products (fallback) ──

async function getTrendingProducts(limit = DEFAULT_LIMIT, excludeIds = new Set()) {
  const filter = {
    stock: { $gt: 0 },
  };

  const excludeArray = [...excludeIds].map(toObjectId).filter(Boolean);
  if (excludeArray.length > 0) {
    filter._id = { $nin: excludeArray };
  }

  const products = await Product.find(filter)
    .sort({ totalPurchases: -1, totalViews: -1, averageRating: -1 })
    .limit(limit * 2)
    .lean();

  return shuffle(products).slice(0, limit);
}

module.exports = {
  getPersonalizedRecommendations,
  getAnonymousRecommendations,
  getTrendingProducts,
};
