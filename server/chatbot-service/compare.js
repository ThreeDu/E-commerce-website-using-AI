const Product = require('../models/Product');

// Minimal helper copies used by compare module (kept self-contained)
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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeHintValue(value) {
  const normalized = normalizeText(value);
  return normalized || "";
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function inferBrandHint(message) {
  const KNOWN_BRAND_HINTS = ["iphone", "samsung", "xiaomi", "oppo", "vivo", "realme", "macbook", "ipad"];
  const normalized = normalizeText(message);
  for (const brand of KNOWN_BRAND_HINTS) {
    if (normalized.includes(brand)) {
      return brand;
    }
  }
  return "";
}

function getEffectivePrice(product) {
  const originalPrice = Number(product?.price || 0);
  const discountedPrice = Number(product?.finalPrice || 0);

  if (discountedPrice > 0) {
    return discountedPrice;
  }

  return originalPrice > 0 ? originalPrice : 0;
}

function formatVnd(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "-";
  }

  return `${numeric.toLocaleString("vi-VN")} VND`;
}

function buildStorageRegexAtLeast(minGb) {
  const canonical = [32, 64, 128, 256, 512, 1024, 2048];
  const allowed = canonical.filter((value) => value >= Math.max(0, Math.trunc(minGb || 0)));
  if (allowed.length === 0) {
    return null;
  }

  const pattern = allowed
    .map((value) => (value >= 1024 ? `${value / 1024}TB` : `${value}GB`))
    .map((value) => value.replace(/\s+/g, "\\s*"))
    .join("|");

  return new RegExp(pattern, "i");
}

function buildRamRegexAtLeast(minGb) {
  const canonical = [2, 3, 4, 6, 8, 12, 16, 24, 32, 64];
  const allowed = canonical.filter((value) => value >= Math.max(0, Math.trunc(minGb || 0)));
  if (allowed.length === 0) {
    return null;
  }

  return new RegExp(allowed.map((value) => `${value}GB`).join("|"), "i");
}

function buildBatteryRegexAtLeast(minMah) {
  const canonical = [2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000];
  const allowed = canonical.filter((value) => value >= Math.max(0, Math.trunc(minMah || 0)));
  if (allowed.length === 0) {
    return null;
  }

  return new RegExp(allowed.map((value) => `${value}mAh`).join("|"), "i");
}

function buildScreenRoleRegex(role) {
  const normalizedRole = normalizeText(role);
  if (!normalizedRole) {
    return null;
  }

  if (normalizedRole === "main") {
    return /m[aàáảãạâă]n\s*h[iìíỉĩị]nh\s*ch[iìíỉĩị]nh|main screen|primary screen/i;
  }

  if (normalizedRole === "cover") {
    return /m[aàáảãạâă]n\s*h[iìíỉĩị]nh\s*(ph[uùúủũụ]|ngo[aàáảãạâă]i)|cover screen|secondary screen|outer screen/i;
  }

  return null;
}

