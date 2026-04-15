const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

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
      default: "/placeholder.svg", // URL ảnh mặc định
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
    reviews: {
      type: [reviewSchema],
      default: [],
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
      min: 0,
    },
    viewedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
      select: false,
    },
    totalViews: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);