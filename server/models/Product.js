const mongoose = require("mongoose");

const KNOWN_BRANDS = ["samsung", "iphone", "xiaomi", "oppo", "vivo", "realme", "macbook", "ipad"];

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

function slugify(value) {
  return normalizeText(value).replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

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

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên sản phẩm là bắt buộc"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Giá sản phẩm là bắt buộc"],
    },
    description: {
      type: String,
      required: [true, "Mô tả sản phẩm là bắt buộc"],
    },
    category: {
      type: String, // Sau này có thể nâng cấp thành: mongoose.Schema.Types.ObjectId, ref: 'Category'
      required: [true, "Danh mục sản phẩm là bắt buộc"],
    },
    brand: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      index: true,
    },
    series: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      index: true,
    },
    model: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      index: true,
    },
    variant: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      index: true,
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      index: true,
    },
    image: {
      type: String,
      default: "/placeholder.svg", // URL ảnh mặc định
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    finalPrice: {
      // Giá này có thể được tính toán lại trước khi lưu
      // hoặc để frontend tự tính và gửi lên
      type: Number,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
    },
    reviews: {
      type: [reviewSchema],
      default: [],
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
      min: 0,
    },
    viewedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
      select: false,
    },
    totalViews: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.pre("validate", function prepareStructuredFields(next) {
  const structured = deriveStructuredFields({
    name: this.name,
    category: this.category,
  });

  if (!String(this.brand || "").trim()) {
    this.brand = structured.brand;
  }

  if (!String(this.series || "").trim()) {
    this.series = structured.series;
  }

  if (!String(this.model || "").trim()) {
    this.model = structured.model;
  }

  if (!String(this.variant || "").trim()) {
    this.variant = structured.variant;
  }

  if (!String(this.slug || "").trim()) {
    this.slug = structured.inferredSlug;
  }

  if (!String(this.sku || "").trim()) {
    const skuParts = [structured.brand, structured.series, structured.model, structured.variant]
      .filter(Boolean)
      .join("-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toUpperCase();
    this.sku = skuParts;
  }

  next();
});

productSchema.index(
  { sku: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sku: { $type: "string", $exists: true, $ne: "" },
    },
  }
);

module.exports = mongoose.model("Product", productSchema);