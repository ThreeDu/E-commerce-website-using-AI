const express = require("express");
const { verifyAdminRequest } = require("../helpers/authHelpers");
const {
  listOrders,
  getOrderById,
  updateOrderStatus,
  getRevenueOverview,
} = require("../../controllers/admin/orderController");

const router = express.Router();

const requireAdmin = async (req, res, next) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  req.adminUser = adminUser;
  next();
};

router.get("/", requireAdmin, listOrders);
router.get("/revenue-overview", requireAdmin, getRevenueOverview);
router.get("/:id", requireAdmin, getOrderById);
router.put("/:id/status", requireAdmin, updateOrderStatus);

module.exports = router;
