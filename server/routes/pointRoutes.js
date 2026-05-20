const express = require("express");
const router = express.Router();
const {
  getMyPoints,
  getRewards,
  redeemPoints,
} = require("../controllers/pointController");

// Các route này đều cần user đăng nhập (xác thực bên trong controller)
router.get("/me", getMyPoints);
router.get("/rewards", getRewards);
router.post("/redeem", redeemPoints);

module.exports = router;
