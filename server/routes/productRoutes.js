const express = require("express");
const { requireUser } = require("./helpers/authHelpers");
const {
  listProducts,
  trackProductView,
  getReviewEligibility,
  createReview,
  updateReview,
  deleteReview,
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

router.post("/:id/view", requireUser, trackProductView);

router.get("/:id/review-eligibility", requireUser, getReviewEligibility);

router.post("/:id/reviews", requireUser, createReview);

router.put("/:id/reviews/:reviewId", requireUser, updateReview);

router.delete("/:id/reviews/:reviewId", requireUser, deleteReview);

// @route   GET /api/products/:id
// @desc    Lấy thông tin chi tiết một sản phẩm
// @access  Public
router.get("/:id", getProductById);

module.exports = router;