const express = require("express");
const { requireUser } = require("./helpers/authHelpers");
const { syncCart, getCart } = require("../controllers/cartController");

const router = express.Router();

router.get("/", requireUser, getCart);
router.post("/sync", requireUser, syncCart);

module.exports = router;
