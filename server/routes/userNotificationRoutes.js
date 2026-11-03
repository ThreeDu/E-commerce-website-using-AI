const express = require("express");
const { requireUser } = require("./helpers/authHelpers");
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require("../controllers/userNotificationController");

const router = express.Router();

router.get("/", requireUser, getNotifications);
router.get("/unread-count", requireUser, getUnreadCount);
router.put("/read-all", requireUser, markAllAsRead);
router.put("/:id/read", requireUser, markAsRead);
router.delete("/:id", requireUser, deleteNotification);

module.exports = router;
