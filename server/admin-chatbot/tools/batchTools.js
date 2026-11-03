/**
 * Tool xuất báo cáo và cập nhật hàng loạt cho admin chatbot.
 */
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const AuditLog = require('../../models/AuditLog');
const { canTransition, changeOrderStatus } = require('../../services/orderStatusService');
const { escapeRegex } = require('../../chatbot-service/textUtils');
const { generateExcelReport } = require('../reportGenerator');
const { REVENUE_ORDER_FILTER } = require('../../services/orderService');

// ─── Tool 10: exportReport ──────────────────────────────────────────────────────
async function exportReport({ reportType }) {
  try {
    let data = [];
    const type = String(reportType || 'orders').toLowerCase();

    if (type === 'orders') {
      const orders = await Order.find({}).sort({ createdAt: -1 }).limit(100).lean();
      data = orders.map((o) => ({
        'Mã Đơn': o._id.toString(),
        'Tổng Tiền': o.totalPrice,
        'Trạng Thái': o.status,
        'Thanh Toán': o.paymentMethod,
        'Ngày Tạo': o.createdAt ? new Date(o.createdAt).toLocaleString('vi-VN') : '',
      }));
    } else if (type === 'products') {
      const products = await Product.find({}).sort({ totalPurchases: -1 }).limit(100).lean();
      data = products.map((p) => ({
        'Mã SP': p._id.toString(),
        'Tên Sản Phẩm': p.name,
        'Danh Mục': p.category,
        'Thương Hiệu': p.brand,
        'Giá': p.price,
        'Tồn Kho': p.stock,
        'Lượt Bán': p.totalPurchases || 0,
      }));
    } else if (type === 'revenue' || type === 'stats') {
      const orders = await Order.find(REVENUE_ORDER_FILTER).lean();
      const totalRev = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
      data = [
        { 'Chỉ Số': 'Tổng Đơn Hàng Thành Công', 'Giá Trị': orders.length },
        { 'Chỉ Số': 'Tổng Doanh Thu (VND)', 'Giá Trị': totalRev },
      ];
    } else {
      return { error: 'Loại báo cáo không hợp lệ. Chọn: orders, products, revenue.' };
    }

    const report = generateExcelReport(data, `Report_${type}`);
    return {
      success: true,
      filename: report.filename,
      downloadUrl: report.downloadUrl,
      totalRecords: data.length,
    };
  } catch (error) {
    return { error: `Lỗi khi xuất báo cáo: ${error.message}` };
  }
}

// ─── Tool 11: batchUpdateProducts ───────────────────────────────────────────────
async function batchUpdateProducts({ category, brand, discountPercent, priceMultiplier, adminUserId }) {
  try {
    const filter = {};
    if (category) filter.category = { $regex: escapeRegex(category), $options: 'i' };
    if (brand) filter.brand = { $regex: escapeRegex(brand), $options: 'i' };

    if (Object.keys(filter).length === 0) {
      return { error: 'Cần chỉ định category hoặc brand để thực hiện batch update.' };
    }

    const products = await Product.find(filter).limit(50);
    let updatedCount = 0;

    for (const p of products) {
      let changed = false;

      if (discountPercent !== undefined) {
        p.discountPercent = Number(discountPercent);
        changed = true;
      }

      if (priceMultiplier !== undefined && priceMultiplier > 0) {
        p.price = Math.round(p.price * Number(priceMultiplier));
        changed = true;
      }

      if (changed) {
        await p.save();
        updatedCount++;
      }
    }

    return {
      success: true,
      updatedCount,
      message: `Đã cập nhật ${updatedCount} sản phẩm thành công.`,
    };
  } catch (error) {
    return { error: `Lỗi batch update sản phẩm: ${error.message}` };
  }
}

// ─── Tool 12: batchUpdateOrders ─────────────────────────────────────────────────
async function batchUpdateOrders({ fromStatus, toStatus, adminUserId }) {
  try {
    if (!fromStatus || !toStatus) {
      return { error: 'Cần truyền fromStatus và toStatus.' };
    }

    if (!canTransition(fromStatus, toStatus)) {
      return { error: `Không thể chuyển trạng thái từ "${fromStatus}" sang "${toStatus}".` };
    }

    // Đi qua từng đơn để áp dụng hoàn kho / cộng điểm / thông báo như cập nhật đơn lẻ.
    const orders = await Order.find({ status: fromStatus }).select('_id').lean();
    let updatedCount = 0;
    for (const { _id } of orders) {
      try {
        await changeOrderStatus(_id, toStatus);
        updatedCount += 1;
      } catch (err) {
        if (!err.status) throw err;
      }
    }

    await AuditLog.create({
      action: 'BATCH_UPDATE_ORDER_STATUS',
      resource: 'Order',
      adminId: adminUserId ? String(adminUserId) : null,
      method: 'CHATBOT',
      path: '/api/admin/chatbot/message',
      details: { from: fromStatus, to: toStatus, count: updatedCount },
    });

    return {
      success: true,
      updatedCount,
      message: `Đã chuyển ${updatedCount} đơn hàng từ ${fromStatus} sang ${toStatus}.`,
    };
  } catch (error) {
    return { error: `Lỗi batch update đơn hàng: ${error.message}` };
  }
}

// Append new schemas to toolSchemas

module.exports = {
  exportReport,
  batchUpdateProducts,
  batchUpdateOrders,
};
