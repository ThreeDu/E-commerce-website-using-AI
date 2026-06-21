const Redis = require("ioredis");
const Product = require("../models/Product");
const { processChatMessage } = require("./service");

const REDIS_KEY_PREFIX = "chatbot:history:";
const HISTORY_TTL_SECONDS = 900;
const HISTORY_WINDOW = 8;

let redisClient = null;
let redisUnavailable = false;
const memoryHistoryStore = new Map();

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s\."]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAccentText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function looksLikeCompareQuery(value) {
  const text = normalizeAccentText(value);
  if (!text) {
    return false;
  }

  const compareSeparators = /\s+(?:va|và|vs\.?|v\.s\.?|with|and|so voi|so sanh|giua|\/|vs\s+|vs\.\s+)/i;
  const parts = text
    .split(compareSeparators)
    .map((item) => item.trim())
    .filter(Boolean);

  const isProductLikePart = (part) => {
    if (!part) {
      return false;
    }

    if (/\b(iphone|samsung|galaxy|xiaomi|oppo|vivo|realme|ipad|macbook|pro|max|ultra|plus|mini|fold|flip)\b/.test(part)) {
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

  return parts.length >= 2 && parts.slice(0, 2).every((part) => isProductLikePart(part));
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseStorageSpecToGB(spec) {
  if (!spec) return null;
  const raw = String(spec || "").toLowerCase();
  const m = raw.match(/(\d+(?:[\.,]\d+)?)\s*(tb|gb)\b/);
  if (!m) return null;
  let n = Number(String(m[1]).replace(/[,\.]/g, "."));
  if (!Number.isFinite(n)) return null;
  const unit = String(m[2]).toLowerCase();
  if (unit === "tb") n = n * 1024;
  return Math.round(n);
}

function buildStorageRegexAtLeast(minGb) {
  const canonical = [32, 64, 128, 256, 512, 1024, 2048];
  const allowed = canonical.filter((s) => s >= Math.max(0, Math.trunc(minGb || 0)));
  if (allowed.length === 0) return null;
  const parts = allowed.map((s) => (s >= 1024 ? `${s / 1024}TB` : `${s}GB`));
  // match with or without space e.g., "512GB" or "512 GB"
  const pattern = parts.map((p) => p.replace(/\s+/g, "\\s*")).join("|");
  return new RegExp(pattern, "i");
}

function parseRamToGB(textOrSpec) {
  if (!textOrSpec) return null;
  const raw = String(textOrSpec || "").toLowerCase();
  const m = raw.match(/(\d+(?:[\.,]\d+)?)\s*(gb)\s*(ram)?\b/);
  if (m) return parseStorageSpecToGB(m[0]);

  // fallback: standalone GB token
  const m2 = raw.match(/(\d+(?:[\.,]\d+)?)\s*(gb)\b/);
  if (m2) return parseStorageSpecToGB(m2[0]);
  return null;
}

function buildRamRegexAtLeast(minGb) {
  // common RAM sizes
  const canonical = [2, 3, 4, 6, 8, 12, 16, 24, 32, 64];
  const allowed = canonical.filter((s) => s >= Math.max(0, Math.trunc(minGb || 0)));
  if (allowed.length === 0) return null;
  const parts = allowed.map((s) => `${s}GB`);
  const pattern = parts.map((p) => p.replace(/\s+/g, "\\s*")).join("|");
  return new RegExp(pattern, "i");
}

function parseCameraMp(textOrSpec) {
  if (!textOrSpec) return null;
  const raw = String(textOrSpec || "").toLowerCase();
  const m = raw.match(/(\d{2,3})\s*mp\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function buildCameraRegexAtLeast(minMp) {
  const canonical = [8, 12, 16, 24, 32, 48, 64, 108, 200, 256];
  const allowed = canonical.filter((s) => s >= Math.max(0, Math.trunc(minMp || 0)));
  if (allowed.length === 0) return null;
  const parts = allowed.map((s) => `${s}MP`);
  const pattern = parts.join("|");
  return new RegExp(pattern, "i");
}

function parseBatteryToMah(textOrSpec) {
  if (!textOrSpec) return null;
  const raw = String(textOrSpec || "").toLowerCase();
  const m = raw.match(/(\d{3,5})\s*m?ah\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function buildBatteryRegexAtLeast(minMah) {
  const canonical = [2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000];
  const allowed = canonical.filter((s) => s >= Math.max(0, Math.trunc(minMah || 0)));
  if (allowed.length === 0) return null;
  const parts = allowed.map((s) => `${s}mAh`);
  const pattern = parts.join("|");
  return new RegExp(pattern, "i");
}

function parseScreenInch(textOrSpec) {
  if (!textOrSpec) return null;
  const raw = String(textOrSpec || "");
  const m = raw.match(/(\d+(?:[\.,]\d+)?)\s*(?:"|inch|in)\b/i);
  if (!m) return null;
  const n = Number(String(m[1]).replace(/,/, "."));
  if (!Number.isFinite(n)) return null;
  return Number(n);
}

function parseScreenContext(textOrSpec) {
  const raw = String(textOrSpec || "");
  const accentless = normalizeAccentText(raw);
  const compact = accentless.replace(/\s+/g, " ").trim();

  let role = "";
  if (/(man hinh chinh|main screen|primary screen)/.test(compact)) {
    role = "main";
  } else if (/(man hinh phu|man hinh ngoai|cover screen|secondary screen|outer screen)/.test(compact)) {
    role = "cover";
  }

  const techCandidates = [
    "dynamic amoled 2x",
    "dynamic amoled",
    "amoled 2x",
    "super retina xdr",
    "super amoled",
    "amoled",
    "oled",
    "ltpo",
    "ltps",
    "retina xdr",
    "retina",
    "p oled",
    "p-oled",
    "poled",
    "lcd",
  ];

  const techs = [];
  for (const tech of techCandidates) {
    if (compact.includes(tech)) {
      techs.push(tech.toUpperCase().replace(/\bP OLED\b/, "POLED"));
    }
  }

  const resolutionMatch = raw.match(/\b(fhd\+?|qhd\+?|qxga\+?|wqhd\+?|uhd|hd\+?|2k|3k|4k)\b/i);
  const resolution = resolutionMatch ? String(resolutionMatch[1]).toUpperCase().replace(/\+$/g, "+") : "";

  return {
    role,
    tech: techs[0] || "",
    techs: Array.from(new Set(techs)),
    resolution,
  };
}

function parseRefreshRate(textOrSpec) {
  if (!textOrSpec) return null;
  const raw = String(textOrSpec || "").toLowerCase();
  // range like 1-120Hz
  const range = raw.match(/(\d{1,3})\s*[-–]\s*(\d{1,3})\s*hz/);
  if (range) {
    return { min: Number(range[1]), max: Number(range[2]) };
  }
  const single = raw.match(/(\d{2,3})\s*hz/);
  if (single) return { min: Number(single[1]), max: Number(single[1]) };
  return null;
}

function buildScreenTechRegex(value) {
  const normalized = normalizeAccentText(value).replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  const candidates = [
    "dynamic amoled 2x",
    "dynamic amoled",
    "amoled 2x",
    "super retina xdr",
    "super amoled",
    "amoled",
    "oled",
    "ltpo",
    "ltps",
    "retina xdr",
    "retina",
    "p oled",
    "p-oled",
    "poled",
    "lcd",
  ];

  for (const candidate of candidates) {
    if (normalized.includes(candidate)) {
      return new RegExp(escapeRegExp(candidate), "i");
    }
  }

  return new RegExp(escapeRegExp(value), "i");
}

function buildScreenRoleRegex(role) {
  const normalized = normalizeAccentText(role);
  if (!normalized) {
    return null;
  }

  if (normalized === "main") {
    return /m[aàáảãạâă]n\s*h[iìíỉĩị]nh\s*ch[iìíỉĩị]nh|main screen|primary screen/i;
  }

  if (normalized === "cover") {
    return /m[aàáảãạâă]n\s*h[iìíỉĩị]nh\s*(ph[uùúủũụ]|ngo[aàáảãạâă]i)|cover screen|secondary screen|outer screen/i;
  }

  return null;
}

function buildHzRegexAtLeast(minHz) {
  const canonical = [50, 60, 90, 120, 144, 240, 360];
  const allowed = canonical.filter((s) => s >= Math.max(0, Math.trunc(minHz || 0)));
  const parts = allowed.map((s) => `${s}Hz`);
  if (parts.length === 0) return null;
  const pattern = parts.join("|");
  return new RegExp(pattern, "i");
}

function safeJsonParse(raw) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const start = String(raw).indexOf("{");
    const end = String(raw).lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(String(raw).slice(start, end + 1));
    } catch (nestedError) {
      return null;
    }
  }
}

function toIntegerOrNull(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.trunc(parsed);
}

function normalizeCategory(category) {
  const normalized = normalizeText(category);
  if (!normalized) {
    return null;
  }

  if (normalized.includes("dien thoai") || normalized.includes("smartphone") || normalized === "phone") {
    return "dien thoai";
  }

  if (normalized.includes("laptop") || normalized.includes("notebook") || normalized.includes("macbook")) {
    return "laptop";
  }

  if (normalized.includes("phu kien") || normalized.includes("accessory")) {
    return "phu kien";
  }

  if (normalized.includes("tablet") || normalized.includes("ipad")) {
    return "tablet";
  }

  return normalized;
}

function detectCategoryFromHistory(history = []) {
  const recent = Array.isArray(history) ? [...history].reverse() : [];
  for (const item of recent) {
    const text = normalizeText(item?.content || item?.text || "");
    if (!text) {
      continue;
    }

    const category = normalizeCategory(text);
    if (category) {
      if (text.includes("dien thoai") || text.includes("phone") || text.includes("smartphone") || text.includes("iphone") || text.includes("samsung") || text.includes("xiaomi") || text.includes("oppo") || text.includes("vivo") || text.includes("realme")) {
        return "dien thoai";
      }

      if (text.includes("laptop") || text.includes("macbook") || text.includes("notebook")) {
        return "laptop";
      }

      if (text.includes("tablet") || text.includes("ipad")) {
        return "tablet";
      }
    }
  }

  return null;
}

function extractPriceMaxFromText(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }

  const maxSignals = ["duoi", "khong qua", "toi da", "under", "less than", "max"];
  if (!maxSignals.some((signal) => normalized.includes(signal))) {
    return null;
  }

  const grouped = normalized.match(/(\d{1,3}(?:[\.,\s]\d{3})+|\d+(?:[\.,]\d+)?)\s*(trieu|tr|k|nghin|d|vnd|dong)?/i);
  if (!grouped) {
    return null;
  }

  const numeric = Number(String(grouped[1]).replace(/[\.,\s]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  const unit = normalizeText(grouped[2] || "");
  if (unit === "trieu" || unit === "tr") {
    return Math.trunc(numeric * 1000000);
  }

  if (unit === "k" || unit === "nghin") {
    return Math.trunc(numeric * 1000);
  }

  if (unit === "" && numeric < 1000) {
    return Math.trunc(numeric * 1000000);
  }

  return Math.trunc(numeric);
}

function extractSpecsLocally(text) {
  const normalized = normalizeText(text);
  const specs = [];

  const push = (value) => {
    const cleaned = String(value || "").trim();
    if (cleaned && !specs.includes(cleaned)) {
      specs.push(cleaned);
    }
  };

  const cameraMatches = normalized.match(/\b\d{2,3}\s*mp\b/gi) || [];
  cameraMatches.forEach((item) => push(item.toUpperCase().replace(/\s+/g, "")));

  const hzRangeMatches = String(text || "").match(/\b\d{1,3}\s*-\s*\d{1,3}\s*hz\b/gi) || [];
  hzRangeMatches.forEach((item) => push(item.toUpperCase().replace(/\s+/g, "")));

  const hzMatches = normalized.match(/\b\d{2,3}\s*hz\b/gi) || [];
  hzMatches.forEach((item) => push(item.toUpperCase().replace(/\s+/g, "")));

  const memoryMatches = normalized.match(/\b\d+(?:\.\d+)?\s*(gb|tb)\b/gi) || [];
  memoryMatches.forEach((item) => push(item.toUpperCase().replace(/\s+/g, "")));

  const batteryMatches = normalized.match(/\b\d{3,5}\s*mah\b/gi) || [];
  batteryMatches.forEach((item) => push(item.toUpperCase().replace(/\s+/g, "")));

  const screenMatches = String(text || "").match(/\b\d+(?:[.,]\d+)?\s*"/g) || [];
  screenMatches.forEach((item) => push(item.replace(/\s+/g, "")));

  return specs;
}

function getRedisClient() {
  if (redisUnavailable) {
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  const redisUrl = String(process.env.REDIS_URL || "").trim();
  const options = {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    retryStrategy(times) {
      return Math.min(times * 100, 1000);
    },
  };

  if (redisUrl) {
    redisClient = new Redis(redisUrl, options);
  } else {
    redisClient = new Redis({
      ...options,
      host: String(process.env.REDIS_HOST || "127.0.0.1").trim(),
      port: Number(process.env.REDIS_PORT || 6379),
      password: String(process.env.REDIS_PASSWORD || "").trim() || undefined,
      db: Number(process.env.REDIS_DB || 0),
    });
  }

  redisClient.on("error", (error) => {
    redisUnavailable = true;
  });

  return redisClient;
}

async function readHistoryFromRedis(sessionId) {
  const id = String(sessionId || "").trim();
  if (!id) {
    return [];
  }

  if (redisUnavailable) {
    return Array.isArray(memoryHistoryStore.get(id)) ? memoryHistoryStore.get(id) : [];
  }

  try {
    const client = getRedisClient();
    if (!client) {
      return Array.isArray(memoryHistoryStore.get(id)) ? memoryHistoryStore.get(id) : [];
    }

    const raw = await client.get(`${REDIS_KEY_PREFIX}${id}`);
    const parsed = safeJsonParse(raw);
    if (!Array.isArray(parsed)) {
      return Array.isArray(memoryHistoryStore.get(id)) ? memoryHistoryStore.get(id) : [];
    }

    return parsed
      .slice(-HISTORY_WINDOW)
      .map((item) => ({
        role: item?.role === "assistant" ? "assistant" : "user",
        content: String(item?.content || item?.text || "").trim(),
        at: String(item?.at || new Date().toISOString()),
      }))
      .filter((item) => item.content);
  } catch (error) {
    redisUnavailable = true;
    return Array.isArray(memoryHistoryStore.get(id)) ? memoryHistoryStore.get(id) : [];
  }
}

async function writeHistoryToRedis(sessionId, history) {
  const id = String(sessionId || "").trim();
  if (!id) {
    return;
  }

  const payloadHistory = Array.isArray(history)
    ? history
        .slice(-HISTORY_WINDOW)
        .map((item) => ({
          role: item?.role === "assistant" ? "assistant" : "user",
          content: String(item?.content || item?.text || "").trim(),
          at: String(item?.at || new Date().toISOString()),
        }))
        .filter((item) => item.content)
    : [];

  if (redisUnavailable) {
    memoryHistoryStore.set(id, payloadHistory);
    return;
  }

  try {
    const client = getRedisClient();
    if (!client) {
      memoryHistoryStore.set(id, payloadHistory);
      return;
    }

    const payload = JSON.stringify(payloadHistory);
    await client.set(`${REDIS_KEY_PREFIX}${id}`, payload, "EX", HISTORY_TTL_SECONDS);
  } catch (error) {
    redisUnavailable = true;
    memoryHistoryStore.set(id, payloadHistory);
  }
}

function formatHistoryForPrompt(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return "Chưa có lịch sử.";
  }

  return history
    .slice(-HISTORY_WINDOW)
    .map((item) => {
      const role = item?.role === "assistant" ? "Assistant" : "User";
      return `${role}: ${String(item?.content || "").trim()}`;
    })
    .filter(Boolean)
    .join("\n");
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

async function parseDescriptionToSpecsWithMemory(rawText, history = []) {
  const apiKey = String(process.env.CHATBOT_LLM_API_KEY || "").trim();
  const apiUrl = String(process.env.CHATBOT_LLM_API_URL || "").trim();
  const model = String(process.env.CHATBOT_LLM_MODEL || "gpt-4o-mini").trim();
  const recentHistory = Array.isArray(history) ? history.slice(-HISTORY_WINDOW) : [];
  const historyText = formatHistoryForPrompt(recentHistory);

  const fallbackCategory = detectCategoryFromHistory(recentHistory) || null;
  const fallbackPriceMax = extractPriceMaxFromText(rawText);
  const fallbackSpecs = extractSpecsLocally(rawText);

  // fallback structured attributes
  const fallback_storage_gb = (fallbackSpecs || []).map((s) => parseStorageSpecToGB(s)).find(Boolean) || null;
  const fallback_ram_gb = (fallbackSpecs || []).map((s) => parseRamToGB(s)).find(Boolean) || null;
  const fallback_camera_mp = (fallbackSpecs || []).map((s) => parseCameraMp(s)).find(Boolean) || null;
  const fallback_battery_mah = (fallbackSpecs || []).map((s) => parseBatteryToMah(s)).find(Boolean) || null;
  const fallback_screen_inch = (fallbackSpecs || []).map((s) => parseScreenInch(s)).find(Boolean) || null;
  const fallback_screen_context = parseScreenContext(rawText);
  const fallback_refresh = (fallbackSpecs || []).map((s) => parseRefreshRate(s)).find(Boolean) || null;

  if (!apiKey || !apiUrl) {
    return {
      category: fallbackCategory,
      price_max: fallbackPriceMax,
      specs: fallbackSpecs,
      screen_context: fallback_screen_context,
    };
  }

  const prompt = [
    "Bạn là bộ trích xuất thông số e-commerce chính xác cao.",
    "Nhiệm vụ: đọc lịch sử hội thoại và câu hiện tại để suy ra danh mục sản phẩm, giá tối đa, và các thông số phần cứng cốt lõi.",
    "Hãy kế thừa ngữ cảnh từ lịch sử nếu câu hiện tại quá ngắn.",
    "Loại bỏ hoàn toàn từ quảng cáo, hoa mỹ, mô tả cảm xúc, slogan.",
    "Chỉ giữ lại thông số kỹ thuật sạch như 200MP, 12GB, 256GB, 6.9\", 120Hz, 1-120Hz, 5000mAh.",
    "Nếu người dùng nhắc tới màn hình, hãy giữ thêm screen_role (main/cover/secondary) và screen_tech nếu có, ví dụ Dynamic AMOLED 2X, Super Retina XDR, AMOLED, OLED.",
    "Nếu câu có dải tần số quét như 1-120Hz thì giữ nguyên đúng chuỗi này.",
    "Nếu người dùng nói câu ngắn như 'RAM 12GB dưới 20 triệu', hãy suy ra danh mục từ lịch sử gần nhất.",
    "Nếu câu hỏi liên quan điện thoại thì category phải là 'dien thoai'. Nếu liên quan laptop thì category phải là 'laptop'.",
    "Tuyệt đối trả về DUY NHẤT một JSON object hợp lệ, không markdown, không giải thích.",
    "Schema bắt buộc:",
    '{"category": "dien thoai|laptop|phu kien|tablet|null", "price_max": 20000000|null, "specs": ["12GB", "200MP", "120Hz"], "screen_role": "main|cover|secondary|null", "screen_tech": "Dynamic AMOLED 2X|null"}',
    `Lịch sử hội thoại:\n${historyText}`,
    `Tin nhắn hiện tại: ${String(rawText || "").trim()}`,
  ].join("\n");

  const isGemini = apiUrl.includes("generativelanguage.googleapis.com");

  try {
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
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `Bạn chỉ được xuất một JSON object nghiêm ngặt. Không bao giờ thêm markdown, chú thích hay văn bản ngoài JSON.\n\n${prompt}` }],
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
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                "Bạn chỉ được xuất một JSON object nghiêm ngặt. Không bao giờ thêm markdown, chú thích hay văn bản ngoài JSON.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });
    })();

    if (!response.ok) {
      console.error("[LLM] parseDescriptionToSpecsWithMemory API response error:", response.status, response.statusText);
      return {
        category: fallbackCategory,
        price_max: fallbackPriceMax,
        specs: fallbackSpecs,
        screen_context: fallback_screen_context,
      };
    }

    const data = await response.json();
    const content = isGemini
      ? (data?.candidates || [])
          .flatMap((candidate) => candidate?.content?.parts || [])
          .map((part) => String(part?.text || "").trim())
          .filter(Boolean)
          .join("\n")
          .replace(/```json|```/g, "")
          .trim()
      : String(data?.choices?.[0]?.message?.content || "").replace(/```json|```/g, "").trim();

    const parsed = extractJsonObjectFromText(content);

    const category = normalizeCategory(parsed?.category) || fallbackCategory;
    const price_max = toIntegerOrNull(parsed?.price_max) || fallbackPriceMax;
    const specs = Array.isArray(parsed?.specs)
      ? Array.from(
          new Set(
            parsed.specs
              .map((item) => String(item || "").trim())
              .filter(Boolean)
          )
        )
      : fallbackSpecs;

    // structured attributes: prefer LLM fields if present, else fallback
    const storage_gb = parseStorageSpecToGB(parsed?.storage || parsed?.storage_gb || parsed?.storageGb) ||
      parseStorageSpecToGB((parsed?.specs || []).find((s) => /gb|tb/i.test(String(s || "")))) ||
      fallback_storage_gb;

    const ram_gb = parseRamToGB(parsed?.ram || parsed?.ram_gb || parsed?.ramGb) ||
      parseRamToGB((parsed?.specs || []).find((s) => /ram|gb/i.test(String(s || "")))) ||
      fallback_ram_gb;

    const camera_mp = parseCameraMp(parsed?.camera || parsed?.camera_mp || parsed?.cameraMp) ||
      parseCameraMp((parsed?.specs || []).find((s) => /mp\b/i.test(String(s || "")))) ||
      fallback_camera_mp;

    const battery_mah = parseBatteryToMah(parsed?.battery || parsed?.battery_mah || parsed?.batteryMah) ||
      parseBatteryToMah((parsed?.specs || []).find((s) => /m?ah\b/i.test(String(s || "")))) ||
      fallback_battery_mah;

    const screen_inch = parseScreenInch(parsed?.screen || parsed?.screen_inch || parsed?.screenInch) ||
      parseScreenInch((parsed?.specs || []).find((s) => /"|inch|in\b/i.test(String(s || "")))) ||
      fallback_screen_inch;

    const screen_context_raw = parsed?.screen_context || parsed?.screenContext || {};
    const screen_context = {
      role: normalizeAccentText(screen_context_raw?.role || parsed?.screen_role || parsed?.screenRole || fallback_screen_context.role || ""),
      tech: String(screen_context_raw?.tech || parsed?.screen_tech || parsed?.screenTech || fallback_screen_context.tech || "").trim(),
      resolution: String(screen_context_raw?.resolution || parsed?.screen_resolution || parsed?.screenResolution || fallback_screen_context.resolution || "").trim(),
      techs: Array.isArray(screen_context_raw?.techs) ? screen_context_raw.techs : (fallback_screen_context.techs || []),
    };

    const refresh_rate = parsed?.refresh_rate || parsed?.hz || parsed?.refresh || null;
    const parsed_refresh = parseRefreshRate(refresh_rate) || parseRefreshRate((parsed?.specs || []).find((s) => /hz\b/i.test(String(s || "")))) || fallback_refresh;

    return {
      category,
      price_max,
      specs,
      storage_gb,
      ram_gb,
      camera_mp,
      battery_mah,
      screen_inch,
      screen_context,
      refresh_rate: parsed_refresh,
    };
  } catch (error) {
    console.error("[LLM] parseDescriptionToSpecsWithMemory failed:", error.message);
    return {
      category: fallbackCategory,
      price_max: fallbackPriceMax,
      specs: fallbackSpecs,
      screen_context: fallback_screen_context,
    };
  }
}

function buildProductFilter(parsedContext) {
  const dbFilter = {
    stock: { $gt: 0 },
  };

  const category = normalizeCategory(parsedContext?.category);
  if (category) {
    // Try to match category but don't make it overly restrictive; allow brand/model matches too
    dbFilter.$or = [
      { category: new RegExp(`^${escapeRegExp(category)}`, "i") },
    ];
  }

  const priceMax = toIntegerOrNull(parsedContext?.price_max);
  if (priceMax) {
    dbFilter.finalPrice = { $lte: priceMax };
  }

  const specs = Array.isArray(parsedContext?.specs)
    ? parsedContext.specs.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  // Extract brand hints from category/specs when available (e.g., Apple, iPhone, Samsung)
  function extractBrandHints(ctx) {
    const known = ["apple", "iphone", "samsung", "xiaomi", "oppo", "vivo", "realme", "huawei", "oneplus", "sony", "nokia", "motorola", "google"];
    const found = new Set();
    const source = String(ctx?.category || "") + " " + (Array.isArray(ctx?.specs) ? ctx.specs.join(" ") : "");
    const normalized = normalizeText(source);
    for (const k of known) {
      if (normalized.includes(k)) {
        found.add(k);
      }
    }
    return Array.from(found);
  }

  const brandHints = extractBrandHints(parsedContext);
  if (brandHints.length > 0) {
    // Add brand/series/model/name patterns to OR list so brand-specific items surface
    dbFilter.$or = dbFilter.$or || [];
    for (const b of brandHints) {
      const re = new RegExp(escapeRegExp(b), "i");
      dbFilter.$or.push({ brand: re }, { series: re }, { model: re }, { name: re });
    }
  }

  // For each spec, require that at least one product field contains it (description OR name OR brand OR model OR variant)
  if (specs.length > 0) {
    dbFilter.$and = specs.map((spec) => {
      // If spec is a storage size (e.g., 256GB), match >= that capacity (256GB, 512GB, 1TB...)
      const storageGb = parseStorageSpecToGB(spec);
      let re = null;
      if (storageGb) {
        re = buildStorageRegexAtLeast(storageGb);
      }

      if (!re) {
        re = new RegExp(escapeRegExp(spec), "i");
      }

      return {
        $or: [
          { description: re },
          { name: re },
          { brand: re },
          { model: re },
          { variant: re },
          { sku: re },
        ],
      };
    });
  }

  // Apply structured attribute filters (match across description and name primarily)
  const structuredAnd = [];

  if (parsedContext?.storage_gb) {
    const re = buildStorageRegexAtLeast(parsedContext.storage_gb);
    if (re) {
      structuredAnd.push({ $or: [{ description: re }, { name: re }, { variant: re }, { sku: re }] });
    }
  }

  if (parsedContext?.ram_gb) {
    const re = buildRamRegexAtLeast(parsedContext.ram_gb);
    if (re) structuredAnd.push({ $or: [{ description: re }, { name: re }, { variant: re }] });
  }

  if (parsedContext?.camera_mp) {
    const re = buildCameraRegexAtLeast(parsedContext.camera_mp);
    if (re) structuredAnd.push({ $or: [{ description: re }, { name: re }] });
  }

  if (parsedContext?.battery_mah) {
    const re = buildBatteryRegexAtLeast(parsedContext.battery_mah);
    if (re) structuredAnd.push({ $or: [{ description: re }, { name: re }] });
  }

  if (parsedContext?.screen_inch) {
    const v = parsedContext.screen_inch;
    const re = new RegExp(`${String(v).replace(/\./g, "\\.")}\\s*(\"|inch|in)`, "i");
    structuredAnd.push({ $or: [{ description: re }, { name: re }] });
  }

  if (parsedContext?.screen_context?.role) {
    const roleRegex = buildScreenRoleRegex(parsedContext.screen_context.role);
    if (roleRegex) {
      structuredAnd.push({ $or: [{ description: roleRegex }, { name: roleRegex }] });
    }
  }

  const screenTechHint = String(parsedContext?.screen_context?.tech || "").trim();
  if (screenTechHint) {
    const techRegex = buildScreenTechRegex(screenTechHint);
    if (techRegex) {
      structuredAnd.push({ $or: [{ description: techRegex }, { name: techRegex }] });
    }
  }

  const screenTechs = Array.isArray(parsedContext?.screen_context?.techs)
    ? parsedContext.screen_context.techs
    : [];
  if (screenTechs.length > 1) {
    screenTechs.slice(1, 3).forEach((tech) => {
      const techRegex = buildScreenTechRegex(tech);
      if (techRegex) {
        structuredAnd.push({ $or: [{ description: techRegex }, { name: techRegex }] });
      }
    });
  }

  const screenResolutionHint = String(parsedContext?.screen_context?.resolution || "").trim();
  if (screenResolutionHint) {
    const resolutionRegex = new RegExp(escapeRegExp(screenResolutionHint), "i");
    structuredAnd.push({ $or: [{ description: resolutionRegex }, { name: resolutionRegex }] });
  }

  if (parsedContext?.refresh_rate && parsedContext.refresh_rate.min) {
    const re = buildHzRegexAtLeast(parsedContext.refresh_rate.min);
    if (re) structuredAnd.push({ $or: [{ description: re }, { name: re }] });
  }

  if (structuredAnd.length > 0) {
    dbFilter.$and = Array.isArray(dbFilter.$and) ? dbFilter.$and.concat(structuredAnd) : structuredAnd;
  }

  return dbFilter;
}

function buildAssistantHistoryEntry(parsedContext, products) {
  const productNames = Array.isArray(products)
    ? products.map((item) => String(item?.name || "").trim()).filter(Boolean)
    : [];

  return {
    role: "assistant",
    content: JSON.stringify(
      {
        category: parsedContext?.category || null,
        price_max: parsedContext?.price_max || null,
        specs: Array.isArray(parsedContext?.specs) ? parsedContext.specs : [],
        matched_products: productNames,
      },
      null,
      0
    ),
    at: new Date().toISOString(),
  };
}

async function searchProductByFullDescription(req, res) {
  try {
    const sessionId = String(req.body?.sessionId || "").trim();
    const descriptionText = String(req.body?.descriptionText || req.body?.message || "").trim();

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "Thiếu sessionId." });
    }

    if (!descriptionText) {
      return res.status(400).json({ success: false, message: "Thiếu văn bản mô tả." });
    }

    if (looksLikeCompareQuery(descriptionText)) {
      const result = await processChatMessage({
        message: descriptionText,
        sessionId,
        context: req.body?.context || {},
        history: [],
      });

      return res.json({
        success: true,
        routedTo: "compare",
        ...result,
      });
    }

    const history = await readHistoryFromRedis(sessionId);
    const parsedContext = await parseDescriptionToSpecsWithMemory(descriptionText, history);
    const dbFilter = buildProductFilter(parsedContext);

    const products = await Product.find(dbFilter)
      .select("_id name brand series model variant sku slug price finalPrice discountPercent description category image averageRating totalRatings totalViews stock")
      .limit(5)
      .lean();

    const nextHistory = [
      ...history,
      {
        role: "user",
        content: descriptionText,
        at: new Date().toISOString(),
      },
      buildAssistantHistoryEntry(parsedContext, products),
    ];

    await writeHistoryToRedis(sessionId, nextHistory);

    return res.status(200).json({
      success: true,
      sessionId,
      extractedData: parsedContext,
      products,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Không thể xử lý gợi ý theo mô tả lúc này.",
      error: error.message,
    });
  }
}

module.exports = {
  searchProductByFullDescription,
  parseDescriptionToSpecsWithMemory,
  buildProductFilter,
  getRedisClient,
  readHistoryFromRedis,
  writeHistoryToRedis,
  escapeRegExp,
};