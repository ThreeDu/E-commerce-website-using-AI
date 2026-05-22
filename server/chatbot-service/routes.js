const express = require("express");
const { chatWithAssistant, trackEvent } = require("./controller");

const router = express.Router();

router.post("/message", chatWithAssistant);
router.post("/event", trackEvent);

module.exports = router;
