const crypto = require("crypto");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Order = require("../models/Order");
const ChatbotEvent = require("../models/ChatbotEvent");

const MAX_HISTORY = 10;
const MAX_SESSION_IDLE_MS = 1000 * 60 * 30;
const MAX_EVENT_WINDOW = 5000;
const sessionStore = new Map();
const knnCache = {
  expiresAt: 0,
  productActorWeights: new Map(),
  actorProductWeights: new Map(),
};

function cleanupOldSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessionStore.entries()) {
    if (now - Number(session.updatedAt || 0) > MAX_SESSION_IDLE_MS) {
      sessionStore.delete(sessionId);
    }
  }
}

function getOrCreateSession(sessionId) {
  cleanupOldSessions();
  const key = String(sessionId || "").trim() || crypto.randomUUID();

  if (!sessionStore.has(key)) {
    sessionStore.set(key, {
      id: key,
      history: [],
      updatedAt: Date.now(),
    });
  }

  const session = sessionStore.get(key);
  session.updatedAt = Date.now();
  return session;
}

function safeObjectId(id) {
  const value = String(id || "").trim();
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }

  return new mongoose.Types.ObjectId(value);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .filter((item) => item.length >= 2);
}

function parseBudgetFromText(message) {
  const text = normalizeText(message);
  if (!text) {
    return null;
  }

  const directMatch = text.match(/(\d+[\d\.]*)\s*(trieu|tr|k|nghin)?/);
  if (!directMatch) {
    return null;
  }

  const numeric = Number(String(directMatch[1]).replace(/\./g, ""));
  if (!numeric || Number.isNaN(numeric)) {
    return null;
  }

  const unit = directMatch[2] || "";
  if (unit === "trieu" || unit === "tr") {
    return numeric * 1000000;
  }

  if (unit === "k" || unit === "nghin") {
    return numeric * 1000;
  }

  if (numeric < 1000) {
    return numeric * 1000000;
  }

  return numeric;
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function detectIntent(message) {
  const plain = normalizeText(message);

  if (!plain) {
    return "unknown";
  }

  if (includesAny(plain, ["xin chao", "chao", "hello", "hi"])) {
    return "greeting";
  }

  if (includesAny(plain, ["doi tra", "bao hanh", "van chuyen", "giao hang", "thanh toan", "chinh sach"])) {
    return "policy";
  }

  if (includesAny(plain, ["goi y", "tu van", "nen mua", "so sanh", "phu hop", "chon", "mua"])) {
    return "product_consult";
  }

  if (includesAny(plain, ["dien thoai", "laptop", "tai nghe", "dong ho", "chuot", "ban phim", "man hinh", "webcam"])) {
    return "product_search";
  }

  return "product_search";
}

function buildBehaviorProfile(behavior) {
  const viewedProductIds = Array.isArray(behavior?.viewedProductIds)
    ? behavior.viewedProductIds.map((item) => String(item))
    : [];

  const cartProductIds = Array.isArray(behavior?.cartProductIds)
    ? behavior.cartProductIds.map((item) => String(item))
    : [];

  const preferredCategories = Array.isArray(behavior?.preferredCategories)
    ? behavior.preferredCategories.map((item) => normalizeText(item))
    : [];

  return {
    viewedProductIds: new Set(viewedProductIds),
    cartProductIds: new Set(cartProductIds),
    preferredCategories,
  };
}

function buildActorKey({ userId, sessionId }) {
  const uid = String(userId || "").trim();
  if (uid) {
    return `u:${uid}`;
  }

  const sid = String(sessionId || "").trim();
  if (sid) {
    return `s:${sid}`;
  }

  return "";
}

function getEventWeight(eventType) {
  if (eventType === "cart") {
    return 3;
  }

  if (eventType === "click") {
    return 2;
  }

  if (eventType === "view") {
    return 1.3;
  }

  if (eventType === "impression") {
    return 0.5;
  }

  if (eventType === "message") {
    return 0.4;
  }

  return 1;
}

async function refreshKnnCache() {
  if (Date.now() < knnCache.expiresAt) {
    return;
  }

  const events = await ChatbotEvent.find({
    product: { $ne: null },
    eventType: { $in: ["view", "click", "cart", "impression"] },
  })
    .sort({ createdAt: -1 })
    .limit(MAX_EVENT_WINDOW)
    .select("sessionId user eventType product")
    .lean();

  const productActorWeights = new Map();
  const actorProductWeights = new Map();

  events.forEach((event) => {
    const productId = String(event.product || "").trim();
    if (!productId) {
      return;
    }

    const actorKey = buildActorKey({
      userId: event.user,
      sessionId: event.sessionId,
    });

    if (!actorKey) {
      return;
    }

    const weight = getEventWeight(event.eventType);

    const actorMap = productActorWeights.get(productId) || new Map();
    actorMap.set(actorKey, Number(actorMap.get(actorKey) || 0) + weight);
    productActorWeights.set(productId, actorMap);

    const productMap = actorProductWeights.get(actorKey) || new Map();
    productMap.set(productId, Number(productMap.get(productId) || 0) + weight);
    actorProductWeights.set(actorKey, productMap);
  });

  knnCache.productActorWeights = productActorWeights;
  knnCache.actorProductWeights = actorProductWeights;
  knnCache.expiresAt = Date.now() + 1000 * 60 * 3;
}

function computeKnnScores(seedProductIds = []) {
  const scores = new Map();
  const productActorWeights = knnCache.productActorWeights;
  const actorProductWeights = knnCache.actorProductWeights;
  const seedSet = new Set(seedProductIds.map((item) => String(item)));

  seedSet.forEach((seedId) => {
    const seedActors = productActorWeights.get(seedId);
    if (!seedActors) {
      return;
    }

    let seedNorm = 0;
    seedActors.forEach((weight) => {
      seedNorm += weight * weight;
    });

    const seedNormRoot = Math.sqrt(seedNorm || 1);
    const dotByCandidate = new Map();

    seedActors.forEach((seedWeight, actorKey) => {
      const actorProducts = actorProductWeights.get(actorKey);
      if (!actorProducts) {
        return;
      }

      actorProducts.forEach((otherWeight, candidateId) => {
        if (candidateId === seedId) {
          return;
        }

        dotByCandidate.set(
          candidateId,
          Number(dotByCandidate.get(candidateId) || 0) + seedWeight * otherWeight
        );
      });
    });

    dotByCandidate.forEach((dot, candidateId) => {
      const candidateActors = productActorWeights.get(candidateId);
      if (!candidateActors) {
        return;
      }

      let candidateNorm = 0;
      candidateActors.forEach((weight) => {
        candidateNorm += weight * weight;
      });

      const sim = dot / (seedNormRoot * Math.sqrt(candidateNorm || 1));
      if (Number.isNaN(sim) || sim <= 0) {
        return;
      }

      const current = Number(scores.get(candidateId) || 0);
      scores.set(candidateId, Math.max(current, sim));
    });
  });

  return scores;
}

async function getSessionSeedProducts({ sessionId, userId, behaviorProfile }) {
  const behaviorSeeds = [
    ...Array.from(behaviorProfile.cartProductIds || []),
    ...Array.from(behaviorProfile.viewedProductIds || []),
  ];

  const seedSet = new Set(behaviorSeeds.map((item) => String(item)));
  const filters = [];

  if (sessionId) {
    filters.push({ sessionId: String(sessionId) });
  }

  const userObjectId = safeObjectId(userId);
  if (userObjectId) {
    filters.push({ user: userObjectId });
  }

  if (filters.length > 0) {
    const recentAgg = await ChatbotEvent.aggregate([
      {
        $match: {
          $or: filters,
          product: { $ne: null },
          eventType: { $in: ["view", "click", "cart"] },
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $limit: 300,
      },
      {
        $group: {
          _id: "$product",
          score: {
            $sum: {
              $switch: {
                branches: [
                  { case: { $eq: ["$eventType", "cart"] }, then: 3 },
                  { case: { $eq: ["$eventType", "click"] }, then: 2 },
                ],
                default: 1,
              },
            },
          },
        },
      },
      {
        $sort: {
          score: -1,
        },
      },
      {
        $limit: 12,
      },
    ]);

    recentAgg.forEach((item) => {
      seedSet.add(String(item._id));
    });
  }

  return Array.from(seedSet).slice(0, 20);
}

function buildSemanticSignal(product, queryTokens) {
  const nameTokens = tokenize(product.name);
  const categoryTokens = tokenize(product.category);
  const descTokens = tokenize(product.description);

  const nameSet = new Set(nameTokens);
  const categorySet = new Set(categoryTokens);
  const descSet = new Set(descTokens);

  let semanticRaw = 0;
  const matched = [];

  queryTokens.forEach((token) => {
    if (nameSet.has(token)) {
      semanticRaw += 4;
      matched.push(token);
      return;
    }

    if (categorySet.has(token)) {
      semanticRaw += 3;
      matched.push(token);
      return;
    }

    if (descSet.has(token)) {
      semanticRaw += 1.2;
      matched.push(token);
    }
  });

  return {
    semanticRaw,
    matched: Array.from(new Set(matched)).slice(0, 4),
  };
}

function rankWithLtr({ product, queryTokens, behaviorProfile, knnScore, budget, totalPurchases }) {
  const semanticSignal = buildSemanticSignal(product, queryTokens);
  const semanticFeature = Math.min(1, semanticSignal.semanticRaw / 8);

  const normalizedCategory = normalizeText(product.category);
  const behaviorFeature =
    (behaviorProfile.preferredCategories.includes(normalizedCategory) ? 0.45 : 0) +
    (behaviorProfile.viewedProductIds.has(String(product._id)) ? 0.25 : 0) +
    (behaviorProfile.cartProductIds.has(String(product._id)) ? 0.35 : 0);

  const popularityFeature =
    Math.min(1, Math.log10(Number(totalPurchases || 0) + 1) / 3) * 0.65 +
    Math.min(1, Math.log10(Number(product.totalViews || 0) + 1) / 4) * 0.35;

  const ratingFeature = Math.min(1, Number(product.averageRating || 0) / 5);

  let priceFitFeature = 0.45;
  if (budget && budget > 0) {
    const delta = Math.abs(Number(product.price || 0) - budget);
    priceFitFeature = Math.max(0, 1 - delta / budget);
  }

  const ltrScore =
    semanticFeature * 0.38 +
    Math.min(1, Number(knnScore || 0)) * 0.22 +
    Math.min(1, behaviorFeature) * 0.16 +
    popularityFeature * 0.14 +
    ratingFeature * 0.06 +
    priceFitFeature * 0.04;

  return {
    ltrScore,
    matched: semanticSignal.matched,
    semanticFeature,
    knnFeature: Math.min(1, Number(knnScore || 0)),
    behaviorFeature: Math.min(1, behaviorFeature),
    popularityFeature,
  };
}

async function trackChatbotEvent({
  sessionId,
  eventType,
  productId,
  category,
  queryText,
  metadata,
  userId,
}) {
  const payload = {
    sessionId: String(sessionId || "").trim(),
    eventType: String(eventType || "").trim(),
    category: String(category || "").trim(),
    queryText: String(queryText || "").trim(),
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  };

  if (!payload.sessionId || !payload.eventType) {
    return null;
  }

  const productObjectId = safeObjectId(productId);
  if (productObjectId) {
    payload.product = productObjectId;
  }

  const userObjectId = safeObjectId(userId);
  if (userObjectId) {
    payload.user = userObjectId;
  }

  const created = await ChatbotEvent.create(payload);
  knnCache.expiresAt = 0;
  return created;
}

async function getPurchaseMapByProductIds(productIds = []) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return new Map();
  }

  const stats = await Order.aggregate([
    {
      $match: {
        status: { $ne: "cancelled" },
      },
    },
    {
      $unwind: "$orderItems",
    },
    {
      $match: {
        "orderItems.product": { $in: productIds },
      },
    },
    {
      $group: {
        _id: "$orderItems.product",
        totalPurchases: {
          $sum: "$orderItems.quantity",
        },
      },
    },
  ]);

  return new Map(stats.map((item) => [String(item._id), Number(item.totalPurchases || 0)]));
}

