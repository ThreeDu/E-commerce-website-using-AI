const Product = require("../../models/Product");
const Category = require("../../models/Category");
const { logAdminAction } = require("../../utils/adminAuditLogger");

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

function normalizePlainText(value) {
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
  return normalizePlainText(value).replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
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

const listProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    return res.json({
      message: "Lấy danh sách sản phẩm thành công.",
      products,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }

    return res.json({
      message: "Lấy chi tiết sản phẩm thành công.",
      product,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const {
      name,
      image,
      imageUrl,
      price,
      discountPercent,
      category,
      stock,
      description,
      brand,
      series,
      model,
      variant,
      sku,
      slug,
    } = req.body;
    const normalizedImage = String(image || imageUrl || "").trim();

    if (!name || !normalizedImage || price === undefined || price === null) {
      return res.status(400).json({ message: "Tên, ảnh và giá sản phẩm là bắt buộc." });
    }

    const numericPrice = Number(price);
    const numericDiscount =
      discountPercent === undefined || discountPercent === null ? 0 : Number(discountPercent);
    const numericStock = stock === undefined || stock === null ? 0 : Number(stock);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ message: "Giá sản phẩm không hợp lệ." });
    }

    if (Number.isNaN(numericDiscount) || numericDiscount < 0 || numericDiscount > 100) {
      return res.status(400).json({ message: "% giảm giá không hợp lệ." });
    }

    if (Number.isNaN(numericStock) || numericStock < 0) {
      return res.status(400).json({ message: "Số lượng tồn không hợp lệ." });
    }

    const computedFinalPrice = Math.round(numericPrice * (1 - numericDiscount / 100));
    const inferred = deriveStructuredFromName({ name, category: category || "Chua phan loai" });

    const newProduct = await Product.create({
      name,
      image: normalizedImage,
      price: numericPrice,
      discountPercent: numericDiscount,
      finalPrice: computedFinalPrice,
      category: category || "Chưa phân loại",
      stock: numericStock,
      description: description || "",
      brand: normalizePlainText(brand) || inferred.brand,
      series: normalizePlainText(series) || inferred.series,
      model: normalizePlainText(model) || inferred.model,
      variant: normalizePlainText(variant) || inferred.variant,
      sku: toSku(sku) || inferred.sku,
      slug: slugify(slug) || inferred.slug,
    });

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "create",
      resource: "product",
      resourceId: newProduct._id,
      details: {
        name: newProduct.name,
        category: newProduct.category,
      },
    });

    return res.status(201).json({
      message: "Thêm sản phẩm thành công.",
      product: newProduct,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      image,
      imageUrl,
      price,
      discountPercent,
      category,
      stock,
      description,
      brand,
      series,
      model,
      variant,
      sku,
      slug,
    } = req.body;
    const normalizedImage = String(image || imageUrl || "").trim();

    if (!name || !normalizedImage || price === undefined || price === null) {
      return res.status(400).json({ message: "Tên, ảnh và giá sản phẩm là bắt buộc." });
    }

    const numericPrice = Number(price);
    const numericDiscount =
      discountPercent === undefined || discountPercent === null ? 0 : Number(discountPercent);
    const numericStock = stock === undefined || stock === null ? 0 : Number(stock);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ message: "Giá sản phẩm không hợp lệ." });
    }

    if (Number.isNaN(numericDiscount) || numericDiscount < 0 || numericDiscount > 100) {
      return res.status(400).json({ message: "% giảm giá không hợp lệ." });
    }

    if (Number.isNaN(numericStock) || numericStock < 0) {
      return res.status(400).json({ message: "Số lượng tồn không hợp lệ." });
    }

    const computedFinalPrice = Math.round(numericPrice * (1 - numericDiscount / 100));
    const inferred = deriveStructuredFromName({ name, category: category || "Chua phan loai" });

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name,
        image: normalizedImage,
        price: numericPrice,
        discountPercent: numericDiscount,
        finalPrice: computedFinalPrice,
        category: category || "Chưa phân loại",
        stock: numericStock,
        description: description || "",
        brand: normalizePlainText(brand) || inferred.brand,
        series: normalizePlainText(series) || inferred.series,
        model: normalizePlainText(model) || inferred.model,
        variant: normalizePlainText(variant) || inferred.variant,
        sku: toSku(sku) || inferred.sku,
        slug: slugify(slug) || inferred.slug,
      },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "update",
      resource: "product",
      resourceId: updatedProduct._id,
      details: {
        name: updatedProduct.name,
        category: updatedProduct.category,
      },
    });

    return res.json({
      message: "Cập nhật sản phẩm thành công.",
      product: updatedProduct,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "delete",
      resource: "product",
      resourceId: deletedProduct._id,
      details: {
        name: deletedProduct.name,
        category: deletedProduct.category,
      },
    });

    return res.json({
      message: "Xóa sản phẩm thành công.",
      product: deletedProduct,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const previewProductImport = async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

    if (rows.length === 0) {
      return res.status(400).json({ message: "Vui lòng gửi dữ liệu sản phẩm để xem trước." });
    }

    if (rows.length > IMPORT_ROW_LIMIT) {
      return res
        .status(400)
        .json({ message: `Số dòng vượt quá giới hạn ${IMPORT_ROW_LIMIT}. Vui lòng tách nhỏ file.` });
    }

    const preview = await buildImportPreview(rows);

    return res.json({
      message: "Phân tích file thành công.",
      summary: {
        totalRows: rows.length,
        validRows: preview.validRows.length,
        errorRows: preview.errorRows.length,
      },
      validRows: preview.validRows,
      errorRows: preview.errorRows,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const commitProductImport = async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const mode = req.body?.mode === "upsert" ? "upsert" : "create";

    if (rows.length === 0) {
      return res.status(400).json({ message: "Không có dữ liệu để import." });
    }

    if (rows.length > IMPORT_ROW_LIMIT) {
      return res
        .status(400)
        .json({ message: `Số dòng vượt quá giới hạn ${IMPORT_ROW_LIMIT}. Vui lòng tách nhỏ file.` });
    }

    const preview = await buildImportPreview(rows);
    if (preview.errorRows.length > 0) {
      return res.status(400).json({
        message: "Dữ liệu còn lỗi. Vui lòng sửa trước khi import.",
        summary: {
          totalRows: rows.length,
          validRows: preview.validRows.length,
          errorRows: preview.errorRows.length,
        },
        errorRows: preview.errorRows,
      });
    }

    if (mode === "create") {
      const docs = preview.validRows.map((item) => item.payload);
      const createdProducts = await Product.insertMany(docs, { ordered: false });

      logAdminAction({
        req,
        adminUser: req.adminUser,
        action: "bulk_import",
        resource: "product",
        details: {
          mode,
          totalRows: rows.length,
          importedCount: createdProducts.length,
        },
      });

      return res.status(201).json({
        message: `Đã import ${createdProducts.length} sản phẩm thành công.`,
        summary: {
          totalRows: rows.length,
          importedCount: createdProducts.length,
          mode,
        },
      });
    }

    const operations = preview.validRows.map((item) => ({
      updateOne: {
        filter: item.payload.sku
          ? { sku: item.payload.sku }
          : {
              name: item.payload.name,
              category: item.payload.category,
            },
        update: {
          $set: item.payload,
        },
        upsert: true,
      },
    }));

    const result = await Product.bulkWrite(operations, { ordered: false });
    const importedCount = Number(result.upsertedCount || 0) + Number(result.modifiedCount || 0);

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "bulk_import",
      resource: "product",
      details: {
        mode,
        totalRows: rows.length,
        importedCount,
      },
    });

    return res.status(201).json({
      message: `Đã import ${importedCount} sản phẩm thành công (upsert).`,
      summary: {
        totalRows: rows.length,
        importedCount,
        mode,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  previewProductImport,
  commitProductImport,
};
