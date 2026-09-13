/**
 * chatbotToolExecutor.js — Tool definitions & implementations
 *
 * 7 tools for the customer-facing AI chatbot:
 *  1. searchProducts     — Tìm kiếm sản phẩm
 *  2. getProductDetail   — Chi tiết 1 sản phẩm
 *  3. compareProducts    — So sánh 2 sản phẩm
 *  4. addToCart           — Thêm vào giỏ hàng
 *  5. getOrderStatus     — Tra cứu đơn hàng
 *  6. getCategories      — Danh mục sản phẩm
 *  7. getPromotions      — Khuyến mãi hiện tại
 */

const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Discount = require('../models/Discount');
const { normalizeVietnamese } = require('./textUtils');
const { generateEmbedding, cosineSimilarity } = require('./embeddingHelper');

// ─── Tool 1: searchProducts ─────────────────────────────────────────────────
async function searchProducts({ keyword, brand, category, priceMin, priceMax, sortBy, limit }) {
  try {
    const filter = {};
    const maxResults = Math.min(Number(limit) || 8, 12);

    if (brand) {
      filter.brand = { $regex: normalizeVietnamese(brand).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    if (category) {
      filter.category = { $regex: category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    if (priceMin !== undefined || priceMax !== undefined) {
      filter.finalPrice = {};
      if (priceMin !== undefined) filter.finalPrice.$gte = Number(priceMin);
      if (priceMax !== undefined) filter.priceMax = Number(priceMax);
    }

    let products = [];

    // Try RAG vector search if keyword exists
    let queryVector = null;
    if (keyword) {
      queryVector = await generateEmbedding(keyword);
    }

    if (keyword) {
      const normalized = normalizeVietnamese(keyword);
      const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { brand: { $regex: escaped, $options: 'i' } },
        { series: { $regex: escaped, $options: 'i' } },
      ];
    }

    let sort = {};
    if (sortBy === 'price_asc') sort = { finalPrice: 1 };
    else if (sortBy === 'price_desc') sort = { finalPrice: -1 };
    else if (sortBy === 'rating') sort = { averageRating: -1 };
    else if (sortBy === 'sales') sort = { totalPurchases: -1 };
    else if (sortBy === 'newest') sort = { createdAt: -1 };
    else sort = { averageRating: -1, totalPurchases: -1 };

    products = await Product.find(filter).sort(sort).limit(maxResults * 2).lean();

    // Re-rank results with Vector Similarity if query embedding is available
    if (queryVector && products.length > 0) {
      products = products.map((p) => {
        let similarity = 0;
        if (Array.isArray(p.embedding) && p.embedding.length > 0) {
          similarity = cosineSimilarity(queryVector, p.embedding);
        }
        return { ...p, similarityScore: similarity };
      });

      // Sort by similarity score descending if not custom sorted
      if (!sortBy) {
        products.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
      }
    }

    products = products.slice(0, maxResults);

    if (products.length === 0) {
      return { found: 0, message: 'Không tìm thấy sản phẩm nào phù hợp.' };
    }

    return {
      found: products.length,
      products: products.map((p) => ({
        _id: p._id,
        name: p.name,
        price: p.price,
        finalPrice: p.finalPrice,
        discountPercent: p.discountPercent || 0,
        image: p.image,
        averageRating: p.averageRating || 0,
        totalRatings: p.totalRatings || 0,
        stock: p.stock,
        brand: p.brand || '',
        category: p.category,
        series: p.series || '',
      })),
    };
  } catch (error) {
    return { error: `Lỗi khi tìm kiếm sản phẩm: ${error.message}` };
  }
}

// ─── Tool 2: getProductDetail ───────────────────────────────────────────────
async function getProductDetail({ productId, productName }) {
  try {
    let product;

    if (productId) {
      product = await Product.findById(productId)
        .select('-embedding -viewedBy')
        .lean();
    } else if (productName) {
      const normalized = normalizeVietnamese(productName);
      const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      product = await Product.findOne({
        $or: [
          { name: { $regex: escaped, $options: 'i' } },
          { series: { $regex: escaped, $options: 'i' } },
        ],
      })
        .select('-embedding -viewedBy')
        .lean();
    }

    if (!product) {
      return { error: 'Không tìm thấy sản phẩm.' };
    }

    // Calculate review summary
    const reviewSummary = product.reviews?.length
      ? {
          totalReviews: product.reviews.length,
          averageRating: product.averageRating,
          recentReviews: product.reviews.slice(-3).map((r) => ({
            rating: r.rating,
            comment: r.comment,
          })),
        }
      : { totalReviews: 0, averageRating: 0, recentReviews: [] };

    return {
      _id: product._id,
      name: product.name,
      price: product.price,
      finalPrice: product.finalPrice,
      discountPercent: product.discountPercent || 0,
      image: product.image,
      brand: product.brand || '',
      series: product.series || '',
      model: product.model || '',
      category: product.category,
      stock: product.stock,
      description: product.description,
      reviews: reviewSummary,
    };
  } catch (error) {
    return { error: `Lỗi khi lấy chi tiết sản phẩm: ${error.message}` };
  }
}

// ─── Tool 3: compareProducts ────────────────────────────────────────────────
async function compareProducts({ productId1, productId2, productName1, productName2 }) {
  try {
    // Find both products
    const findProduct = async (id, name) => {
      if (id) return Product.findById(id).select('-embedding -viewedBy').lean();
      if (name) {
        const normalized = normalizeVietnamese(name);
        const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return Product.findOne({
          $or: [
            { name: { $regex: escaped, $options: 'i' } },
            { series: { $regex: escaped, $options: 'i' } },
          ],
        })
          .select('-embedding -viewedBy')
          .lean();
      }
      return null;
    };

    const [p1, p2] = await Promise.all([
      findProduct(productId1, productName1),
      findProduct(productId2, productName2),
    ]);

    if (!p1 || !p2) {
      const missing = [];
      if (!p1) missing.push(productName1 || productId1 || 'sản phẩm 1');
      if (!p2) missing.push(productName2 || productId2 || 'sản phẩm 2');
      return { error: `Không tìm thấy: ${missing.join(', ')}` };
    }

    const format = (p) => ({
      _id: p._id,
      name: p.name,
      price: p.price,
      finalPrice: p.finalPrice,
      discountPercent: p.discountPercent || 0,
      image: p.image,
      brand: p.brand || '',
      category: p.category,
      stock: p.stock,
      averageRating: p.averageRating || 0,
      totalRatings: p.totalRatings || 0,
      description: p.description,
    });

    return {
      product1: format(p1),
      product2: format(p2),
    };
  } catch (error) {
    return { error: `Lỗi khi so sánh sản phẩm: ${error.message}` };
  }
}

// ─── Tool 4: addToCart ──────────────────────────────────────────────────────
async function addToCart({ productId, quantity, userId }) {
  try {
    if (!userId) {
      return { error: 'Bạn cần đăng nhập để thêm sản phẩm vào giỏ hàng.' };
    }

    const product = await Product.findById(productId).select('name stock price finalPrice image').lean();
    if (!product) {
      return { error: 'Không tìm thấy sản phẩm.' };
    }

    const qty = Math.max(1, Number(quantity) || 1);

    if (product.stock < qty) {
      return { error: `Sản phẩm "${product.name}" chỉ còn ${product.stock} sản phẩm trong kho.` };
    }

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({ user: userId, items: [{ product: productId, quantity: qty }] });
    } else {
      const existingItem = cart.items.find((item) => String(item.product) === String(productId));
      if (existingItem) {
        existingItem.quantity += qty;
      } else {
        cart.items.push({ product: productId, quantity: qty });
      }
    }

    await cart.save();

    return {
      success: true,
      message: `Đã thêm "${product.name}" (x${qty}) vào giỏ hàng.`,
      cartItemCount: cart.items.length,
      productName: product.name,
    };
  } catch (error) {
    return { error: `Lỗi khi thêm vào giỏ hàng: ${error.message}` };
  }
}

// ─── Tool 5: getOrderStatus ─────────────────────────────────────────────────
async function getOrderStatus({ orderId, userId }) {
  try {
    if (!userId) {
      return { error: 'Bạn cần đăng nhập để tra cứu đơn hàng.' };
    }

    const STATUS_MAP = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      shipping: 'Đang giao hàng',
      delivered: 'Đã giao thành công',
      cancelled: 'Đã hủy',
    };

    // If orderId specified, find that specific order
    if (orderId) {
      const order = await Order.findOne({ _id: orderId, user: userId })
        .select('status totalPrice orderItems paymentMethod createdAt isDelivered isPaid')
        .lean();

      if (!order) {
        return { error: 'Không tìm thấy đơn hàng hoặc đơn hàng không thuộc về bạn.' };
      }

      return {
        orderId: order._id,
        status: STATUS_MAP[order.status] || order.status,
        statusCode: order.status,
        totalPrice: order.totalPrice,
        itemCount: order.orderItems?.length || 0,
        items: order.orderItems?.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })) || [],
        paymentMethod: order.paymentMethod,
        isPaid: order.isPaid,
        isDelivered: order.isDelivered,
        createdAt: order.createdAt,
      };
    }

    // Otherwise, get recent orders for the user
    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('status totalPrice orderItems paymentMethod createdAt')
      .lean();

    if (orders.length === 0) {
      return { message: 'Bạn chưa có đơn hàng nào.' };
    }

    return {
      totalOrders: orders.length,
      orders: orders.map((o) => ({
        orderId: o._id,
        status: STATUS_MAP[o.status] || o.status,
        statusCode: o.status,
        totalPrice: o.totalPrice,
        itemCount: o.orderItems?.length || 0,
        createdAt: o.createdAt,
      })),
    };
  } catch (error) {
    return { error: `Lỗi khi tra cứu đơn hàng: ${error.message}` };
  }
}

