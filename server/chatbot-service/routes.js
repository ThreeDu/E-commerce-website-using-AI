const express = require("express");
const { chatWithAssistant, trackEvent } = require("./controller");
const { searchProductByFullDescription } = require("./descriptionSearch");

const router = express.Router();

router.post("/message", chatWithAssistant);
router.post("/event", trackEvent);
router.post("/description-search", searchProductByFullDescription);

module.exports = router;
