const express = require("express");
const { requireAdmin } = require("../helpers/authHelpers");
const { listSystemLogs } = require("../../controllers/admin/systemLogController");

const router = express.Router();

router.get("/", requireAdmin, listSystemLogs);

module.exports = router;
