const Product = require("../models/Product");
const Order = require("../models/Order");
const ChatbotEvent = require("./models/ChatbotEvent");
const { refreshKnnCache, computeKnnScores } = require("./sessionState");
const {
  normalizeText,
  tokenize,
  normalizeHintValue,
  includesAny,
  isModelAnchorToken,
} = require("./textUtils");

const ML_SERVICE_URL = String(process.env.ML_SERVICE_URL || "http://localhost:5001").trim();

function getEffectivePrice(product) {
  const originalPrice = Number(product?.price || 0);
  const discountedPrice = Number(product?.finalPrice || 0);

  if (discountedPrice > 0) {
    return discountedPrice;
  }

  return originalPrice > 0 ? originalPrice : 0;
}

function detectIntent(message) {
  const text = normalizeText(message);
  if (!text) {
    return "product_search";
  }

  if (includesAny(text, ["xin chao", "chao ban", "hello", "hi", "hey"])) {
    return "greeting";
  }

  if (includesAny(text, ["chinh sach", "bao hanh", "doi tra", "van chuyen", "giao hang"])) {
    return "policy";
  }

  if (includesAny(text, ["so sanh", "compare", "phan biet", "khac nhau"])) {
    return "compare";
  }

  if (includesAny(text, ["tu van", "goi y", "de xuat", "nen mua gi"])) {
    return "product_consult";
  }

  return "product_search";
}

function buildBehaviorProfile(userBehavior) {
  const viewedProductIds = new Set(
    Array.isArray(userBehavior?.viewedProductIds) ? userBehavior.viewedProductIds.map(String) : []
  );
  const cartProductIds = new Set(
    Array.isArray(userBehavior?.cartProductIds) ? userBehavior.cartProductIds.map(String) : []
  );
  const preferredCategories = Array.isArray(userBehavior?.preferredCategories)
    ? userBehavior.preferredCategories.map((item) => normalizeText(String(item || ""))).filter(Boolean)
    : [];

  return { viewedProductIds, cartProductIds, preferredCategories };
}

function classifyQueryType({ informativeQueryTokens, hasNumericToken, priceConstraint }) {
  if (priceConstraint && informativeQueryTokens.length <= 2) {
    return "budget_search";
  }

  if (hasNumericToken && informativeQueryTokens.length <= 3) {
    return "exact_product_search";
  }

  if (informativeQueryTokens.length >= 4) {
    return "broad_search";
  }

  return "partial_search";
}

