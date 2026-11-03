const express = require("express");
const { requireAdmin } = require("../helpers/authHelpers");
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../../controllers/admin/categoryController");

const router = express.Router();

router.get("/", requireAdmin, listCategories);
router.post("/", requireAdmin, createCategory);
router.put("/:id", requireAdmin, updateCategory);
router.delete("/:id", requireAdmin, deleteCategory);

module.exports = router;
