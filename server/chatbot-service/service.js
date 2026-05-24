const crypto = require("crypto");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Order = require("../models/Order");
const ChatbotEvent = require("./models/ChatbotEvent");

// Chatbot service implementation with structured replies and recommendation logic.

const MAX_HISTORY = 10;
const MAX_SESSION_IDLE_MS = 1000 * 60 * 30;
const MAX_EVENT_WINDOW = 5000;
const sessionStore = new Map();
const knnCache = {
  expiresAt: 0,
  productActorWeights: new Map(),
  actorProductWeights: new Map(),
};

const LLM_TIMEOUT_MS = Number(process.env.CHATBOT_LLM_TIMEOUT_MS || 2500);
const ML_SERVICE_URL = String(process.env.ML_SERVICE_URL || "http://localhost:5001").trim();

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

const PHONE_BRAND_HINTS = new Set(["iphone", "samsung", "xiaomi", "oppo", "vivo", "realme"]);
const COLOR_HINTS = new Set([
  "den",
  "trang",
  "xanh",
  "do",
  "tim",
  "vang",
  "hong",
  "bac",
  "xam",
  "nau",
  "cam",
  "green",
  "blue",
  "black",
  "white",
  "silver",
  "gold",
  "pink",
]);
const AVAILABILITY_HINTS = ["co hang", "con hang", "co san", "ton kho", "hang khong", "available"];

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

function getSessionMemory(session) {
  if (!session.memory || typeof session.memory !== "object") {
    session.memory = {};
  }
  return session.memory;
}

function updateSessionMemory(session, updates) {
  const memory = getSessionMemory(session);
  const next = { ...memory };

  if (updates?.budget != null) {
    next.budget = Number(updates.budget);
  }

  if (updates?.category) {
    next.category = String(updates.category);
  }

  if (updates?.brand) {
    next.brand = String(updates.brand);
  }

  if (updates?.series) {
    next.series = String(updates.series);
  }

  if (updates?.model) {
    next.model = String(updates.model);
  }

  if (updates?.selectedProductId) {
    next.selectedProductId = String(updates.selectedProductId);
  }

  if (updates?.selectedProductName) {
    next.selectedProductName = String(updates.selectedProductName);
  }

  if (updates?.selectedProductVariant) {
    next.selectedProductVariant = String(updates.selectedProductVariant);
  }

  next.updatedAt = Date.now();
  session.memory = next;
  return next;
}

function normalizeConversationHistory(history, limit = 6) {
  if (!Array.isArray(history) || history.length === 0) {
    return [];
  }

  return history
    .slice(-Math.max(1, Number(limit) || 6))
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: String(item?.content || item?.text || "").trim(),
      products: Array.isArray(item?.products) ? item.products : [],
    }))
    .filter((item) => item.content || item.products.length > 0);
}

function formatConversationHistoryForPrompt(history, limit = 6) {
  const normalizedHistory = normalizeConversationHistory(history, limit);
  if (normalizedHistory.length === 0) {
    return "Chua co lich su.";
  }

  return normalizedHistory
    .map((item) => {
      const speaker = item.role === "assistant" ? "Assistant" : "User";
      const productNames = item.products
        .map((product) => {
          const name = String(product?.name || product?.title || "").trim();
          const variant = String(product?.variant || "").trim();
          return variant && variant !== name ? `${name} (${variant})` : name;
        })
        .filter(Boolean)
        .slice(0, 3);
      const productSuffix = productNames.length > 0 ? ` [products: ${productNames.join(", ")}]` : "";
      return `${speaker}: ${item.content}${productSuffix}`.trim();
    })
    .join("\n");
}