function buildConversationFocus({ history = [], message = "", memory = {} }) {
  const normalized = normalizeText(message);
  const recentAssistant = [...history].reverse().find((item) => item.role === "assistant");
  const recentUser = [...history].reverse().find((item) => item.role === "user");

  const focus = {
    isFollowUp: false,
    type: "",
    anchorProductId: String(memory?.selectedProductId || "").trim() || null,
    anchorProductName: String(memory?.selectedProductName || "").trim() || null,
    anchorProductVariant: String(memory?.selectedProductVariant || "").trim() || null,
    storageHint: "",
    colorHint: "",
  };

  if (!normalized) {
    return focus;
  }

  const followUpHints = ["do do", "mau", "bo nho", "phien ban", "con hang", "chi tiet", "cac mau", "ban nao", "may nay"];
  const looksLikeFollowUp = followUpHints.some((token) => normalized.includes(token)) || normalized.length <= 18;
  if (!looksLikeFollowUp && !recentAssistant && !recentUser) {
    return focus;
  }

  focus.isFollowUp = looksLikeFollowUp || Boolean(memory?.selectedProductId);

  if (includesAny(normalized, ["con hang", "co hang", "available", "ton kho"])) {
    focus.type = "availability";
  } else if (includesAny(normalized, ["bo nho", "rom", "storage", "128", "256", "512", "1tb", "2tb"])) {
    focus.type = "storage";
    focus.storageHint = normalized.match(/\b(\d{2,4}|\d+\s*tb)\b/i)?.[1] || "";
  } else if (includesAny(normalized, ["mau", "màu", "den", "trang", "xanh", "do", "tim", "vang", "hong", "bac"])) {
    focus.type = "color";
    focus.colorHint = normalized.match(/\b(den|trang|xanh|do|tim|vang|hong|bac|xam|nau|cam|black|white|blue|green|red|pink|silver|gold)\b/i)?.[1] || "";
  } else {
    focus.type = focus.anchorProductId ? "product" : "generic";
  }

  if (!focus.anchorProductName && recentAssistant?.products?.[0]?.name) {
    focus.anchorProductName = String(recentAssistant.products[0].name || "").trim() || null;
  }

  return focus;
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
      return;
    }

    if (token.length >= 3) {
      const prefixMatchInName = nameTokens.find(
        (nt) =>
          (token.length >= 3 && nt.startsWith(token) && nt.length <= token.length + 4) ||
          (nt.length >= 3 && token.startsWith(nt) && token.length <= nt.length + 4)
      );
      if (prefixMatchInName) {
        semanticRaw += 2.5;
        matched.push(token);
        return;
      }

      const prefixMatchInCategory = categoryTokens.find((ct) => token.length >= 3 && ct.startsWith(token));
      if (prefixMatchInCategory) {
        semanticRaw += 1.8;
        matched.push(token);
      }
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

async function getPurchaseMapByProductIds(productIds = []) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return new Map();
  }

  const stats = await Order.aggregate([
    { $match: { status: { $ne: "cancelled" } } },
    { $unwind: "$orderItems" },
    { $match: { "orderItems.product": { $in: productIds } } },
    { $group: { _id: "$orderItems.product", totalPurchases: { $sum: "$orderItems.quantity" } } },
  ]);

  return new Map(stats.map((item) => [String(item._id), Number(item.totalPurchases || 0)]));
}

function buildRecommendationReason(item) {
  const reasons = [];

  if (item.exactMatch) {
    reasons.push("Đúng chính xác sản phẩm bạn đang tìm");
  } else if (item.fullModelMatch) {
    reasons.push("Khớp đúng mẫu sản phẩm bạn quan tâm");
  }

  if (item.matched.length > 0) {
    reasons.push("Phù hợp với nhu cầu tìm kiếm của bạn");
  }

  if (Number(item.knnScore || 0) > 0.2) {
    reasons.push("Được gợi ý thêm từ các sản phẩm tương tự");
  }

  if (Number(item.totalPurchases || 0) > 0) {
    reasons.push(`${item.totalPurchases} lượt mua`);
  }

  if (Number(item.averageRating || 0) >= 4) {
    reasons.push(`Đánh giá ${Number(item.averageRating).toFixed(1)} sao`);
  }

  if (reasons.length === 0) {
    reasons.push("Phù hợp với nhu cầu cơ bản của bạn");
  }

  return reasons.join(" | ");
}

