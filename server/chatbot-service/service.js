const mongoose = require("mongoose");
const Product = require("../models/Product");
const ChatbotEvent = require("./models/ChatbotEvent");
const compareService = require("./compare");
const recommenderService = require("./recommender");
const llmHelper = require("./llmHelper");
const {
  getOrCreateSession,
  updateSessionMemory,
  invalidateKnnCache,
} = require("./sessionState");
const {
  normalizeText,
  tokenize,
  normalizeHintValue,
  normalizeConversationHistory,
  includesAny,
  isModelAnchorToken,
} = require("./textUtils");

// Chatbot service implementation with structured replies and recommendation logic.

const MAX_HISTORY = 10;
const KNOWN_BRAND_HINTS = ["iphone", "samsung", "xiaomi", "oppo", "vivo", "realme", "macbook", "ipad"];
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

const PHONE_BRAND_HINTS = new Set(["iphone", "samsung", "xiaomi", "oppo", "vivo", "realme"]);

function safeObjectId(id) {
  const value = String(id || "").trim();
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }

  return new mongoose.Types.ObjectId(value);
}

function formatVnd(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "-";
  }

  return `${numeric.toLocaleString("vi-VN")} VND`;
}

function formatBudgetVn(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  if (numeric % 1000000 === 0) {
    return `${numeric / 1000000} triệu`;
  }

  return `${numeric.toLocaleString("vi-VN")} VND`;
}

function formatStructuredReply(structured) {
  if (!structured || typeof structured !== "object") {
    return "";
  }

  const lines = [];
  if (structured.title) {
    lines.push(String(structured.title).trim());
  }

  if (Array.isArray(structured.items) && structured.items.length > 0) {
    structured.items.forEach((item) => {
      const name = String(item?.name || "").trim();
      const price = String(item?.price || "").trim();
      if (name) {
        lines.push(`${name}${price ? ` với giá ${price}` : ""}`);
      }
    });
  }

  if (structured.followUp) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(String(structured.followUp).trim());
  }

  return lines.filter((line) => line !== null && line !== undefined).join("\n");
}

function buildHistoryEnrichedMessage(plainMessage, history) {
  const normalizedMessage = normalizeText(plainMessage);
  const tokenCount = tokenize(plainMessage).length;
  const shortContext = tokenCount <= 5 || normalizedMessage.length < 18;

  if (!shortContext) {
    return plainMessage;
  }

  const normalizedHistory = normalizeConversationHistory(history, 6);
  const recentAssistant = [...normalizedHistory].reverse().find((item) => item.role === "assistant");
  const recentUser = [...normalizedHistory].reverse().find((item) => item.role === "user");

  const productNames = Array.isArray(recentAssistant?.products)
    ? recentAssistant.products
        .map((product) => String(product?.name || product?.title || "").trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const contextParts = [];
  if (productNames.length > 0) {
    contextParts.push(`san pham gan day: ${productNames.join(", ")}`);
  }

  if (recentUser?.content) {
    contextParts.push(`cau truoc: ${recentUser.content.slice(0, 120)}`);
  }

  if (contextParts.length === 0) {
    return plainMessage;
  }

  return `${plainMessage} [context: ${contextParts.join(" | ")}]`;
}

async function maybeParseQueryWithLlm(message, history = []) {
  return llmHelper.maybeParseQueryWithLlm(message, history);
}

function parsePriceConstraint(message) {
  const text = normalizeText(message);
  if (!text) {
    return null;
  }

  const moneyMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|million|vnd|dong|k)\b/i);
  const bareNumberMatch = moneyMatch ? null : text.match(/\b(\d{2,4})\b/);

  let budget = null;
  if (moneyMatch) {
    const numeric = Number(String(moneyMatch[1]).replace(",", "."));
    if (Number.isFinite(numeric) && numeric > 0) {
      const unit = String(moneyMatch[2] || "").toLowerCase();
      budget = unit === "k" ? Math.round(numeric * 1000) : numeric < 1000 ? Math.round(numeric * 1000000) : Math.round(numeric);
    }
  } else if (bareNumberMatch) {
    budget = Number(bareNumberMatch[1]) * 1000000;
  }

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
    "dien thoai": ["dien thoai", "smartphone", "phone", "iphone", "android", "galaxy"],
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