function detectFollowUpSignals(message) {
  const text = normalizeText(message);
  const tokenSet = new Set(tokenize(message));

  const availability = AVAILABILITY_HINTS.some((hint) => text.includes(hint));
  const colorHint = Array.from(COLOR_HINTS).find((hint) => tokenSet.has(hint) || text.includes(hint));
  const storageMatch = text.match(/\b(\d+\s*(gb|tb))\b/);
  let storageHint = "";
  let ramHint = "";

  if (storageMatch) {
    const numericValue = Number(String(storageMatch[1]).replace(/[^0-9]/g, ""));
    const compactValue = storageMatch[1].replace(/\s+/g, "");
    const explicitStorageSignal = includesAny(text, ["dung luong", "bo nho trong", "rom", "storage", "capacity"]);

    if (numericValue > 0 && numericValue <= 64 && !explicitStorageSignal) {
      ramHint = compactValue;
    } else {
      storageHint = compactValue;
    }
  }

  return {
    availability,
    colorHint: colorHint || "",
    storageHint,
    ramHint,
    isDirectFollowUp: Boolean(availability || colorHint || storageHint),
  };
}

function getLatestAssistantProducts(history) {
  const normalizedHistory = normalizeConversationHistory(history, 8);
  const recentAssistant = [...normalizedHistory].reverse().find((item) => item.role === "assistant");
  return Array.isArray(recentAssistant?.products) ? recentAssistant.products.filter(Boolean) : [];
}

function pickConversationAnchorProduct(history, message) {
  const products = getLatestAssistantProducts(history);
  if (products.length === 0) {
    return null;
  }

  const signals = detectFollowUpSignals(message);
  const candidates = [...products];

  if (signals.storageHint) {
    const storageToken = normalizeText(signals.storageHint);
    const storageMatch = candidates.find((product) => {
      const haystack = normalizeText([product?.name, product?.variant, product?.model, product?.description].join(" "));
      return haystack.includes(storageToken);
    });

    if (storageMatch) {
      return storageMatch;
    }
  }

  if (signals.colorHint) {
    const colorToken = normalizeText(signals.colorHint);
    const colorMatch = candidates.find((product) => {
      const haystack = normalizeText([product?.name, product?.variant, product?.description].join(" "));
      return haystack.includes(colorToken);
    });

    if (colorMatch) {
      return colorMatch;
    }
  }

  return candidates[0] || null;
}

function buildConversationFocus({ history, message, memory }) {
  const signals = detectFollowUpSignals(message);
  const anchorProduct = pickConversationAnchorProduct(history, message);
  const memorySelectedProductId = String(memory?.selectedProductId || "").trim();

  const anchorProductId = String(anchorProduct?._id || memory?.selectedProductId || "").trim();
  const anchorProductName = String(anchorProduct?.name || memory?.selectedProductName || "").trim();
  const anchorProductVariant = String(anchorProduct?.variant || memory?.selectedProductVariant || "").trim();

  const type = signals.availability
    ? "availability"
    : signals.storageHint
      ? "storage"
      : signals.colorHint
        ? "color"
        : "";

  const isFollowUp = Boolean(type && (anchorProductId || memorySelectedProductId));

  return {
    ...signals,
    type,
    isFollowUp,
    anchorProductId: anchorProductId || memorySelectedProductId,
    anchorProductName,
    anchorProductVariant,
    anchorProduct,
  };
}

