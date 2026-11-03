const express = require("express");
const { requireAdmin } = require("../helpers/authHelpers");
const {
  listOrders,
  getOrderById,
  updateOrderStatus,
  getRevenueOverview,
} = require("../../controllers/admin/orderController");

const router = express.Router();

router.get("/", requireAdmin, listOrders);
router.get("/revenue-overview", requireAdmin, getRevenueOverview);
router.get("/:id", requireAdmin, getOrderById);
router.put("/:id/status", requireAdmin, updateOrderStatus);

module.exports = router;
