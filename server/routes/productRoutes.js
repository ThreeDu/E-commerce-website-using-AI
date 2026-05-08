const express = require("express");
const {
  listProducts,
  trackProductView,
  getReviewEligibility,
  createReview,
  updateReview,
  deleteReview,
  seedProducts,
  getProductById,
} = require("../controllers/productController");

const router = express.Router();

// @route   GET /api/products
// @desc    Lấy tất cả sản phẩm
// @access  Public
router.get("/", listProducts);

// @route   POST /api/products
// @desc    Lấy thông tin nhiều sản phẩm theo IDs
// @access  Public
router.post("/", async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "Danh sách IDs không hợp lệ." });
  }

  try {
    const products = await require("../models/Product").find({
      _id: { $in: ids },
      stock: { $gt: 0 },
    }).select("_id name price finalPrice discountPercent stock");

    return res.json(products);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/:id/view", trackProductView);

router.get("/:id/review-eligibility", getReviewEligibility);

router.post("/:id/reviews", createReview);

router.put("/:id/reviews/:reviewId", updateReview);

router.delete("/:id/reviews/:reviewId", deleteReview);

// @route   GET /api/products/seed
// @desc    Nạp dữ liệu mẫu
// @access  Public
router.get("/seed", seedProducts);

// @route   GET /api/products/:id
// @desc    Lấy thông tin chi tiết một sản phẩm
// @access  Public
router.get("/:id", getProductById);

module.exports = router;