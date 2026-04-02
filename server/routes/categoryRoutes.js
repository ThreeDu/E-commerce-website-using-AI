const express = require("express");
const router = express.Router();
const Category = require("../models/Category");

// @route   GET /api/categories/seed
// @desc    Nạp dữ liệu mẫu cho danh mục
// @access  Public
router.get("/seed", async (req, res) => {
  const mockCategories = [
    { name: "Điện thoại", description: "Các dòng điện thoại thông minh mới nhất" },
    { name: "Laptop", description: "Máy tính xách tay phục vụ học tập, làm việc và chơi game" },
    { name: "Máy tính bảng", description: "Máy tính bảng iPad, Android đa nhiệm" },
    { name: "Phụ kiện", description: "Tai nghe, chuột, bàn phím, màn hình..." },
  ];

  try {
    await Category.deleteMany({}); // Xóa dữ liệu cũ
    const createdCategories = await Category.insertMany(mockCategories); // Thêm dữ liệu mới
    res.status(201).json({ message: "Seed danh mục thành công!", count: createdCategories.length });
  } catch (error) {
    console.error("Lỗi khi seed danh mục:", error.message);
    res.status(500).json({ message: "Lỗi khi seed danh mục", error: error.message });
  }
});

// @route   GET /api/categories
// @desc    Lấy danh sách tất cả danh mục
// @access  Public
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find({});
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ khi lấy danh mục" });
  }
});

module.exports = router;