const express = require("express");
const { verifyAdminRequest } = require("../helpers/authHelpers");
const {
  listRewardTiers,
  getRewardTierById,
  createRewardTier,
  updateRewardTier,
  deleteRewardTier,
} = require("../../controllers/admin/rewardTierController");

const router = express.Router();

const requireAdmin = async (req, res, next) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  req.adminUser = adminUser;
  next();
};

router.get("/", requireAdmin, listRewardTiers);
router.get("/:id", requireAdmin, getRewardTierById);
router.post("/", requireAdmin, createRewardTier);
router.put("/:id", requireAdmin, updateRewardTier);
router.delete("/:id", requireAdmin, deleteRewardTier);

module.exports = router;