function inferBrandHint(message, llmQueryHints = null) {
  const normalized = normalizeText(message);
  for (const brand of KNOWN_BRAND_HINTS) {
    if (normalized.includes(brand)) {
      return brand;
    }
  }

  const llmBrand = normalizeHintValue(llmQueryHints?.brand);
  return llmBrand || "";
}

function inferCategoryFromBrandHint(brandHint) {
  const normalizedBrand = normalizeHintValue(brandHint);
  if (!normalizedBrand) {
    return "";
  }

  if (PHONE_BRAND_HINTS.has(normalizedBrand) || normalizedBrand === "iphone") {
    return "dien thoai";
  }

  if (normalizedBrand === "macbook" || normalizedBrand === "ipad") {
    return normalizedBrand === "ipad" ? "tablet" : "laptop";
  }

  return "";
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
  invalidateKnnCache();
  return created;
}

function buildRuleReply(intent, recommendedProducts, options = {}) {
  const categoryLabels = {
    "dien thoai": "điện thoại",
    laptop: "laptop",
    "phu kien": "phụ kiện",
  };
  const conversationFocus = options?.conversationFocus || null;
  const anchorName = String(conversationFocus?.anchorProductName || recommendedProducts?.[0]?.name || "").trim();
  const storageHint = String(conversationFocus?.storageHint || "").trim();
  const colorHint = String(conversationFocus?.colorHint || "").trim();

  if (intent === "greeting") {
    const churn = options?.mlSignal?.churn === true || Number(options?.mlSignal?.churn_score || 0) >= 61 || String(options?.mlSignal?.churn_level || "").toLowerCase() === "high";
    const vip = Number(options?.mlSignal?.potential_score || 0) > 75 || String(options?.mlSignal?.potential_level || "").toLowerCase() === "high";

    if (recommendedProducts.length > 0) {
      if (churn) {
        return {
          title: "Chào bạn, mình là AI Shopping Assistant",
          followUp:
            "Chào mừng quay trở lại! Hệ thống vừa mở các deal giảm giá cực sâu chỉ dành riêng cho bạn trong hôm nay — mình đã chuẩn bị sẵn các ưu đãi ở bên dưới, bạn xem nhanh nhé.",
          items: [],
        };
      }

      if (vip) {
        return {
          title: "Chào bạn, mình là AI Shopping Assistant",
          followUp:
            "Dựa trên sở thích của bạn, mình đã chuẩn bị sẵn các sản phẩm Flagship phù hợp với phong cách của bạn — xem ngay bên dưới nhé",
          items: [],
        };
      }

      return {
        title: "Chào bạn, mình là AI Shopping Assistant",
        followUp: "Mình đã chuẩn bị sẵn các deal hời cá nhân hóa ngay bên dưới, bạn xem nhanh nhé.",
        items: [],
      };
    }

    return {
      title: "Chào bạn, mình là AI Shopping Assistant",
      followUp: "Bạn đang quan tâm nhóm sản phẩm nào?",
      items: [],
    };
  }

  if (intent === "policy") {
    return {
      title: "Hỗ trợ Chính sách",
      followUp: "Bạn có thể cho biết cần hỏi về chính sách nào?",
      items: [],
    };
  }

  if (recommendedProducts.length === 0) {
    return {
      title: "Chưa tìm được sản phẩm phù hợp",
      followUp: "Bạn thử mô tả rõ hơn về nhu cầu sử dụng, ngân sách, hoặc thương hiệu mong muốn nhé.",
      items: [],
    };
  }

  if (conversationFocus?.isFollowUp && conversationFocus?.type === "availability") {
    return {
      title: anchorName ? `${anchorName} hiện còn hàng:` : "Sản phẩm này hiện còn hàng:",
      followUp: "Bạn muốn xem chi tiết hoặc thêm vào giỏ không?",
      items: recommendedProducts.slice(0, 3).map((item) => ({
        name: item.name,
        price: formatVnd(item.price),
      })),
    };
  }

  if (conversationFocus?.isFollowUp && conversationFocus?.type === "storage") {
    const hintLabel = storageHint || "phiên bản";
    return {
      title: anchorName
        ? `Mình tìm thấy ${hintLabel} phù hợp cho ${anchorName}:`
        : `Mình tìm thấy ${hintLabel} phù hợp:`,
      followUp: "Bạn muốn mình lọc thêm theo màu hoặc giá không?",
      items: recommendedProducts.slice(0, 3).map((item) => ({
        name: item.name,
        price: formatVnd(item.price),
      })),
    };
  }

  if (conversationFocus?.isFollowUp && conversationFocus?.type === "color") {
    const hintLabel = colorHint || "màu bạn muốn";
    return {
      title: anchorName
        ? `Mình tìm thấy ${hintLabel} cho ${anchorName}:`
        : `Mình tìm thấy sản phẩm ${hintLabel}:`,
      followUp: "Bạn muốn xem thêm biến thể khác hoặc so sánh giá không?",
      items: recommendedProducts.slice(0, 3).map((item) => ({
        name: item.name,
        price: formatVnd(item.price),
      })),
    };
  }

  const budget = options?.priceConstraint?.maxPrice ?? options?.budget ?? null;
  const category = options?.categoryConstraint || "";
  const categoryLabel = categoryLabels[category] || (category ? category : "sản phẩm");
  const budgetText = formatBudgetVn(budget);

  const title = budgetText
    ? `Với ngân sách ${budgetText}, bạn có thể tham khảo các ${categoryLabel} sau:`
    : `Một vài ${categoryLabel} phù hợp cho bạn:`;

  const followUp = budgetText
    ? `Bạn có muốn xem chi tiết về các sản phẩm này không, hay bạn đang tìm sản phẩm có giá chính xác ${budgetText}?`
    : "Bạn có muốn xem chi tiết về các sản phẩm này không?";

  return {
    title,
    followUp,
    items: recommendedProducts.slice(0, 3).map((item) => ({
      name: item.name,
      price: formatVnd(item.price),
    })),
  };
}

