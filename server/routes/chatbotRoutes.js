const express = require("express");
const { chatWithAssistant, trackEvent } = require("../controllers/chatbotController");

const router = express.Router();

router.post("/message", chatWithAssistant);
router.post("/event", trackEvent);

module.exports = router;
