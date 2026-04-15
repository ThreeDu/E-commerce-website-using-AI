const express = require("express");
const { verifyAdminRequest } = require("../helpers/authHelpers");
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../../controllers/admin/categoryController");

const router = express.Router();

const requireAdmin = async (req, res, next) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  req.adminUser = adminUser;
  next();
};

router.get("/", requireAdmin, listCategories);
router.post("/", requireAdmin, createCategory);
router.put("/:id", requireAdmin, updateCategory);
router.delete("/:id", requireAdmin, deleteCategory);

module.exports = router;