function buildScreenTechRegex(value) {
  const normalized = normalizeText(value).replace(/\s+/g, " ").trim();
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

function extractChip(rawText) {
  const chipRegex = /(?:chip\s+xử\s+lý|chip\s+vi\s+xử\s+lý|vi\s+xử\s+lý|vi\s+xu\s+ly|chipset|chip|cpu)\s*:?\s*([^.,\n()]+)/i;
  const match = rawText.match(chipRegex);
  
  if (match) {
    let chip = match[1].trim();
    chip = chip.split(/\(|của|cua|công|cong|mạnh|manh|siêu|sieu|mang|giúp|giup|tối|toi|cho|được|duoc|\n|\.|\,/i)[0].trim();
    if (chip.length > 1) {
      return chip;
    }
  }
  
  const knownChipMatch = rawText.match(/\b(A\d{2}\s*Pro|A\d{2}\s*Bionic|A\d{2}|Apple\s*M\d\s*(?:Pro|Max|Ultra)?|Snapdragon\s*\d+\s*Gen\s*\d+|Snapdragon\s*\d+|Dimensity\s*\d+|Exynos\s*\d+|Intel\s*Core\s*i\d|Ryzen\s*\d)\b/i);
  if (knownChipMatch) {
    return knownChipMatch[1].trim();
  }
  
  return "Theo hãng công bố";
}

function extractCamera(rawText) {
  const rearRegex = /(?:camera\s+sau|camera\s+chinh|camera\s+chính|cụm\s+\d+\s+camera|camera\s+sau\s+chính|camera\s+sau\s+phụ)\s*:?\s*([^.\n]+)/i;
  const frontRegex = /(?:camera\s+truoc|camera\s+trước|camera\s+selfie|selfie)\s*:?\s*([^.\n]+)/i;
  
  const rearMatch = rawText.match(rearRegex);
  const frontMatch = rawText.match(frontRegex);
  
  let rearMp = [];
  let frontMp = [];
  
  if (rearMatch) {
    rearMp = Array.from(rearMatch[1].matchAll(/\b(\d{1,3})\s*(?:MP|megapixel)\b/gi)).map(m => `${m[1]}MP`);
  }
  if (frontMatch) {
    frontMp = Array.from(frontMatch[1].matchAll(/\b(\d{1,3})\s*(?:MP|megapixel)\b/gi)).map(m => `${m[1]}MP`);
  }
  
  if (rearMp.length === 0 && frontMp.length === 0) {
    const globalMp = Array.from(rawText.matchAll(/\b(\d{1,3})\s*(?:MP|megapixel)\b/gi)).map(m => `${m[1]}MP`);
    if (globalMp.length > 0) {
      return globalMp.join(" + ");
    }
    return "Theo hãng công bố";
  }
  
  const parts = [];
  if (rearMp.length > 0) {
    parts.push(`Sau: ${rearMp.join(" + ")}`);
  } else if (rearMatch) {
    parts.push(`Sau: ${rearMatch[1].split(/[(),:]/)[0].trim()}`);
  }
  
  if (frontMp.length > 0) {
    parts.push(`Trước: ${frontMp.join(" + ")}`);
  } else if (frontMatch) {
    parts.push(`Trước: ${frontMatch[1].split(/[(),:]/)[0].trim()}`);
  }
  
  return parts.join(" | ");
}

function extractComparisonSpecSummary(product) {
  const rawText = [product?.name, product?.variant, product?.model, product?.series, product?.description]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const ramPairMatch = rawText.match(/\b(\d{1,2})\s*GB\s*\/\s*(\d{2,4})\s*(GB|TB)\b/i);
  const ramMatch = rawText.match(/\b(\d{1,2})\s*GB\s*(?:RAM|LPDDR|DDR)?\b/i);
  const storageMatches = Array.from(rawText.matchAll(/\b(\d{2,4})\s*(GB|TB)\b/gi));
  const storageMatch = ramPairMatch || storageMatches[storageMatches.length - 1] || null;
  const screenSizeMatch = rawText.match(/\b(\d+(?:[.,]\d+)?)\s*(?:"|inch|in)\b/i);
  const screenTechMatch = rawText.match(/\b(dynamic amoled 2x|dynamic amoled|amoled 2x|super retina xdr|super amoled|amoled|oled|ltpo|ltps|retina xdr|retina|poled|p-oled|p oled|lcd)\b/i);
  const batteryMatch = rawText.match(/\b(\d{3,5})\s*m?a?h\b/i);
  const priceValue = Number(getEffectivePrice(product) || 0);

  const formatFriendlyValue = (value, fallback = "Đang cập nhật") => {
    const text = String(value || "").trim();
    return text && text !== "-" ? text : fallback;
  };

  let ram = "-";
  if (ramPairMatch) {
    ram = `${Number(ramPairMatch[1])}GB`;
  } else if (ramMatch) {
    ram = `${Number(ramMatch[1])}GB`;
  }

  let rom = "-";
  if (ramPairMatch) {
    rom = `${Number(ramPairMatch[2])}${String(ramPairMatch[3] || "GB").toUpperCase()}`;
  } else if (storageMatch) {
    const storageValue = Number(storageMatch[1]);
    if (Number.isFinite(storageValue) && storageValue > 0) {
      rom = `${storageValue}${String(storageMatch[2] || "GB").toUpperCase()}`;
    }
  }

  const screenParts = [];
  if (screenSizeMatch) {
    screenParts.push(`${String(screenSizeMatch[1]).replace(/\.$/, "")}\"`);
  }
  if (screenTechMatch) {
    screenParts.push(String(screenTechMatch[1]).toUpperCase());
  }

  return {
    finalPrice: formatVnd(priceValue),
    chip: formatFriendlyValue(extractChip(rawText), "Theo hãng công bố"),
    ram: formatFriendlyValue(ram, "Theo hãng công bố"),
    rom: formatFriendlyValue(rom, "Đang cập nhật"),
    screen: formatFriendlyValue(screenParts.length > 0 ? screenParts.join(" ") : "", "Đang cập nhật"),
    camera: formatFriendlyValue(extractCamera(rawText), "Theo hãng công bố"),
    battery: formatFriendlyValue(batteryMatch ? `${Number(batteryMatch[1])} mAh` : "", "Theo hãng công bố"),
  };
}

function buildCompareMarkdownTable(products) {
  const rows = Array.isArray(products) ? products : [];
  if (rows.length === 0) return "";

  const headers = ["| Đặc tính", ...rows.map(p => String(p?.name || "-").replace(/\|/g, "\\|"))];
  const alignments = ["| ---", ...rows.map(() => "---")];

  const specRows = [
    { label: "**Giá bán**", key: "finalPrice" },
    { label: "**Chip**", key: "chip" },
    { label: "**RAM**", key: "ram" },
    { label: "**ROM**", key: "rom" },
    { label: "**Màn hình**", key: "screen" },
    { label: "**Camera**", key: "camera" },
    { label: "**Pin**", key: "battery" }
  ];

  const summaries = rows.map(p => extractComparisonSpecSummary(p));

  const lines = [
    headers.join(" | ") + " |",
    alignments.join(" | ") + " |"
  ];

  specRows.forEach(spec => {
    const cells = [spec.label];
    summaries.forEach(summary => {
      cells.push(summary[spec.key] || "-");
    });
    lines.push("| " + cells.join(" | ") + " |");
  });

  return lines.join("\n");
}

function buildCompareFallbackComment(product1, product2) {
  const summary1 = extractComparisonSpecSummary(product1);
  const summary2 = extractComparisonSpecSummary(product2);
  const price1 = getEffectivePrice(product1);
  const price2 = getEffectivePrice(product2);
  const priceDelta = Math.abs(price1 - price2);

  const comments = [];
  if (price1 !== price2) {
    comments.push(
      price1 < price2
        ? `${product1.name} đang có giá tốt hơn, tiết kiệm khoảng ${formatVnd(priceDelta)} so với ${product2.name}.`
        : `${product2.name} đang có giá tốt hơn, tiết kiệm khoảng ${formatVnd(priceDelta)} so với ${product1.name}.`
    );
  }

  if (summary1.ram !== summary2.ram) {
    comments.push(`RAM đang là điểm khác biệt nổi bật: ${product1.name} hiển thị ${summary1.ram}, còn ${product2.name} là ${summary2.ram}.`);
  }

  if (summary1.rom !== summary2.rom) {
    comments.push(`ROM của hai máy cũng lệch nhau đáng kể: ${summary1.rom} so với ${summary2.rom}.`);
  }

  if (comments.length === 0) {
    comments.push("Hai sản phẩm khá sát nhau, bạn nên ưu tiên hệ sinh thái, thói quen dùng và mức giá thực tế.");
  }

  return comments.slice(0, 2).join(" ");
}

function buildCompareReply(product1, product2) {
  return buildCompareMarkdownTable([product1, product2]);
}

function parseCompareIntentFromText(message, history = []) {
  const normalized = normalizeText(message);
  const compareSignals = ["so sanh", "compare", "giua", "vs", "voi nhau", "so voi"];
  let raw = String(message || "").trim();
  raw = raw.replace(/^\s*(so s[aă]nh|so sanh|compare)\s*/i, "");
  raw = raw.replace(/^\s*(giua|between)\s*/i, "");

  const separators = /\s+(?:v[àa]|va|vs\.?|v\.s\.?|với|with|and|\/|so voi)\s+/i;
  const parts = raw
    .split(separators)
    .map((item) => item.replace(/[?.!]+$/g, "").trim())
    .filter(Boolean);

  const hasCompareSignal = compareSignals.some((signal) => normalized.includes(signal));
  const isProductLikePart = (part) => {
    const normalizedPart = normalizeText(part);
    if (!normalizedPart) {
      return false;
    }

    const productTokens = [
      "iphone",
      "samsung",
      "galaxy",
      "xiaomi",
      "oppo",
      "vivo",
      "realme",
      "ipad",
      "macbook",
      "pro",
      "max",
      "ultra",
      "plus",
      "mini",
      "fold",
      "flip",
    ];

    if (includesAny(normalizedPart, productTokens)) {
      return true;
    }

    if (/\b\d{1,2}\s*gb\s*\/\s*\d{2,4}\s*(gb|tb)\b/.test(normalizedPart)) {
      return true;
    }

    if (/\b\d{2,4}\s*(gb|tb)\b/.test(normalizedPart)) {
      return true;
    }

    return /\b\d{2,3}\s*hz\b/.test(normalizedPart) || /\b\d{3,5}\s*mah\b/.test(normalizedPart);
  };

  const hasProductLikeParts = parts.slice(0, 2).every((part) => isProductLikePart(part));

  if (parts.length >= 2 && (hasCompareSignal || hasProductLikeParts)) {
    return {
      intent: "compare",
      product_1: { name: parts[0], brand: inferBrandHint(parts[0]) || "" },
      product_2: { name: parts[1], brand: inferBrandHint(parts[1]) || "" },
    };
  }

  const vsMatch = raw.match(/^(.+?)\s+(?:vs\.?|v\.s\.?|với|va|và|and)\s+(.+)$/i);
  if (vsMatch && (hasCompareSignal || hasProductLikeParts)) {
    return {
      intent: "compare",
      product_1: { name: vsMatch[1].trim(), brand: inferBrandHint(vsMatch[1]) || "" },
      product_2: { name: vsMatch[2].trim(), brand: inferBrandHint(vsMatch[2]) || "" },
    };
  }

  const lastUserMessage = [...history].reverse().find((item) => item?.role === "user" && String(item?.content || "").trim());
  if (lastUserMessage) {
    const lastRaw = String(lastUserMessage.content || "").trim();
    const lastParts = lastRaw
      .replace(/^\s*(so s[aă]nh|so sanh|compare)\s*/i, "")
      .split(separators)
      .map((item) => item.replace(/[?.!]+$/g, "").trim())
      .filter(Boolean);

    const lastHasCompareSignal = compareSignals.some((signal) => normalizeText(lastRaw).includes(signal));
    const lastHasProductLikeParts = lastParts.slice(0, 2).every((part) => isProductLikePart(part));

    if (lastParts.length >= 2 && (lastHasCompareSignal || lastHasProductLikeParts)) {
      return {
        intent: "compare",
        product_1: { name: lastParts[0], brand: inferBrandHint(lastParts[0]) || "" },
        product_2: { name: lastParts[1], brand: inferBrandHint(lastParts[1]) || "" },
      };
    }
  }

  return null;
}

async function maybeParseCompareIntentWithLlm(message, history = []) {
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
    "Extract compare intent as strict JSON only.",
    "Return one JSON object with keys: intent, product_1, product_2.",
    "intent must be compare.",
    "Each product object must contain: name, brand.",
    "Use null or empty string if a field is unknown.",
    "Do not include markdown or explanation.",
    `Conversation history:\n${history ? history.map(h=>`${h.role}: ${h.content}`).join('\n') : ''}`,
    `User message: ${String(message || "")}`,
  ].join("\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.CHATBOT_LLM_TIMEOUT_MS || 2500));

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

    const parsed = (() => {
      try {
        return JSON.parse(content);
      } catch (e) {
        const start = content.indexOf("{");
        const end = content.lastIndexOf("}");
        if (start === -1 || end === -1 || end <= start) return null;
        try { return JSON.parse(content.slice(start, end+1)); } catch (e2) { return null; }
      }
    })();

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const product1 = parsed.product_1 || parsed.product1 || {};
    const product2 = parsed.product_2 || parsed.product2 || {};

    return {
      intent: "compare",
      product_1: {
        name: normalizeHintValue(product1.name),
        brand: normalizeHintValue(product1.brand),
      },
      product_2: {
        name: normalizeHintValue(product2.name),
        brand: normalizeHintValue(product2.brand),
      },
    };
  } catch (error) {
    return null;
  }
}

function buildCompareProductFilter(queryText, hints = {}) {
  const normalizedQuery = normalizeText(queryText);
  const queryTokens = tokenize(queryText).filter((token) => token.length >= 2);
  const searchTerms = Array.from(
    new Set([
      ...queryTokens,
      ...tokenize(hints.name || ""),
      ...tokenize(hints.brand || ""),
    ])
  ).filter((token) => token.length >= 2);

  const filter = {
    stock: { $gt: 0 },
  };

  const orClauses = [];
  if (normalizedQuery) {
    const exactRegex = new RegExp(escapeRegExp(normalizedQuery), "i");
    orClauses.push(
      { name: exactRegex },
      { brand: exactRegex },
      { series: exactRegex },
      { model: exactRegex },
      { variant: exactRegex },
      { sku: exactRegex },
      { description: exactRegex }
    );
  }

  searchTerms.forEach((term) => {
    const re = new RegExp(escapeRegExp(term), "i");
    orClauses.push(
      { name: re },
      { brand: re },
      { series: re },
      { model: re },
      { variant: re },
      { sku: re },
      { description: re }
    );
  });

  if (orClauses.length > 0) {
    filter.$or = orClauses;
  }

  const structuredAnd = [];
  const storagePairMatch = String(queryText || "").match(/\b(\d{1,2})\s*GB\s*\/\s*(\d{2,4})\s*(GB|TB)\b/i);
  const storageMatch = storagePairMatch || String(queryText || "").match(/\b(\d{2,4})\s*(GB|TB)\b/i);
  if (storagePairMatch) {
    const storageRegex = buildStorageRegexAtLeast(Number(storagePairMatch[2] || 0));
    if (storageRegex) {
      structuredAnd.push({ $or: [{ description: storageRegex }, { name: storageRegex }, { variant: storageRegex }] });
    }
  } else if (storageMatch) {
    const storageValue = Number(storageMatch[1]);
    if (Number.isFinite(storageValue) && storageValue > 0) {
      const storageRegex = buildStorageRegexAtLeast(storageValue);
      if (storageRegex) {
        structuredAnd.push({ $or: [{ description: storageRegex }, { name: storageRegex }, { variant: storageRegex }] });
      }
    }
  }

  const ramMatch = String(queryText || "").match(/\b(\d{1,2})\s*GB\s*RAM\b/i);
  if (ramMatch) {
    const ramRegex = buildRamRegexAtLeast(Number(ramMatch[1]));
    if (ramRegex) {
      structuredAnd.push({ $or: [{ description: ramRegex }, { name: ramRegex }, { variant: ramRegex }] });
    }
  }

  const batteryMatch = String(queryText || "").match(/\b(\d{3,5})\s*m?a?h\b/i);
  if (batteryMatch) {
    const batteryRegex = buildBatteryRegexAtLeast(Number(batteryMatch[1]));
    if (batteryRegex) {
      structuredAnd.push({ $or: [{ description: batteryRegex }, { name: batteryRegex }] });
    }
  }

  const screenSizeMatch = String(queryText || "").match(/\b(\d+(?:[.,]\d+)?)\s*(?:"|inch|in)\b/i);
  if (screenSizeMatch) {
    const screenSizeRegex = new RegExp(`${String(screenSizeMatch[1]).replace(/\./g, "\\.")}\s*(?:"|inch|in)`, "i");
    structuredAnd.push({ $or: [{ description: screenSizeRegex }, { name: screenSizeRegex }] });
  }

  const screenTechHints = [
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
    "poled",
    "p-oled",
    "p oled",
    "lcd",
  ];
  const matchedTech = screenTechHints.find((hint) => normalizedQuery.includes(hint));
  if (matchedTech) {
    const techRegex = buildScreenTechRegex(matchedTech);
    if (techRegex) {
      structuredAnd.push({ $or: [{ description: techRegex }, { name: techRegex }] });
    }
  }

  const screenRole = normalizedQuery.includes("man hinh phu") || normalizedQuery.includes("cover screen")
    ? "cover"
    : normalizedQuery.includes("man hinh chinh") || normalizedQuery.includes("main screen")
      ? "main"
      : "";
  if (screenRole) {
    const roleRegex = buildScreenRoleRegex(screenRole);
    if (roleRegex) {
      structuredAnd.push({ $or: [{ description: roleRegex }, { name: roleRegex }] });
    }
  }

  if (structuredAnd.length > 0) {
    filter.$and = structuredAnd;
  }

  return filter;
}

async function findBestCompareProduct(queryText, hints = {}) {
  const filter = buildCompareProductFilter(queryText, hints);
  const candidates = await Product.find(filter)
    .select(
      "_id name brand series model variant sku slug price finalPrice discountPercent description category image averageRating totalRatings totalViews stock"
    )
    .limit(40)
    .lean();

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const normalizedQuery = normalizeText(queryText);
  const queryTokens = tokenize(queryText).filter((token) => token.length >= 2);
  const brandHint = normalizeHintValue(hints.brand || inferBrandHint(queryText));
  const storageMatch = String(queryText || "").match(/\b(\d{2,4})\s*(GB|TB)\b/i);
  const storageHint = storageMatch ? `${Number(storageMatch[1])}${String(storageMatch[2] || "GB").toUpperCase()}` : "";

  const scored = candidates.map((product) => {
    const normalizedName = normalizeText(product.name);
    const normalizedBrand = normalizeText(product.brand);
    const normalizedSeries = normalizeText(product.series);
    const normalizedModel = normalizeText(product.model);
    const normalizedVariant = normalizeText(product.variant);
    const normalizedDescription = normalizeText(product.description);
    const productText = [normalizedName, normalizedBrand, normalizedSeries, normalizedModel, normalizedVariant, normalizedDescription].join(" ");

    let score = 0;
    queryTokens.forEach((token) => {
      if (productText.includes(token)) {
        score += token.length >= 4 ? 2 : 1;
      }
    });

    if (normalizedQuery && (normalizedName.includes(normalizedQuery) || normalizedModel.includes(normalizedQuery) || normalizedVariant.includes(normalizedQuery))) {
      score += 16;
    }

    if (brandHint && (normalizedBrand.includes(brandHint) || normalizedName.includes(brandHint))) {
      score += 8;
    }

    if (storageHint && productText.includes(normalizeText(storageHint))) {
      score += 4;
    }

    if (normalizedQuery.includes("cover screen") && (normalizedDescription.includes("cover screen") || normalizedName.includes("cover screen"))) {
      score += 4;
    }

    if (normalizedQuery.includes("main screen") && (normalizedDescription.includes("main screen") || normalizedName.includes("main screen"))) {
      score += 4;
    }

    return {
      product,
      score,
      priceDelta: Math.abs(getEffectivePrice(product) - (Number(hints.budget || 0) || 0)),
      nameLength: normalizedName.length,
    };
  });

  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (left.nameLength !== right.nameLength) {
      return left.nameLength - right.nameLength;
    }

    return left.priceDelta - right.priceDelta;
  });

  return scored[0]?.product || null;
}

async function maybeGenerateCompareReply({ message, product1, product2, history }) {
  const enabled = String(process.env.CHATBOT_LLM_ENABLED || "").toLowerCase() === "true";
  const apiUrl = String(process.env.CHATBOT_LLM_API_URL || "").trim();
  const apiKey = String(process.env.CHATBOT_LLM_API_KEY || "").trim();
  const model = String(process.env.CHATBOT_LLM_MODEL || "gpt-4.1-mini").trim();

  if (!enabled || !apiUrl || !apiKey) {
    return null;
  }

  const isGemini = apiUrl.includes("generativelanguage.googleapis.com");
  const comparePayload = {
    intent: "compare",
    message,
    product_1: product1,
    product_2: product2,
    recentHistory: history ? history.slice(-4) : [],
    instructions:
      "Chỉ dùng dữ liệu JSON đã cung cấp. Không tự bịa thông số. Trả về đúng một bảng Markdown so sánh theo chiều dọc: cột 1 là 'Đặc tính', các cột tiếp theo là tên của các sản phẩm. Các dòng hiển thị đặc tính gồm: Giá bán, Chip, RAM, ROM, Màn hình, Camera, Pin. Dùng '-' nếu không có dữ liệu. Tuyệt đối KHÔNG viết thêm bất kỳ đoạn mô tả, nhận xét hay kết luận nào phía dưới bảng.",
  };

  const systemPrompt = [
    "Bạn là trợ lý so sánh sản phẩm thương mại điện tử chuyên nghiệp.",
    "Nhiệm vụ duy nhất của bạn là xuất ra một bảng Markdown so sánh các sản phẩm theo chiều dọc.",
    "Cột đầu tiên phải có tiêu đề là 'Đặc tính'. Các cột tiếp theo lần lượt là tên của từng sản phẩm được so sánh.",
    "Các dòng (tiêu đề ở cột 'Đặc tính') bắt buộc phải gồm các thông tin: Giá bán, Chip, RAM, ROM, Màn hình, Camera, Pin.",
    "Hãy điền thông số chính xác từ dữ liệu JSON được cung cấp vào các cột sản phẩm tương ứng. Dùng '-' nếu không có thông tin.",
    "Tuyệt đối KHÔNG được viết thêm bất kỳ văn bản, lời thoại, mô tả, nhận xét, so sánh hay kết luận nào ở phía dưới hoặc xung quanh bảng. Chỉ trả về duy nhất bảng Markdown.",
  ].join(" ");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.CHATBOT_LLM_TIMEOUT_MS || 2500));

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
                parts: [{ text: JSON.stringify(comparePayload, null, 2) }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
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
          temperature: 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(comparePayload, null, 2) },
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

async function handleCompareIntent({ message, session, historyContext }) {
  const MAX_HISTORY = 10;

  // Step 1: Parse which two products the user wants to compare
  let parsed = parseCompareIntentFromText(message, historyContext);
  if (!parsed) {
    parsed = await maybeParseCompareIntentWithLlm(message, historyContext);
  }

  if (!parsed || !parsed.product_1?.name || !parsed.product_2?.name) {
    return null;
  }

  // Step 2: Find the best matching product in DB for each side
  const [product1, product2] = await Promise.all([
    findBestCompareProduct(parsed.product_1.name, {
      brand: parsed.product_1.brand || "",
    }),
    findBestCompareProduct(parsed.product_2.name, {
      brand: parsed.product_2.brand || "",
    }),
  ]);

  if (!product1 || !product2) {
    const missing = [];
    if (!product1) missing.push(parsed.product_1.name);
    if (!product2) missing.push(parsed.product_2.name);

    const replyText = `Mình chưa tìm thấy sản phẩm "${missing.join('" và "')}" trong hệ thống. Bạn thử nhập lại tên chính xác hơn nhé.`;

    session.history.push({ role: "user", content: message, at: new Date().toISOString() });
    session.history.push({ role: "assistant", content: replyText, products: [], at: new Date().toISOString() });
    session.history = session.history.slice(-MAX_HISTORY);
    session.updatedAt = Date.now();

    return {
      sessionId: session.id,
      intent: "compare",
      reply: replyText,
      replyStructured: {
        title: "Không tìm thấy sản phẩm để so sánh",
        followUp: "Bạn thử nhập lại tên chính xác hơn nhé.",
        items: [],
      },
      products: [],
      quickReplies: ["So sánh iPhone vs Samsung", "Gợi ý điện thoại", "Laptop bán chạy"],
      metadata: { llmUsed: false, productCount: 0, compare: true },
    };
  }

  // Step 3: Build compare reply — try LLM first, fall back to rule-based
  const spec1 = extractComparisonSpecSummary(product1);
  const spec2 = extractComparisonSpecSummary(product2);

  let llmReplyText = null;
  try {
    llmReplyText = await maybeGenerateCompareReply({
      message,
      product1: { ...product1, specs: spec1 },
      product2: { ...product2, specs: spec2 },
      history: historyContext,
    });
  } catch (_) {
    llmReplyText = null;
  }

  const replyText = llmReplyText || buildCompareReply(product1, product2);

  // Step 4: Push to session history
  const compareProducts = [product1, product2];
  session.history.push({ role: "user", content: message, at: new Date().toISOString() });
  session.history.push({
    role: "assistant",
    content: replyText,
    products: compareProducts.map((item) => ({
      _id: item._id,
      name: item.name,
      category: item.category,
      price: getEffectivePrice(item),
      brand: item.brand,
      model: item.model,
      variant: item.variant,
      stock: item.stock,
    })),
    at: new Date().toISOString(),
  });
  session.history = session.history.slice(-MAX_HISTORY);
  session.updatedAt = Date.now();

  // Step 5: Return structured response
  return {
    sessionId: session.id,
    intent: "compare",
    reply: replyText,
    replyStructured: {
      title: `So sánh ${product1.name} và ${product2.name}`,
      followUp: "Bạn muốn xem chi tiết sản phẩm nào hoặc cần so sánh thêm?",
      items: compareProducts.map((item) => ({
        name: item.name,
        price: formatVnd(getEffectivePrice(item)),
      })),
    },
    products: compareProducts,
    quickReplies: [`Chi tiết ${product1.name}`, `Chi tiết ${product2.name}`, "So sánh khác"],
    metadata: {
      llmUsed: Boolean(llmReplyText),
      productCount: 2,
      compare: true,
    },
  };
}

module.exports = {
  handleCompareIntent,
  parseCompareIntentFromText,
  maybeParseCompareIntentWithLlm,
  buildCompareProductFilter,
  findBestCompareProduct,
  maybeGenerateCompareReply,
  buildCompareReply,
  buildCompareMarkdownTable,
  buildCompareFallbackComment,
};
