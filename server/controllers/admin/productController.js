const Product = require("../../models/Product");
const { logAdminAction } = require("../../utils/adminAuditLogger");
const { normalizeText: normalizePlainText, slugify } = require("../../helpers/textHelpers");
const {
  IMPORT_ROW_LIMIT,
  toSku,
  deriveStructuredFromName,
  buildImportPreview,
} = require("../../services/productImportService");

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

    // Lấy thông tin sản phẩm trước khi cập nhật để so sánh discountPercent
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }
    const oldDiscount = existingProduct.discountPercent || 0;

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

    // Trigger gửi thông báo khi mức giảm giá được tăng lên
    const newDiscount = updatedProduct.discountPercent || 0;
    if (newDiscount > oldDiscount && newDiscount > 0) {
      const { notifyProductDiscount } = require("../../helpers/notificationHelper");
      notifyProductDiscount(updatedProduct, oldDiscount, newDiscount).catch((err) =>
        console.error("Gửi thông báo giảm giá sản phẩm thất bại:", err)
      );
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
