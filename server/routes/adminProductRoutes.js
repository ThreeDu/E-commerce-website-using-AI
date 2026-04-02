const express = require("express");
const Product = require("../models/Product");
const { verifyAdminRequest } = require("./helpers/authHelpers");
const { logAdminAction } = require("../utils/adminAuditLogger");

const router = express.Router();

router.get("/", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const products = await Product.find().sort({ createdAt: -1 });

    return res.json({
      message: "Lấy danh sách sản phẩm thành công.",
      products,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

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
});

router.post("/", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { name, image, price, discountPercent, category, stock, description } = req.body;

    if (!name || !image || price === undefined || price === null) {
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

    const newProduct = await Product.create({
      name,
      image,
      price: numericPrice,
      discountPercent: numericDiscount,
      finalPrice: computedFinalPrice,
      category: category || "Chưa phân loại",
      stock: numericStock,
      description: description || "",
    });

    logAdminAction({
      req,
      adminUser,
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
});

router.put("/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { id } = req.params;
    const { name, image, price, discountPercent, category, stock, description } = req.body;

    if (!name || !image || price === undefined || price === null) {
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

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name,
        image,
        price: numericPrice,
        discountPercent: numericDiscount,
        finalPrice: computedFinalPrice,
        category: category || "Chưa phân loại",
        stock: numericStock,
        description: description || "",
      },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }

    logAdminAction({
      req,
      adminUser,
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
});

router.delete("/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { id } = req.params;
    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }

    logAdminAction({
      req,
      adminUser,
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
});

module.exports = router;
