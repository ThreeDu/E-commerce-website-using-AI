/**
 * Recommendation Service — Personalized product suggestions.
 *
 * Uses analytics events (product_view, add_to_cart, wishlist_add),
 * order history, and wishlist data to suggest relevant products for
 * each user. Falls back to trending products when no behavioral data
 * is available.
 *
 * Three-tier recommendation strategy:
 *   Tier 1 — Authenticated user → personalized by behavior
 *   Tier 2 — Anonymous visitor  → session-based suggestions
 *   Tier 3 — No data fallback   → trending / popular products
 */

const mongoose = require("mongoose");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const Product = require("../models/Product");
const User = require("../models/User");
const Order = require("../models/Order");

const WINDOW_DAYS = 30;
const DEFAULT_LIMIT = 8;

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

function uniqueIds(ids) {
  const seen = new Set();
  return ids.filter((id) => {
    const key = String(id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ── Tier 1: Personalized for authenticated users ──

async function getPersonalizedRecommendations(userId, limit = DEFAULT_LIMIT) {
  const uid = toObjectId(userId);
  if (!uid) return getTrendingProducts(limit);

  const since = windowStart();

  // 1. Gather behavioral signals in parallel
  const [viewEvents, cartEvents, user, recentOrders] = await Promise.all([
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

  // 3. Resolve categories/brands from interacted products (for products
  //    where the event metadata may not contain category info)
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

  // 4. If we have no behavioral signals at all, use trending
  if (categoryHints.size === 0 && brandHints.size === 0) {
    return getTrendingProducts(limit);
  }

  // 5. Find recommended products: same category/brand, excluding seen ones
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

  // Shuffle to add variety, then trim to limit
  candidates = shuffle(candidates).slice(0, limit);

  // 6. If not enough, pad with trending products
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

async function getAnonymousRecommendations(anonymousId, limit = DEFAULT_LIMIT) {
  if (!anonymousId) return getTrendingProducts(limit);

  const since = windowStart();

  const viewEvents = await AnalyticsEvent.find({
    anonymousId: String(anonymousId).trim(),
    eventName: "product_view",
    occurredAt: { $gte: since },
  })
    .sort({ occurredAt: -1 })
    .limit(30)
    .lean();

  if (viewEvents.length === 0) {
    return getTrendingProducts(limit);
  }

  const viewedProductIds = new Set();
  const categoryHints = new Set();

  for (const event of viewEvents) {
    const pid = String(event.metadata?.productId || "").trim();
    if (pid) viewedProductIds.add(pid);

    const cat = String(event.metadata?.category || "").trim();
    if (cat) categoryHints.add(cat);
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

  const filter = {
    category: { $in: [...categoryHints] },
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
