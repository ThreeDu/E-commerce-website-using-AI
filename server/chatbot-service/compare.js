const Product = require('../models/Product');
const { cleanHtmlBreaks } = require('./textUtils');

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
  const cleanText = String(rawText || "").replace(/\s+/g, " ").trim();
  
  let rearMp = [];
  let frontMp = [];

  const mpRegex = /\b(\d{1,3})\s*(?:MP|megapixel)\b/gi;
  let match;
  
  while ((match = mpRegex.exec(cleanText)) !== null) {
    const mpValue = `${match[1]}MP`;
    const matchIndex = match.index;
    
    // Look at the context before this match (up to 80 characters)
    const startContext = Math.max(0, matchIndex - 80);
    let contextText = cleanText.substring(startContext, matchIndex);
    
    // Isolate only the current sentence/clause
    const lastPunct = Math.max(
      contextText.lastIndexOf("."),
      contextText.lastIndexOf(";"),
      contextText.lastIndexOf("\n")
    );
    if (lastPunct !== -1) {
      contextText = contextText.substring(lastPunct + 1);
    }
    
    const isFront = /trước|truoc|selfie|front/i.test(contextText);
    if (isFront) {
      frontMp.push(mpValue);
    } else {
      rearMp.push(mpValue);
    }
  }

  // Deduplicate
  const uniq = (arr) => Array.from(new Set(arr));
  rearMp = uniq(rearMp);
  frontMp = uniq(frontMp);

  // Format response
  const parts = [];
  if (rearMp.length > 0) {
    parts.push(`Sau: ${rearMp.join(" + ")}`);
  }
  if (frontMp.length > 0) {
    parts.push(`Trước: ${frontMp.join(" + ")}`);
  }

  if (parts.length === 0) {
    const globalMp = uniq(Array.from(cleanText.matchAll(/\b(\d{1,3})\s*(?:MP|megapixel)\b/gi)).map(m => `${m[1]}MP`));
    if (globalMp.length > 0) {
      if (globalMp.length === 1) {
        return `Sau: ${globalMp[0]}`;
      }
      return `Sau: ${globalMp.slice(0, -1).join(" + ")} | Trước: ${globalMp[globalMp.length - 1]}`;
    }
    return "Theo hãng công bố";
  }

  return parts.join(" | ");
}

