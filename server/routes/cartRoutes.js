const express = require("express");
const { syncCart } = require("../controllers/cartController");

const router = express.Router();

router.post("/sync", syncCart);

module.exports = router;
