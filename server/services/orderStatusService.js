/**
 * orderStatusService.js — nguồn duy nhất cho việc đổi trạng thái đơn hàng.
 * Dùng chung cho admin controller, admin chatbot (đơn lẻ + hàng loạt) và khách tự hủy.
 */
const Order = require("../models/Order");
const Product = require("../models/Product");
const Discount = require("../models/Discount");
const User = require("../models/User");
const PointHistory = require("../models/PointHistory");
const { notifyOrderStatusChange } = require("../helpers/notificationHelper");

const VALID_STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipping", "cancelled"],
  shipping: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

const POINTS_PER_UNIT = 10000; // 10.000đ = 1 điểm

const calculatePoints = (totalPrice) => Math.floor(Number(totalPrice || 0) / POINTS_PER_UNIT);

function canTransition(fromStatus, toStatus) {
  return (VALID_STATUS_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

function transitionError(fromStatus, toStatus) {
  const allowed = VALID_STATUS_TRANSITIONS[fromStatus] || [];
  return `Không thể chuyển trạng thái từ "${fromStatus}" sang "${toStatus}". Trạng thái hợp lệ: ${
    allowed.length > 0 ? allowed.join(", ") : "không có (trạng thái cuối)"
  }`;
}

// Hoàn kho + trả lại lượt dùng mã giảm giá khi hủy đơn.
async function releaseOrderResources(order) {
  const quantityByProductId = new Map();
  for (const item of order.orderItems || []) {
    const productId = String(item.product?._id || item.product);
    quantityByProductId.set(productId, Number(quantityByProductId.get(productId) || 0) + Number(item.quantity || 0));
  }
  await Promise.all(
    Array.from(quantityByProductId, ([productId, quantity]) =>
      Product.updateOne({ _id: productId }, { $inc: { stock: quantity } })
    )
  );

  if (order.discount) {
    await Discount.updateOne({ _id: order.discount, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
  }
}

async function awardDeliveryPoints(order) {
  const earnedPoints = calculatePoints(order.totalPrice);
  if (!order.user || earnedPoints <= 0) return;

  const user = await User.findByIdAndUpdate(order.user, { $inc: { loyaltyPoints: earnedPoints } }, { new: true });
  if (!user) return;

  await PointHistory.create({
    user: order.user,
    amount: earnedPoints,
    type: "earn",
    reason: `Đơn hàng #${String(order._id).slice(-8)} giao thành công`,
    relatedOrder: order._id,
    balanceAfter: user.loyaltyPoints,
  });
}

/**
 * Đổi trạng thái 1 đơn hàng, kiểm tra luồng hợp lệ và chạy các tác vụ đi kèm
 * (đánh dấu đã thanh toán, hoàn kho khi hủy, cộng điểm khi giao, gửi thông báo).
 * Ném Error có `status` (400/404) khi không hợp lệ.
 */
async function changeOrderStatus(orderId, newStatus, { reason } = {}) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw Object.assign(new Error("Không tìm thấy đơn hàng."), { status: 404 });
  }

  const previousStatus = order.status;
  if (!canTransition(previousStatus, newStatus)) {
    throw Object.assign(new Error(transitionError(previousStatus, newStatus)), { status: 400 });
  }

  const update = { status: newStatus };
  if (newStatus === "delivered") {
    update.isDelivered = true;
    update.deliveredAt = new Date();
  }
  if (newStatus === "cancelled") {
    update.isDelivered = false;
    update.cancelledAt = new Date();
    if (reason) update.cancelledReason = reason;
  }
  if (
    newStatus === "confirmed" &&
    (order.paymentMethod === "beepay" || order.paymentMethod === "transfer") &&
    !order.isPaid
  ) {
    update.isPaid = true;
    update.paidAt = new Date();
    update.paymentDetails = {
      transactionRef: "MANUAL_CONFIRM_" + Date.now(),
      bankCode: "MANUAL",
      amount: order.totalPrice,
      counterpartName: "ADMIN_MANUAL",
    };
  }

  // Điều kiện status cũ trong filter để hai request song song không cùng chạy tác vụ đi kèm.
  const updatedOrder = await Order.findOneAndUpdate({ _id: orderId, status: previousStatus }, update, {
    new: true,
    runValidators: true,
  }).populate("user", "_id name email");

  if (!updatedOrder) {
    throw Object.assign(new Error("Đơn hàng vừa được cập nhật bởi thao tác khác, vui lòng tải lại."), { status: 409 });
  }

  if (newStatus === "cancelled") {
    await releaseOrderResources(order);
  }
  if (newStatus === "delivered") {
    await awardDeliveryPoints(order);
  }

  notifyOrderStatusChange(updatedOrder, newStatus).catch((err) =>
    console.error("Gửi thông báo cập nhật đơn hàng thất bại:", err)
  );

  return { order: updatedOrder, previousStatus };
}

module.exports = {
  VALID_STATUS_TRANSITIONS,
  canTransition,
  changeOrderStatus,
  releaseOrderResources,
};
