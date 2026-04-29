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

const DEFAULT_EXPLICIT_PRICE_TERMS = [
  "gia",
  "duoi",
  "toi da",
  "khong qua",
  "tren",
  "toi thieu",
  "ngan sach",
  "budget",
  "price",
  "cost",
  "vnd",
  "dong",
];

const DEFAULT_PRICE_TERMS = [
  ...DEFAULT_EXPLICIT_PRICE_TERMS,
  "tu ",
  "k",
  "nghin",
  "tr",
  "trieu",
];

const KNOWN_BRAND_HINTS = ["iphone", "samsung", "xiaomi", "oppo", "vivo", "realme", "macbook", "ipad"];
const MODEL_HINT_TERMS = [
  "ultra",
  "pro",
  "max",
  "plus",
  "mini",
  "gb",
  "tb",
  "seri",
  "series",
  "fold",
  "flip",
  "note",
];
const GENERIC_QUERY_TOKENS = new Set([
  ...KNOWN_BRAND_HINTS,
  "galaxy",
  "phone",
  "smartphone",
  "dien",
  "thoai",
  "series",
  "seri",
]);

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
    .replace(/đ/g, "d")
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

function getConfiguredTerms(envKey, defaultTerms) {
  const raw = String(process.env[envKey] || "").trim();
  if (!raw) {
    return defaultTerms;
  }

  const customTerms = raw
    .split(",")
    .map((item) => normalizeText(item))
    .filter(Boolean);

  if (customTerms.length === 0) {
    return defaultTerms;
  }

  return Array.from(new Set([...defaultTerms, ...customTerms]));
}

function getEffectivePrice(product) {
  const originalPrice = Number(product?.price || 0);
  const discountedPrice = Number(product?.finalPrice || 0);

  if (discountedPrice > 0) {
    return discountedPrice;
  }

  return originalPrice > 0 ? originalPrice : 0;
}

function toNumberOrNull(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function normalizeHintValue(value) {
  const normalized = normalizeText(value);
  return normalized || "";
}

function extractJsonObjectFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch (nestedError) {
      return null;
    }
  }
}

