const express = require("express");
const { verifyAdminRequest } = require("../helpers/authHelpers");
const { listSystemLogs } = require("../../controllers/admin/systemLogController");

const router = express.Router();

const requireAdmin = async (req, res, next) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  req.adminUser = adminUser;
  next();
};

router.get("/", requireAdmin, listSystemLogs);

module.exports = router;
