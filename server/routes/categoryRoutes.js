const express = require("express");
const router = express.Router();
const { listCategories } = require("../controllers/categoryController");

// @route   GET /api/categories
// @desc    Lấy danh sách tất cả danh mục
// @access  Public
router.get("/", listCategories);

module.exports = router;