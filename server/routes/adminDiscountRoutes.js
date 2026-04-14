const express = require("express");
const { verifyAdminRequest } = require("./helpers/authHelpers");
const {
  listDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount,
} = require("../controllers/admin/discountController");

const router = express.Router();

const requireAdmin = async (req, res, next) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  req.adminUser = adminUser;
  next();
};

router.get("/", requireAdmin, listDiscounts);
router.get("/:id", requireAdmin, getDiscountById);
router.post("/", requireAdmin, createDiscount);
router.put("/:id", requireAdmin, updateDiscount);
router.delete("/:id", requireAdmin, deleteDiscount);

module.exports = router;
