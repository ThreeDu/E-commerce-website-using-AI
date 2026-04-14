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
    const order = await Order.findById(req.params.id).populate("user", "_id name email");
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

module.exports = {
  listOrders,
  getOrderById,
  updateOrderStatus,
};
