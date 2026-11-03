/**
 * chatbotRoutes.js — Express routes for customer chatbot
 */

const express = require('express');
const router = express.Router();
const { chatWithAssistant, chatWithAssistantStream, chatWithImage, trackEvent, getChatHistory } = require('./chatbotController');

router.post('/message', chatWithAssistant);
router.post('/message/stream', chatWithAssistantStream);
router.post('/message/image', chatWithImage);
router.post('/event', trackEvent);
router.get('/session/:sessionId', getChatHistory);

module.exports = router;