function buildQuickReplies(intent) {
  if (intent === "policy") {
    return ["Phí vận chuyển", "Thời gian giao hàng", "Chính sách đổi trả"];
  }

  return ["Ngân sách dưới 5 triệu", "Đánh giá cao", "Bán chạy nhất"];
}

async function maybeGenerateLlmReply({ message, intent, recommendedProducts, history }) {
  return llmHelper.maybeGenerateLlmReply({ message, intent, recommendedProducts, history });
}

async function processChatMessage({ message, sessionId, context = {}, userId = null, history = [] }) {
  const session = getOrCreateSession(sessionId);
  const plainMessage = String(message || "").trim();

  const providedHistory = normalizeConversationHistory(history, 6);
  const historyContext = providedHistory.length > 0 ? providedHistory : session.history;

  let enrichedMessage = buildHistoryEnrichedMessage(plainMessage, historyContext);
  if (historyContext.length >= 2 && plainMessage.split(" ").length <= 5) {
    const pronouns = ["no", "cai do", "may do", "san pham do", "cai nay", "loai do", "con", "it"];
    const normalizedMsg = normalizeText(plainMessage);
    const hasVagueRef = pronouns.some((p) => normalizedMsg.includes(p)) ||
      normalizedMsg.length < 15;

    if (hasVagueRef) {
      const lastAssistant = [...historyContext].reverse().find((h) => h.role === "assistant");
      const lastUser = [...historyContext].reverse().find((h) => h.role === "user");
      if (lastUser && lastAssistant) {
        enrichedMessage = `${plainMessage} [context: ${lastUser.content.slice(0, 80)}]`;
      }
    }
  }

  const intent = recommenderService.detectIntent(plainMessage);
  void trackChatbotEvent({
    sessionId: session.id,
    eventType: "message",
    queryText: plainMessage,
    metadata: {
      intent,
      page: String(context?.page || ""),
    },
    userId,
  }).catch(() => null);

  if (intent === "compare") {
    const compareResult = await compareService.handleCompareIntent({
      message: plainMessage,
      session,
      historyContext,
    });

    if (compareResult) {
      return compareResult;
    }
  }

  const priceConstraint = parsePriceConstraint(plainMessage);

  const normalizedMessage = normalizeText(plainMessage);
  const queryTokens = tokenize(plainMessage);
  const informativeQueryTokens = queryTokens.filter(
    (token) => token.length >= 3 && !GENERIC_QUERY_TOKENS.has(token)
  );
  const hasPriceSignal = Boolean(priceConstraint);
  const hasBrandHint = includesAny(normalizedMessage, KNOWN_BRAND_HINTS);
  const hasModelHint = informativeQueryTokens.some((token) => isModelAnchorToken(token));
  const isShortQuery = queryTokens.length <= 4;
  const shouldUseLlmParser =
    !hasPriceSignal &&
    ((hasBrandHint || hasModelHint) || (isShortQuery && informativeQueryTokens.length <= 1));

  const llmQueryHints = shouldUseLlmParser ? await maybeParseQueryWithLlm(plainMessage, historyContext) : null;
  const categoryFromMessage = buildCategoryConstraint(plainMessage);
  const brandHint = inferBrandHint(plainMessage, llmQueryHints);
  const categoryFromBrand = inferCategoryFromBrandHint(brandHint);
  const inferredCategory = categoryFromMessage || categoryFromBrand || null;
  const conversationFocus = recommenderService.buildConversationFocus({
    history: historyContext,
    message: plainMessage,
    memory: session.memory,
  });

  const memory = updateSessionMemory(session, {
    budget: priceConstraint?.maxPrice ?? null,
    category: inferredCategory || (!brandHint ? session.memory?.category || null : null),
    brand: brandHint || null,
    series: llmQueryHints?.series || llmQueryHints?.productLine || null,
    model: llmQueryHints?.model || null,
    selectedProductId: conversationFocus.anchorProductId || null,
    selectedProductName: conversationFocus.anchorProductName || null,
    selectedProductVariant: conversationFocus.anchorProductVariant || null,
  });

  let mlSignal = null;
  let recommendedProducts = [];

  if (intent === "greeting") {
    const greetingOffers = await recommenderService.fetchAutomatedMlOffers(userId, 4);
    recommendedProducts = greetingOffers.products;
    mlSignal = greetingOffers.mlSignal;
  } else {
    mlSignal = userId ? await recommenderService.fetchMlCustomerSignal(userId) : null;
  }

  if (intent !== "greeting") {
    recommendedProducts =
      intent === "policy"
        ? []
        : await recommenderService.findRecommendedProducts(enrichedMessage, context, {
          sessionId: session.id,
          userId,
          llmQueryHints,
          memory,
          mlSignal,
          conversationFocus,
        });
  }

  const shouldUseLlm = recommendedProducts.length > 0;

  const rawLlmReply = shouldUseLlm
    ? await maybeGenerateLlmReply({
        message: plainMessage,
        intent,
        recommendedProducts,
        history: session.history,
      })
    : null;

  let llmReply = rawLlmReply;
  if (rawLlmReply && recommendedProducts.length > 0) {
    const replyNormalized = normalizeText(rawLlmReply);
    const hasProductMention = recommendedProducts.some((p) => {
      const tokens = tokenize(p.name).filter((t) => t.length >= 4);
      return tokens.some((t) => replyNormalized.includes(t));
    });
    if (!hasProductMention && rawLlmReply.length > 80) {
      llmReply = null;
    }
  }

  // Build structured reply (new format)
  const ruleReplyStructured = buildRuleReply(intent, recommendedProducts, {
    priceConstraint,
    categoryConstraint: inferredCategory || memory?.category || "",
    conversationFocus,
    mlSignal,
  });
  const replyText = llmReply || formatStructuredReply(ruleReplyStructured);
  const quickReplies = buildQuickReplies(intent);

  session.history.push({ role: "user", content: plainMessage, at: new Date().toISOString() });
  session.history.push({
    role: "assistant",
    content: replyText,
    products: recommendedProducts.slice(0, 5).map((item) => ({
      _id: item._id,
      name: item.name,
      category: item.category,
      price: item.price,
      brand: item.brand,
      model: item.model,
      variant: item.variant,
      stock: item.stock,
    })),
    at: new Date().toISOString(),
  });
  session.history = session.history.slice(-MAX_HISTORY);
  session.updatedAt = Date.now();

  return {
    sessionId: session.id,
    intent,
    reply: replyText,
    replyStructured: ruleReplyStructured,
    products: recommendedProducts,
    quickReplies,
    metadata: {
      llmUsed: Boolean(llmReply),
      productCount: recommendedProducts.length,
    },
  };
}