function buildRecommendationReason(item) {
  const reasons = [];

  if (item.matched.length > 0) {
    reasons.push(`khop nhu cau: ${item.matched.join(", ")}`);
  }

  if (Number(item.knnScore || 0) > 0.2) {
    reasons.push("tuong dong hanh vi KNN");
  }

  if (Number(item.totalPurchases || 0) > 0) {
    reasons.push(`${item.totalPurchases} luot mua`);
  }

  if (Number(item.averageRating || 0) >= 4) {
    reasons.push(`danh gia ${Number(item.averageRating).toFixed(1)} sao`);
  }

  if (reasons.length === 0) {
    reasons.push("phu hop voi nhu cau co ban");
  }

  return reasons.join(" | ");
}

async function findRecommendedProducts(message, context = {}, options = {}) {
  const queryTokens = tokenize(message);
  const behaviorProfile = buildBehaviorProfile(context.userBehavior);
  const budget = parseBudgetFromText(message);

  const products = await Product.find({ stock: { $gt: 0 } })
    .select("_id name price description category image averageRating totalRatings totalViews stock")
    .limit(260)
    .lean();

  const purchaseMap = await getPurchaseMapByProductIds(products.map((item) => item._id));
  await refreshKnnCache();

  const seedProductIds = await getSessionSeedProducts({
    sessionId: options.sessionId,
    userId: options.userId,
    behaviorProfile,
  });
  const knnScores = computeKnnScores(seedProductIds);

  const scored = products
    .map((product) => {
      const totalPurchases = purchaseMap.get(String(product._id)) || 0;
      const knnScore = Number(knnScores.get(String(product._id)) || 0);
      const ltr = rankWithLtr({
        product,
        queryTokens,
        behaviorProfile,
        knnScore,
        budget,
        totalPurchases,
      });

      return {
        ...product,
        totalPurchases,
        knnScore,
        ltrScore: ltr.ltrScore,
        matched: ltr.matched,
      };
    })
    .filter((item) => item.ltrScore > 0.06)
    .sort((a, b) => b.ltrScore - a.ltrScore)
    .slice(0, 5)
    .map((item) => ({
      _id: item._id,
      name: item.name,
      category: item.category,
      price: item.price,
      image: item.image,
      averageRating: item.averageRating,
      totalRatings: item.totalRatings,
      totalViews: item.totalViews,
      totalPurchases: item.totalPurchases,
      knnScore: item.knnScore,
      reason: buildRecommendationReason(item),
    }));

  return scored;
}

