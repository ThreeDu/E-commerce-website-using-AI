const Product = require("../models/Product");
const Order = require("../models/Order");
const { isId } = require("../db/firestore");

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

// shortcut: tổng lượt mua được tính từ toàn bộ đơn chưa huỷ và cache 5 phút theo instance để không
// đọc lại ~nghìn đơn mỗi lần mở trang sản phẩm (hạn mức đọc Firestore). Khi lớn hơn: lưu bộ đếm trên Product.
const PURCHASE_CACHE_MS = 5 * 60 * 1000;
let purchaseCache = { at: 0, totals: null };

async function getPurchaseTotals() {
  if (purchaseCache.totals && Date.now() - purchaseCache.at < PURCHASE_CACHE_MS) {
    return purchaseCache.totals;
  }
  const totals = new Map();
  const orders = await Order.find({ status: { $ne: "cancelled" } }).select("orderItems");
  orders.forEach((order) => (order.orderItems || []).forEach((item) => {
    const key = String(item.product);
    totals.set(key, (totals.get(key) || 0) + Number(item.quantity || 0));
  }));
  purchaseCache = { at: Date.now(), totals };
  return totals;
}

async function getPurchaseMapByProductIds(productIds = []) {
  const ids = (Array.isArray(productIds) ? productIds : []).map((id) => String(id || "").trim()).filter(isId);
  if (ids.length === 0) {
    return new Map();
  }
  const totals = await getPurchaseTotals();
  return new Map(ids.map((id) => [id, totals.get(id) || 0]));
}

// shortcut: danh sách sản phẩm (~50 lượt đọc) được gọi 2 lần mỗi lượt mở trang (header + trang),
// nên cache 30 giây theo instance; tồn kho hiển thị có thể trễ tối đa 30 giây (đặt hàng vẫn kiểm tra kho thật).
const LIST_CACHE_MS = 30 * 1000;
let listCache = { at: 0, products: null };

const listProducts = async (req, res) => {
  try {
    if (listCache.products && Date.now() - listCache.at < LIST_CACHE_MS) {
      return res.json(listCache.products);
    }
    const products = await Product.find({}).lean();
    const purchaseMap = await getPurchaseMapByProductIds(products.map((product) => product._id));
    const normalizedProducts = products.map((product) => ({
      ...product,
      totalPurchases: purchaseMap.get(String(product._id)) || 0,
    }));

    listCache = { at: Date.now(), products: normalizedProducts };
    return res.json(normalizedProducts);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách sản phẩm:", error.message);
    return res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

const trackProductView = async (req, res) => {
  try {
    const authUser = req.user;

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
    const authUser = req.user;

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
    const authUser = req.user;

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
    const authUser = req.user;

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
    const authUser = req.user;

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
  getProductById,
};
