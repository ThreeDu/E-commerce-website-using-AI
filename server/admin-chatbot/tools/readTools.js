/**
 * Tool đọc dữ liệu cho admin chatbot (không cần xác nhận).
 */
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');
const { escapeRegex } = require('../../chatbot-service/textUtils');
const { REVENUE_ORDER_FILTER } = require('../../services/orderService');

// ─── Helper: compute date range from period ────────────────────────────────────
function getDateRange(period) {
  const now = new Date();
  let start;

  switch (period) {
    case 'today': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    }
    case 'week': {
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'month': {
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
    }
    default: {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    }
  }

  return { start, end: now };
}

// ─── Tool 1: getDashboardStats ─────────────────────────────────────────────────
async function getDashboardStats({ period = 'today' }) {
  try {
    const { start, end } = getDateRange(period);
    const dateFilter = { createdAt: { $gte: start, $lte: end } };

    // Đếm theo trạng thái và doanh thu bằng JS (Firestore không có aggregate)
    const periodOrders = await Order.find(dateFilter).select('status totalPrice');

    const statusMap = {};
    for (const order of periodOrders) {
      statusMap[order.status] = (statusMap[order.status] || 0) + 1;
    }
    const totalOrders = periodOrders.length;

    // Revenue: định nghĩa dùng chung trong orderService
    const revenue = periodOrders
      .filter((order) => Order.matches(order, REVENUE_ORDER_FILTER))
      .reduce((sum, order) => sum + Number(order.totalPrice || 0), 0);

    // New users
    const newUsers = await User.countDocuments(dateFilter);

    // New products
    const newProducts = await Product.countDocuments(dateFilter);

    return {
      totalOrders,
      pendingOrders: statusMap['pending'] || 0,
      confirmedOrders: statusMap['confirmed'] || 0,
      shippingOrders: statusMap['shipping'] || 0,
      deliveredOrders: statusMap['delivered'] || 0,
      cancelledOrders: statusMap['cancelled'] || 0,
      revenue,
      newUsers,
      newProducts,
      period,
    };
  } catch (error) {
    return { error: `Lỗi khi lấy thống kê: ${error.message}` };
  }
}


// ─── Tool 2: searchOrders ──────────────────────────────────────────────────────
async function searchOrders({ orderId, status, dateFrom, dateTo, limit = 10 }) {
  try {
    // Search by specific order ID
    if (orderId) {
      const order = await Order.findById(orderId)
        .populate('user', 'name email')
        .populate('orderItems.product', 'name image')
        .lean();

      if (!order) {
        return { error: `Không tìm thấy đơn hàng với ID: ${orderId}` };
      }

      return {
        orders: [
          {
            _id: order._id,
            user: order.user,
            shippingAddress: order.shippingAddress,
            paymentMethod: order.paymentMethod,
            orderItems: order.orderItems.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              product: item.product,
            })),
            totalPrice: order.totalPrice,
            subtotalPrice: order.subtotalPrice,
            discountAmount: order.discountAmount,
            status: order.status,
            isPaid: order.isPaid,
            paidAt: order.paidAt,
            isDelivered: order.isDelivered,
            deliveredAt: order.deliveredAt,
            cancelledReason: order.cancelledReason,
            createdAt: order.createdAt,
          },
        ],
        total: 1,
      };
    }

    // Build filter
    const filter = {};
    if (status) {
      filter.status = status;
    }
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const safeLimit = Math.min(Math.max(1, Number(limit) || 10), 50);

    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean();

    const total = await Order.countDocuments(filter);

    return {
      orders: orders.map((order) => ({
        _id: order._id,
        userName: order.user?.name || order.shippingAddress?.fullName || 'N/A',
        userEmail: order.user?.email || 'N/A',
        totalPrice: order.totalPrice,
        status: order.status,
        paymentMethod: order.paymentMethod,
        isPaid: order.isPaid,
        itemCount: order.orderItems?.length || 0,
        createdAt: order.createdAt,
      })),
      total,
      showing: orders.length,
    };
  } catch (error) {
    return { error: `Lỗi khi tìm đơn hàng: ${error.message}` };
  }
}

// ─── Tool 4: searchProducts ────────────────────────────────────────────────────
async function searchProducts({ query, brand, lowStock, limit = 10 }) {
  try {
    const filter = {};

    if (query) {
      filter.name = { $regex: escapeRegex(query), $options: 'i' };
    }
    if (brand) {
      filter.brand = brand.toLowerCase();
    }
    if (lowStock === true || lowStock === 'true') {
      filter.stock = { $lte: 5 };
    }

    const safeLimit = Math.min(Math.max(1, Number(limit) || 10), 50);

    const products = await Product.find(filter)
      .select('name price stock category brand discountPercent averageRating image updatedAt')
      .sort({ updatedAt: -1 })
      .limit(safeLimit)
      .lean();

    const total = await Product.countDocuments(filter);

    return {
      products: products.map((p) => ({
        _id: p._id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        category: p.category,
        brand: p.brand,
        discountPercent: p.discountPercent,
        averageRating: p.averageRating,
      })),
      total,
      showing: products.length,
    };
  } catch (error) {
    return { error: `Lỗi khi tìm sản phẩm: ${error.message}` };
  }
}

// ─── Tool 6: searchUsers ───────────────────────────────────────────────────────
async function searchUsers({ query, limit = 10 }) {
  try {
    const filter = {};

    if (query) {
      filter.$or = [
        { name: { $regex: escapeRegex(query), $options: 'i' } },
        { email: { $regex: escapeRegex(query), $options: 'i' } },
      ];
    }

    const safeLimit = Math.min(Math.max(1, Number(limit) || 10), 50);

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean();

    // Aggregate order stats for each user
    const userIds = users.map((u) => u._id);

    const userOrders = await Order.find({ user: { $in: userIds } }).select('user totalPrice');

    const statsMap = {};
    for (const order of userOrders) {
      const stat = (statsMap[String(order.user)] ||= { totalOrders: 0, totalSpent: 0 });
      stat.totalOrders += 1;
      stat.totalSpent += Number(order.totalPrice || 0);
    }

    const total = await User.countDocuments(filter);

    return {
      users: users.map((u) => {
        const stats = statsMap[String(u._id)] || { totalOrders: 0, totalSpent: 0 };
        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          loyaltyPoints: u.loyaltyPoints,
          totalOrders: stats.totalOrders,
          totalSpent: stats.totalSpent,
          createdAt: u.createdAt,
        };
      }),
      total,
      showing: users.length,
    };
  } catch (error) {
    return { error: `Lỗi khi tìm khách hàng: ${error.message}` };
  }
}

// ─── Tool 7: getRecentLogs ─────────────────────────────────────────────────────
async function getRecentLogs({ limit = 20, actionType }) {
  try {
    const filter = {};
    if (actionType) {
      filter.action = actionType;
    }

    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(safeLimit)
      .lean();

    return {
      logs: logs.map((log) => ({
        _id: log._id,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        adminId: log.adminId,
        adminEmail: log.adminEmail,
        method: log.method,
        details: log.details,
        timestamp: log.timestamp,
      })),
      showing: logs.length,
    };
  } catch (error) {
    return { error: `Lỗi khi lấy lịch sử hoạt động: ${error.message}` };
  }
}


module.exports = {
  getDashboardStats,
  searchOrders,
  searchProducts,
  searchUsers,
  getRecentLogs,
};