function buildRuleReply(intent, recommendedProducts) {
  if (intent === "greeting") {
    return "Chao ban, minh co the goi y san pham theo nhu cau va ngan sach. Ban dang quan tam nhom nao?";
  }

  if (intent === "policy") {
    return "Minh ho tro tu van san pham la chinh. Ve chinh sach giao hang/doi tra, ban co the cho minh biet don cu the hoac phan can hoi de minh huong dan nhanh nhat.";
  }

  if (recommendedProducts.length === 0) {
    return "Minh chua tim duoc san pham phu hop ngay luc nay. Ban thu mo ta ro hon ve muc gia, nhu cau su dung hoac thuong hieu mong muon nhe.";
  }

  const preview = recommendedProducts
    .slice(0, 3)
    .map((item) => `${item.name} (${Number(item.price || 0).toLocaleString("vi-VN")} đ)`)
    .join(", ");

  return `Minh da chon nhanh cac san pham phu hop cho ban: ${preview}. Ban muon minh loc them theo ngan sach hoac muc dich su dung khong?`;
}

function buildQuickReplies(intent) {
  if (intent === "policy") {
    return ["Phi van chuyen", "Thoi gian giao hang", "Chinh sach doi tra"];
  }

  return ["Ngan sach duoi 5 trieu", "Danh gia cao", "Ban chay nhat", "So sanh 2 san pham"];
}

