const User = require("../../models/User");
const PointHistory = require("../../models/PointHistory");
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
      .sort({ createdAt: -1 })
      .limit(search ? 20 : 100);

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

    if (role !== undefined && role !== currentUser.role) {
      return res.status(403).json({ message: "Không thể chỉnh sửa vai trò người dùng." });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { name, email },
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

module.exports = {
  listUsers,
  updateUser,
  deleteUser,
  updateUserPoints,
  updateUserPassword,
};
