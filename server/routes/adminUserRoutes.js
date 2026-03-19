const express = require("express");
const User = require("../models/User");
const { verifyAdminRequest } = require("./helpers/authHelpers");

const router = express.Router();

router.get("/", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const users = await User.find()
      .select("_id name email role createdAt")
      .sort({ createdAt: -1 });

    return res.json({
      message: "Lấy danh sách người dùng thành công.",
      users,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put("/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res
        .status(400)
        .json({ message: "Họ tên, email và vai trò là bắt buộc." });
    }

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Vai trò không hợp lệ." });
    }

    const existedEmail = await User.findOne({ email, _id: { $ne: id } });
    if (existedEmail) {
      return res.status(409).json({ message: "Email đã tồn tại." });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { name, email, role },
      { new: true, runValidators: true }
    ).select("_id name email role createdAt");

    if (!updatedUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    return res.json({
      message: "Cập nhật người dùng thành công.",
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { id } = req.params;

    if (String(adminUser._id) === String(id)) {
      return res.status(400).json({ message: "Không thể tự xóa tài khoản admin hiện tại." });
    }

    const deletedUser = await User.findByIdAndDelete(id).select("_id name email role");

    if (!deletedUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    return res.json({
      message: "Xóa người dùng thành công.",
      user: deletedUser,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
