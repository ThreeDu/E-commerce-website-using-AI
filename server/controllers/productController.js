const mongoose = require("mongoose");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { verifyUserRequest } = require("../routes/helpers/authHelpers");

function recalculateRatings(product) {
  const totalRatings = product.reviews.length;
  if (totalRatings === 0) {
    product.totalRatings = 0;
    product.averageRating = 0;
    return;
  }

  const sum = product.reviews.reduce((acc, review) => acc + Number(review.rating || 0), 0);
  product.totalRatings = totalRatings;
  product.averageRating = Number((sum / totalRatings).toFixed(1));
}

async function getPurchaseMapByProductIds(productIds = []) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return new Map();
  }

  const objectIds = productIds
    .map((id) => String(id || "").trim())
    .filter(Boolean)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (objectIds.length === 0) {
    return new Map();
  }

  const purchaseStats = await Order.aggregate([
    {
      $match: {
        status: { $ne: "cancelled" },
      },
    },
    {
      $unwind: "$orderItems",
    },
    {
      $match: {
        "orderItems.product": { $in: objectIds },
      },
    },
    {
      $group: {
        _id: "$orderItems.product",
        totalPurchases: {
          $sum: "$orderItems.quantity",
        },
      },
    },
  ]);

  return new Map(purchaseStats.map((item) => [String(item._id), Number(item.totalPurchases || 0)]));
}

