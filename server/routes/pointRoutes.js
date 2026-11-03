const express = require("express");
const { requireUser } = require("./helpers/authHelpers");
const router = express.Router();
const {
  getMyPoints,
  getRewards,
  redeemPoints,
} = require("../controllers/pointController");

// Các route này đều cần user đăng nhập (xác thực bên trong controller)
router.get("/me", requireUser, getMyPoints);
router.get("/rewards", getRewards);
router.post("/redeem", requireUser, redeemPoints);

module.exports = router;
