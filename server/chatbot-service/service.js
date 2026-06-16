const mongoose = require("mongoose");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
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
  escapeRegExp,
  normalizeHintValue,
  normalizeConversationHistory,
  includesAny,
  isModelAnchorToken,
  cleanHtmlBreaks,
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
  
  let bareNumberMatch = null;
  if (!moneyMatch) {
    const m = text.match(/\b(\d{2,4})\b/);
    if (m) {
      const num = parseInt(m[1], 10);
      const hasPriceKeyword = /\b(tam|khoang|duoi|tren|gia|ngan\s*sach|tai\s*chinh|budget|price|under|above|around|toi\s*da|toi\s*thieu|nho\s*hon|lon\s*hon)\b/i.test(text) ||
                              (/\b(max|min)\b/i.test(text) && !/\bpro\s+max\b/i.test(text));
      
      if (hasPriceKeyword && num < 200) {
        bareNumberMatch = m;
      } else if (!hasPriceKeyword && num >= 3 && num <= 100) {
        const commonExclude = [8, 11, 12, 13, 14, 15, 16, 17, 24, 32, 64];
        if (!commonExclude.includes(num)) {
          bareNumberMatch = m;
        }
      }
    }
  }

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
    "phu kien": ["phu kien", "accessory", "tai nghe", "chuot", "ban phim", "webcam", "dong ho"],
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

  if (intent === "order_status") {
    return {
      title: "Tra cứu Đơn hàng",
      followUp: "Bạn vui lòng đăng nhập để mình hỗ trợ tra cứu đơn hàng gần nhất nhé.",
      items: [],
    };
  }

  if (intent === "add_to_cart") {
    return {
      title: "Thêm vào Giỏ hàng",
      followUp: "Bạn muốn mua sản phẩm nào? Hãy chọn sản phẩm hoặc mô tả tên sản phẩm để mình thêm vào giỏ nhé.",
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

  let title = budgetText
    ? `Với ngân sách ${budgetText}, bạn có thể tham khảo các ${categoryLabel} sau:`
    : `Một vài ${categoryLabel} phù hợp cho bạn:`;

  if (options?.sortConstraint === "rating") {
    title = `Danh sách các ${categoryLabel} được đánh giá cao nhất tại hệ thống:`;
  } else if (options?.sortConstraint === "sales") {
    title = `Danh sách các ${categoryLabel} bán chạy nhất hiện nay:`;
  }

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

function buildQuickReplies(intent, options = {}) {
  if (intent === "policy") {
    return ["Phí vận chuyển", "Thời gian giao hàng", "Chính sách đổi trả"];
  }

  const sort = options?.sortConstraint || null;

  if (sort === "rating") {
    return ["Điện thoại đánh giá cao", "Laptop đánh giá cao", "Bán chạy nhất"];
  }
  
  if (sort === "sales") {
    return ["Điện thoại bán chạy", "Laptop bán chạy", "Đánh giá cao"];
  }

  return ["Ngân sách dưới 5 triệu", "Đánh giá cao", "Bán chạy nhất"];
}

async function maybeGenerateLlmReply({ message, intent, recommendedProducts, history }) {
  return llmHelper.maybeGenerateLlmReply({ message, intent, recommendedProducts, history });
}

async function maybeGenerateProductConsultLlmReply(product, specs, history = []) {
  const enabled = String(process.env.CHATBOT_LLM_ENABLED || "").toLowerCase() === "true";
  const apiUrl = String(process.env.CHATBOT_LLM_API_URL || "").trim();
  const apiKey = String(process.env.CHATBOT_LLM_API_KEY || "").trim();
  const model = String(process.env.CHATBOT_LLM_MODEL || "gpt-4.1-mini").trim();

  if (!enabled || !apiUrl || !apiKey) {
    return null;
  }

  const isGemini = apiUrl.includes("generativelanguage.googleapis.com");
  const systemPrompt = "Bạn là chuyên gia tư vấn công nghệ chuyên nghiệp. Hãy viết một đoạn nhận xét/tư vấn ngắn gọn (khoảng 3-4 câu) về cấu hình và hiệu năng của sản phẩm dưới đây bằng tiếng Việt. Tập trung vào đối tượng sử dụng phù hợp (học sinh, game thủ, văn phòng, v.v.). Trả lời tự nhiên, thân thiện. Tuyệt đối không sử dụng bất kỳ thẻ HTML nào bao gồm cả thẻ '<br>'. Đối với laptop, hãy sử dụng thông tin từ đối tượng 'specs' (ví dụ specs.ram, specs.rom, specs.chip, specs.gpu) để nhận xét, tránh nhầm lẫn dung lượng bộ nhớ card đồ họa GPU (ví dụ 4GB VRAM) với dung lượng RAM của hệ thống (ví dụ 16GB RAM).";
  
  const payload = {
    product: {
      name: product.name,
      price: product.price,
      finalPrice: product.finalPrice,
      brand: product.brand,
      description: product.description,
    },
    specs
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.CHATBOT_LLM_TIMEOUT_MS || 10000));

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
                parts: [{ text: JSON.stringify(payload, null, 2) }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
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
          temperature: 0.7,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(payload, null, 2) },
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

function buildSingleProductSpecsMarkdown(product, extractComparisonSpecSummary, llmComment = null) {
  const specs = extractComparisonSpecSummary(product);
  const escapePipe = (str) => String(str || "").replace(/\|/g, "\\|");
  
  if (specs.isLaptop) {
    const laptopComment = llmComment || `Thiết bị sở hữu bộ vi xử lý **${specs.chip}** cùng **${specs.ram} RAM** và card đồ họa **${specs.gpu}**, mang lại hiệu năng mạnh mẽ vượt trội cho mọi tác vụ học tập, văn phòng và đồ họa, giải trí. Thời lượng pin **${specs.battery}** cùng trọng lượng chỉ **${specs.weight}** mang lại sự cơ động cao khi di chuyển. Máy được trang bị ổ cứng **${specs.rom}** siêu tốc và chạy trên hệ điều hành **${specs.os}** mượt mà.`;
    return [
      `### 📋 Thông số kỹ thuật chi tiết của ${product.name}`,
      `| Đặc tính | Chi tiết |`,
      `| --- | --- |`,
      `| **Giá bán** | **${escapePipe(specs.finalPrice)}** |`,
      `| **CPU (Vi xử lý)** | ${escapePipe(specs.chip)} |`,
      `| **Card đồ họa (GPU)** | ${escapePipe(specs.gpu)} |`,
      `| **Bộ nhớ RAM** | ${escapePipe(specs.ram)} |`,
      `| **Ổ cứng (ROM)** | ${escapePipe(specs.rom)} |`,
      `| **Màn hình** | ${escapePipe(specs.screen)} |`,
      `| **Dung lượng Pin** | ${escapePipe(specs.battery)} |`,
      `| **Trọng lượng** | ${escapePipe(specs.weight)} |`,
      `| **Hệ điều hành** | ${escapePipe(specs.os)} |`,
      `| **Tình trạng kho** | ${product.stock > 0 ? `Còn hàng (${product.stock} máy)` : "Hết hàng"} |`,
      `\n**💡 Nhận xét chi tiết**: ${laptopComment}`
    ].join("\n");
  }

  const comment = llmComment || `Thiết bị sở hữu dòng chip **${specs.chip}** cùng **${specs.ram} RAM**, mang lại hiệu năng cực kỳ mạnh mẽ, xử lý mượt mà mọi tác vụ từ văn phòng giải trí đến chơi game đồ họa cao. Dung lượng pin **${specs.battery}** đảm bảo thời gian hoạt động thoải mái cả ngày dài. Hệ thống camera **${specs.camera}** cho chất lượng chụp ảnh sắc nét, cực kỳ phù hợp cho người dùng yêu thích quay phim chụp hình.`;
  
  return [
    `### 📋 Thông số kỹ thuật chi tiết của ${product.name}`,
    `| Đặc tính | Chi tiết |`,
    `| --- | --- |`,
    `| **Giá bán** | **${escapePipe(specs.finalPrice)}** |`,
    `| **Chip xử lý** | ${escapePipe(specs.chip)} |`,
    `| **Bộ nhớ RAM** | ${escapePipe(specs.ram)} |`,
    `| **Bộ nhớ trong (ROM)** | ${escapePipe(specs.rom)} |`,
    `| **Màn hình** | ${escapePipe(specs.screen)} |`,
    `| **Hệ thống Camera** | ${escapePipe(specs.camera)} |`,
    `| **Dung lượng Pin** | ${escapePipe(specs.battery)} |`,
    `| **Tình trạng kho** | ${product.stock > 0 ? `Còn hàng (${product.stock} máy)` : "Hết hàng"} |`,
    `\n**💡 Nhận xét chi tiết**: ${comment}`
  ].join("\n");
}

async function processChatMessage({ message, sessionId, context = {}, userId = null, history = [] }) {
  const session = getOrCreateSession(sessionId);
  const plainMessage = String(message || "").trim();
  
  const normMsgForSort = normalizeText(plainMessage);
  let sortConstraint = null;
  if (includesAny(normMsgForSort, ["danh gia cao", "top rated", "highly rated", "nhieu sao", "sao cao", "danh gia tot"])) {
    sortConstraint = "rating";
  } else if (includesAny(normMsgForSort, ["ban chay nhat", "best seller", "ban chay", "mua nhieu", "nhieu nguoi mua", "hot"])) {
    sortConstraint = "sales";
  }

  const providedHistory = normalizeConversationHistory(history, 6);
  const historyContext = providedHistory.length > 0 ? providedHistory : session.history;

  const normalizedMsg = normalizeText(plainMessage);
  const specsKeywords = [
    "tu van chi tiet cau hinh",
    "tu van chi tiet",
    "cau hinh",
    "thong so",
    "thong tin",
    "chi tiet san pham",
    "chi tiet may",
    "nhan xet",
    "danh gia"
  ];
  const isSpecsQuery = specsKeywords.some(keyword => normalizedMsg.includes(keyword)) && !normalizedMsg.includes("danh gia cao");
  if (isSpecsQuery) {
    let productObj = null;

    // First try to extract by hidden database ID: [Mã: ID] or [ID: ID]
    const idMatch = plainMessage.match(/\[Mã:\s*([a-f0-9]{24})\]/i) || plainMessage.match(/\[ID:\s*([a-f0-9]{24})\]/i);
    if (idMatch) {
      const productId = idMatch[1];
      productObj = await Product.findById(productId);
    }

    // Fallback to name search if product not found by ID
    if (!productObj) {
      let searchName = plainMessage
        .replace(/\[Mã:\s*[a-f0-9]{24}\]/gi, "")
        .replace(/\[ID:\s*[a-f0-9]{24}\]/gi, "")
        .replace(/tư vấn chi tiết cấu hình sản phẩm/gi, "")
        .replace(/tu van chi tiet cau hinh san pham/gi, "")
        .replace(/tư vấn chi tiết cấu hình/gi, "")
        .replace(/tu van chi tiet cau hinh/gi, "")
        .replace(/cấu hình sản phẩm/gi, "")
        .replace(/cau hinh san pham/gi, "")
        .replace(/cấu hình/gi, "")
        .replace(/cau hinh/gi, "")
        .replace(/thông số kỹ thuật/gi, "")
        .replace(/thong so ky thuat/gi, "")
        .replace(/thông số sản phẩm/gi, "")
        .replace(/thong so san pham/gi, "")
        .replace(/thông số/gi, "")
        .replace(/thong so/gi, "")
        .replace(/thông tin sản phẩm/gi, "")
        .replace(/thong tin san pham/gi, "")
        .replace(/thông tin/gi, "")
        .replace(/thong tin/gi, "")
        .replace(/chi tiết sản phẩm/gi, "")
        .replace(/chi tiet san pham/gi, "")
        .replace(/chi tiết/gi, "")
        .replace(/chi tiet/gi, "")
        .replace(/nhận xét/gi, "")
        .replace(/nhan xet/gi, "")
        .replace(/đánh giá/gi, "")
        .replace(/danh gia/gi, "")
        .trim();

      searchName = searchName
        .replace(/^(của|cua|cho|sản phẩm|san pham|máy tính xách tay|may tinh xach tay|máy tính|may tinh|máy|may|thiết bị|thiet bi|laptop|macbook|điện thoại|dien thoai|phone)\s+/gi, "")
        .trim();

      if (searchName) {
        productObj = await Product.findOne({ name: { $regex: new RegExp(escapeRegExp(searchName), "i") } });
        if (!productObj) {
          const tokens = searchName.split(/\s+/).filter(w => w.length >= 3);
          if (tokens.length > 0) {
            const regexQuery = tokens.map(t => escapeRegExp(t)).join('.*');
            productObj = await Product.findOne({ name: { $regex: new RegExp(regexQuery, "i") } });
          }
        }
      }
    }

    if (productObj) {
      const compareService = require("./compare");
      const specs = compareService.extractComparisonSpecSummary(productObj);
      let llmComment = null;
      try {
        llmComment = await maybeGenerateProductConsultLlmReply(productObj, specs, historyContext);
      } catch (_) {
        llmComment = null;
      }

      const specsMarkdown = cleanHtmlBreaks(buildSingleProductSpecsMarkdown(productObj, compareService.extractComparisonSpecSummary, llmComment));

      session.history.push({ role: "user", content: plainMessage, at: new Date().toISOString() });
      session.history.push({
        role: "assistant",
        content: specsMarkdown,
        products: [
          {
            _id: productObj._id,
            name: productObj.name,
            category: productObj.category,
            price: productObj.price,
            finalPrice: productObj.finalPrice || productObj.price,
            discountPercent: productObj.discountPercent || 0,
            image: productObj.image,
            brand: productObj.brand,
            model: productObj.model,
            variant: productObj.variant,
            stock: productObj.stock,
            averageRating: productObj.averageRating || 0,
            totalPurchases: productObj.totalPurchases || 0,
            reason: productObj.reason,
          }
        ],
        at: new Date().toISOString()
      });
      session.history = session.history.slice(-MAX_HISTORY);
      session.updatedAt = Date.now();

      return {
        sessionId: session.id,
        intent: "product_consult",
        reply: specsMarkdown,
        replyStructured: {
          title: `Chi tiết cấu hình: ${productObj.name}`,
          followUp: `Bạn có muốn mình tư vấn thêm hoặc so sánh sản phẩm này với dòng khác không?`,
          items: [{ name: productObj.name, price: formatVnd(productObj.price) }]
        },
        products: [productObj],
        quickReplies: ["So sánh sản phẩm này", "Thêm vào giỏ hàng", "Xem chính sách bảo hành"],
        metadata: {
          llmUsed: Boolean(llmComment),
          productCount: 1,
          specsConsult: true
        }
      };
    }
  }

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
      (intent === "policy" || intent === "order_status")
        ? []
        : await recommenderService.findRecommendedProducts(enrichedMessage, context, {
          sessionId: session.id,
          userId,
          llmQueryHints,
          memory,
          mlSignal,
          conversationFocus,
          sortConstraint,
        });
  }

  const shouldUseLlm = intent !== "compare";
  let llmReply = null;
  let toolCall = null;
  let cartUpdated = false;

  if (shouldUseLlm) {
    const llmResult = await maybeGenerateLlmReply({
      message: plainMessage,
      intent,
      recommendedProducts,
      history: session.history,
    });

    if (llmResult) {
      llmReply = llmResult.text;
      toolCall = llmResult.toolCall;
    }
  }

  if (!toolCall) {
    if (intent === "order_status") {
      toolCall = {
        name: "getOrderStatus",
        args: {
          orderId: plainMessage.match(/[a-fA-F0-9]{24}/)?.[0] || null
        }
      };
    } else if (intent === "add_to_cart") {
      let queryName = plainMessage
        .replace(/thêm vào giỏ hàng/gi, "")
        .replace(/them vao gio hang/gi, "")
        .replace(/thêm vào giỏ/gi, "")
        .replace(/them vao gio/gi, "")
        .replace(/thêm giỏ hàng/gi, "")
        .replace(/them gio hang/gi, "")
        .replace(/cho vào giỏ/gi, "")
        .replace(/cho vao gio/gi, "")
        .replace(/thêm điện thoại/gi, "")
        .replace(/them dien thoai/gi, "")
        .replace(/thêm/gi, "")
        .replace(/them/gi, "")
        .replace(/vào giỏ hàng/gi, "")
        .replace(/vao gio hang/gi, "")
        .replace(/giỏ hàng/gi, "")
        .replace(/gio hang/gi, "")
        .trim();

      if (queryName.length >= 3) {
        toolCall = {
          name: "addToCart",
          args: {
            productId: queryName,
            quantity: 1
          }
        };
      }
    }
  }

  if (toolCall) {
    const statusMap = {
      pending: "Đang chờ xử lý",
      confirmed: "Đã xác nhận",
      shipping: "Đang giao hàng",
      delivered: "Đã giao hàng thành công",
      cancelled: "Đã hủy",
    };

    if (toolCall.name === "addToCart") {
      const { productId, quantity = 1 } = toolCall.args;
      if (!userId) {
        llmReply = "Bạn cần đăng nhập để thực hiện thêm sản phẩm vào giỏ hàng.";
      } else {
        let productObj = null;
        if (productId && mongoose.Types.ObjectId.isValid(productId)) {
          productObj = await Product.findById(productId);
        }
        if (!productObj && productId) {
          productObj = await Product.findOne({ name: { $regex: new RegExp(escapeRegExp(productId), "i") } });
          if (!productObj) {
            const words = productId.split(/\s+/).filter((w) => w.length >= 3);
            if (words.length > 0) {
              const regexQuery = words.map(w => escapeRegExp(w)).join('.*');
              productObj = await Product.findOne({ name: { $regex: new RegExp(regexQuery, 'i') } });
            }
          }
          
          // Typo/abbreviation fallback using recommender LTR scoring:
          if (!productObj) {
            const recommenderService = require("./recommender");
            const recommended = await recommenderService.findRecommendedProducts(productId);
            if (recommended && recommended.length > 0) {
              productObj = await Product.findById(recommended[0]._id);
            }
          }
        }

        if (!productObj) {
          llmReply = "Không tìm thấy sản phẩm này trong hệ thống.";
        } else if (productObj.stock < quantity) {
          llmReply = `Sản phẩm ${productObj.name} hiện chỉ còn ${productObj.stock} sản phẩm trong kho, không đủ số lượng bạn yêu cầu.`;
        } else {
          const matchedProductId = productObj._id;
          let cart = await Cart.findOne({ user: userId });
          if (!cart) {
            cart = new Cart({ user: userId, items: [] });
          }
          const existingItemIndex = cart.items.findIndex(
            (item) => String(item.product) === String(matchedProductId)
          );
          if (existingItemIndex > -1) {
            cart.items[existingItemIndex].quantity += quantity;
          } else {
            cart.items.push({ product: matchedProductId, quantity });
          }
          await cart.save();
          llmReply = `Đã thêm thành công ${quantity} sản phẩm ${productObj.name} vào giỏ hàng của bạn.`;
          cartUpdated = true;
        }
      }
    } else if (toolCall.name === "getOrderStatus") {
      if (!userId) {
        llmReply = "Bạn cần đăng nhập để tra cứu trạng thái đơn hàng.";
      } else {
        const { orderId } = toolCall.args;
        let order = null;

        if (orderId) {
          const validObjectId = safeObjectId(orderId);
          if (validObjectId) {
            order = await Order.findOne({ _id: validObjectId, user: userId }).lean();
          }
          if (!order) {
            order = await Order.findOne({ user: userId }).sort({ createdAt: -1 }).lean();
            if (order) {
              llmReply = `Không tìm thấy đơn hàng với mã "${orderId}". Dưới đây là thông tin đơn hàng mới nhất của bạn:\n\n`;
            }
          }
        } else {
          order = await Order.findOne({ user: userId }).sort({ createdAt: -1 }).lean();
        }

        if (!order) {
          llmReply = "Bạn chưa có đơn hàng nào trên hệ thống của chúng tôi.";
        } else {
          const statusText = statusMap[order.status] || order.status;
          const itemsText = order.orderItems
            .map((item) => `- ${item.name} (x${item.quantity})`)
            .join("\n");
          const dateText = new Date(order.createdAt).toLocaleDateString("vi-VN");

          let replyParts = [
            `Mã đơn hàng: ${order._id}`,
            `Ngày đặt: ${dateText}`,
            `Trạng thái: **${statusText}**`,
            `Tổng tiền: ${formatVnd(order.totalPrice)}`,
            `Sản phẩm trong đơn hàng:\n${itemsText}`,
          ];

          if (order.status === "cancelled" && order.cancelledReason) {
            replyParts.push(`Lý do hủy: ${order.cancelledReason}`);
          }

          if (orderId && order._id.toString() === orderId) {
            llmReply = `Thông tin đơn hàng của bạn:\n\n${replyParts.join("\n")}`;
          } else {
            llmReply = (llmReply || "") + `Đơn hàng mới nhất của bạn:\n\n${replyParts.join("\n")}`;
          }
        }
      }
    }
  } else if (llmReply && (intent === "product_search" || intent === "product_consult") && recommendedProducts.length > 0) {
    const replyNormalized = normalizeText(llmReply);
    const hasProductMention = recommendedProducts.some((p) => {
      const tokens = tokenize(p.name).filter((t) => t.length >= 4);
      return tokens.some((t) => replyNormalized.includes(t));
    });
    if (!hasProductMention && llmReply.length > 80) {
      llmReply = null;
    }
  }

  // Build structured reply (new format)
  const ruleReplyStructured = buildRuleReply(intent, recommendedProducts, {
    priceConstraint,
    categoryConstraint: inferredCategory || memory?.category || "",
    conversationFocus,
    mlSignal,
    sortConstraint,
  });
  const replyText = cleanHtmlBreaks(llmReply || formatStructuredReply(ruleReplyStructured));
  const quickReplies = buildQuickReplies(intent, {
    sortConstraint,
    categoryConstraint: inferredCategory || memory?.category || "",
  });

  session.history.push({ role: "user", content: plainMessage, at: new Date().toISOString() });
  session.history.push({
    role: "assistant",
    content: replyText,
    products: recommendedProducts.slice(0, 5).map((item) => ({
      _id: item._id,
      name: item.name,
      category: item.category,
      price: item.price,
      finalPrice: item.finalPrice || item.price,
      discountPercent: item.discountPercent || 0,
      image: item.image,
      brand: item.brand,
      model: item.model,
      variant: item.variant,
      stock: item.stock,
      averageRating: item.averageRating || 0,
      totalPurchases: item.totalPurchases || 0,
      reason: item.reason,
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
    cartUpdated,
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
