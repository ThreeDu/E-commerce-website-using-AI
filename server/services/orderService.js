/**
 * orderService.js — giá, mã giảm giá và hoàn kho dùng khi tạo đơn hàng.
 */
const Order = require("../models/Order");
const Product = require("../models/Product");

// Định nghĩa doanh thu dùng chung (dashboard, admin chatbot, báo cáo): chỉ tính đơn đã giao.
const REVENUE_ORDER_FILTER = Object.freeze({ status: "delivered" });

// Đơn giá tính từ DB, không tin giá client gửi lên (cùng công thức với getProductPricing ở frontend).
function getUnitPrice(product) {
  const basePrice = Math.max(0, Number(product?.price || 0));
  const finalPrice = Math.max(0, Number(product?.finalPrice || 0));
  if (finalPrice > 0 && finalPrice < basePrice) {
    return finalPrice;
  }
  const discountPercent = Math.max(0, Math.min(100, Number(product?.discountPercent || 0)));
  return Math.round(basePrice * (1 - discountPercent / 100));
}

function calculateSubtotal(orderItems) {
  return orderItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.price), 0);
}

async function restockItems(items) {
  await Promise.all(
    items.map((entry) => Product.updateOne({ _id: entry.productId }, { $inc: { stock: entry.quantity } }))
  );
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

async function validateDiscount(discount, subtotalPrice, authUser) {
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

  if (
    Number(discount.usageLimit || 0) > 0 &&
    Number(discount.usedCount || 0) >= Number(discount.usageLimit || 0)
  ) {
    return "Mã giảm giá đã hết lượt sử dụng (đạt giới hạn tổng).";
  }

  // Kiểm tra người dùng chỉ định
  if (discount.allowedUsers && discount.allowedUsers.length > 0) {
    const isAllowed = discount.allowedUsers.some(
      (userId) => String(userId) === String(authUser._id)
    );
    if (!isAllowed) {
      return "Mã giảm giá này không dành cho tài khoản của bạn.";
    }
  }

  // Kiểm tra giới hạn số lần dùng trên mỗi user
  if (Number(discount.usageLimitPerUser || 0) > 0) {
    // Đếm số đơn hàng đã đặt dùng mã này (không tính đơn đã bị hủy)
    const usageCount = await Order.countDocuments({
      user: authUser._id,
      discount: discount._id,
      status: { $ne: "cancelled" },
    });

    if (usageCount >= Number(discount.usageLimitPerUser)) {
      return "Bạn đã hết lượt sử dụng mã giảm giá này.";
    }
  }

  if (subtotalPrice < Number(discount.minOrderValue || 0)) {
    return `Đơn hàng cần tối thiểu ${Number(discount.minOrderValue || 0).toLocaleString("vi-VN")} đ để áp dụng mã này.`;
  }

  return "";
}

module.exports = {
  REVENUE_ORDER_FILTER,
  getUnitPrice,
  calculateSubtotal,
  restockItems,
  calculateDiscountAmount,
  validateDiscount,
};
