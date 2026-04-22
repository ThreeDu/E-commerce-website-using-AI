const Order = require("../../models/Order");
const { logAdminAction } = require("../../utils/adminAuditLogger");

const ALLOWED_STATUS = ["pending", "confirmed", "shipping", "delivered", "cancelled"];

const listOrders = async (req, res) => {
  try {
    const { status = "all", page = "1", limit = "20" } = req.query;
    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedLimit = Math.min(100, Math.max(5, Number(limit) || 20));

    const filter = {};
    if (status !== "all") {
      filter.status = String(status);
    }

    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
      .populate("user", "_id name email")
      .lean();

    return res.json({
      message: "Lấy danh sách đơn hàng thành công.",
      orders,
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.max(1, Math.ceil(total / parsedLimit)),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "_id name email")
      .populate("orderItems.product", "_id name image imageUrl");
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }

    return res.json({
      message: "Lấy chi tiết đơn hàng thành công.",
      order,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({ message: "Trạng thái đơn hàng không hợp lệ." });
    }

    const updatePayload = {
      status,
      isDelivered: status === "delivered",
      deliveredAt: status === "delivered" ? new Date() : null,
      cancelledAt: status === "cancelled" ? new Date() : null,
    };

    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true,
    }).populate("user", "_id name email");

    if (!updatedOrder) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "update",
      resource: "order",
      resourceId: updatedOrder._id,
      details: {
        status: updatedOrder.status,
      },
    });

    return res.json({
      message: "Cập nhật trạng thái đơn hàng thành công.",
      order: updatedOrder,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getRevenueOverview = async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const requestedPeriodType = String(req.query.periodType || "month").toLowerCase();
    const periodType = requestedPeriodType === "year" ? "year" : "month";

    const rawYear = Number(req.query.year);
    const selectedYear = Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= currentYear + 1
      ? rawYear
      : currentYear;

    const rawMonth = Number(req.query.month);
    const selectedMonth = Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12
      ? rawMonth
      : currentMonth;

    const periodStart = periodType === "year"
      ? new Date(selectedYear, 0, 1)
      : new Date(selectedYear, selectedMonth - 1, 1);
    const periodEnd = periodType === "year"
      ? new Date(selectedYear + 1, 0, 1)
      : new Date(selectedYear, selectedMonth, 1);

    const deliveredMatch = {
      status: "delivered",
    };

    const [monthlyAggregation, yearlyAggregation, allTimeAggregation, periodAggregation, productSoldAggregation] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            ...deliveredMatch,
            createdAt: {
              $gte: new Date(currentYear, 0, 1),
              $lt: new Date(currentYear + 1, 0, 1),
            },
          },
        },
        {
          $group: {
            _id: { $month: "$createdAt" },
            revenue: { $sum: "$totalPrice" },
            orders: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            month: "$_id",
            revenue: 1,
            orders: 1,
          },
        },
      ]),
      Order.aggregate([
        {
          $match: deliveredMatch,
        },
        {
          $group: {
            _id: { $year: "$createdAt" },
            revenue: { $sum: "$totalPrice" },
            orders: { $sum: 1 },
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
        {
          $project: {
            _id: 0,
            year: "$_id",
            revenue: 1,
            orders: 1,
          },
        },
      ]),
      Order.aggregate([
        {
          $match: deliveredMatch,
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$totalPrice" },
            orders: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            ...deliveredMatch,
            createdAt: {
              $gte: periodStart,
              $lt: periodEnd,
            },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$totalPrice" },
            orders: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            ...deliveredMatch,
            createdAt: {
              $gte: periodStart,
              $lt: periodEnd,
            },
          },
        },
        {
          $unwind: "$orderItems",
        },
        {
          $group: {
            _id: {
              productId: "$orderItems.product",
              name: "$orderItems.name",
            },
            soldQuantity: { $sum: "$orderItems.quantity" },
            revenue: {
              $sum: {
                $multiply: ["$orderItems.quantity", "$orderItems.price"],
              },
            },
          },
        },
        {
          $sort: {
            soldQuantity: -1,
            revenue: -1,
          },
        },
        {
          $project: {
            _id: 0,
            key: {
              $ifNull: [
                { $toString: "$_id.productId" },
                "unknown-product",
              ],
            },
            label: {
              $ifNull: ["$_id.name", "Sản phẩm không xác định"],
            },
            soldQuantity: 1,
            revenue: 1,
          },
        },
      ]),
    ]);

    const monthlyMap = new Map(monthlyAggregation.map((item) => [Number(item.month || 0), item]));
    const monthlyBreakdown = Array.from({ length: 12 }, (_, index) => {
      const monthNumber = index + 1;
      const item = monthlyMap.get(monthNumber);

      return {
        key: String(monthNumber).padStart(2, "0"),
        label: `T${monthNumber}`,
        revenue: Number(item?.revenue || 0),
        orders: Number(item?.orders || 0),
      };
    });

    const yearlyMap = new Map(yearlyAggregation.map((item) => [Number(item.year || 0), item]));
    const minYearFromData = yearlyAggregation.length > 0
      ? Math.min(...yearlyAggregation.map((item) => Number(item.year || currentYear)))
      : currentYear;
    const startYear = Math.max(currentYear - 5, minYearFromData);
    const availableYears = Array.from(
      new Set(yearlyAggregation.map((item) => Number(item.year || currentYear)))
    ).sort((a, b) => b - a);

    const yearlyBreakdown = Array.from({ length: currentYear - startYear + 1 }, (_, index) => {
      const year = startYear + index;
      const item = yearlyMap.get(year);

      return {
        key: String(year),
        label: String(year),
        revenue: Number(item?.revenue || 0),
        orders: Number(item?.orders || 0),
      };
    });

    const thisYearRevenue = monthlyBreakdown.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
    const thisMonthRevenue = Number(monthlyBreakdown[currentMonth - 1]?.revenue || 0);
    const allTimeRevenue = Number(allTimeAggregation[0]?.revenue || 0);
    const allTimeDeliveredOrders = Number(allTimeAggregation[0]?.orders || 0);
    const selectedPeriodRevenue = Number(periodAggregation[0]?.revenue || 0);
    const selectedPeriodOrders = Number(periodAggregation[0]?.orders || 0);

    const normalizedProducts = productSoldAggregation.map((item) => ({
      key: String(item?.key || "unknown-product"),
      label: String(item?.label || "Sản phẩm không xác định"),
      soldQuantity: Number(item?.soldQuantity || 0),
      revenue: Number(item?.revenue || 0),
    }));

    const topProducts = normalizedProducts.slice(0, 8);
    const remainingProducts = normalizedProducts.slice(8);
    const remainingSoldQuantity = remainingProducts.reduce((sum, item) => sum + Number(item.soldQuantity || 0), 0);
    const remainingRevenue = remainingProducts.reduce((sum, item) => sum + Number(item.revenue || 0), 0);

    const productBreakdown = remainingSoldQuantity > 0
      ? [
          ...topProducts,
          {
            key: "other-products",
            label: "Sản phẩm khác",
            soldQuantity: remainingSoldQuantity,
            revenue: remainingRevenue,
          },
        ]
      : topProducts;

    const totalSoldUnits = normalizedProducts.reduce((sum, item) => sum + Number(item.soldQuantity || 0), 0);

    return res.json({
      message: "Lấy tổng quan doanh thu thành công.",
      generatedAt: now,
      revenue: {
        filter: {
          periodType,
          year: selectedYear,
          month: selectedMonth,
          availableYears,
          periodStart,
          periodEnd,
        },
        monthly: {
          year: currentYear,
          total: thisYearRevenue,
          breakdown: monthlyBreakdown,
        },
        yearly: {
          startYear,
          endYear: currentYear,
          breakdown: yearlyBreakdown,
        },
        totals: {
          thisMonth: thisMonthRevenue,
          thisYear: thisYearRevenue,
          allTime: allTimeRevenue,
          deliveredOrders: allTimeDeliveredOrders,
          selectedPeriodRevenue,
          selectedPeriodOrders,
        },
        products: {
          totalSoldUnits,
          breakdown: productBreakdown,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listOrders,
  getOrderById,
  updateOrderStatus,
  getRevenueOverview,
};
