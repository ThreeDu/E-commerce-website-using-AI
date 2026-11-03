const express = require("express");
const { requireAdmin } = require("../helpers/authHelpers");
const {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  previewProductImport,
  commitProductImport,
} = require("../../controllers/admin/productController");

const router = express.Router();

router.get("/", requireAdmin, listProducts);
router.get("/:id", requireAdmin, getProductById);
router.post("/import/preview", requireAdmin, previewProductImport);
router.post("/import/commit", requireAdmin, commitProductImport);
router.post("/", requireAdmin, createProduct);
router.put("/:id", requireAdmin, updateProduct);
router.delete("/:id", requireAdmin, deleteProduct);

module.exports = router;
