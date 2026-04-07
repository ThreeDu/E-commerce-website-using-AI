const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { verifyUserRequest } = require("./helpers/authHelpers");

// @route   POST /api/orders
// @desc    Tạo đơn hàng mới
// @access  Public (Sau này bạn có thể đổi thành Private nếu cần đăng nhập)
router.post("/", async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const { orderItems, shippingAddress, paymentMethod, totalPrice } = req.body;

    if (orderItems && orderItems.length === 0) {
      return res.status(400).json({ message: "Không có sản phẩm nào trong đơn hàng" });
    }

    const order = new Order({
      user: authUser._id,
      orderItems,
      shippingAddress,
      paymentMethod,
      totalPrice,
    });

    const createdOrder = await order.save();
    res.status(201).json({ message: "Đặt hàng thành công", order: createdOrder });
  } catch (error) {
    console.error("Lỗi khi tạo đơn hàng:", error);
    res.status(500).json({ message: "Lỗi máy chủ khi tạo đơn hàng" });
  }
});

// @route   GET /api/orders/my-orders
// @desc    Lấy danh sách đơn hàng của user đang đăng nhập
// @access  Private
router.get("/my-orders", async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const orders = await Order.find({ user: authUser._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ khi lấy lịch sử đơn hàng" });
  }
});

module.exports = router;