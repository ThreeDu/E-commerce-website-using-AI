const express = require("express");
const { requireAdmin } = require("../helpers/authHelpers");
const {
  listRewardTiers,
  getRewardTierById,
  createRewardTier,
  updateRewardTier,
  deleteRewardTier,
} = require("../../controllers/admin/rewardTierController");

const router = express.Router();

router.get("/", requireAdmin, listRewardTiers);
router.get("/:id", requireAdmin, getRewardTierById);
router.post("/", requireAdmin, createRewardTier);
router.put("/:id", requireAdmin, updateRewardTier);
router.delete("/:id", requireAdmin, deleteRewardTier);

module.exports = router;
