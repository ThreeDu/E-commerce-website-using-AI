const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    // ID của user đặt hàng (nếu có đăng nhập)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Thông tin người đặt hàng
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
    },
    // Phương thức thanh toán
    paymentMethod: {
      type: String,
      required: true,
      default: "cod",
    },
    // Danh sách sản phẩm trong đơn hàng
    orderItems: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
      },
    ],
    // Tổng tiền
    totalPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    // Trạng thái đơn hàng
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipping", "delivered", "cancelled"],
      default: "pending",
      index: true,
    },
    isDelivered: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
  }
);

module.exports = mongoose.model("Order", orderSchema);