const listProducts = async (req, res) => {
  try {
    const products = await Product.find({}).lean();
    const purchaseMap = await getPurchaseMapByProductIds(products.map((product) => product._id));
    const normalizedProducts = products.map((product) => ({
      ...product,
      totalPurchases: purchaseMap.get(String(product._id)) || 0,
    }));

    return res.json(normalizedProducts);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách sản phẩm:", error.message);
    return res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

const trackProductView = async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const product = await Product.findById(req.params.id).select("_id viewedBy totalViews");
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    const userId = String(authUser._id);
    const hasViewed = Array.isArray(product.viewedBy)
      ? product.viewedBy.some((viewerId) => String(viewerId) === userId)
      : false;

    if (!hasViewed) {
      product.viewedBy = [...(product.viewedBy || []), authUser._id];
      product.totalViews = Number(product.totalViews || 0) + 1;
      await product.save();
    }

    return res.json({
      message: hasViewed ? "Lượt xem đã được ghi nhận trước đó." : "Ghi nhận lượt xem thành công.",
      totalViews: product.totalViews,
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi ghi nhận lượt xem" });
  }
};

const getReviewEligibility = async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const product = await Product.findById(req.params.id).select("_id reviews");
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    const deliveredOrders = await Order.find({
      user: authUser._id,
      status: "delivered",
      "orderItems.product": product._id,
    }).select("_id createdAt orderItems");

    const reviewedOrderIds = new Set(
      (product.reviews || [])
        .filter((review) => String(review.user) === String(authUser._id))
        .map((review) => String(review.order))
    );

    const availableOrders = deliveredOrders
      .filter((order) => !reviewedOrderIds.has(String(order._id)))
      .map((order) => ({
        _id: order._id,
        createdAt: order.createdAt,
      }));

    return res.json({
      canReview: availableOrders.length > 0,
      availableOrders,
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi kiểm tra quyền đánh giá" });
  }
};

const createReview = async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    const rating = Number(req.body?.rating || 0);
    const comment = String(req.body?.comment || "").trim();
    const orderId = String(req.body?.orderId || "").trim();

    if (!orderId) {
      return res.status(400).json({ message: "Thiếu thông tin đơn hàng để đánh giá." });
    }

    if (Number.isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Số sao đánh giá phải từ 1 đến 5." });
    }

    if (comment.length < 5) {
      return res.status(400).json({ message: "Nội dung đánh giá phải có ít nhất 5 ký tự." });
    }

    const deliveredOrder = await Order.findOne({
      _id: orderId,
      user: authUser._id,
      status: "delivered",
      "orderItems.product": product._id,
    }).select("_id");

    if (!deliveredOrder) {
      return res.status(400).json({ message: "Bạn chỉ có thể đánh giá sản phẩm từ đơn hàng đã giao." });
    }

    const existedReview = (product.reviews || []).some(
      (review) => String(review.user) === String(authUser._id) && String(review.order) === String(orderId)
    );

    if (existedReview) {
      return res.status(409).json({ message: "Bạn đã đánh giá sản phẩm này cho đơn hàng đã chọn." });
    }

    product.reviews.push({
      user: authUser._id,
      order: deliveredOrder._id,
      rating,
      comment,
    });
    recalculateRatings(product);
    await product.save();

    const lastReview = product.reviews[product.reviews.length - 1];

    return res.status(201).json({
      message: "Đánh giá sản phẩm thành công.",
      review: {
        _id: lastReview._id,
        user: authUser._id,
        userName: authUser.name,
        order: lastReview.order,
        rating: lastReview.rating,
        comment: lastReview.comment,
        createdAt: lastReview.createdAt,
      },
      averageRating: product.averageRating,
      totalRatings: product.totalRatings,
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi gửi đánh giá" });
  }
};

const updateReview = async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    const review = product.reviews.id(req.params.reviewId);
    if (!review) {
      return res.status(404).json({ message: "Không tìm thấy đánh giá cần chỉnh sửa." });
    }

    if (String(review.user) !== String(authUser._id)) {
      return res.status(403).json({ message: "Bạn chỉ có thể chỉnh sửa đánh giá của mình." });
    }

    const rating = Number(req.body?.rating || 0);
    const comment = String(req.body?.comment || "").trim();

    if (Number.isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Số sao đánh giá phải từ 1 đến 5." });
    }

    if (comment.length < 5) {
      return res.status(400).json({ message: "Nội dung đánh giá phải có ít nhất 5 ký tự." });
    }

    review.rating = rating;
    review.comment = comment;
    recalculateRatings(product);
    await product.save();

    return res.json({
      message: "Cập nhật đánh giá thành công.",
      review: {
        _id: review._id,
        user: authUser._id,
        order: review.order,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      },
      averageRating: product.averageRating,
      totalRatings: product.totalRatings,
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi cập nhật đánh giá" });
  }
};

const deleteReview = async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    const review = product.reviews.id(req.params.reviewId);
    if (!review) {
      return res.status(404).json({ message: "Không tìm thấy đánh giá cần xóa." });
    }

    if (String(review.user) !== String(authUser._id)) {
      return res.status(403).json({ message: "Bạn chỉ có thể xóa đánh giá của mình." });
    }

    product.reviews.pull(review._id);
    recalculateRatings(product);
    await product.save();

    return res.json({
      message: "Xóa đánh giá thành công.",
      reviewId: req.params.reviewId,
      averageRating: product.averageRating,
      totalRatings: product.totalRatings,
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi xóa đánh giá" });
  }
};

const seedProducts = async (req, res) => {
  const mockProducts = [
    {
      name: "Điện thoại AI Pro",
      price: 25000000,
      category: "Điện thoại",
      description: "Điện thoại thông minh tích hợp AI mới nhất, camera siêu nét 108MP, pin trâu 5000mAh.",
      stock: 50,
    },
    {
      name: "Laptop DevBook 16",
      price: 40000000,
      category: "Laptop",
      description: "Cỗ máy làm việc với chip hiệu năng cao, RAM 32GB, ổ cứng SSD 1TB chuẩn PCIe 4.0.",
      stock: 30,
    },
    {
      name: "Tai nghe Noise Cancel",
      price: 3500000,
      category: "Phụ kiện",
      description: "Tai nghe chống ồn chủ động ANC, âm thanh Hi-Res chân thực, pin sử dụng liên tục 30 giờ.",
      stock: 100,
    },
    {
      name: "Đồng hồ thông minh",
      price: 5000000,
      category: "Phụ kiện",
      description: "Theo dõi sức khỏe toàn diện, đo nhịp tim, nồng độ oxy trong máu, chống nước chuẩn 5ATM.",
      stock: 80,
    },
    {
      name: "Bàn phím cơ RGB",
      price: 2100000,
      category: "Phụ kiện",
      description: "Bàn phím cơ sử dụng switch cao cấp, tích hợp LED RGB 16.8 triệu màu tùy chỉnh, gõ cực êm.",
      stock: 45,
    },
    {
      name: "Chuột không dây Ergonomic",
      price: 950000,
      category: "Phụ kiện",
      description: "Thiết kế công thái học chống mỏi tay khi dùng lâu, kết nối wireless độ trễ thấp, pin sạc dùng 3 tháng.",
      stock: 120,
    },
    {
      name: "Màn hình 4K 27 inch",
      price: 12500000,
      category: "Phụ kiện",
      description: "Màn hình độ phân giải 4K sắc nét, chuẩn màu 99% sRGB dành cho dân thiết kế, tích hợp công nghệ bảo vệ mắt.",
      stock: 15,
    },
    {
      name: "Webcam Full HD",
      price: 1200000,
      category: "Phụ kiện",
      description: "Webcam 1080p sắc nét lý tưởng cho học tập và họp trực tuyến, tích hợp micro chống ồn kép.",
      stock: 60,
    },
  ];

  try {
    await Product.deleteMany({});
    const createdProducts = await Product.insertMany(mockProducts);
    return res.status(201).json({ message: "Seed data thành công!", count: createdProducts.length });
  } catch (error) {
    console.error("Lỗi khi seed data:", error.message);
    return res.status(500).json({ message: "Lỗi khi seed data", error: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("reviews.user", "_id name");

    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    const normalizedReviews = (product.reviews || []).map((review) => ({
      _id: review._id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      order: review.order,
      user: review.user
        ? {
            _id: review.user._id,
            name: review.user.name,
          }
        : null,
    }));

    const purchaseMap = await getPurchaseMapByProductIds([product._id]);

    return res.json({
      ...product.toObject(),
      reviews: normalizedReviews,
      totalPurchases: purchaseMap.get(String(product._id)) || 0,
    });
  } catch (error) {
    console.error(`Lỗi khi lấy sản phẩm ID ${req.params.id}:`, error.message);
    if (error.name === "CastError") {
      return res.status(400).json({ message: "ID sản phẩm không hợp lệ" });
    }
    return res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

module.exports = {
  listProducts,
  trackProductView,
  getReviewEligibility,
  createReview,
  updateReview,
  deleteReview,
  seedProducts,
  getProductById,
};
