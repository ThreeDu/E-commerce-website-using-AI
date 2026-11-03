/**
 * Tool ghi dữ liệu đơn lẻ cho admin chatbot (cần admin xác nhận).
 */
const Product = require('../../models/Product');
const AuditLog = require('../../models/AuditLog');
const { changeOrderStatus } = require('../../services/orderStatusService');

// ─── Tool 3: updateOrderStatus ─────────────────────────────────────────────────
async function updateOrderStatus({ orderId, newStatus, reason, adminUserId }) {
  try {
    if (!orderId || !newStatus) {
      return { error: 'Thiếu orderId hoặc newStatus.' };
    }

    let result;
    try {
      result = await changeOrderStatus(orderId, newStatus, {
        reason: newStatus === 'cancelled' ? reason || 'Admin hủy đơn qua chatbot' : undefined,
      });
    } catch (err) {
      if (err.status) return { error: err.message };
      throw err;
    }
    const { order, previousStatus: currentStatus } = result;

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

    const Discount = require('../../models/Discount');

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


module.exports = {
  updateOrderStatus,
  updateProduct,
  createProduct,
  createDiscount,
};