function extractComparisonSpecSummary(product) {
  const rawText = [product?.name, product?.variant, product?.model, product?.series, product?.description]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const isLaptop = /laptop|macbook/i.test(product?.category || "") || /laptop|macbook/i.test(product?.name || "");

  const ramPairMatch = rawText.match(/\b(\d{1,2})\s*GB\s*\/\s*(\d{2,4})\s*(GB|TB)\b/i);
  
  let ramMatch = null;
  const ramPrefixMatch = rawText.match(/(?:bộ\s+nhớ\s+|bo\s+nho\s+)?ram\s*:?\s*(\d{1,2})\s*gb/i);
  if (ramPrefixMatch) {
    ramMatch = ramPrefixMatch;
  }
  if (!ramMatch) {
    const ramSuffixMatch = rawText.match(/\b(\d{1,2})\s*gb\s*(?:ram|lpddr|ddr)/i);
    if (ramSuffixMatch) {
      ramMatch = ramSuffixMatch;
    }
  }
  if (!ramMatch) {
    const allGbMatches = Array.from(rawText.matchAll(/\b(\d{1,2})\s*gb\b/gi));
    for (const match of allGbMatches) {
      const idx = match.index;
      const contextBefore = rawText.substring(Math.max(0, idx - 20), idx);
      if (!/rtx|gtx|gpu|card|vram/i.test(contextBefore)) {
        ramMatch = match;
        break;
      }
    }
  }
  if (!ramMatch) {
    ramMatch = rawText.match(/\b(\d{1,2})\s*gb\b/i);
  }
  const storageMatches = Array.from(rawText.matchAll(/\b(\d{2,4})\s*(GB|TB)\b/gi));
  const storageMatch = ramPairMatch || storageMatches[storageMatches.length - 1] || null;
  const screenSizeMatch = rawText.match(/\b(\d+(?:[.,]\d+)?)\s*(?:"|inch\b|in\b)/i);
  const screenTechMatch = rawText.match(/\b(dynamic amoled 2x|dynamic amoled|amoled 2x|super retina xdr|super amoled|amoled|oled|ltpo|ltps|retina xdr|retina|poled|p-oled|p oled|lcd|liquid retina xdr)\b/i);
  const screenResMatch = rawText.match(/\b(quad hd\+|full hd\+|qhd\+|fhd\+|hd\+)\b/i);
  const screenHzMatch = rawText.match(/\b(\d+(?:-\d+)?\s*Hz)\b/i);
  const screenNitsMatch = rawText.match(/\b(\d+\s*nits)\b/i);
  const batteryMatch = rawText.match(/\b(\d{3,5})\s*m?a?h\b/i);
  const laptopBatteryMatch = rawText.match(/\b(\d{2,3})\s*Whr?\b/i);

  // Laptop specific fields
  const gpuRegex = /(?:card\s+đồ\s+họa|card\s+do\s+hoa|gpu|vga|đồ\s+họa|do\s+hoa)\s*:?\s*([^.,\n()]+)/i;
  const gpuMatch = rawText.match(gpuRegex);
  let gpu = gpuMatch ? gpuMatch[1].trim() : "";

  if (!gpu) {
    const standaloneGpuRegex = /\b((?:geforce\s+)?rtx\s*\d{4}(?:\s*ti)?|(?:geforce\s+)?gtx\s*\d{4}(?:\s*ti)?|intel\s+iris\s+xe|iris\s+xe|intel\s+uhd|uhd\s+graphics|radeon(?:\s+graphics)?|m\d\s*(?:pro|max)?\s+gpu|\d+-core\s+gpu)\b/i;
    const standaloneGpuMatch = rawText.match(standaloneGpuRegex);
    if (standaloneGpuMatch) {
      gpu = standaloneGpuMatch[1].trim();
    }
  }

  if (!gpu) {
    gpu = "Tích hợp";
  }

  const weightRegex = /(?:trọng\s+lượng|nặng|weight)\s*:?\s*(\d+(?:[.,]\d+)?\s*(?:kg|g|gram))\b/i;
  const weightMatch = rawText.match(weightRegex);
  const weight = weightMatch ? weightMatch[1].trim() : "Đang cập nhật";

  const osRegex = /(?:hệ\s+điều\s+hành|os)\s*:?\s*(windows\s*\d*|macos|android\s*\d*|ios\s*\d*|mac\s*os|linus|linux)/i;
  const osMatch = rawText.match(osRegex);
  const os = osMatch ? osMatch[1].trim() : "Windows";

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
  if (screenResMatch) {
    screenParts.push(String(screenResMatch[1]).toUpperCase());
  }
  if (screenHzMatch) {
    screenParts.push(String(screenHzMatch[1]));
  }
  if (screenNitsMatch) {
    screenParts.push(String(screenNitsMatch[1]));
  }

  return {
    isLaptop,
    finalPrice: formatVnd(priceValue),
    chip: formatFriendlyValue(extractChip(rawText), "Theo hãng công bố"),
    ram: formatFriendlyValue(ram, "Theo hãng công bố"),
    rom: formatFriendlyValue(rom, "Đang cập nhật"),
    screen: formatFriendlyValue(screenParts.length > 0 ? screenParts.join(" ") : "", "Đang cập nhật"),
    camera: isLaptop ? "-" : formatFriendlyValue(extractCamera(rawText), "Theo hãng công bố"),
    battery: formatFriendlyValue(
      isLaptop && laptopBatteryMatch ? `${laptopBatteryMatch[1]} Wh` : 
      batteryMatch ? `${Number(batteryMatch[1])} mAh` : "",
      "Theo hãng công bố"
    ),
    gpu: isLaptop ? formatFriendlyValue(gpu, "Tích hợp") : "-",
    weight: isLaptop ? formatFriendlyValue(weight, "Đang cập nhật") : "-",
    os: isLaptop ? formatFriendlyValue(os, "Windows") : "-",
  };
}

function buildCompareMarkdownTable(products) {
  const rows = Array.isArray(products) ? products : [];
  if (rows.length === 0) return "";

  const summaries = rows.map(p => extractComparisonSpecSummary(p));
  const isComparingLaptops = summaries.some(s => s.isLaptop);

  const headers = ["| Đặc tính", ...rows.map(p => String(p?.name || "-").replace(/\|/g, "\\|"))];
  const alignments = ["| ---", ...rows.map(() => "---")];

  const specRows = isComparingLaptops
    ? [
        { label: "**Giá bán**", key: "finalPrice" },
        { label: "**CPU (Vi xử lý)**", key: "chip" },
        { label: "**Card đồ họa (GPU)**", key: "gpu" },
        { label: "**Bộ nhớ RAM**", key: "ram" },
        { label: "**Ổ cứng (ROM)**", key: "rom" },
        { label: "**Màn hình**", key: "screen" },
        { label: "**Dung lượng Pin**", key: "battery" },
        { label: "**Trọng lượng**", key: "weight" },
        { label: "**Hệ điều hành**", key: "os" }
      ]
    : [
        { label: "**Giá bán**", key: "finalPrice" },
        { label: "**Chip**", key: "chip" },
        { label: "**RAM**", key: "ram" },
        { label: "**ROM**", key: "rom" },
        { label: "**Màn hình**", key: "screen" },
        { label: "**Camera**", key: "camera" },
        { label: "**Pin**", key: "battery" }
      ];

  const lines = [
    headers.join(" | ") + " |",
    alignments.join(" | ") + " |"
  ];

  specRows.forEach(spec => {
    const cells = [spec.label];
    summaries.forEach(summary => {
      const val = String(summary[spec.key] || "-").replace(/\|/g, "\\|");
      cells.push(val);
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

function buildCompareFallbackConclusion(product1, product2) {
  const spec1 = extractComparisonSpecSummary(product1);
  const spec2 = extractComparisonSpecSummary(product2);
  const price1 = getEffectivePrice(product1);
  const price2 = getEffectivePrice(product2);

  const lines = ["**💡 Kết luận: Sản phẩm nào phù hợp với bạn?**"];

  // Comparison logic
  const isP1Cheaper = price1 < price2;
  const priceDiff = Math.abs(price1 - price2);

  let p1Highlights = [];
  let p2Highlights = [];

  if (price1 !== price2) {
    if (isP1Cheaper) {
      p1Highlights.push(`Tiết kiệm chi phí hơn (rẻ hơn ${formatVnd(priceDiff)})`);
    } else {
      p2Highlights.push(`Tiết kiệm chi phí hơn (rẻ hơn ${formatVnd(priceDiff)})`);
    }
  }

  // Parse RAM
  const ramVal1 = parseInt(spec1.ram) || 0;
  const ramVal2 = parseInt(spec2.ram) || 0;
  if (ramVal1 > ramVal2) {
    p1Highlights.push(`RAM lớn hơn (${spec1.ram} so với ${spec2.ram}) giúp đa nhiệm tốt hơn`);
  } else if (ramVal2 > ramVal1) {
    p2Highlights.push(`RAM lớn hơn (${spec2.ram} so với ${spec1.ram}) giúp đa nhiệm tốt hơn`);
  }

  // Parse ROM
  const romVal1 = parseInt(spec1.rom) || 0;
  const romVal2 = parseInt(spec2.rom) || 0;
  if (romVal1 > romVal2) {
    p1Highlights.push(`Bộ nhớ trong lớn hơn (${spec1.rom} so với ${spec2.rom})`);
  } else if (romVal2 > romVal1) {
    p2Highlights.push(`Bộ nhớ trong lớn hơn (${spec2.rom} so với ${spec1.rom})`);
  }

  // Battery
  const batVal1 = parseInt(spec1.battery) || 0;
  const batVal2 = parseInt(spec2.battery) || 0;
  if (batVal1 > batVal2) {
    p1Highlights.push(`Dung lượng pin cao hơn (${spec1.battery} so với ${spec2.battery})`);
  } else if (batVal2 > batVal1) {
    p2Highlights.push(`Dung lượng pin cao hơn (${spec2.battery} so với ${spec1.battery})`);
  }

  if (p1Highlights.length > 0) {
    lines.push(`- **Nên chọn ${product1.name}** nếu bạn ưu tiên: ${p1Highlights.join(", ")}.`);
  } else {
    lines.push(`- **Chọn ${product1.name}**: Thiết kế tinh tế, tối ưu cho nhu cầu sử dụng phổ thông.`);
  }

  if (p2Highlights.length > 0) {
    lines.push(`- **Nên chọn ${product2.name}** nếu bạn ưu tiên: ${p2Highlights.join(", ")}.`);
  } else {
    lines.push(`- **Chọn ${product2.name}**: Hiệu năng ổn định, đáp ứng tốt mọi tác vụ cơ bản.`);
  }

  // Add a general recommendation sentence
  if (price1 === price2 && ramVal1 === ramVal2 && romVal1 === romVal2) {
    lines.push(`\n**Khuyên dùng**: Do hai sản phẩm có thông số kỹ thuật và giá thành gần như tương đương, bạn nên quyết định dựa trên sở thích cá nhân về thương hiệu hoặc các chương trình quà tặng đi kèm.`);
  } else {
    lines.push(`\n**Khuyên dùng**: Chọn sản phẩm có thông số vượt trội hơn nếu ngân sách cho phép, hoặc chọn dòng máy giá tốt hơn nếu muốn tối ưu hóa chi phí.`);
  }

  return lines.join("\n");
}

function buildCompareReply(product1, product2) {
  const table = buildCompareMarkdownTable([product1, product2]);
  const conclusion = buildCompareFallbackConclusion(product1, product2);
  return `${table}\n\n${conclusion}`;
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
    console.error("[LLM] maybeParseCompareIntentWithLlm failed:", error.message);
    return null;
  }
}

function buildCompareProductFilter(queryText, hints = {}) {
  const COMPARISON_STOPWORDS = new Set([
    "san", "pham", "mock", "ssd", "va", "vs", "voi", "so", "sanh", "compare", "giua", "and", "with", "or", "huong", "dan", "chi", "tiet"
  ]);
  const normalizedQuery = normalizeText(queryText);
  const queryTokens = tokenize(queryText).filter((token) => token.length >= 2);
  const searchTerms = Array.from(
    new Set([
      ...queryTokens,
      ...tokenize(hints.name || ""),
      ...tokenize(hints.brand || ""),
    ])
  ).filter((token) => token.length >= 2 && !COMPARISON_STOPWORDS.has(token));

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
      "Chỉ dùng dữ liệu JSON đã cung cấp. Không tự bịa thông số. Trả về một bảng Markdown so sánh theo chiều dọc: cột 1 là 'Đặc tính', các cột tiếp theo là tên của các sản phẩm. Các dòng hiển thị đặc tính gồm: Giá bán, Chip, RAM, ROM, Màn hình, Camera, Pin. Dùng '-' nếu không có dữ liệu. Hãy nhớ viết các ký tự '|' bên trong ô dữ liệu là '\\|' để tránh làm hỏng các cột của bảng. Tuyệt đối không dùng các thẻ HTML như '<br>', '<br/>', '<br />' để xuống dòng trong bảng. Hãy dùng dấu gạch đứng đã được escape là '\\|' (ví dụ: 'Sau: 50MP \\| Trước: 12MP') khi muốn phân tách hoặc xuống dòng thông số camera trước và sau. Đặc biệt lưu ý đối với Laptop: hãy sử dụng chính xác thông số được cung cấp sẵn ở trường 'specs' (ví dụ specs.ram, specs.rom, specs.chip, specs.gpu) để điền vào bảng. Tuyệt đối không nhầm lẫn dung lượng bộ nhớ của Card đồ họa GPU (ví dụ: 4GB VRAM) với dung lượng RAM hệ thống (ví dụ: 16GB RAM). Dưới bảng, hãy viết một mục kết luận có tiêu đề '**💡 Kết luận: Sản phẩm nào phù hợp với bạn?**' phân tích chi tiết xem dòng máy nào phù hợp với nhu cầu hay đối tượng khách hàng nào (học sinh, game thủ, quay chụp, tối ưu chi phí, v.v.), giúp người dùng đưa ra quyết định mua sắm tốt nhất.",
  };

  const systemPrompt = [
    "Bạn là trợ lý so sánh sản phẩm thương mại điện tử chuyên nghiệp.",
    "Nhiệm vụ của bạn là xuất ra một bảng Markdown so sánh các sản phẩm theo chiều dọc.",
    "Cột đầu tiên phải có tiêu đề là 'Đặc tính'. Các cột tiếp theo lần lượt là tên của từng sản phẩm được so sánh.",
    "Các dòng (tiêu đề ở cột 'Đặc tính') bắt buộc phải gồm các thông tin: Giá bán, Chip, RAM, ROM, Màn hình, Camera, Pin.",
    "Hãy điền thông số chính xác từ dữ liệu JSON được cung cấp vào các cột sản phẩm tương ứng. Dùng '-' nếu không có thông tin.",
    "Bắt buộc viết mọi ký tự '|' trong các ô giá trị dưới dạng '\\|' để tránh làm hỏng cấu trúc cột của bảng Markdown.",
    "Tuyệt đối KHÔNG được sử dụng các thẻ HTML như '<br>', '<br />', '<br/>' để tạo dòng mới trong ô dữ liệu của bảng. Thay vào đó, hãy dùng ký tự '\\|' (ví dụ: 'Sau: 50MP \\| Trước: 12MP') để hiển thị ngăn cách thông số camera.",
    "Chú ý quan trọng về thông số RAM và Card đồ họa (GPU): Đối với laptop, hãy luôn sử dụng cấu hình đã được trích xuất sẵn ở trường 'specs' của mỗi sản phẩm (ví dụ: specs.ram, specs.rom, specs.chip, specs.gpu). Tuyệt đối không được nhầm lẫn dung lượng bộ nhớ của Card đồ họa GPU (ví dụ: 4GB) với dung lượng RAM hệ thống (ví dụ: 16GB RAM). Hãy điền đúng RAM hệ thống (ví dụ: 16GB) cho thuộc tính RAM.",
    "Ngay phía dưới bảng Markdown, bạn BẮT BUỘC phải viết một phần kết luận chi tiết ngắn gọn (khoảng 3-5 câu) dưới tiêu đề '**💡 Kết luận: Sản phẩm nào phù hợp với bạn?**' so sánh các điểm mạnh cốt lõi và tư vấn sản phẩm nào phù hợp nhất cho đối tượng/nhu cầu nào để hướng dẫn người dùng lựa chọn.",
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
    console.error("[LLM] maybeGenerateCompareReply failed:", error.message);
    return null;
  }
}

async function handleCompareIntent({ message, session, historyContext }) {
  const MAX_HISTORY = 10;

  let product1 = null;
  let product2 = null;

  // First try to extract by hidden database ID tags: [Mã: ID1] and [Mã: ID2]
  const idMatches = Array.from(message.matchAll(/\[Mã:\s*([a-f0-9]{24})\]/gi));
  if (idMatches.length >= 2) {
    const id1 = idMatches[0][1];
    const id2 = idMatches[1][1];
    [product1, product2] = await Promise.all([
      Product.findById(id1).select("_id name brand series model variant sku slug price finalPrice discountPercent description category image averageRating totalRatings totalViews stock").lean(),
      Product.findById(id2).select("_id name brand series model variant sku slug price finalPrice discountPercent description category image averageRating totalRatings totalViews stock").lean()
    ]);
  }

  let parsed = null;
  if (!product1 || !product2) {
    // Step 1: Parse which two products the user wants to compare
    parsed = parseCompareIntentFromText(message, historyContext);
    if (!parsed) {
      parsed = await maybeParseCompareIntentWithLlm(message, historyContext);
    }

    if (!parsed || !parsed.product_1?.name || !parsed.product_2?.name) {
      return null;
    }

    // Step 2: Find the best matching product in DB for each side
    const [found1, found2] = await Promise.all([
      product1 || findBestCompareProduct(parsed.product_1.name, {
        brand: parsed.product_1.brand || "",
      }),
      product2 || findBestCompareProduct(parsed.product_2.name, {
        brand: parsed.product_2.brand || "",
      }),
    ]);
    product1 = found1;
    product2 = found2;
  }

  if (!product1 || !product2) {
    const missing = [];
    if (!product1) missing.push(parsed?.product_1?.name || "sản phẩm 1");
    if (!product2) missing.push(parsed?.product_2?.name || "sản phẩm 2");

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
  } catch (error) {
    console.error("[LLM] Generating compare reply failed:", error.message);
    llmReplyText = null;
  }

  const replyText = cleanHtmlBreaks(llmReplyText || buildCompareReply(product1, product2));

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
  extractComparisonSpecSummary,
};