async function fetchMlCustomerSignal(userId) {
  const id = String(userId || "").trim();
  if (!id || !ML_SERVICE_URL) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const response = await fetch(
      `${ML_SERVICE_URL.replace(/\/$/, "")}/api/intelligence/customer/${encodeURIComponent(id)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data && typeof data === "object" ? data : null;
  } catch (error) {
    return null;
  }
}

async function fetchAutomatedMlOffers(userId, limit = 4) {
  const fallbackFilter = { stock: { $gt: 0 } };
  const projection = "_id name brand price finalPrice discountPercent description category image averageRating totalPurchases totalViews reason";

  const queryProducts = async (filter, sort) =>
    Product.find(filter)
      .select(projection)
      .sort(sort)
      .limit(limit)
      .lean();

  if (!userId) {
    const products = await queryProducts(fallbackFilter, { averageRating: -1, totalViews: -1, totalPurchases: -1 });
    return { products, mlSignal: null, strategy: "anonymous_welcome" };
  }

  const mlSignal = await fetchMlCustomerSignal(userId);
  const churnScore = Number(mlSignal?.churn_score ?? 0);
  const potentialScore = Number(mlSignal?.potential_score ?? 0);

  let filter = { ...fallbackFilter };
  let sort = { totalViews: -1, averageRating: -1, totalPurchases: -1 };
  let strategy = "welcome_default";

  if (churnScore >= 61 || String(mlSignal?.churn_level || "") === "high") {
    filter = { ...fallbackFilter, discountPercent: { $gt: 10 } };
    sort = { discountPercent: -1, averageRating: -1, totalViews: -1 };
    strategy = "churn_recovery";
  } else if (potentialScore > 75 || String(mlSignal?.potential_level || "") === "high") {
    filter = { ...fallbackFilter, finalPrice: { $gte: 15000000 } };
    sort = { averageRating: -1, totalViews: -1, totalPurchases: -1 };
    strategy = "vip_premium";
  }

  let products = await queryProducts(filter, sort);

  if (products.length < limit) {
    const seenIds = new Set(products.map((item) => String(item._id)));
    const paddingFilter = {
      ...fallbackFilter,
      ...(seenIds.size > 0 ? { _id: { $nin: [...seenIds].map((item) => item).filter(Boolean) } } : {}),
    };
    const padding = await queryProducts(paddingFilter, { averageRating: -1, totalViews: -1, totalPurchases: -1 });

    for (const item of padding) {
      if (products.length >= limit) {
        break;
      }

      if (!seenIds.has(String(item._id))) {
        products.push(item);
      }
    }
  }

  return { products: products.slice(0, limit), mlSignal, strategy };
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

  const userObjectId = String(userId || "").trim();
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
      { $sort: { createdAt: -1 } },
      { $limit: 300 },
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
      { $sort: { score: -1 } },
      { $limit: 12 },
    ]);

    recentAgg.forEach((item) => {
      seedSet.add(String(item._id));
    });
  }

  return Array.from(seedSet).slice(0, 20);
}

async function findRecommendedProducts(message, context = {}, options = {}) {
  const queryTokens = tokenize(message);
  const QUERY_STOPWORDS = new Set([
    "co", "khong", "ngan", "sach", "duoi", "tren", "toi", "da", "min", "max",
    "gia", "mua", "san", "pham", "goi", "cho", "voi", "cai", "cac",
    "mot", "hai", "nhung", "nay", "kia", "ban", "minh", "anh", "chi",
    "dang", "duoc", "het", "con", "lam", "xem", "hoi", "biet",
    "muon", "can", "tim", "kiem", "nhat", "tot", "moi", "hang",
    "chinh", "noi", "nhap", "chinh hang",
  ]);
  const informativeQueryTokens = queryTokens.filter(
    (token) => !/^\d+$/.test(token) && token.length >= 3 && !QUERY_STOPWORDS.has(token)
  );
  const hasNumericToken = queryTokens.some((token) => /^\d+$/.test(token));
  const behaviorProfile = buildBehaviorProfile(context.userBehavior);
  const llmQueryHints = options.llmQueryHints && typeof options.llmQueryHints === "object" ? options.llmQueryHints : null;
  const memory = options.memory && typeof options.memory === "object" ? options.memory : null;
  const conversationFocus = options.conversationFocus && typeof options.conversationFocus === "object" ? options.conversationFocus : null;
  const parsedPriceConstraint = options.priceConstraint || null;
  const llmPriceConstraint =
    llmQueryHints?.priceMin != null || llmQueryHints?.priceMax != null
      ? {
          minPrice: llmQueryHints?.priceMin != null ? Number(llmQueryHints.priceMin) : null,
          maxPrice: llmQueryHints?.priceMax != null ? Number(llmQueryHints.priceMax) : null,
          source: "llm",
          strictUpperBound: false,
        }
      : null;
  let priceConstraint = parsedPriceConstraint || llmPriceConstraint;
  const categoryConstraint = normalizeHintValue(llmQueryHints?.category || memory?.category || "");
  const brandConstraint = normalizeHintValue(llmQueryHints?.brand || memory?.brand || "");
  const queryType = classifyQueryType({ informativeQueryTokens, hasNumericToken, priceConstraint });

  if (!priceConstraint && memory?.budget) {
    priceConstraint = {
      minPrice: 0,
      maxPrice: Number(memory.budget),
      source: "memory",
      strictUpperBound: false,
    };
  }

  if (conversationFocus?.isFollowUp && conversationFocus.anchorProductId) {
    const anchorProduct = await Product.findById(conversationFocus.anchorProductId)
      .select("_id name brand series model variant sku slug price finalPrice discountPercent description category image averageRating totalRatings totalViews stock")
      .lean();

    if (anchorProduct) {
      return [anchorProduct];
    }
  }

  const dbFilter = { stock: { $gt: 0 } };
  if (priceConstraint?.minPrice != null || priceConstraint?.maxPrice != null) {
    const minPrice = priceConstraint.minPrice != null ? Number(priceConstraint.minPrice) : null;
    const maxPrice = priceConstraint.maxPrice != null ? Number(priceConstraint.maxPrice) : null;
    const allowSlightOverBudget = priceConstraint.source === "implicit-max" && priceConstraint.strictUpperBound !== true;
    const effectiveMax = maxPrice != null ? (allowSlightOverBudget ? Math.round(maxPrice * 1.05) : maxPrice) : null;
    const effectivePriceExpr = { $cond: [{ $gt: ["$finalPrice", 0] }, "$finalPrice", "$price"] };
    const exprFilters = [];
    if (minPrice != null) exprFilters.push({ $gte: [effectivePriceExpr, minPrice] });
    if (effectiveMax != null) exprFilters.push({ $lte: [effectivePriceExpr, effectiveMax] });
    if (exprFilters.length === 1) dbFilter.$expr = exprFilters[0];
    if (exprFilters.length > 1) dbFilter.$expr = { $and: exprFilters };
  }

  const rawProducts = await Product.find(dbFilter)
    .select("_id name brand series model variant sku slug price finalPrice discountPercent description category image averageRating totalRatings totalViews stock")
    .sort({ averageRating: -1, stock: -1 })
    .limit(400)
    .lean();

  let products = rawProducts;
  if (categoryConstraint) {
    products = products.filter((item) => {
      const normalizedCategory = normalizeText(item.category);
      return normalizedCategory === categoryConstraint || normalizedCategory.startsWith(`${categoryConstraint} `);
    });
  }

  if (brandConstraint) {
    const brandFiltered = products.filter((item) => {
      const normalizedName = normalizeText(item.name);
      const normalizedBrand = normalizeText(item.brand);
      return normalizedName.includes(brandConstraint) || normalizedBrand.includes(brandConstraint);
    });

    if (brandFiltered.length > 0) {
      products = brandFiltered;
    }
  }

  if (products.length === 0) {
    return [];
  }

  const purchaseMap = await getPurchaseMapByProductIds(products.map((item) => item._id));
  await refreshKnnCache();
  const seedProductIds = await getSessionSeedProducts({ sessionId: options.sessionId, userId: options.userId, behaviorProfile });
  const knnScores = computeKnnScores(seedProductIds);
  const mlSignal = options.mlSignal && typeof options.mlSignal === "object" ? options.mlSignal : null;
  const churnScore = Number(mlSignal?.churn_score ?? mlSignal?.churnScore ?? 0);
  const potentialScore = Number(mlSignal?.potential_score ?? mlSignal?.potentialScore ?? 0);
  const isChurnRisk = churnScore >= 60;
  const isPotentialHigh = potentialScore >= 60;
  const normalizedMessage = normalizeText(message);
  const numericTokens = queryTokens.filter((token) => /^\d+$/.test(token));
  const rankedCandidates = products
    .map((product) => {
      const normalizedName = normalizeText(product.name);
      const nameTokens = new Set(tokenize(product.name));
      const nameOverlap = informativeQueryTokens.reduce((count, token) => count + (nameTokens.has(token) ? 1 : 0), 0);
      const exactMatch = normalizedName === normalizedMessage;
      const fullModelMatch = normalizedMessage.length >= 8 && (normalizedName.includes(normalizedMessage) || normalizedMessage.includes(normalizedName));
      const allNumericMatched = numericTokens.length === 0 || numericTokens.every((token) => normalizedName.includes(token));
      const queryCoverage = informativeQueryTokens.length > 0 ? nameOverlap / informativeQueryTokens.length : 0;
      const totalPurchases = purchaseMap.get(String(product._id)) || 0;
      const knnScore = Number(knnScores.get(String(product._id)) || 0);
      const ltr = rankWithLtr({ product, queryTokens, behaviorProfile, knnScore, budget: priceConstraint?.maxPrice ?? null, totalPurchases });

      const sellingPrice = getEffectivePrice(product);
      const discountFeature = Math.min(1, Number(product.discountPercent || 0) / 30);
      const ratingFeature = Math.min(1, Number(product.averageRating || 0) / 5);
      const budget = priceConstraint?.maxPrice ?? null;
      const priceFitMl = budget ? Math.max(0, 1 - Math.abs(sellingPrice - budget) / budget) : Math.max(0, 1 - sellingPrice / 20000000);
      const premiumFeature = Math.min(1, sellingPrice / 25000000);

      let mlBoost = 0;
      if (isChurnRisk) {
        mlBoost += discountFeature * 0.08 + priceFitMl * 0.06;
      }
      if (isPotentialHigh) {
        mlBoost += ratingFeature * 0.06 + premiumFeature * 0.04;
      }

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
        ltrScore: ltr.ltrScore + hardMatchOverride + mlBoost,
        nameOverlap,
        queryCoverage,
        exactMatch,
        fullModelMatch,
        priceDelta: Math.abs(getEffectivePrice(product) - Number(priceConstraint?.maxPrice || 0)),
        matched: ltr.matched,
      };
    })
    .sort((a, b) => {
      if (b.ltrScore !== a.ltrScore) return b.ltrScore - a.ltrScore;
      if (Number(a.nameOverlap || 0) !== Number(b.nameOverlap || 0)) return Number(b.nameOverlap || 0) - Number(a.nameOverlap || 0);
      return Number(a.priceDelta || 0) - Number(b.priceDelta || 0);
    });

  const dedupedCandidates = [];
  const seenCandidateKeys = new Set();
  rankedCandidates.forEach((item) => {
    const candidateKey = `${normalizeText(item.name)}|${getEffectivePrice(item)}`;
    if (seenCandidateKeys.has(candidateKey)) {
      return;
    }
    seenCandidateKeys.add(candidateKey);
    dedupedCandidates.push(item);
  });

  const pickedCandidates = dedupedCandidates.filter((item) => item.ltrScore > 0.06);
  const finalCandidates = (pickedCandidates.length > 0 ? pickedCandidates : dedupedCandidates).slice(0, 5).map((item) => {
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
      brand: item.brand,
      series: item.series,
      model: item.model,
      variant: item.variant,
      description: item.description,
      stock: Number(item.stock || 0),
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

module.exports = {
  detectIntent,
  buildBehaviorProfile,
  classifyQueryType,
  buildConversationFocus,
  buildSemanticSignal,
  rankWithLtr,
  getPurchaseMapByProductIds,
  buildRecommendationReason,
  fetchMlCustomerSignal,
  fetchAutomatedMlOffers,
  getSessionSeedProducts,
  findRecommendedProducts,
};