// Debug helper: generate a greeting response for QA without requiring real ML user
async function debugGreeting({ mode = "anonymous", sessionId = null, limit = 4 } = {}) {
  const session = getOrCreateSession(sessionId);
  const fallbackFilter = { stock: { $gt: 0 } };
  const projection = "_id name brand price finalPrice discountPercent description category image averageRating totalPurchases totalViews reason";

  const queryProducts = async (filter, sort) =>
    Product.find(filter)
      .select(projection)
      .sort(sort)
      .limit(limit)
      .lean();

  let filter = { ...fallbackFilter };
  let sort = { totalViews: -1, averageRating: -1, totalPurchases: -1 };
  let mlSignal = null;

  if (mode === "churn") {
    mlSignal = { churn: true, churn_score: 85, churn_level: "high" };
    filter = { ...fallbackFilter, discountPercent: { $gt: 10 } };
    sort = { discountPercent: -1, averageRating: -1, totalViews: -1 };
  } else if (mode === "vip") {
    mlSignal = { potential_score: 90, potential_level: "high" };
    filter = { ...fallbackFilter, finalPrice: { $gte: 15000000 } };
    sort = { averageRating: -1, totalViews: -1, totalPurchases: -1 };
  }

  const products = await queryProducts(filter, sort);

  const recommendedProducts = products.slice(0, limit);

  const ruleReplyStructured = buildRuleReply("greeting", recommendedProducts, { mlSignal });

  // Attempt to generate an LLM reply (optional) using existing helper
  let llmText = null;
  try {
    const raw = await maybeGenerateLlmReply({ message: "Xin chào", intent: "greeting", recommendedProducts, history: session.history });
    if (raw) llmText = String(raw).trim();
  } catch (e) {
    llmText = null;
  }

  const replyText = llmText || formatStructuredReply(ruleReplyStructured);

  // push to session history similar to processChatMessage
  session.history.push({ role: "user", content: "Xin chào", at: new Date().toISOString() });
  session.history.push({ role: "assistant", content: replyText, products: recommendedProducts, at: new Date().toISOString() });
  session.history = session.history.slice(-MAX_HISTORY);
  session.updatedAt = Date.now();

  return {
    sessionId: session.id,
    intent: "greeting",
    reply: replyText,
    replyStructured: ruleReplyStructured,
    products: recommendedProducts,
    quickReplies: buildQuickReplies("greeting"),
    metadata: { debug: true, mode, mlSignal },
  };
}

module.exports = {
  trackChatbotEvent,
  processChatMessage,
  debugGreeting,
};