// ─── Tool 6: getCategories ──────────────────────────────────────────────────
async function getCategories() {
  try {
    // Get distinct categories that have actual products
    const categories = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return {
      categories: categories.map((c) => ({
        name: c._id,
        productCount: c.count,
      })),
    };
  } catch (error) {
    return { error: `Lỗi khi lấy danh mục: ${error.message}` };
  }
}

// ─── Tool 7: getPromotions ──────────────────────────────────────────────────
async function getPromotions({ category }) {
  try {
    const now = new Date();

    // Get active discount codes
    const discounts = await Discount.find({
      isActive: true,
      $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }],
    })
      .select('code type value minOrderValue maxDiscountValue endDate usageLimit usedCount')
      .limit(5)
      .lean();

    // Get discounted products
    const productFilter = { discountPercent: { $gt: 0 } };
    if (category) {
      productFilter.category = { $regex: category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const discountedProducts = await Product.find(productFilter)
      .sort({ discountPercent: -1 })
      .limit(8)
      .select('name price finalPrice discountPercent image averageRating category brand')
      .lean();

    return {
      discountCodes: discounts.map((d) => ({
        code: d.code,
        type: d.type,
        value: d.value,
        minOrderValue: d.minOrderValue,
        maxDiscountValue: d.maxDiscountValue,
        endDate: d.endDate,
        remaining: d.usageLimit > 0 ? d.usageLimit - d.usedCount : 'Không giới hạn',
      })),
      discountedProducts: discountedProducts.map((p) => ({
        _id: p._id,
        name: p.name,
        price: p.price,
        finalPrice: p.finalPrice,
        discountPercent: p.discountPercent,
        image: p.image,
        averageRating: p.averageRating || 0,
        category: p.category,
        brand: p.brand || '',
      })),
    };
  } catch (error) {
    return { error: `Lỗi khi lấy khuyến mãi: ${error.message}` };
  }
}

