const express = require("express");
const { verifyAdminRequest } = require("../helpers/authHelpers");
const { getAdminFunnelOverview } = require("../../controllers/analyticsController");

const router = express.Router();

const requireAdmin = async (req, res, next) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  req.adminUser = adminUser;
  next();
};

router.get("/funnel", requireAdmin, getAdminFunnelOverview);

module.exports = router;
