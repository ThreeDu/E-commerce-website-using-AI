const User = require("../../models/User");
const PointHistory = require("../../models/PointHistory");
const Order = require("../../models/Order");
const AnalyticsEvent = require("../../models/AnalyticsEvent");
const Discount = require("../../models/Discount");
const Notification = require("../../models/Notification");
const bcrypt = require("bcryptjs");
const { logAdminAction } = require("../../utils/adminAuditLogger");

const listUsers = async (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : "";
    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ]
      };
    }

    const users = await User.find(query)
      .select("_id name email role loyaltyPoints createdAt")
      .sort({ createdAt: -1 });

    return res.json({
      message: "Lấy danh sách người dùng thành công.",
      users,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    if (!name || !email) {
      return res
        .status(400)
        .json({ message: "Họ tên và email là bắt buộc." });
    }

    const existedEmail = await User.findOne({ email, _id: { $ne: id } });
    if (existedEmail) {
      return res.status(409).json({ message: "Email đã tồn tại." });
    }

    const currentUser = await User.findById(id).select("_id role");
    if (!currentUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    const updateFields = { name, email };

    if (role !== undefined && role !== currentUser.role) {
      if (role === "admin") {
        const { adminPassword } = req.body;
        if (!adminPassword) {
          return res.status(400).json({ message: "Mật khẩu xác nhận của admin là bắt buộc để nâng quyền." });
        }

        const currentAdmin = await User.findById(req.adminUser._id);
        const isMatch = await bcrypt.compare(adminPassword, currentAdmin.password);
        if (!isMatch) {
          return res.status(401).json({ message: "Mật khẩu xác nhận admin không chính xác." });
        }
      }

      if (currentUser.role === "admin" && String(currentUser._id) === String(req.adminUser._id)) {
        return res.status(400).json({ message: "Không thể tự hạ vai trò admin của chính mình." });
      }

      updateFields.role = role;
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateFields,
      { new: true, runValidators: true }
    ).select("_id name email role loyaltyPoints createdAt");

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "update",
      resource: "user",
      resourceId: updatedUser._id,
      details: {
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });

    return res.json({
      message: "Cập nhật người dùng thành công.",
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (String(req.adminUser._id) === String(id)) {
      return res.status(400).json({ message: "Không thể tự xóa tài khoản admin hiện tại." });
    }

    const targetUser = await User.findById(id).select("_id role");
    if (!targetUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    if (targetUser.role === "admin") {
      return res.status(403).json({ message: "Không thể xóa tài khoản admin." });
    }

    const deletedUser = await User.findByIdAndDelete(id).select("_id name email role");

    if (!deletedUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "delete",
      resource: "user",
      resourceId: deletedUser._id,
      details: {
        email: deletedUser.email,
        role: deletedUser.role,
      },
    });

    return res.json({
      message: "Xóa người dùng thành công.",
      user: deletedUser,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateUserPoints = async (req, res) => {
  try {
    const { id } = req.params;
    const { points, reason } = req.body;

    if (points === undefined || points === null || isNaN(Number(points)) || Number(points) < 0) {
      return res.status(400).json({ message: "Số điểm không hợp lệ (phải >= 0)." });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    const oldPoints = user.loyaltyPoints || 0;
    const newPoints = Number(points);
    const diff = newPoints - oldPoints;

    if (diff !== 0) {
      user.loyaltyPoints = newPoints;
      await user.save();

      await PointHistory.create({
        user: user._id,
        amount: diff,
        type: diff > 0 ? "earn" : "redeem",
        reason: reason ? String(reason).trim() : "Quản trị viên điều chỉnh điểm tích lũy",
        balanceAfter: newPoints,
      });

      logAdminAction({
        req,
        adminUser: req.adminUser,
        action: "update_points",
        resource: "user",
        resourceId: user._id,
        details: {
          email: user.email,
          oldPoints,
          newPoints,
          reason: reason || "Quản trị viên điều chỉnh điểm tích lũy",
        },
      });
    }

    return res.json({
      message: "Cập nhật điểm thành công.",
      loyaltyPoints: newPoints,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: "Mật khẩu phải có tối thiểu 6 ký tự." });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "reset_password",
      resource: "user",
      resourceId: user._id,
      details: {
        email: user.email,
      },
    });

    return res.json({
      message: "Cập nhật mật khẩu thành công.",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getCustomerStatsForAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("_id name email role loyaltyPoints createdAt");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng." });
    }

    // 1. Get all orders
    const orders = await Order.find({ user: id }).sort({ createdAt: -1 });
    const totalOrders = orders.length;
    const totalSpent = orders
      .filter(order => order.status !== "cancelled")
      .reduce((sum, order) => sum + (order.totalPrice || 0), 0);

    // 2. Count weekly visits
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - distanceToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklySessions = await AnalyticsEvent.find({
      userId: id,
      occurredAt: { $gte: startOfWeek }
    }).distinct("sessionId");
    const weeklyVisits = weeklySessions.length;

    // 3. Customer rank
    let rank = "Đồng";
    if (totalSpent >= 10000000) rank = "Kim Cương";
    else if (totalSpent >= 5000000) rank = "Vàng";
    else if (totalSpent >= 1500000) rank = "Bạc";

    return res.json({
      user,
      totalOrders,
      totalSpent,
      weeklyVisits,
      rank,
      orders
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createQuickVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      value = 10,
      minOrderValue = 0,
      maxDiscountValue = 0,
      expiryDays = 7,
    } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng." });
    }

    // Generate code if not provided
    let finalCode = String(code || "").trim().toUpperCase();
    if (!finalCode) {
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const sanitizedUserName = user.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z]/g, "")
        .substring(0, 5)
        .toUpperCase();
      finalCode = `VIP_${sanitizedUserName}_${randomStr}`;
    }

    // Check if code already exists
    const existingDiscount = await Discount.findOne({ code: finalCode });
    if (existingDiscount) {
      return res.status(400).json({ message: "Mã giảm giá này đã tồn tại." });
    }

    const now = new Date();
    const endDate = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

    const discount = await Discount.create({
      code: finalCode,
      type: "percent",
      value: Number(value) || 10,
      minOrderValue: Number(minOrderValue) || 0,
      maxDiscountValue: Number(maxDiscountValue) || 0,
      startDate: now,
      endDate: endDate,
      usageLimit: 1,
      usedCount: 0,
      usageLimitPerUser: 1,
      allowedUsers: [user._id],
      isActive: true,
    });

    // Notify user about this new voucher
    await Notification.create({
      user: user._id,
      type: "new_coupon",
      title: "🎁 Bạn nhận được một voucher đặc biệt!",
      message: `Admin đã gửi tặng bạn mã giảm giá ${finalCode} (giảm ${value}% tối đa ${maxDiscountValue ? maxDiscountValue.toLocaleString("vi-VN") + "đ" : "không giới hạn"}). Hạn dùng đến ${endDate.toLocaleDateString("vi-VN")}. Hãy sử dụng ngay!`,
      data: {
        discountCode: finalCode,
        discountPercent: Number(value),
      },
      link: "/dashboard"
    });

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "create",
      resource: "discount",
      resourceId: discount._id,
      details: {
        code: finalCode,
        assignedToUser: user.email,
      },
    });

    return res.status(201).json({
      message: `Đã tạo mã giảm giá ${finalCode} và tặng cho khách hàng thành công.`,
      discount,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listUsers,
  updateUser,
  deleteUser,
  updateUserPoints,
  updateUserPassword,
  getCustomerStatsForAdmin,
  createQuickVoucher,
};
