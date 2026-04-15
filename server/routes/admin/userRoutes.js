const express = require("express");
const { verifyAdminRequest } = require("../helpers/authHelpers");
const {
  listUsers,
  updateUser,
  deleteUser,
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

module.exports = router;
