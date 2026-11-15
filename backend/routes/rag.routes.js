const express = require('express');
const authMiddleware = require('../middlewares/auth');
const ragController = require('../controllers/rag.controller');

const router = express.Router();

router.get('/library', authMiddleware, ragController.getLibrary);
router.post('/chat', authMiddleware, ragController.chat);

module.exports = router;
