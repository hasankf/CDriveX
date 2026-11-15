const express = require('express');
const { body } = require('express-validator');
const authMiddleware = require('../middlewares/auth');
const authController = require('../controllers/auth.controller');

const router = express.Router();

router.post(
  '/register',
  body('email').trim().isEmail().isLength({ min: 13 }),
  body('password').trim().isLength({ min: 5 }),
  body('username').trim().isLength({ min: 3 }),
  authController.register
);

router.post(
  '/login',
  body('username').trim().isLength({ min: 3 }),
  body('password').trim().isLength({ min: 5 }),
  authController.login
);

router.post('/logout', authController.logout);
router.get('/me', authMiddleware, authController.me);

module.exports = router;
