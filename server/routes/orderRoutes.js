const express = require("express");
const router = express.Router();
const Order = require("../models/Order");

// @route   POST /api/orders
// @desc    Tạo đơn hàng mới
// @access  Public (Sau này bạn có thể đổi thành Private nếu cần đăng nhập)
router.post("/", async (req, res) => {
  try {
    const { orderItems, shippingAddress, paymentMethod, totalPrice, user } = req.body;

    if (orderItems && orderItems.length === 0) {
      return res.status(400).json({ message: "Không có sản phẩm nào trong đơn hàng" });
    }

    const order = new Order({
      user, // Lưu ID user nếu có
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

// @route   GET /api/orders/user/:userId
// @desc    Lấy danh sách đơn hàng của một user
// @access  Public
router.get("/user/:userId", async (req, res) => {
  try {
    const orders = await Order.find({ user: req.params.userId }).sort({ createdAt: -1 }); // Lấy đơn hàng mới nhất lên đầu
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ khi lấy lịch sử đơn hàng" });
  }
});

module.exports = router;