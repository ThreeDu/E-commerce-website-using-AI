const express = require("express");
const router = express.Router();
const { seedCategories, listCategories } = require("../controllers/categoryController");

// @route   GET /api/categories/seed
// @desc    Nạp dữ liệu mẫu cho danh mục
// @access  Public
router.get("/seed", seedCategories);

// @route   GET /api/categories
// @desc    Lấy danh sách tất cả danh mục
// @access  Public
router.get("/", listCategories);

module.exports = router;