const express = require("express");
const { requireUser } = require("./helpers/authHelpers");
const router = express.Router();
const {
  verifyCoupon,
  createOrder,
  listMyOrders,
  getMyOrderById,
  cancelMyOrder,
  listMyVouchers,
} = require("../controllers/orderController");

router.get("/coupon/:code", requireUser, verifyCoupon);

// @route   POST /api/orders
// @desc    Tạo đơn hàng mới
// @access  Public (Sau này bạn có thể đổi thành Private nếu cần đăng nhập)
router.post("/", requireUser, createOrder);

// @route   GET /api/orders/my-orders
// @desc    Lấy danh sách đơn hàng của user đang đăng nhập
// @access  Private
router.get("/my-orders", requireUser, listMyOrders);

router.get("/my-orders/:id", requireUser, getMyOrderById);

router.put("/my-orders/:id/cancel", requireUser, cancelMyOrder);

// @route   GET /api/orders/my-vouchers
// @desc    Lấy danh sách mã giảm giá khả dụng của user
// @access  Private
router.get("/my-vouchers", requireUser, listMyVouchers);

module.exports = router;