const express = require('express');
const router = express.Router();
const { chat, chatStream, getSessions, getSessionDetail, deleteSession } = require('./adminChatController');

router.post('/message', chat);
router.post('/message/stream', chatStream);
router.get('/sessions', getSessions);
router.get('/sessions/:sessionId', getSessionDetail);
router.delete('/sessions/:sessionId', deleteSession);

module.exports = router;
