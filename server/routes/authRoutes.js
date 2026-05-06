const express = require("express");
const {
  register,
  login,
  verifyAdmin,
  verifyToken,
  getProfile,
  updateProfile,
  changePassword,
  getWishlist,
  addWishlist,
  removeWishlist,
} = require("../controllers/authController");
const adminUserRoutes = require("./admin/userRoutes");
const adminProductRoutes = require("./admin/productRoutes");
const adminCategoryRoutes = require("./admin/categoryRoutes");
const adminDiscountRoutes = require("./admin/discountRoutes");
const adminSystemLogRoutes = require("./admin/systemLogRoutes");
const adminOrderRoutes = require("./admin/orderRoutes");
const adminNotificationRoutes = require("./admin/notificationRoutes");

const adminIntelligenceRoutes = require("./admin/intelligenceRoutes");

const router = express.Router();
router.post("/register", register);
router.post("/login", login);
router.get("/verify-admin", verifyAdmin);
router.get("/verify-token", verifyToken);
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/change-password", changePassword);
router.get("/wishlist", getWishlist);
router.post("/wishlist", addWishlist);
router.delete("/wishlist/:productId", removeWishlist);

router.use("/admin/users", adminUserRoutes);
router.use("/admin/products", adminProductRoutes);
router.use("/admin/categories", adminCategoryRoutes);
router.use("/admin/discounts", adminDiscountRoutes);
router.use("/admin/orders", adminOrderRoutes);
router.use("/admin/system-logs", adminSystemLogRoutes);
router.use("/admin/notifications", adminNotificationRoutes);

router.use("/admin/intelligence", adminIntelligenceRoutes);

module.exports = router;