// ─── Tool Definitions (for LLM) ────────────────────────────────────────────
const TOOL_DEFINITIONS = [
  {
    name: 'searchProducts',
    description: 'Tìm kiếm sản phẩm theo từ khóa, thương hiệu, danh mục, khoảng giá. Luôn gọi tool này khi khách hỏi về sản phẩm, gợi ý, hoặc tìm kiếm.',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Từ khóa tìm kiếm (tên sản phẩm, dòng sản phẩm, tính năng).' },
        brand: { type: 'string', description: 'Lọc theo thương hiệu (Apple, Samsung, Xiaomi, OPPO, v.v.).' },
        category: { type: 'string', description: 'Lọc theo danh mục (Điện thoại, Laptop, Tablet, v.v.).' },
        priceMin: { type: 'number', description: 'Giá tối thiểu (VND).' },
        priceMax: { type: 'number', description: 'Giá tối đa (VND).' },
        sortBy: { type: 'string', enum: ['price_asc', 'price_desc', 'rating', 'sales', 'newest'], description: 'Sắp xếp kết quả.' },
        limit: { type: 'number', description: 'Số lượng kết quả tối đa (mặc định 8, tối đa 12).' },
      },
    },
  },
  {
    name: 'getProductDetail',
    description: 'Lấy thông tin chi tiết đầy đủ của 1 sản phẩm (mô tả, specs, đánh giá, tồn kho). Gọi khi khách muốn biết chi tiết về sản phẩm cụ thể.',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'ID sản phẩm (MongoDB ObjectId).' },
        productName: { type: 'string', description: 'Tên sản phẩm (dùng khi không có ID).' },
      },
    },
  },
  {
    name: 'compareProducts',
    description: 'So sánh 2 sản phẩm cạnh nhau (giá, specs, đánh giá). Gọi khi khách muốn so sánh hoặc chọn giữa 2 sản phẩm.',
    parameters: {
      type: 'object',
      properties: {
        productId1: { type: 'string', description: 'ID sản phẩm thứ nhất.' },
        productId2: { type: 'string', description: 'ID sản phẩm thứ hai.' },
        productName1: { type: 'string', description: 'Tên sản phẩm thứ nhất (dùng khi không có ID).' },
        productName2: { type: 'string', description: 'Tên sản phẩm thứ hai (dùng khi không có ID).' },
      },
    },
  },
  {
    name: 'addToCart',
    description: 'Thêm sản phẩm vào giỏ hàng của khách. Chỉ gọi khi khách yêu cầu rõ ràng muốn thêm vào giỏ hàng.',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'ID sản phẩm cần thêm.' },
        quantity: { type: 'number', description: 'Số lượng (mặc định 1).' },
      },
      required: ['productId'],
    },
  },
  {
    name: 'getOrderStatus',
    description: 'Tra cứu tình trạng đơn hàng. Nếu không có orderId, trả về 5 đơn hàng gần nhất.',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'ID đơn hàng cụ thể cần tra cứu (tùy chọn).' },
      },
    },
  },
  {
    name: 'getCategories',
    description: 'Liệt kê tất cả danh mục sản phẩm có sẵn trong cửa hàng và số lượng sản phẩm mỗi danh mục.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getPromotions',
    description: 'Lấy danh sách mã giảm giá đang hoạt động và sản phẩm đang khuyến mãi.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Lọc sản phẩm khuyến mãi theo danh mục (tùy chọn).' },
      },
    },
  },
];

// ─── Tool Executor ──────────────────────────────────────────────────────────
const TOOL_FUNCTIONS = {
  searchProducts,
  getProductDetail,
  compareProducts,
  addToCart,
  getOrderStatus,
  getCategories,
  getPromotions,
};

/**
 * Execute a tool by name with given arguments.
 * @param {string} toolName
 * @param {object} args
 * @param {string|null} userId - Authenticated user ID (for cart/order operations)
 * @returns {Promise<object>}
 */
async function executeTool(toolName, args, userId) {
  const fn = TOOL_FUNCTIONS[toolName];
  if (!fn) {
    return { error: `Tool "${toolName}" không tồn tại.` };
  }

  // Inject userId for tools that require authentication
  if (toolName === 'addToCart' || toolName === 'getOrderStatus') {
    args.userId = userId;
  }

  return fn(args);
}

module.exports = {
  TOOL_DEFINITIONS,
  executeTool,
};
