const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên sản phẩm là bắt buộc"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Giá sản phẩm là bắt buộc"],
    },
    description: {
      type: String,
      required: [true, "Mô tả sản phẩm là bắt buộc"],
    },
    category: {
      type: String, // Sau này có thể nâng cấp thành: mongoose.Schema.Types.ObjectId, ref: 'Category'
      required: [true, "Danh mục sản phẩm là bắt buộc"],
    },
    image: {
      type: String,
      default: "/placeholder.jpg", // URL ảnh mặc định
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    finalPrice: {
      // Giá này có thể được tính toán lại trước khi lưu
      // hoặc để frontend tự tính và gửi lên
      type: Number,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);