const { defineModel } = require("../db/model");
const { normalizeText, slugify } = require("../helpers/textHelpers");

const KNOWN_BRANDS = [
  "samsung", "iphone", "xiaomi", "oppo", "vivo", "realme", "macbook", "ipad",
  "acer", "dell", "hp", "asus", "lenovo", "msi", "razer",
  "google", "oneplus", "huawei", "honor", "nokia", "sony",
  "nothing", "motorola", "rog",
];

function deriveStructuredFields({ name, category }) {
  const normalizedName = normalizeText(name);
  const normalizedCategory = normalizeText(category);
  const tokens = normalizedName.split(" ").filter(Boolean);

  let brand = "";
  for (const candidate of KNOWN_BRANDS) {
    if (normalizedName.includes(candidate)) {
      brand = candidate;
      break;
    }
  }

  let series = "";
  if (brand === "samsung") {
    if (/\bgalaxy\s*z\b/.test(normalizedName) || /\bz\s*(flip|fold)\d+/i.test(normalizedName)) {
      series = "z";
    } else if (/\bgalaxy\s*s\d+/i.test(normalizedName) || /\bs\d+\b/.test(normalizedName)) {
      series = "s";
    } else if (/\bgalaxy\s*a\d+/i.test(normalizedName) || /\ba\d+\b/.test(normalizedName)) {
      series = "a";
    }
  }

  if (!series) {
    if (normalizedName.includes("fold")) {
      series = "fold";
    } else if (normalizedName.includes("flip")) {
      series = "flip";
    }
  }

  const storageMatch = normalizedName.match(/\b\d+\s*(gb|tb)\b.*$/i);
  const variant = storageMatch ? storageMatch[0].replace(/\s+/g, "") : "";

  let model = "";
  const modelPatterns = [
    /\bz\s*(fold|flip)\s*\d+\b/i,
    /\bs\d+\s*ultra\b/i,
    /\bs\d+\s*plus\b/i,
    /\bs\d+\b/i,
    /\ba\d+\b/i,
    /\biphone\s*\d+\b/i,
    /\bmacbook\s*(air|pro)?\s*m?\d*\b/i,
  ];

  for (const pattern of modelPatterns) {
    const matched = normalizedName.match(pattern);
    if (matched && matched[0]) {
      model = matched[0].replace(/\s+/g, " ").trim();
      break;
    }
  }

  if (!model) {
    model = tokens.slice(0, Math.min(4, tokens.length)).join(" ");
  }

  const inferredSlug = slugify(`${name || ""}-${category || ""}`);

  return {
    brand,
    series,
    model,
    variant,
    inferredSlug,
    normalizedCategory,
  };
}

// Điền các trường cấu trúc còn trống từ tên/danh mục (trước đây là hook pre("validate") của Mongoose)
function fillStructuredFields(doc) {
  const structured = deriveStructuredFields({ name: doc.name, category: doc.category });
  if (!String(doc.brand || "").trim()) doc.brand = structured.brand;
  if (!String(doc.series || "").trim()) doc.series = structured.series;
  if (!String(doc.model || "").trim()) doc.model = structured.model;
  if (!String(doc.variant || "").trim()) doc.variant = structured.variant;
  if (!String(doc.slug || "").trim()) doc.slug = structured.inferredSlug;
  if (!String(doc.sku || "").trim()) {
    doc.sku = [structured.brand, structured.series, structured.model, structured.variant]
      .filter(Boolean)
      .join("-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toUpperCase();
  }
}

module.exports = defineModel("Product", {
  collection: "products",
  defaults: {
    brand: "", series: "", model: "", variant: "", sku: "", slug: "", image: "/placeholder.svg",
    discountPercent: 0, stock: 0, reviews: [], averageRating: 0, totalRatings: 0, viewedBy: [], totalViews: 0,
  },
  lower: ["brand", "series", "model", "variant", "slug"],
  upper: ["sku"],
  trim: ["name", "brand", "series", "model", "variant", "sku", "slug"],
  hidden: ["viewedBy"],
  subdocArrays: ["reviews"],
  subTimestamps: { reviews: true },
  arrays: ["reviews", "embedding", "viewedBy"],
  refs: { viewedBy: "User", "reviews.user": "User" },
  // Không ép sku unique: index unique trên MongoDB cũ chưa bao giờ được tạo (dữ liệu mẫu có 12 sku trùng),
  // nên ép bây giờ sẽ làm hỏng việc lưu các sản phẩm đã chuyển sang. Import Excel vẫn upsert theo sku.
  normalize: fillStructuredFields,
});
