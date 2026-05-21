const Notification = require("../models/Notification");
const Cart = require("../models/Cart");
const User = require("../models/User");

// Tạo 1 thông báo cho 1 user
const createNotification = async (userId, data) => {
  try {
    return await Notification.create({
      user: userId,
      ...data,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

// Tạo thông báo cho nhiều user cùng lúc
const createBulkNotifications = async (userIds, data) => {
  try {
    if (!userIds || userIds.length === 0) return;
    const docs = userIds.map((userId) => ({
      user: userId,
      ...data,
    }));
    return await Notification.insertMany(docs);
  } catch (error) {
    console.error("Error creating bulk notifications:", error);
    throw error;
  }
};

// Trigger 1: Đơn hàng đổi trạng thái
const notifyOrderStatusChange = async (order, newStatus) => {
  try {
    if (!order || !order.user) return;

    const statusMap = {
      pending: "chờ xác nhận",
      confirmed: "đã xác nhận",
      shipping: "đang giao hàng",
      delivered: "đã giao hàng",
      cancelled: "đã hủy",
    };

    const vietnameseStatus = statusMap[newStatus] || newStatus;
    const orderCode = order._id.toString().slice(-6).toUpperCase();

    const title = "Cập nhật trạng thái đơn hàng";
    const message = `Đơn hàng #${orderCode} của bạn đã chuyển sang trạng thái: ${vietnameseStatus}.`;

    await createNotification(order.user, {
      type: "order_status",
      title,
      message,
      data: {
        orderId: order._id,
        orderStatus: newStatus,
      },
      link: `/order-history/${order._id}`,
    });
  } catch (error) {
    console.error("Error sending order status notification:", error);
  }
};

// Trigger 2: Sản phẩm được giảm giá
const notifyProductDiscount = async (
  product,
  oldDiscountPercent,
  newDiscountPercent
) => {
  try {
    if (!product) return;

    // Tìm tất cả user có sản phẩm này trong Cart hoặc wishlist
    const cartUsers = await Cart.find({ "items.product": product._id }).distinct(
      "user"
    );
    const wishlistUsers = await User.find({ wishlist: product._id }).distinct(
      "_id"
    );

    // Merge và loại bỏ trùng lặp
    const allUserIds = [
      ...new Set([
        ...cartUsers.map((id) => id.toString()),
        ...wishlistUsers.map((id) => id.toString()),
      ]),
    ];

    if (allUserIds.length === 0) return;

    const title = "Sản phẩm được giảm giá!";
    const message = `Sản phẩm "${product.name}" trong giỏ hàng hoặc danh sách yêu thích của bạn vừa được giảm giá thêm! Giảm từ ${oldDiscountPercent}% xuống còn ${newDiscountPercent}%!`;

    await createBulkNotifications(allUserIds, {
      type: "product_discount",
      title,
      message,
      data: {
        productId: product._id,
        productName: product.name,
        discountPercent: newDiscountPercent,
      },
      link: `/products/${product._id}`,
    });
  } catch (error) {
    console.error("Error sending product discount notification:", error);
  }
};

// Trigger 3: Mã giảm giá mới
const notifyNewCoupon = async (discount) => {
  try {
    if (!discount || !discount.isActive) return;

    let targetUserIds = [];
    if (discount.allowedUsers && discount.allowedUsers.length > 0) {
      targetUserIds = discount.allowedUsers.map((id) => id.toString());
    } else {
      // Chỉ thông báo cho các tài khoản có role là 'user'
      const users = await User.find({ role: "user" }).distinct("_id");
      targetUserIds = users.map((id) => id.toString());
    }

    if (targetUserIds.length === 0) return;

    const discountValStr =
      discount.type === "percent"
        ? `${discount.value}%`
        : `${discount.value.toLocaleString("vi-VN")}đ`;
    const minOrderStr = discount.minOrderValue.toLocaleString("vi-VN");

    const title = "Mã giảm giá mới dành cho bạn!";
    const message = `Mã giảm giá mới ${discount.code} vừa xuất hiện — Giảm ${discountValStr} cho đơn từ ${minOrderStr}đ. Nhận ngay!`;

    await createBulkNotifications(targetUserIds, {
      type: "new_coupon",
      title,
      message,
      data: {
        discountCode: discount.code,
        discountPercent: discount.type === "percent" ? discount.value : undefined,
      },
      link: "/profile?openVoucher=true",
    });
  } catch (error) {
    console.error("Error sending new coupon notification:", error);
  }
};

module.exports = {
  createNotification,
  createBulkNotifications,
  notifyOrderStatusChange,
  notifyProductDiscount,
  notifyNewCoupon,
};
