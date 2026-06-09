const express = require("express");
const { verifyAdminRequest } = require("../helpers/authHelpers");
const {
  listUsers,
  updateUser,
  deleteUser,
  updateUserPoints,
  updateUserPassword,
} = require("../../controllers/admin/userController");

const router = express.Router();

const requireAdmin = async (req, res, next) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  req.adminUser = adminUser;
  next();
};

router.get("/", requireAdmin, listUsers);
router.put("/:id", requireAdmin, updateUser);
router.delete("/:id", requireAdmin, deleteUser);
router.put("/:id/points", requireAdmin, updateUserPoints);
router.put("/:id/password", requireAdmin, updateUserPassword);

module.exports = router;
