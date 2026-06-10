const express = require("express");
const { syncCart, getCart } = require("../controllers/cartController");

const router = express.Router();

router.get("/", getCart);
router.post("/sync", syncCart);

module.exports = router;
