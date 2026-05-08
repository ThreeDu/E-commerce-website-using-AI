const User = require("../../models/User");
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
      .select("_id name email role createdAt")
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
    ).select("_id name email role createdAt");

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

module.exports = {
  listUsers,
  updateUser,
  deleteUser,
};
