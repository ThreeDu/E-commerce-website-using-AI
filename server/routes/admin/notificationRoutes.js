const express = require("express");
const { requireAdmin } = require("../helpers/authHelpers");
const { getAdminNotifications } = require("../../controllers/admin/notificationController");

const router = express.Router();

router.get("/", requireAdmin, getAdminNotifications);

module.exports = router;
