const Order = require("../../models/Order");
const Product = require("../../models/Product");
const Discount = require("../../models/Discount");

const LOW_STOCK_THRESHOLD = 5;
const RECENT_WINDOW_HOURS = 24;
const NEAR_DISCOUNT_REMAINING_THRESHOLD = 5;
const NEAR_DISCOUNT_EXPIRY_DAYS = 3;

const toCustomerName = (order) => String(order?.shippingAddress?.fullName || "Khách hàng").trim() || "Khách hàng";

const getAdminNotifications = async (req, res) => {
  try {
    const now = new Date();
    const recentFrom = new Date(now.getTime() - RECENT_WINDOW_HOURS * 60 * 60 * 1000);
    const nearExpiryTo = new Date(now.getTime() + NEAR_DISCOUNT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const [
      recentOrders,
      recentCancelledOrders,
      lowStockProducts,
      outOfStockProducts,
      discounts,
    ] = await Promise.all([
      Order.find({ createdAt: { $gte: recentFrom } })
        .sort({ createdAt: -1 })
        .limit(12)
        .select("_id status totalPrice createdAt shippingAddress.fullName")
        .lean(),
      Order.find({
        status: "cancelled",
        $or: [
          { cancelledAt: { $gte: recentFrom } },
          { updatedAt: { $gte: recentFrom } },
        ],
      })
        .sort({ cancelledAt: -1, updatedAt: -1 })
        .limit(12)
        .select("_id status totalPrice cancelledAt updatedAt shippingAddress.fullName")
        .lean(),
      Product.find({ stock: { $gt: 0, $lte: LOW_STOCK_THRESHOLD } })
        .sort({ stock: 1, updatedAt: -1 })
        .limit(12)
        .select("_id name stock updatedAt")
        .lean(),
      Product.find({ stock: { $lte: 0 } })
        .sort({ updatedAt: -1 })
        .limit(12)
        .select("_id name stock updatedAt")
        .lean(),
      Discount.find({ isActive: true })
        .sort({ endDate: 1, updatedAt: -1 })
        .select("_id code usageLimit usedCount endDate isActive")
        .lean(),
    ]);

    const nearLimitDiscounts = [];
    const exhaustedDiscounts = [];

    discounts.forEach((discount) => {
      const usageLimit = Math.max(0, Number(discount.usageLimit || 0));
      const usedCount = Math.max(0, Number(discount.usedCount || 0));
      const hasUsageLimit = usageLimit > 0;
      const remainingUses = hasUsageLimit ? Math.max(0, usageLimit - usedCount) : null;
      const hasEndDate = Boolean(discount.endDate);
      const endDate = hasEndDate ? new Date(discount.endDate) : null;
      const isExpiredByDate = Boolean(endDate && endDate <= now);
      const isNearExpiryByDate = Boolean(endDate && endDate > now && endDate <= nearExpiryTo);
      const isExhaustedByUsage = hasUsageLimit && remainingUses === 0;
      const isNearUsageLimit = hasUsageLimit && remainingUses > 0 && remainingUses <= NEAR_DISCOUNT_REMAINING_THRESHOLD;

      const enrichedDiscount = {
        ...discount,
        usageLimit,
        usedCount,
        remainingUses,
        isExpiredByDate,
        isNearExpiryByDate,
        isExhaustedByUsage,
        isNearUsageLimit,
      };

      if (isExhaustedByUsage || isExpiredByDate) {
        exhaustedDiscounts.push(enrichedDiscount);
        return;
      }

      if (isNearUsageLimit || isNearExpiryByDate) {
        nearLimitDiscounts.push(enrichedDiscount);
      }
    });

    return res.json({
      message: "Lấy thông báo quản trị thành công.",
      generatedAt: now,
      summary: {
        newOrders: recentOrders.length,
        cancelledOrders: recentCancelledOrders.length,
        lowStockProducts: lowStockProducts.length,
        outOfStockProducts: outOfStockProducts.length,
        nearLimitDiscounts: nearLimitDiscounts.length,
        exhaustedDiscounts: exhaustedDiscounts.length,
      },
      sections: {
        newOrders: recentOrders.map((order) => ({
          ...order,
          customerName: toCustomerName(order),
        })),
        cancelledOrders: recentCancelledOrders.map((order) => ({
          ...order,
          customerName: toCustomerName(order),
        })),
        lowStockProducts,
        outOfStockProducts,
        nearLimitDiscounts: nearLimitDiscounts.slice(0, 12),
        exhaustedDiscounts: exhaustedDiscounts.slice(0, 12),
      },
      config: {
        recentWindowHours: RECENT_WINDOW_HOURS,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
        nearDiscountRemainingThreshold: NEAR_DISCOUNT_REMAINING_THRESHOLD,
        nearDiscountExpiryDays: NEAR_DISCOUNT_EXPIRY_DAYS,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAdminNotifications,
};
