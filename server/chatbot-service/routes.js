const express = require("express");
const { chatWithAssistant, trackEvent, debugGreeting } = require("./controller");
const { searchProductByFullDescription } = require("./descriptionSearch");

const router = express.Router();

router.post("/message", chatWithAssistant);
router.post("/event", trackEvent);
router.post("/debug-greeting", debugGreeting);
router.post("/description-search", searchProductByFullDescription);

module.exports = router;
