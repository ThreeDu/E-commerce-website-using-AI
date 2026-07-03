const express = require('express');
const router = express.Router();
const { chat, getSessions, getSessionDetail, deleteSession } = require('./adminChatController');

router.post('/message', chat);
router.get('/sessions', getSessions);
router.get('/sessions/:sessionId', getSessionDetail);
router.delete('/sessions/:sessionId', deleteSession);

module.exports = router;
