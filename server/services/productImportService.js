/**
 * productImportService.js — chuẩn hóa dữ liệu sản phẩm và dựng bản xem trước khi import Excel.
 */
const Category = require("../models/Category");
const { normalizeText: normalizePlainText, slugify } = require("../helpers/textHelpers");

const IMPORT_ROW_LIMIT = 2000;

function toNormalizedString(value) {
  return String(value || "").trim();
}

function normalizePath(value) {
  return toNormalizedString(value)
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" > ");
}

function toSku(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

function deriveStructuredFromName({ name, category }) {
  const normalizedName = normalizePlainText(name);
  const brandCandidates = ["samsung", "iphone", "xiaomi", "oppo", "vivo", "realme", "macbook", "ipad"];
  const brand = brandCandidates.find((item) => normalizedName.includes(item)) || "";

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

  const modelMatch =
    normalizedName.match(/\bz\s*(fold|flip)\s*\d+\b/i) ||
    normalizedName.match(/\bs\d+\s*(ultra|plus)?\b/i) ||
    normalizedName.match(/\ba\d+\b/i) ||
    normalizedName.match(/\biphone\s*\d+\b/i) ||
    normalizedName.match(/\bmacbook\s*(air|pro)?\s*m?\d*\b/i);
  const model = modelMatch ? modelMatch[0].replace(/\s+/g, " ").trim() : normalizedName;

  const variantMatch = normalizedName.match(/\b\d+\s*(gb|tb)\b.*$/i);
  const variant = variantMatch ? variantMatch[0].replace(/\s+/g, "") : "";

  const slug = slugify(`${name || ""}-${category || ""}`);
  const sku = toSku(`${brand}-${series}-${model}-${variant}`);

  return {
    brand,
    series,
    model,
    variant,
    slug,
    sku,
  };
}

function findCellValue(row, aliases) {
  const source = row && typeof row === "object" ? row : {};
  const aliasSet = new Set(
    aliases
      .map((key) => String(key || "").toLowerCase().replace(/[^a-z0-9]/g, ""))
      .filter(Boolean)
  );

  const keys = Object.keys(source);
  for (const key of keys) {
    const normalizedKey = String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (aliasSet.has(normalizedKey)) {
      return source[key];
    }
  }

  return "";
}

function computeCategoryPathMap(categories) {
  const byId = new Map();
  categories.forEach((item) => {
    byId.set(String(item._id), item);
  });

  const resolved = new Map();

  const resolvePathById = (categoryId, visited = new Set()) => {
    if (resolved.has(categoryId)) {
      return resolved.get(categoryId);
    }

    if (visited.has(categoryId)) {
      return null;
    }

    const category = byId.get(categoryId);
    if (!category) {
      return null;
    }

    const nextVisited = new Set(visited);
    nextVisited.add(categoryId);

    const name = toNormalizedString(category.name);
    if (!category.parentId) {
      resolved.set(categoryId, name);
      return name;
    }

    const parentPath = resolvePathById(String(category.parentId), nextVisited);
    const fullPath = parentPath ? `${parentPath} > ${name}` : name;
    resolved.set(categoryId, fullPath);
    return fullPath;
  };

  const map = new Map();
  categories.forEach((item) => {
    const path = resolvePathById(String(item._id));
    if (path) {
      map.set(path.toLowerCase(), path);
    }
  });

  return map;
}

function toImportPayload(row, categoryPathMap) {
  const name = toNormalizedString(findCellValue(row, ["name", "ten", "ten san pham", "productname"]));
  const description = toNormalizedString(
    findCellValue(row, ["description", "mo ta", "mota", "productdescription"])
  );
  const image = toNormalizedString(findCellValue(row, ["image", "imageurl", "anh", "url anh"]));
  const categoryRaw = findCellValue(row, ["category", "categorypath", "category_path", "danhmuc", "danh muc"]);
  const categoryPath = normalizePath(categoryRaw);
  const price = Number(findCellValue(row, ["price", "gia"]));
  const stock = Number(findCellValue(row, ["stock", "ton kho", "soluong", "quantity"]));
  const discountPercent = Number(
    findCellValue(row, ["discountpercent", "discount", "giamgia", "phan tram giam"])
  );
  const skuRaw = toNormalizedString(findCellValue(row, ["sku", "ma sku", "product sku"]));
  const slugRaw = toNormalizedString(findCellValue(row, ["slug", "duong dan", "product slug"]));
  const brandRaw = toNormalizedString(findCellValue(row, ["brand", "thuong hieu"]));
  const seriesRaw = toNormalizedString(findCellValue(row, ["series", "dong", "phan khuc"]));
  const modelRaw = toNormalizedString(findCellValue(row, ["model", "model_name", "ten model"]));
  const variantRaw = toNormalizedString(findCellValue(row, ["variant", "phien ban", "cau hinh"]));

  const errors = [];

  if (!name) {
    errors.push("Tên sản phẩm là bắt buộc.");
  }

  if (!categoryPath) {
    errors.push("Danh mục là bắt buộc.");
  }

  if (!Number.isFinite(price) || price <= 0) {
    errors.push("Giá sản phẩm phải lớn hơn 0.");
  }

  if (!Number.isFinite(stock) || stock < 0) {
    errors.push("Tồn kho phải là số không âm.");
  }

  const normalizedDiscount = Number.isFinite(discountPercent) ? discountPercent : 0;
  if (normalizedDiscount < 0 || normalizedDiscount > 100) {
    errors.push("% giảm giá phải trong khoảng 0 - 100.");
  }

  const normalizedImage = image || "/placeholder.svg";
  if (image && !normalizedImage.startsWith("/") && !/^https?:\/\//i.test(normalizedImage) && !/^data:image\//i.test(normalizedImage)) {
    errors.push("Ảnh phải là URL hợp lệ, data URL hoặc đường dẫn bắt đầu bằng '/'.");
  }

  const matchedCategory = categoryPathMap.get(categoryPath.toLowerCase());
  if (categoryPath && !matchedCategory) {
    errors.push("Danh mục không tồn tại trong hệ thống.");
  }

  const finalCategory = matchedCategory || categoryPath;
  const computedFinalPrice = Number.isFinite(price) ? Math.round(price * (1 - normalizedDiscount / 100)) : 0;
  const inferred = deriveStructuredFromName({ name, category: finalCategory });

  const payload = {
    name,
    description,
    image: normalizedImage,
    category: finalCategory,
    brand: normalizePlainText(brandRaw) || inferred.brand,
    series: normalizePlainText(seriesRaw) || inferred.series,
    model: normalizePlainText(modelRaw) || inferred.model,
    variant: normalizePlainText(variantRaw) || inferred.variant,
    sku: toSku(skuRaw) || inferred.sku,
    slug: slugify(slugRaw) || inferred.slug,
    price,
    stock,
    discountPercent: normalizedDiscount,
    finalPrice: computedFinalPrice,
  };

  return {
    payload,
    errors,
  };
}

async function buildImportPreview(rows) {
  const categories = await Category.find({}, { name: 1, parentId: 1 });
  const categoryPathMap = computeCategoryPathMap(categories);

  const validRows = [];
  const errorRows = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const { payload, errors } = toImportPayload(row, categoryPathMap);

    if (errors.length > 0) {
      errorRows.push({
        rowNumber,
        errors,
        raw: row,
      });
      return;
    }

    validRows.push({
      rowNumber,
      payload,
    });
  });

  return {
    validRows,
    errorRows,
  };
}


module.exports = {
  IMPORT_ROW_LIMIT,
  toSku,
  deriveStructuredFromName,
  buildImportPreview,
};