async function maybeGenerateLlmReply({ message, intent, recommendedProducts, history }) {
  const enabled = String(process.env.CHATBOT_LLM_ENABLED || "").toLowerCase() === "true";
  const apiUrl = String(process.env.CHATBOT_LLM_API_URL || "").trim();
  const apiKey = String(process.env.CHATBOT_LLM_API_KEY || "").trim();
  const model = String(process.env.CHATBOT_LLM_MODEL || "gpt-4.1-mini").trim();

  if (!enabled || !apiUrl || !apiKey) {
    return null;
  }

  const contextProducts = recommendedProducts.slice(0, 4).map((item) => ({
    name: item.name,
    category: item.category,
    price: item.price,
    reason: item.reason,
  }));

  const systemPrompt =
    "Ban la tro ly ban hang e-commerce. Tra loi ngan gon bang tieng Viet, uu tien de xuat hanh dong mua hang va khong bịa thong tin ngoai danh sach san pham duoc cung cap.";

  const userPrompt = JSON.stringify(
    {
      intent,
      message,
      products: contextProducts,
      recentHistory: history.slice(-4),
      requirements: "Tra loi toi da 5 cau. Neu can, hoi them 1 cau de lam ro nhu cau.",
    },
    null,
    2
  );

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    return String(content || "").trim() || null;
  } catch (error) {
    return null;
  }
}

async function processChatMessage({ message, sessionId, context = {}, userId = null }) {
  const session = getOrCreateSession(sessionId);
  const plainMessage = String(message || "").trim();
  const intent = detectIntent(plainMessage);

  await trackChatbotEvent({
    sessionId: session.id,
    eventType: "message",
    queryText: plainMessage,
    metadata: {
      intent,
      page: String(context?.page || ""),
    },
    userId,
  });

  const recommendedProducts =
    intent === "policy"
      ? []
      : await findRecommendedProducts(plainMessage, context, {
          sessionId: session.id,
          userId,
        });

  const llmReply = await maybeGenerateLlmReply({
    message: plainMessage,
    intent,
    recommendedProducts,
    history: session.history,
  });

  const reply = llmReply || buildRuleReply(intent, recommendedProducts);
  const quickReplies = buildQuickReplies(intent);

  session.history.push({ role: "user", content: plainMessage, at: new Date().toISOString() });
  session.history.push({ role: "assistant", content: reply, at: new Date().toISOString() });
  session.history = session.history.slice(-MAX_HISTORY);
  session.updatedAt = Date.now();

  return {
    sessionId: session.id,
    intent,
    reply,
    products: recommendedProducts,
    quickReplies,
    metadata: {
      llmUsed: Boolean(llmReply),
      productCount: recommendedProducts.length,
    },
  };
}

module.exports = {
  trackChatbotEvent,
  processChatMessage,
};
