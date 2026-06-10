const express = require("express");
const { chatWithAssistant, trackEvent, debugGreeting } = require("./controller");
const { searchProductByFullDescription } = require("./descriptionSearch");

const router = express.Router();
const debugGreetingEnabled = String(process.env.CHATBOT_DEBUG_GREETING_ENABLED || "").trim().toLowerCase();
const isDebugGreetingEnabled = debugGreetingEnabled === "1" || debugGreetingEnabled === "true" || debugGreetingEnabled === "yes";

router.post("/message", chatWithAssistant);
router.post("/event", trackEvent);
if (isDebugGreetingEnabled) {
	router.get("/debug-greeting", debugGreeting);
	router.post("/debug-greeting", debugGreeting);
}
router.post("/description-search", searchProductByFullDescription);

module.exports = router;
