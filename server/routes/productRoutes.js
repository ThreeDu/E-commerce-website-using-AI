const express = require("express");
const Product = require("../models/Product");

const router = express.Router();

// @route   GET /api/products
// @desc    Lấy tất cả sản phẩm
// @access  Public
router.get("/", async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách sản phẩm:", error.message);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
});

// @route   GET /api/products/seed
// @desc    Nạp dữ liệu mẫu
// @access  Public
router.get("/seed", async (req, res) => {
  const mockProducts = [
    { name: "Điện thoại AI Pro", price: 25000000, category: "Điện thoại", description: "Điện thoại thông minh tích hợp AI mới nhất, camera siêu nét 108MP, pin trâu 5000mAh.", stock: 50 },
    { name: "Laptop DevBook 16", price: 40000000, category: "Laptop", description: "Cỗ máy làm việc với chip hiệu năng cao, RAM 32GB, ổ cứng SSD 1TB chuẩn PCIe 4.0.", stock: 30 },
    { name: "Tai nghe Noise Cancel", price: 3500000, category: "Phụ kiện", description: "Tai nghe chống ồn chủ động ANC, âm thanh Hi-Res chân thực, pin sử dụng liên tục 30 giờ.", stock: 100 },
    { name: "Đồng hồ thông minh", price: 5000000, category: "Phụ kiện", description: "Theo dõi sức khỏe toàn diện, đo nhịp tim, nồng độ oxy trong máu, chống nước chuẩn 5ATM.", stock: 80 },
    { name: "Bàn phím cơ RGB", price: 2100000, category: "Phụ kiện", description: "Bàn phím cơ sử dụng switch cao cấp, tích hợp LED RGB 16.8 triệu màu tùy chỉnh, gõ cực êm.", stock: 45 },
    { name: "Chuột không dây Ergonomic", price: 950000, category: "Phụ kiện", description: "Thiết kế công thái học chống mỏi tay khi dùng lâu, kết nối wireless độ trễ thấp, pin sạc dùng 3 tháng.", stock: 120 },
    { name: "Màn hình 4K 27 inch", price: 12500000, category: "Phụ kiện", description: "Màn hình độ phân giải 4K sắc nét, chuẩn màu 99% sRGB dành cho dân thiết kế, tích hợp công nghệ bảo vệ mắt.", stock: 15 },
    { name: "Webcam Full HD", price: 1200000, category: "Phụ kiện", description: "Webcam 1080p sắc nét lý tưởng cho học tập và họp trực tuyến, tích hợp micro chống ồn kép.", stock: 60 },
  ];

  try {
    await Product.deleteMany({}); // Xóa toàn bộ dữ liệu sản phẩm cũ
    const createdProducts = await Product.insertMany(mockProducts); // Thêm mảng dữ liệu mẫu vào DB
    res.status(201).json({ message: "Seed data thành công!", count: createdProducts.length });
  } catch (error) {
    console.error("Lỗi khi seed data:", error.message);
    res.status(500).json({ message: "Lỗi khi seed data", error: error.message });
  }
});

// @route   GET /api/products/:id
// @desc    Lấy thông tin chi tiết một sản phẩm
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    res.json(product);
  } catch (error) {
    console.error(`Lỗi khi lấy sản phẩm ID ${req.params.id}:`, error.message);
    // Nếu ID không hợp lệ (ví dụ không phải ObjectId), Mongoose sẽ throw lỗi CastError
    if (error.name === "CastError") {
      return res.status(400).json({ message: "ID sản phẩm không hợp lệ" });
    }
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
});

module.exports = router;