// Helper thuần cho chatbot widget: chuẩn hóa text, tạo message, lưu session/hành vi vào localStorage.
export const SESSION_STORAGE_KEY = "chatbot_session_id";

export const BEHAVIOR_STORAGE_KEY = "chatbot_behavior";

export function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function looksLikeCompareQuery(value) {
  const text = normalizeSearchText(value);
  if (!text) {
    return false;
  }

  const compareSeparators = /\s+(?:và|va|vs\.?|v\.s\.?|with|and|so voi|so sanh|giua|\/|vs\s+|vs\.\s+)/i;
  const parts = text
    .split(compareSeparators)
    .map((item) => item.trim())
    .filter(Boolean);

  const isProductLikePart = (part) => {
    if (!part) {
      return false;
    }

    if (
      /\b(iphone|samsung|galaxy|xiaomi|oppo|vivo|realme|ipad|macbook|pro|max|ultra|plus|mini|fold|flip)\b/.test(part)
    ) {
      return true;
    }

    if (/\b\d{1,2}\s*gb\s*\/\s*\d{2,4}\s*(gb|tb)\b/.test(part)) {
      return true;
    }

    if (/\b\d{2,4}\s*(gb|tb)\b/.test(part)) {
      return true;
    }

    return /\b\d{2,3}\s*hz\b/.test(part) || /\b\d{3,5}\s*mah\b/.test(part);
  };

  if (parts.length >= 2) {
    const hasTwoProductLikeParts = parts.slice(0, 2).every((part) => isProductLikePart(part));
    if (hasTwoProductLikeParts) {
      return true;
    }
  }

  return /\b(so sanh|compare|vs\.?|v\.s\.?|doi chieu|doi sach|di chung voi|giua)\b/.test(text) && parts.length >= 2;
}

export function createMessage(role, text, extra = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    products: extra.products || [],
    quickReplies: extra.quickReplies || [],
  };
}

export function cleanSpecialTokens(text) {
  if (!text || typeof text !== "string") return "";
  let cleaned = text;
  cleaned = cleaned.replace(/<\|tool_call\|?>[\s\S]*?(?:\{\}|(?=\n\n|\n[A-ZÀ-Ỹa-zà-ỹ]|$))/gi, "");
  cleaned = cleaned.replace(/<\|[a-z_0-9:-]+\|?>/gi, "");
  cleaned = cleaned.replace(/call:\s*[a-zA-Z0-9_]+\s*\{[^}]*\}/gi, "");
  cleaned = cleaned.replace(/```(?:tool_call|json_call|function_call)[\s\S]*?```/gi, "");
  return cleaned.replace(/\n{3,}/g, "\n\n").trim();
}

export function getOrCreateSessionId() {
  const existed = localStorage.getItem(SESSION_STORAGE_KEY);
  if (existed) {
    return existed;
  }

  const generated = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  localStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
}

export function readBehavior() {
  try {
    const raw = localStorage.getItem(BEHAVIOR_STORAGE_KEY);
    if (!raw) {
      return {
        viewedProductIds: [],
        preferredCategories: [],
        cartProductIds: [],
        recentPaths: [],
      };
    }

    const parsed = JSON.parse(raw);
    return {
      viewedProductIds: Array.isArray(parsed.viewedProductIds) ? parsed.viewedProductIds : [],
      preferredCategories: Array.isArray(parsed.preferredCategories) ? parsed.preferredCategories : [],
      cartProductIds: Array.isArray(parsed.cartProductIds) ? parsed.cartProductIds : [],
      recentPaths: Array.isArray(parsed.recentPaths) ? parsed.recentPaths : [],
    };
  } catch (error) {
    return {
      viewedProductIds: [],
      preferredCategories: [],
      cartProductIds: [],
      recentPaths: [],
    };
  }
}

export function writeBehavior(nextBehavior) {
  localStorage.setItem(BEHAVIOR_STORAGE_KEY, JSON.stringify(nextBehavior));
}
