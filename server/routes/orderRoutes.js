const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Discount = require("../models/Discount");
const { verifyUserRequest } = require("./helpers/authHelpers");

const CANCELLABLE_STATUSES = new Set(["pending", "confirmed"]);

function calculateSubtotal(orderItems) {
  return orderItems.reduce((sum, item) => {
    const quantity = Number(item?.quantity || 0);
    const price = Number(item?.price || 0);
    if (Number.isNaN(quantity) || Number.isNaN(price) || quantity <= 0 || price < 0) {
      return sum;
    }
    return sum + quantity * price;
  }, 0);
}

function calculateDiscountAmount(discount, subtotalPrice) {
  if (!discount || subtotalPrice <= 0) {
    return 0;
  }

  let amount = 0;
  if (discount.type === "percent") {
    amount = Math.floor((subtotalPrice * Number(discount.value || 0)) / 100);
  } else {
    amount = Math.floor(Number(discount.value || 0));
  }

  const maxDiscount = Number(discount.maxDiscountValue || 0);
  if (maxDiscount > 0) {
    amount = Math.min(amount, maxDiscount);
  }

  amount = Math.max(0, amount);
  return Math.min(amount, subtotalPrice);
}

function validateDiscount(discount, subtotalPrice) {
  if (!discount) {
    return "Mã giảm giá không tồn tại.";
  }

  if (!discount.isActive) {
    return "Mã giảm giá đang không hoạt động.";
  }

  const now = new Date();
  if (discount.startDate && now < discount.startDate) {
    return "Mã giảm giá chưa đến thời gian áp dụng.";
  }

  if (discount.endDate && now > discount.endDate) {
    return "Mã giảm giá đã hết hạn.";
  }

  if (Number(discount.usageLimit || 0) > 0 && Number(discount.usedCount || 0) >= Number(discount.usageLimit || 0)) {
    return "Mã giảm giá đã hết lượt sử dụng.";
  }

  if (subtotalPrice < Number(discount.minOrderValue || 0)) {
    return `Đơn hàng cần tối thiểu ${Number(discount.minOrderValue || 0).toLocaleString("vi-VN")} đ để áp dụng mã này.`;
  }

  return "";
}

router.get("/coupon/:code", async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const code = String(req.params.code || "").trim().toUpperCase();
    const subtotalPrice = Math.max(0, Number(req.query.subtotal || 0));

    if (!code) {
      return res.status(400).json({ message: "Thiếu mã giảm giá." });
    }

    const discount = await Discount.findOne({ code });
    const invalidReason = validateDiscount(discount, subtotalPrice);
    if (invalidReason) {
      return res.status(400).json({ message: invalidReason });
    }

    const discountAmount = calculateDiscountAmount(discount, subtotalPrice);

    return res.json({
      message: "Áp dụng mã giảm giá thành công.",
      coupon: {
        id: discount._id,
        code: discount.code,
        type: discount.type,
        value: discount.value,
      },
      subtotalPrice,
      discountAmount,
      totalPrice: Math.max(0, subtotalPrice - discountAmount),
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi kiểm tra mã giảm giá" });
  }
});

// @route   POST /api/orders
// @desc    Tạo đơn hàng mới
// @access  Public (Sau này bạn có thể đổi thành Private nếu cần đăng nhập)
router.post("/", async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const { orderItems, shippingAddress, paymentMethod, discountCode } = req.body;

    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({ message: "Không có sản phẩm nào trong đơn hàng" });
    }

    const subtotalPrice = calculateSubtotal(orderItems);
    if (subtotalPrice <= 0) {
      return res.status(400).json({ message: "Dữ liệu đơn hàng không hợp lệ." });
    }

    let appliedDiscount = null;
    let appliedDiscountCode = "";
    let discountAmount = 0;

    if (String(discountCode || "").trim()) {
      const normalizedCode = String(discountCode).trim().toUpperCase();
      const discount = await Discount.findOne({ code: normalizedCode });
      const invalidReason = validateDiscount(discount, subtotalPrice);

      if (invalidReason) {
        return res.status(400).json({ message: invalidReason });
      }

      appliedDiscount = discount;
      appliedDiscountCode = discount.code;
      discountAmount = calculateDiscountAmount(discount, subtotalPrice);
    }

    const totalPrice = Math.max(0, subtotalPrice - discountAmount);

    const order = new Order({
      user: authUser._id,
      orderItems,
      shippingAddress,
      paymentMethod,
      subtotalPrice,
      discountCode: appliedDiscountCode,
      discountAmount,
      discount: appliedDiscount?._id || null,
      totalPrice,
    });

    const createdOrder = await order.save();

    if (appliedDiscount) {
      await Discount.findByIdAndUpdate(appliedDiscount._id, { $inc: { usedCount: 1 } });
    }

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

router.get("/my-orders/:id", async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const order = await Order.findOne({
      _id: req.params.id,
      user: authUser._id,
    }).populate("orderItems.product", "_id name image");

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }

    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi lấy chi tiết đơn hàng" });
  }
});

router.put("/my-orders/:id/cancel", async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const cancelledReason = String(req.body?.reason || "").trim();
    if (cancelledReason.length < 5) {
      return res.status(400).json({ message: "Vui lòng nhập lý do hủy đơn tối thiểu 5 ký tự." });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      user: authUser._id,
    });

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }

    if (!CANCELLABLE_STATUSES.has(order.status)) {
      return res.status(400).json({ message: "Đơn hàng đã xử lý, không thể hủy." });
    }

    order.status = "cancelled";
    order.isDelivered = false;
    order.cancelledReason = cancelledReason;
    order.cancelledAt = new Date();
    await order.save();

    return res.json({
      message: "Hủy đơn hàng thành công.",
      order,
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi hủy đơn hàng" });
  }
});

module.exports = router;