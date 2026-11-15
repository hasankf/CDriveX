const express = require('express');
const authRoutes = require('./auth.routes');
const driveRoutes = require('./drive.routes');
const ragRoutes = require('./rag.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/', driveRoutes);
router.use('/rag', ragRoutes);

module.exports = router;