async function maybeParseQueryWithLlm(message) {
  const llmEnabled = String(process.env.CHATBOT_LLM_ENABLED || "").toLowerCase() === "true";
  const parserEnabled =
    String(process.env.CHATBOT_LLM_QUERY_PARSER_ENABLED || "true").toLowerCase() === "true";
  const apiUrl = String(process.env.CHATBOT_LLM_API_URL || "").trim();
  const apiKey = String(process.env.CHATBOT_LLM_API_KEY || "").trim();
  const model = String(process.env.CHATBOT_LLM_MODEL || "gpt-4.1-mini").trim();

  if (!llmEnabled || !parserEnabled || !apiUrl || !apiKey) {
    return null;
  }

  const isGemini = apiUrl.includes("generativelanguage.googleapis.com");
  const prompt = [
    "Extract shopping intent as strict JSON only.",
    "Return one JSON object with keys:",
    "intent, brand, series, model, product_line, storage, ram, price_min, price_max, confidence.",
    "Use null for unknown values.",
    "Do not include markdown or explanation.",
    `User message: ${String(message || "")}`,
  ].join("\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await (async () => {
      if (isGemini) {
        const endpoint = apiUrl.includes(":generateContent")
          ? apiUrl
          : `${apiUrl.replace(/\/$/, "")}/v1beta/models/${model}:generateContent`;
        const delimiter = endpoint.includes("?") ? "&" : "?";
        const requestUrl = `${endpoint}${delimiter}key=${encodeURIComponent(apiKey)}`;

        return fetch(requestUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0,
            },
          }),
        });
      }

      return fetch(`${apiUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [{ role: "user", content: prompt }],
        }),
      });
    })();

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const content = isGemini
      ? (data?.candidates || [])
          .flatMap((candidate) => candidate?.content?.parts || [])
          .map((part) => String(part?.text || "").trim())
          .filter(Boolean)
          .join("\n")
      : data?.choices?.[0]?.message?.content;

    const parsed = extractJsonObjectFromText(content);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      intent: String(parsed.intent || "").trim() || null,
      brand: normalizeHintValue(parsed.brand),
      series: normalizeHintValue(parsed.series),
      model: normalizeHintValue(parsed.model),
      productLine: normalizeHintValue(parsed.product_line),
      storage: normalizeHintValue(parsed.storage),
      ram: normalizeHintValue(parsed.ram),
      priceMin: toNumberOrNull(parsed.price_min),
      priceMax: toNumberOrNull(parsed.price_max),
      confidence: toNumberOrNull(parsed.confidence),
    };
  } catch (error) {
    return null;
  }
}

function parseBudgetFromText(message) {
  const rawText = String(message || "");
  const text = normalizeText(message);
  // If the user is asking for the price (e.g., "gia bao nhieu"), treat as a price question, not a budget
  if (isAskingForPrice(text)) {
    return null;
  }
  if (!text) {
    return null;
  }

  const normalizedRaw = rawText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ");

  const groupedMatch = normalizedRaw.match(/(\d{1,3}(?:[\.,\s]\d{3})+)\s*(trieu|tr|k|nghin)?/);
  const hasGroupedAmount = Boolean(groupedMatch);
  const hasCurrencySymbol = /đ|₫|vnđ|vnd|dong/.test(normalizedRaw);

  const explicitPriceTerms = getConfiguredTerms(
    "CHATBOT_PRICE_EXPLICIT_TERMS",
    DEFAULT_EXPLICIT_PRICE_TERMS
  );
  const priceTerms = getConfiguredTerms("CHATBOT_PRICE_TERMS", DEFAULT_PRICE_TERMS);

  const hasExplicitPriceSignal = includesAny(text, explicitPriceTerms);
  const hasPriceSignal = includesAny(text, priceTerms);

  if (!hasPriceSignal && !hasExplicitPriceSignal && !hasGroupedAmount && !hasCurrencySymbol) {
    return null;
  }

  // Hỗ trợ định dạng tiền kiểu 32.000.000 hoặc 20 370 000.
  if (groupedMatch) {
    const groupedNumeric = Number(String(groupedMatch[1]).replace(/[\.,\s]/g, ""));
    if (groupedNumeric && !Number.isNaN(groupedNumeric)) {
      const groupedUnit = String(groupedMatch[2] || "").trim();
      if (groupedUnit === "trieu" || groupedUnit === "tr") {
        return groupedNumeric * 1000000;
      }

      if (groupedUnit === "k" || groupedUnit === "nghin") {
        return groupedNumeric * 1000;
      }

      return groupedNumeric;
    }
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
  if (!unit && !hasExplicitPriceSignal && !hasCurrencySymbol) {
    return null;
  }

  // Tránh hiểu nhầm "co iphone 15 k" (k = không) thành ngân sách 15k.
  if (!hasExplicitPriceSignal && unit === "k" && numeric < 100) {
    return null;
  }

  // Nếu không có ngữ cảnh giá rõ ràng và số quá nhỏ (mã model), bỏ qua.
  if (!hasExplicitPriceSignal && !unit && numeric < 1000) {
    return null;
  }

  if (unit === "trieu" || unit === "tr") {
    return numeric * 1000000;
  }

  if (unit === "k" || unit === "nghin") {
    return numeric * 1000;
  }

  if (numeric < 1000 && hasExplicitPriceSignal) {
    return numeric * 1000000;
  }

  return numeric;
}

function isAskingForPrice(text) {
  if (!text) return false;
  const t = String(text || "").toLowerCase();
  return includesAny(t, [
    "gia bao nhieu",
    "gia la bao",
    "bao nhieu tien",
    "how much",
    "how much is",
    "cost bao nhieu",
    "price",
    "gia the nao",
    "bao nhieu",
  ]);
}

function parsePriceConstraint(message) {
  const text = normalizeText(message);
  if (!text) {
    return null;
  }

  const budget = parseBudgetFromText(message);
  if (!budget || budget <= 0) {
    return null;
  }

  if (includesAny(text, ["duoi", "toi da", "max", "khong qua", "under", "nho hon", "<"])) {
    return { minPrice: 0, maxPrice: budget, source: "max", strictUpperBound: true };
  }

  if (includesAny(text, ["tren", "toi thieu", "min", "hon", "greater", ">", "tu"])) {
    return { minPrice: budget, maxPrice: null, source: "min" };
  }

  return { minPrice: 0, maxPrice: budget, source: "implicit-max", strictUpperBound: false };
}

function buildCategoryConstraint(message) {
  const text = normalizeText(message);
  const tokenSet = new Set(tokenize(message));
  const aliases = {
    "dien thoai": ["dien thoai", "smartphone", "phone"],
    laptop: ["laptop", "notebook", "ultrabook"],
    "phu kien": ["phu kien", "accessory", "tai nghe", "chuot", "ban phim", "webcam", "man hinh", "dong ho"],
  };

  for (const [category, keywords] of Object.entries(aliases)) {
    const matched = keywords.some((keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      if (!normalizedKeyword) {
        return false;
      }

      if (normalizedKeyword.includes(" ")) {
        return text.includes(normalizedKeyword);
      }

      return tokenSet.has(normalizedKeyword);
    });

    if (matched) {
      return category;
    }
  }

  return "";
}

function classifyQueryType({ normalizedMessage, informativeQueryTokens, hasNumericToken, priceConstraint }) {
  const hasBrandHint = includesAny(normalizedMessage, KNOWN_BRAND_HINTS);
  const hasModelHint = includesAny(normalizedMessage, MODEL_HINT_TERMS);
  const hasAlphaNumericModelToken = informativeQueryTokens.some(
    (token) => /[a-z]+\d+|\d+[a-z]+/.test(token)
  );

  if (priceConstraint && informativeQueryTokens.length <= 1) {
    return "budget_search";
  }

  if (
    informativeQueryTokens.length >= 2 &&
    (hasNumericToken || hasAlphaNumericModelToken || (hasBrandHint && hasModelHint))
  ) {
    return "exact_product_search";
  }

  return "broad_search";
}

function isStorageToken(token) {
  return /^\d+(gb|tb)$/.test(String(token || ""));
}

function isModelAnchorToken(token) {
  const value = String(token || "").toLowerCase();
  if (!value || isStorageToken(value)) {
    return false;
  }

  if (includesAny(value, ["flip", "fold", "ultra", "plus", "pro", "mini", "note"])) {
    return true;
  }

  if (/^(s|a|m|x)\d+/.test(value)) {
    return true;
  }

  return /[a-z]+\d+/.test(value);
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function detectIntent(message) {
  const plain = normalizeText(message);

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
    const delta = Math.abs(getEffectivePrice(product) - budget);
    priceFitFeature = Math.max(0, 1 - delta / budget);
  }

  const isBudgetDriven = Boolean(budget && budget > 0 && semanticFeature < 0.15);

  const ltrScore = isBudgetDriven
    ? semanticFeature * 0.2 +
      Math.min(1, Number(knnScore || 0)) * 0.1 +
      Math.min(1, behaviorFeature) * 0.1 +
      popularityFeature * 0.1 +
      ratingFeature * 0.05 +
      priceFitFeature * 0.45
    : semanticFeature * 0.38 +
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

  if (item.exactMatch) {
    reasons.push("khop chinh xac ten san pham");
  } else if (item.fullModelMatch) {
    reasons.push("khop model gan dung");
  }

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
  const informativeQueryTokens = queryTokens.filter(
    (token) =>
      !/^\d+$/.test(token) &&
      token.length >= 3 &&
      ![
        "co",
        "khong",
        "ngan",
        "sach",
        "duoi",
        "tren",
        "toi",
        "da",
        "min",
        "max",
        "gia",
        "mua",
        "san",
        "pham",
        "goi",
        "y",
      ].includes(token)
  );
  const hasNumericToken = queryTokens.some((token) => /^\d+$/.test(token));
  const behaviorProfile = buildBehaviorProfile(context.userBehavior);
  const llmQueryHints = options.llmQueryHints && typeof options.llmQueryHints === "object" ? options.llmQueryHints : null;
  const parsedPriceConstraint = parsePriceConstraint(message);
  const llmPriceConstraint =
    llmQueryHints?.priceMin != null || llmQueryHints?.priceMax != null
      ? {
          minPrice: llmQueryHints?.priceMin != null ? Number(llmQueryHints.priceMin) : null,
          maxPrice: llmQueryHints?.priceMax != null ? Number(llmQueryHints.priceMax) : null,
          source: "llm",
          strictUpperBound: false,
        }
      : null;
  const priceConstraint = parsedPriceConstraint || llmPriceConstraint;
  const budget = priceConstraint?.maxPrice || parseBudgetFromText(message);
  const categoryConstraint = buildCategoryConstraint(message);

  const dbFilter = {
    stock: { $gt: 0 },
  };

  const rawProducts = await Product.find(dbFilter)
    .select(
      "_id name brand series model variant sku slug price finalPrice discountPercent description category image averageRating totalRatings totalViews stock"
    )
    .sort({ averageRating: -1, stock: -1 })
    .limit(400)
    .lean();

  let products = categoryConstraint
    ? rawProducts.filter((item) => {
        const normalizedCategory = normalizeText(item.category);
        return (
          normalizedCategory === categoryConstraint ||
          normalizedCategory.startsWith(`${categoryConstraint} `)
        );
      })
    : rawProducts;

  const normalizedMessage = normalizeText(message);
  const numericTokens = queryTokens.filter((token) => /^\d+$/.test(token));
  const hasKnownBrandHint = includesAny(normalizedMessage, KNOWN_BRAND_HINTS);

  const queryType = classifyQueryType({
    normalizedMessage,
    informativeQueryTokens,
    hasNumericToken,
    priceConstraint,
  });

  const shouldUseStrictNameFilter =
    queryType === "exact_product_search" && informativeQueryTokens.length > 0 && (hasNumericToken || hasKnownBrandHint);

  const modelSpecificTokens = informativeQueryTokens.filter((token) => !GENERIC_QUERY_TOKENS.has(token));
  const anchorModelTokens = modelSpecificTokens.filter((token) => isModelAnchorToken(token));

  if (shouldUseStrictNameFilter) {
    const hardNameMatches = products.filter((item) => {
      const normalizedName = normalizeText(item.name);
      const tokenOverlap = informativeQueryTokens.reduce(
        (count, token) => count + (normalizedName.includes(token) ? 1 : 0),
        0
      );
      const modelTokenHits = modelSpecificTokens.reduce(
        (count, token) => count + (normalizedName.includes(token) ? 1 : 0),
        0
      );
      const anchorTokenHits = anchorModelTokens.reduce(
        (count, token) => count + (normalizedName.includes(token) ? 1 : 0),
        0
      );
      const numericMatched =
        numericTokens.length === 0 || numericTokens.some((token) => normalizedName.includes(token));

      if (modelSpecificTokens.length > 0 && modelTokenHits === 0) {
        return false;
      }

      if (anchorModelTokens.length > 0 && anchorTokenHits === 0) {
        return false;
      }

      return tokenOverlap >= 1 && numericMatched;
    });

    if (hardNameMatches.length > 0) {
      products = hardNameMatches;
    }
  }

  if (llmQueryHints) {
    const brandHint = normalizeHintValue(llmQueryHints.brand);
    const seriesHint = normalizeHintValue(llmQueryHints.series || llmQueryHints.productLine);
    const modelHint = normalizeHintValue(llmQueryHints.model);

    const constrainedByHints = products.filter((item) => {
      const normalizedName = normalizeText(item.name);
      const normalizedBrand = normalizeText(item.brand);
      const normalizedSeries = normalizeText(item.series);
      const normalizedModel = normalizeText(item.model);
      const normalizedVariant = normalizeText(item.variant);

      if (brandHint && !(normalizedBrand.includes(brandHint) || normalizedName.includes(brandHint))) {
        return false;
      }

      if (seriesHint && !(normalizedSeries.includes(seriesHint) || normalizedName.includes(seriesHint))) {
        return false;
      }

      if (
        modelHint &&
        !(normalizedModel.includes(modelHint) || normalizedVariant.includes(modelHint) || normalizedName.includes(modelHint))
      ) {
        return false;
      }

      return true;
    });

    const llmConfidence = Number(llmQueryHints?.confidence) || 0;

    if (constrainedByHints.length > 0 && llmConfidence >= 0.75) {
      // High-confidence LLM hints: apply full constraint (brand/series/model)
      products = constrainedByHints;
    } else if (constrainedByHints.length > 0 && llmConfidence >= 0.5) {
      // Medium confidence: only apply brand constraint (safer fallback)
      const brandOnlyFiltered = products.filter((item) => {
        if (!brandHint) return true;
        const nb = normalizeText(item.brand || "");
        return nb.includes(brandHint) || normalizeText(item.name || "").includes(brandHint);
      });
      if (brandOnlyFiltered.length > 0) products = brandOnlyFiltered;
    }
  }

  if (priceConstraint?.minPrice != null || priceConstraint?.maxPrice != null) {
    const minPrice =
      priceConstraint.minPrice != null ? Number(priceConstraint.minPrice) : null;
    const maxPrice =
      priceConstraint.maxPrice != null
        ? Number(priceConstraint.maxPrice)
        : null;
    const allowSlightOverBudget =
      priceConstraint.source === "implicit-max" && priceConstraint.strictUpperBound !== true;
    const effectiveMax =
      maxPrice != null
        ? allowSlightOverBudget
          ? Math.round(maxPrice * 1.05)
          : maxPrice
        : null;

    products = products.filter((item) => {
      const sellingPrice = getEffectivePrice(item);
      if (minPrice != null && sellingPrice < minPrice) {
        return false;
      }

      if (effectiveMax != null && sellingPrice > effectiveMax) {
        return false;
      }

      return true;
    });
  }

  if (products.length === 0) {
    return [];
  }

  const purchaseMap = await getPurchaseMapByProductIds(products.map((item) => item._id));
  await refreshKnnCache();

  const seedProductIds = await getSessionSeedProducts({
    sessionId: options.sessionId,
    userId: options.userId,
    behaviorProfile,
  });
  const knnScores = computeKnnScores(seedProductIds);

  const rankedCandidates = products
    .map((product) => {
      const normalizedName = normalizeText(product.name);
      const nameTokens = new Set(tokenize(product.name));
      const nameOverlap = informativeQueryTokens.reduce(
        (count, token) => count + (nameTokens.has(token) ? 1 : 0),
        0
      );
      const exactMatch = normalizedName === normalizedMessage;
      const fullModelMatch =
        normalizedMessage.length >= 8 &&
        (normalizedName.includes(normalizedMessage) || normalizedMessage.includes(normalizedName));
      const allNumericMatched =
        numericTokens.length === 0 || numericTokens.every((token) => normalizedName.includes(token));
      const queryCoverage =
        informativeQueryTokens.length > 0 ? nameOverlap / informativeQueryTokens.length : 0;
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

      let hardMatchOverride = 0;
      if (queryType === "exact_product_search") {
        if (exactMatch) {
          hardMatchOverride = 1000;
        } else if (fullModelMatch && allNumericMatched) {
          hardMatchOverride = 800;
        } else if (queryCoverage >= 0.7 && allNumericMatched) {
          hardMatchOverride = 500;
        } else if (queryCoverage >= 0.45 && allNumericMatched) {
          hardMatchOverride = 200;
        }
      }

      return {
        ...product,
        totalPurchases,
        knnScore,
        ltrScore:
          ltr.ltrScore +
          (shouldUseStrictNameFilter ? queryCoverage * 0.35 + Math.min(0.12, nameOverlap * 0.02) : 0) +
          hardMatchOverride,
        nameOverlap,
        queryCoverage,
        exactMatch,
        fullModelMatch,
        priceDelta: Math.abs(getEffectivePrice(product) - Number(budget || 0)),
        matched: ltr.matched,
      };
    })

    .sort((a, b) => {
      if (b.ltrScore !== a.ltrScore) {
        return b.ltrScore - a.ltrScore;
      }

      if (Number(a.nameOverlap || 0) !== Number(b.nameOverlap || 0)) {
        return Number(b.nameOverlap || 0) - Number(a.nameOverlap || 0);
      }

      return Number(a.priceDelta || 0) - Number(b.priceDelta || 0);
    });

  const maxNameOverlap = rankedCandidates.reduce(
    (maxValue, item) => Math.max(maxValue, Number(item.nameOverlap || 0)),
    0
  );

  const shouldPrioritizeNameMatch =
    informativeQueryTokens.length > 0 && (maxNameOverlap >= 2 || (hasNumericToken && maxNameOverlap >= 1));

  const overlapThreshold =
    informativeQueryTokens.length >= 4
      ? Math.max(2, maxNameOverlap - 1)
      : Math.min(2, maxNameOverlap);

  const nameFilteredCandidates = shouldPrioritizeNameMatch
    ? rankedCandidates.filter((item) => Number(item.nameOverlap || 0) >= overlapThreshold)
    : rankedCandidates;

  const dedupedCandidates = [];
  const seenCandidateKeys = new Set();

  nameFilteredCandidates.forEach((item) => {
    const candidateKey = `${normalizeText(item.name)}|${getEffectivePrice(item)}`;
    if (seenCandidateKeys.has(candidateKey)) {
      return;
    }

    seenCandidateKeys.add(candidateKey);
    dedupedCandidates.push(item);
  });

  // Nếu truy vấn thiên về ngân sách/ngữ cảnh chung khiến semantic thấp,
  // vẫn trả về top candidate hợp lệ từ DB thay vì báo không tìm thấy.
  const pickedCandidates = dedupedCandidates.filter((item) => item.ltrScore > 0.06);
  const finalCandidates = (pickedCandidates.length > 0 ? pickedCandidates : dedupedCandidates)
    .slice(0, 5)
    .map((item) => {
      const sellingPrice = getEffectivePrice(item);
      const originalPrice = Number(item.price || 0);
      const hasDiscount = originalPrice > 0 && sellingPrice > 0 && sellingPrice < originalPrice;

      return {
        _id: item._id,
        name: item.name,
        category: item.category,
        price: sellingPrice,
        originalPrice: hasDiscount ? originalPrice : sellingPrice,
        finalPrice: Number(item.finalPrice || 0),
        discountPercent: Number(item.discountPercent || 0),
        image: item.image,
        averageRating: item.averageRating,
        totalRatings: item.totalRatings,
        totalViews: item.totalViews,
        totalPurchases: item.totalPurchases,
        knnScore: item.knnScore,
        reason: buildRecommendationReason(item),
      };
    });

  return finalCandidates;
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

  const isGemini = apiUrl.includes("generativelanguage.googleapis.com");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await (async () => {
      if (isGemini) {
        const endpoint = apiUrl.includes(":generateContent")
          ? apiUrl
          : `${apiUrl.replace(/\/$/, "")}/v1beta/models/${model}:generateContent`;
        const delimiter = endpoint.includes("?") ? "&" : "?";
        const requestUrl = `${endpoint}${delimiter}key=${encodeURIComponent(apiKey)}`;

        return fetch(requestUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: {
              role: "system",
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: userPrompt }],
              },
            ],
            generationConfig: {
              temperature: 0.4,
            },
          }),
        });
      }

      return fetch(`${apiUrl.replace(/\/$/, "")}/chat/completions`, {
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
    })();

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    const content = isGemini
      ? (data?.candidates || [])
          .flatMap((candidate) => candidate?.content?.parts || [])
          .map((part) => String(part?.text || "").trim())
          .filter(Boolean)
          .join("\n")
      : data?.choices?.[0]?.message?.content;

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
          llmQueryHints: await maybeParseQueryWithLlm(plainMessage),
        });

  const shouldUseLlm = recommendedProducts.length > 0;

  const llmReply = shouldUseLlm
    ? await maybeGenerateLlmReply({
        message: plainMessage,
        intent,
        recommendedProducts,
        history: session.history,
      })
    : null;

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
