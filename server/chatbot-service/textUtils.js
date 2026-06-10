const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .filter((item) => item.length >= 2);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
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

module.exports = {
  normalizeText,
  tokenize,
  escapeRegExp,
  normalizeHintValue,
  extractJsonObjectFromText,
  normalizeConversationHistory,
  formatConversationHistoryForPrompt,
  includesAny,
  isStorageToken,
  isModelAnchorToken,
};
