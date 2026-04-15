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