function buildHistoryEnrichedMessage(message, history) {
  const plainMessage = String(message || "").trim();
  if (!plainMessage) {
    return plainMessage;
  }

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

async function maybeParseQueryWithLlm(message, history = []) {
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
    "Use the conversation history to resolve short follow-up messages and inherit the product category, brand, or model from the previous turn when the current message is underspecified.",
    "If the current message is a budget-only follow-up like 'duoi 20 trieu', infer the implied category from history.",
    "If the current message asks about color or availability, use the latest referenced product from history.",
    `Conversation history:\n${formatConversationHistoryForPrompt(history, 6)}`,
    `User message: ${String(message || "")}`,
  ].join("\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

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

  if (!hasExplicitPriceSignal && unit === "k" && numeric < 100) {
    return null;
  }

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
    "gia the nao",
    "co gia bao",
    "how much",
    "cost bao nhieu",
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

  const sevenDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);

  const events = await ChatbotEvent.find({
    product: { $ne: null },
    eventType: { $in: ["view", "click", "cart", "impression"] },
    createdAt: { $gte: sevenDaysAgo },
  })
    .sort({ createdAt: -1 })
    .limit(10000)
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

      const prefixMatchInCategory = categoryTokens.find(
        (ct) => token.length >= 3 && ct.startsWith(token)
      );
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
    (token) =>
      !/^\d+$/.test(token) &&
      token.length >= 3 &&
      !QUERY_STOPWORDS.has(token)
  );
  const hasNumericToken = queryTokens.some((token) => /^\d+$/.test(token));
  const behaviorProfile = buildBehaviorProfile(context.userBehavior);
  const llmQueryHints = options.llmQueryHints && typeof options.llmQueryHints === "object" ? options.llmQueryHints : null;
  const memory = options.memory && typeof options.memory === "object" ? options.memory : null;
  const conversationFocus = options.conversationFocus && typeof options.conversationFocus === "object" ? options.conversationFocus : null;
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
  let priceConstraint = parsedPriceConstraint || llmPriceConstraint;
  const categoryFromMessage = buildCategoryConstraint(message);
  const hardBrandHint = inferBrandHint(message, llmQueryHints);
  const categoryFromBrand = inferCategoryFromBrandHint(hardBrandHint);
  const hasStrongBrandSignal = Boolean(hardBrandHint);
  const categoryConstraint = categoryFromMessage || categoryFromBrand || (!hasStrongBrandSignal ? memory?.category || "" : "");
  const brandConstraint = hardBrandHint || normalizeHintValue(llmQueryHints?.brand) || (!hasStrongBrandSignal ? memory?.brand || "" : "");

  if (conversationFocus?.isFollowUp && conversationFocus.anchorProductId) {
    const anchorProduct = await Product.findById(conversationFocus.anchorProductId)
      .select(
        "_id name brand series model variant sku slug price finalPrice discountPercent description category image averageRating totalRatings totalViews stock"
      )
      .lean();

    if (anchorProduct) {
      return [anchorProduct];
    }
  }

  if (!priceConstraint && memory?.budget) {
    priceConstraint = {
      minPrice: 0,
      maxPrice: Number(memory.budget),
      source: "memory",
      strictUpperBound: false,
    };
  }

  const budget = priceConstraint?.maxPrice ?? null;

  const dbFilter = {
    stock: { $gt: 0 },
  };

  if (priceConstraint?.minPrice != null || priceConstraint?.maxPrice != null) {
    const minPrice =
      priceConstraint.minPrice != null ? Number(priceConstraint.minPrice) : null;
    const maxPrice =
      priceConstraint.maxPrice != null ? Number(priceConstraint.maxPrice) : null;
    const allowSlightOverBudget =
      priceConstraint.source === "implicit-max" && priceConstraint.strictUpperBound !== true;
    const effectiveMax =
      maxPrice != null
        ? allowSlightOverBudget
          ? Math.round(maxPrice * 1.05)
          : maxPrice
        : null;
    const effectivePriceExpr = {
      $cond: [{ $gt: ["$finalPrice", 0] }, "$finalPrice", "$price"],
    };
    const exprFilters = [];
    if (minPrice != null) {
      exprFilters.push({ $gte: [effectivePriceExpr, minPrice] });
    }
    if (effectiveMax != null) {
      exprFilters.push({ $lte: [effectivePriceExpr, effectiveMax] });
    }
    if (exprFilters.length === 1) {
      dbFilter.$expr = exprFilters[0];
    } else if (exprFilters.length > 1) {
      dbFilter.$expr = { $and: exprFilters };
    }
  }

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

  if (brandConstraint) {
    const normalizedBrandConstraint = normalizeHintValue(brandConstraint);
    const brandFilteredProducts = products.filter((item) => {
      const normalizedName = normalizeText(item.name);
      const normalizedBrand = normalizeText(item.brand);
      const normalizedSeries = normalizeText(item.series);
      const normalizedModel = normalizeText(item.model);
      const normalizedVariant = normalizeText(item.variant);

      return (
        normalizedBrand.includes(normalizedBrandConstraint) ||
        normalizedName.includes(normalizedBrandConstraint) ||
        normalizedSeries.includes(normalizedBrandConstraint) ||
        normalizedModel.includes(normalizedBrandConstraint) ||
        normalizedVariant.includes(normalizedBrandConstraint)
      );
    });

    if (brandFilteredProducts.length > 0) {
      products = brandFilteredProducts;
    } else if (hasStrongBrandSignal) {
      products = [];
    }
  }

  if (conversationFocus?.isFollowUp && conversationFocus.type === "storage") {
    const storageToken = normalizeText(conversationFocus.storageHint);
    const storageMatches = products.filter((item) => {
      const haystack = normalizeText([item.name, item.variant, item.model, item.description].join(" "));
      return haystack.includes(storageToken);
    });

    if (storageMatches.length > 0) {
      products = storageMatches;
    }
  }

  if (conversationFocus?.isFollowUp && conversationFocus.type === "color") {
    const colorToken = normalizeText(conversationFocus.colorHint);
    const colorMatches = products.filter((item) => {
      const haystack = normalizeText([item.name, item.variant, item.description].join(" "));
      return haystack.includes(colorToken);
    });

    if (colorMatches.length > 0) {
      products = colorMatches;
    }
  }

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
      products = constrainedByHints;
    } else if (constrainedByHints.length > 0 && llmConfidence >= 0.5) {
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

  const mlSignal = options.mlSignal && typeof options.mlSignal === "object" ? options.mlSignal : null;
  const churnScore = Number(mlSignal?.churn_score ?? mlSignal?.churnScore ?? 0);
  const potentialScore = Number(mlSignal?.potential_score ?? mlSignal?.potentialScore ?? 0);
  const isChurnRisk = churnScore >= 60;
  const isPotentialHigh = potentialScore >= 60;

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

      const sellingPrice = getEffectivePrice(product);
      const discountFeature = Math.min(1, Number(product.discountPercent || 0) / 30);
      const ratingFeature = Math.min(1, Number(product.averageRating || 0) / 5);
      const priceFitMl = budget
        ? Math.max(0, 1 - Math.abs(sellingPrice - budget) / budget)
        : Math.max(0, 1 - sellingPrice / 20000000);
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
        ltrScore:
          ltr.ltrScore +
          (shouldUseStrictNameFilter ? queryCoverage * 0.35 + Math.min(0.12, nameOverlap * 0.02) : 0) +
          hardMatchOverride +
          mlBoost,
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

// === REFACTORED FUNCTIONS WITH STRUCTURED FORMAT ===

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
    return {
      title: "Chào bạn, tôi là AI Shopping Assistant",
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
    "Bạn là trợ lý bán hàng e-commerce. Trả lời ngắn gọn bằng tiếng Việt, ưu tiên đề xuất hành động mua hàng, không bịa thông tin ngoài danh sách sản phẩm được cung cấp, và khi liệt kê sản phẩm thì mỗi sản phẩm một dòng, không dùng ký hiệu bullet.";

  const userPrompt = JSON.stringify(
    {
      intent,
      message,
      products: contextProducts,
      recentHistory: history.slice(-4),
      requirements:
        "Trả lời tối đa 5 câu. Nếu cần, hỏi thêm 1 câu để làm rõ nhu cầu. Khi liệt kê sản phẩm: mỗi sản phẩm một dòng, không dùng ký hiệu bullet.",
    },
    null,
    2
  );

  const isGemini = apiUrl.includes("generativelanguage.googleapis.com");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

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

  const intent = detectIntent(plainMessage);
  const priceConstraint = parsePriceConstraint(plainMessage);

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

  const normalizedMessage = normalizeText(plainMessage);
  const queryTokens = tokenize(plainMessage);
  const informativeQueryTokens = queryTokens.filter(
    (token) => token.length >= 3 && !GENERIC_QUERY_TOKENS.has(token)
  );
  const hasPriceSignal = Boolean(parsePriceConstraint(plainMessage));
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
  const conversationFocus = buildConversationFocus({
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

  const mlSignal = userId ? await fetchMlCustomerSignal(userId) : null;

  const recommendedProducts =
    intent === "policy"
      ? []
        : await findRecommendedProducts(enrichedMessage, context, {
          sessionId: session.id,
          userId,
          llmQueryHints,
          memory,
          mlSignal,
          conversationFocus,
        });

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

module.exports = {
  trackChatbotEvent,
  processChatMessage,
};
