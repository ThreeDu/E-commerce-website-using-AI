const express = require("express");
const { requireAdmin } = require("../helpers/authHelpers");
const {
  listUsers,
  updateUser,
  deleteUser,
  updateUserPoints,
  updateUserPassword,
  getCustomerStatsForAdmin,
  createQuickVoucher,
} = require("../../controllers/admin/userController");

const router = express.Router();

router.get("/", requireAdmin, listUsers);
router.put("/:id", requireAdmin, updateUser);
router.delete("/:id", requireAdmin, deleteUser);
router.put("/:id/points", requireAdmin, updateUserPoints);
router.put("/:id/password", requireAdmin, updateUserPassword);
router.get("/:id/stats", requireAdmin, getCustomerStatsForAdmin);
router.post("/:id/quick-voucher", requireAdmin, createQuickVoucher);

module.exports = router;
