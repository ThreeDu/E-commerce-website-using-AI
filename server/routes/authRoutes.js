const express = require("express");
const { requireUser } = require("./helpers/authHelpers");
const {
  register,
  login,
  verifyAdmin,
  verifyToken,
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
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
const adminRewardTierRoutes = require("./admin/rewardTierRoutes");
const cartRoutes = require("./cartRoutes");
const userNotificationRoutes = require("./userNotificationRoutes");

const router = express.Router();
router.post("/register", register);
router.post("/login", login);
router.get("/verify-admin", verifyAdmin);
router.get("/verify-token", verifyToken);
router.get("/profile", requireUser, getProfile);
router.put("/profile", requireUser, updateProfile);
router.put("/profile/avatar", requireUser, uploadAvatar);
router.put("/change-password", requireUser, changePassword);
router.get("/wishlist", requireUser, getWishlist);
router.post("/wishlist", requireUser, addWishlist);
router.delete("/wishlist/:productId", requireUser, removeWishlist);

router.use("/cart", cartRoutes);
router.use("/notifications", userNotificationRoutes);

router.use("/admin/users", adminUserRoutes);
router.use("/admin/products", adminProductRoutes);
router.use("/admin/categories", adminCategoryRoutes);
router.use("/admin/discounts", adminDiscountRoutes);
router.use("/admin/orders", adminOrderRoutes);
router.use("/admin/system-logs", adminSystemLogRoutes);
router.use("/admin/notifications", adminNotificationRoutes);
router.use("/admin/intelligence", adminIntelligenceRoutes);
router.use("/admin/rewards", adminRewardTierRoutes);

module.exports = router;
