/**
 * chatbotRoutes.js — Express routes for customer chatbot
 */

const express = require('express');
const router = express.Router();
const { chatWithAssistant, trackEvent } = require('./chatbotController');

router.post('/message', chatWithAssistant);
router.post('/event', trackEvent);

module.exports = router;
