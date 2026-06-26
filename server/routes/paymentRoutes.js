const express = require("express");
const router = express.Router();
const { handleBeepayWebhook } = require("../controllers/paymentController");

router.post("/beepay-webhook", handleBeepayWebhook);

module.exports = router;
