const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// ─── Valid status transitions ──────────────────────────────────────────────────
const VALID_STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

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

    // Count orders by status
    const statusCounts = await Order.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statusMap = {};
    let totalOrders = 0;
    for (const item of statusCounts) {
      statusMap[item._id] = item.count;
      totalOrders += item.count;
    }

    // Revenue from delivered/confirmed orders
    const revenueResult = await Order.aggregate([
      {
        $match: {
          ...dateFilter,
          status: { $in: ['delivered', 'confirmed'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]);

    const revenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

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

// ─── Tool 3: updateOrderStatus ─────────────────────────────────────────────────
async function updateOrderStatus({ orderId, newStatus, reason, adminUserId }) {
  try {
    if (!orderId || !newStatus) {
      return { error: 'Thiếu orderId hoặc newStatus.' };
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return { error: `Không tìm thấy đơn hàng với ID: ${orderId}` };
    }

    const currentStatus = order.status;
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      return {
        error: `Không thể chuyển trạng thái từ "${currentStatus}" sang "${newStatus}". Trạng thái hợp lệ: ${allowed.length > 0 ? allowed.join(', ') : 'không có (trạng thái cuối)'}`,
      };
    }

    order.status = newStatus;

    if (newStatus === 'cancelled') {
      order.cancelledReason = reason || 'Admin hủy đơn qua chatbot';
      order.cancelledAt = new Date();
    }

    if (newStatus === 'delivered') {
      order.isDelivered = true;
      order.deliveredAt = new Date();
    }

    await order.save();

    // Create audit log
    await AuditLog.create({
      action: 'UPDATE_ORDER_STATUS',
      resource: 'Order',
      resourceId: String(orderId),
      adminId: adminUserId ? String(adminUserId) : null,
      method: 'CHATBOT',
      path: '/api/admin/chatbot/message',
      details: {
        from: currentStatus,
        to: newStatus,
        reason: reason || null,
      },
    });

    return {
      success: true,
      orderId: order._id,
      previousStatus: currentStatus,
      newStatus: order.status,
      updatedAt: order.updatedAt,
    };
  } catch (error) {
    return { error: `Lỗi khi cập nhật trạng thái đơn hàng: ${error.message}` };
  }
}

// ─── Tool 4: searchProducts ────────────────────────────────────────────────────
async function searchProducts({ query, brand, lowStock, limit = 10 }) {
  try {
    const filter = {};

    if (query) {
      filter.name = { $regex: query, $options: 'i' };
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

// ─── Tool 5: updateProduct ─────────────────────────────────────────────────────
async function updateProduct({ productId, price, stock, discountPercent, adminUserId }) {
  try {
    if (!productId) {
      return { error: 'Thiếu productId.' };
    }

    const product = await Product.findById(productId);
    if (!product) {
      return { error: `Không tìm thấy sản phẩm với ID: ${productId}` };
    }

    const changes = {};

    if (price !== undefined && price !== null) {
      changes.price = { from: product.price, to: Number(price) };
      product.price = Number(price);
    }
    if (stock !== undefined && stock !== null) {
      changes.stock = { from: product.stock, to: Number(stock) };
      product.stock = Number(stock);
    }
    if (discountPercent !== undefined && discountPercent !== null) {
      changes.discountPercent = { from: product.discountPercent, to: Number(discountPercent) };
      product.discountPercent = Number(discountPercent);
    }

    if (Object.keys(changes).length === 0) {
      return { error: 'Không có trường nào được cập nhật. Vui lòng cung cấp price, stock, hoặc discountPercent.' };
    }

    await product.save();

    // Create audit log
    await AuditLog.create({
      action: 'UPDATE_PRODUCT',
      resource: 'Product',
      resourceId: String(productId),
      adminId: adminUserId ? String(adminUserId) : null,
      method: 'CHATBOT',
      path: '/api/admin/chatbot/message',
      details: changes,
    });

    return {
      success: true,
      productId: product._id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      discountPercent: product.discountPercent,
      changes,
    };
  } catch (error) {
    return { error: `Lỗi khi cập nhật sản phẩm: ${error.message}` };
  }
}

// ─── Tool 6: searchUsers ───────────────────────────────────────────────────────
async function searchUsers({ query, limit = 10 }) {
  try {
    const filter = {};

    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
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

    const orderStats = await Order.aggregate([
      { $match: { user: { $in: userIds } } },
      {
        $group: {
          _id: '$user',
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$totalPrice' },
        },
      },
    ]);

    const statsMap = {};
    for (const stat of orderStats) {
      statsMap[String(stat._id)] = stat;
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

// ─── Tool 8: createProduct ──────────────────────────────────────────────────────
async function createProduct({ name, price, description, category, stock, image, discountPercent, adminUserId }) {
  try {
    if (!name || !price || !description || !category) {
      return { error: 'Thiếu thông tin bắt buộc: name, price, description, category.' };
    }

    const productData = {
      name: String(name).trim(),
      price: Number(price),
      description: String(description).trim(),
      category: String(category).trim(),
      stock: Number(stock || 0),
      discountPercent: Number(discountPercent || 0),
    };

    if (image) {
      productData.image = String(image).trim();
    }

    // Validate price
    if (!Number.isFinite(productData.price) || productData.price <= 0) {
      return { error: 'Giá sản phẩm phải là số dương.' };
    }

    const product = new Product(productData);
    await product.save();

    // Create AuditLog
    await AuditLog.create({
      action: 'CREATE_PRODUCT',
      resource: 'Product',
      resourceId: String(product._id),
      adminId: adminUserId || null,
      method: 'CHATBOT',
      path: '/api/admin/chatbot/message',
      details: {
        productName: product.name,
        price: product.price,
        category: product.category,
        stock: product.stock,
      },
    });

    return {
      success: true,
      product: {
        _id: product._id,
        name: product.name,
        price: product.price,
        category: product.category,
        stock: product.stock,
        sku: product.sku,
        brand: product.brand,
        discountPercent: product.discountPercent,
      },
    };
  } catch (error) {
    if (error.code === 11000) {
      return { error: 'Sản phẩm bị trùng SKU. Vui lòng kiểm tra lại tên sản phẩm.' };
    }
    return { error: `Lỗi khi tạo sản phẩm: ${error.message}` };
  }
}

// ─── Tool 9: createDiscount ─────────────────────────────────────────────────────
async function createDiscount({ code, type, value, minOrderValue, maxDiscountValue, startDate, endDate, usageLimit, usageLimitPerUser, adminUserId }) {
  try {
    if (!code || !value) {
      return { error: 'Thiếu thông tin bắt buộc: code, value.' };
    }

    const Discount = require('../models/Discount');

    const discountData = {
      code: String(code).trim().toUpperCase(),
      type: type === 'fixed' ? 'fixed' : 'percent',
      value: Number(value),
      isActive: true,
    };

    if (minOrderValue !== undefined) discountData.minOrderValue = Number(minOrderValue);
    if (maxDiscountValue !== undefined) discountData.maxDiscountValue = Number(maxDiscountValue);
    if (usageLimit !== undefined) discountData.usageLimit = Number(usageLimit);
    if (usageLimitPerUser !== undefined) discountData.usageLimitPerUser = Number(usageLimitPerUser);
    if (startDate) discountData.startDate = new Date(startDate);
    if (endDate) discountData.endDate = new Date(endDate);

    // Validate value
    if (!Number.isFinite(discountData.value) || discountData.value <= 0) {
      return { error: 'Giá trị giảm giá phải là số dương.' };
    }
    if (discountData.type === 'percent' && discountData.value > 100) {
      return { error: 'Giảm giá phần trăm không được vượt quá 100%.' };
    }

    const discount = new Discount(discountData);
    await discount.save();

    // Create AuditLog
    await AuditLog.create({
      action: 'CREATE_DISCOUNT',
      resource: 'Discount',
      resourceId: String(discount._id),
      adminId: adminUserId || null,
      method: 'CHATBOT',
      path: '/api/admin/chatbot/message',
      details: {
        code: discount.code,
        type: discount.type,
        value: discount.value,
        minOrderValue: discount.minOrderValue,
        usageLimit: discount.usageLimit,
      },
    });

    return {
      success: true,
      discount: {
        _id: discount._id,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        minOrderValue: discount.minOrderValue,
        maxDiscountValue: discount.maxDiscountValue,
        startDate: discount.startDate,
        endDate: discount.endDate,
        usageLimit: discount.usageLimit,
        usageLimitPerUser: discount.usageLimitPerUser,
        isActive: discount.isActive,
      },
    };
  } catch (error) {
    if (error.code === 11000) {
      return { error: `Mã giảm giá "${code}" đã tồn tại. Vui lòng dùng mã khác.` };
    }
    return { error: `Lỗi khi tạo mã giảm giá: ${error.message}` };
  }
}

// ─── Tool definitions for LLM function calling ────────────────────────────────
// Gemini format: functionDeclarations with uppercase types
// OpenAI format: tools with type: 'function' wrapper

const toolSchemas = [
  {
    name: 'getDashboardStats',
    description: 'Lấy thống kê tổng quan dashboard: tổng đơn hàng, doanh thu, người dùng mới, sản phẩm mới theo khoảng thời gian.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month'],
          description: 'Khoảng thời gian thống kê: today (hôm nay), week (7 ngày), month (30 ngày).',
        },
      },
    },
  },
  {
    name: 'searchOrders',
    description: 'Tìm kiếm đơn hàng theo ID, trạng thái, hoặc khoảng thời gian.',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'ID đơn hàng cụ thể cần tra cứu (tùy chọn).',
        },
        status: {
          type: 'string',
          enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'],
          description: 'Lọc theo trạng thái đơn hàng (tùy chọn).',
        },
        dateFrom: {
          type: 'string',
          description: 'Ngày bắt đầu lọc, ISO format (tùy chọn).',
        },
        dateTo: {
          type: 'string',
          description: 'Ngày kết thúc lọc, ISO format (tùy chọn).',
        },
        limit: {
          type: 'number',
          description: 'Số lượng kết quả tối đa, mặc định 10.',
        },
      },
    },
  },
  {
    name: 'updateOrderStatus',
    description: 'Cập nhật trạng thái đơn hàng. Yêu cầu xác nhận từ admin trước khi thực hiện.',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'ID đơn hàng cần cập nhật.',
        },
        newStatus: {
          type: 'string',
          enum: ['confirmed', 'shipping', 'delivered', 'cancelled'],
          description: 'Trạng thái mới cho đơn hàng.',
        },
        reason: {
          type: 'string',
          description: 'Lý do cập nhật (bắt buộc khi hủy đơn).',
        },
      },
      required: ['orderId', 'newStatus'],
    },
  },
  {
    name: 'searchProducts',
    description: 'Tìm kiếm sản phẩm theo tên, thương hiệu, hoặc lọc sản phẩm sắp hết hàng.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Từ khóa tìm kiếm theo tên sản phẩm (tùy chọn).',
        },
        brand: {
          type: 'string',
          description: 'Lọc theo thương hiệu (tùy chọn).',
        },
        lowStock: {
          type: 'boolean',
          description: 'Nếu true, chỉ lấy sản phẩm có tồn kho <= 5.',
        },
        limit: {
          type: 'number',
          description: 'Số lượng kết quả tối đa, mặc định 10.',
        },
      },
    },
  },
  {
    name: 'updateProduct',
    description: 'Cập nhật thông tin sản phẩm (giá, tồn kho, giảm giá). Yêu cầu xác nhận từ admin trước khi thực hiện.',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'ID sản phẩm cần cập nhật.',
        },
        price: {
          type: 'number',
          description: 'Giá mới (tùy chọn).',
        },
        stock: {
          type: 'number',
          description: 'Số lượng tồn kho mới (tùy chọn).',
        },
        discountPercent: {
          type: 'number',
          description: 'Phần trăm giảm giá mới, 0-100 (tùy chọn).',
        },
      },
      required: ['productId'],
    },
  },
  {
    name: 'searchUsers',
    description: 'Tìm kiếm khách hàng theo tên hoặc email, bao gồm thống kê đơn hàng của họ.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Từ khóa tìm kiếm theo tên hoặc email.',
        },
        limit: {
          type: 'number',
          description: 'Số lượng kết quả tối đa, mặc định 10.',
        },
      },
    },
  },
  {
    name: 'getRecentLogs',
    description: 'Lấy lịch sử hoạt động quản trị (audit logs) gần đây.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Số lượng kết quả tối đa, mặc định 20.',
        },
        actionType: {
          type: 'string',
          description: 'Lọc theo loại hành động (ví dụ: UPDATE_ORDER_STATUS, UPDATE_PRODUCT).',
        },
      },
    },
  },
  {
    name: 'createProduct',
    description: 'Tạo sản phẩm mới trong hệ thống. Yêu cầu xác nhận từ admin trước khi thực hiện.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Tên sản phẩm (bắt buộc).',
        },
        price: {
          type: 'number',
          description: 'Giá sản phẩm tính bằng VND (bắt buộc).',
        },
        description: {
          type: 'string',
          description: 'Mô tả chi tiết sản phẩm (bắt buộc).',
        },
        category: {
          type: 'string',
          description: 'Danh mục sản phẩm, ví dụ: "Điện thoại", "Laptop", "Tablet" (bắt buộc).',
        },
        stock: {
          type: 'number',
          description: 'Số lượng tồn kho ban đầu, mặc định 0.',
        },
        image: {
          type: 'string',
          description: 'URL ảnh sản phẩm (tùy chọn).',
        },
        discountPercent: {
          type: 'number',
          description: 'Phần trăm giảm giá 0-100 (tùy chọn).',
        },
      },
      required: ['name', 'price', 'description', 'category'],
    },
  },
  {
    name: 'createDiscount',
    description: 'Tạo mã giảm giá mới. Yêu cầu xác nhận từ admin trước khi thực hiện.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Mã giảm giá (sẽ tự động chuyển thành chữ in hoa, bắt buộc).',
        },
        type: {
          type: 'string',
          enum: ['percent', 'fixed'],
          description: 'Loại giảm giá: percent (phần trăm) hoặc fixed (số tiền cố định). Mặc định percent.',
        },
        value: {
          type: 'number',
          description: 'Giá trị giảm giá (bắt buộc). Nếu type=percent thì là phần trăm (1-100), nếu type=fixed thì là số tiền VND.',
        },
        minOrderValue: {
          type: 'number',
          description: 'Giá trị đơn hàng tối thiểu để áp dụng mã (tùy chọn, mặc định 0).',
        },
        maxDiscountValue: {
          type: 'number',
          description: 'Giá trị giảm tối đa (tùy chọn, dùng cho type=percent).',
        },
        startDate: {
          type: 'string',
          description: 'Ngày bắt đầu hiệu lực, ISO format (tùy chọn).',
        },
        endDate: {
          type: 'string',
          description: 'Ngày kết thúc hiệu lực, ISO format (tùy chọn).',
        },
        usageLimit: {
          type: 'number',
          description: 'Giới hạn số lần sử dụng tổng cộng (tùy chọn, 0 = không giới hạn).',
        },
        usageLimitPerUser: {
          type: 'number',
          description: 'Giới hạn số lần mỗi user được sử dụng (tùy chọn, 0 = không giới hạn).',
        },
      },
      required: ['code', 'value'],
    },
  },
];

// Convert parameter types from lowercase (OpenAI) to uppercase (Gemini)
function toGeminiType(schema) {
  if (!schema || typeof schema !== 'object') return schema;

  const result = { ...schema };

  if (result.type) {
    result.type = result.type.toUpperCase();
  }

  if (result.properties) {
    const convertedProps = {};
    for (const [key, value] of Object.entries(result.properties)) {
      convertedProps[key] = toGeminiType(value);
    }
    result.properties = convertedProps;
  }

  if (result.items) {
    result.items = toGeminiType(result.items);
  }

  return result;
}

const TOOL_DEFINITIONS = {
  gemini: [
    {
      functionDeclarations: toolSchemas.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: toGeminiType(tool.parameters),
      })),
    },
  ],
  openai: toolSchemas.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  })),
};

module.exports = {
  getDashboardStats,
  searchOrders,
  updateOrderStatus,
  searchProducts,
  updateProduct,
  searchUsers,
  getRecentLogs,
  createProduct,
  createDiscount,
  TOOL_DEFINITIONS,
};
