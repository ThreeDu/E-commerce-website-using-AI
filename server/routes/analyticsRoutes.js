const express = require("express");
const { createAnalyticsEvent } = require("../controllers/analyticsController");

const router = express.Router();

router.post("/events", createAnalyticsEvent);

module.exports = router;
