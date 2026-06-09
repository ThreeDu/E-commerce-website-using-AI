const Notification = require("../models/Notification");
const { verifyUserRequest } = require("../routes/helpers/authHelpers");

// GET /api/auth/notifications
const getNotifications = async (req, res) => {
  const user = await verifyUserRequest(req, res);
  if (!user) return;

  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query = { user: user._id };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ ...query, isRead: false });

    return res.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// GET /api/auth/notifications/unread-count
const getUnreadCount = async (req, res) => {
  const user = await verifyUserRequest(req, res);
  if (!user) return;

  try {
    const count = await Notification.countDocuments({ user: user._id, isRead: false });
    return res.json({ count });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PUT /api/auth/notifications/:id/read
const markAsRead = async (req, res) => {
  const user = await verifyUserRequest(req, res);
  if (!user) return;

  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Không tìm thấy thông báo hoặc bạn không có quyền." });
    }

    return res.json({ message: "Đã đánh dấu thông báo là đã đọc.", notification });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PUT /api/auth/notifications/read-all
const markAllAsRead = async (req, res) => {
  const user = await verifyUserRequest(req, res);
  if (!user) return;

  try {
    await Notification.updateMany(
      { user: user._id, isRead: false },
      { isRead: true }
    );

    return res.json({ message: "Đã đánh dấu tất cả thông báo là đã đọc." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// DELETE /api/auth/notifications/:id
const deleteNotification = async (req, res) => {
  const user = await verifyUserRequest(req, res);
  if (!user) return;

  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: user._id,
    });

    if (!notification) {
      return res.status(404).json({ message: "Không tìm thấy thông báo hoặc bạn không có quyền." });
    }

    return res.json({ message: "Đã xóa thông báo." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
