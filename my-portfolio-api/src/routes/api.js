const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { chatRateLimit } = require('../middleware/chatRateLimit');
const visitsController = require('../controllers/visitsController');
const strikeController = require('../controllers/strikeController');

// POST only: a GET would carry the visitor's message in the URL, where request logs keep it
router.post('/chat/stream', chatRateLimit, chatController.streamChat);
router.get('/visits', visitsController.visits);
router.post('/visits', visitsController.visits);
// Straw Hat Strike's bounty board
router.get('/strike/top', strikeController.top);
router.post('/strike/run', strikeController.run);
router.post('/strike/score', strikeController.score);
router.delete('/strike/score/:id', strikeController.remove);

module.exports = router;
