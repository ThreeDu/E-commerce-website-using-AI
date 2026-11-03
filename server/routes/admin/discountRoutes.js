const express = require("express");
const { requireAdmin } = require("../helpers/authHelpers");
const {
  listDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount,
} = require("../../controllers/admin/discountController");

const router = express.Router();

router.get("/", requireAdmin, listDiscounts);
router.get("/:id", requireAdmin, getDiscountById);
router.post("/", requireAdmin, createDiscount);
router.put("/:id", requireAdmin, updateDiscount);
router.delete("/:id", requireAdmin, deleteDiscount);

module.exports = router;
