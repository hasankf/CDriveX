


const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');

const UNIQUE_VIOLATION = 'P2002';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Check your details: username 3+, email 13+, password 5+ characters.',
      errors: errors.array(),
    });
  }

  try {
    const { email, username, password } = req.body;
    const hashPassword = await bcrypt.hash(password, 10);
    await userModel.createUser({ email, username, password: hashPassword });
    return res.status(201).json({ message: 'Account created' });
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      return res.status(409).json({ message: 'That username or email is already taken.' });
    }
    console.error(err);
    return res.status(500).json({ message: 'Could not create the account. Try again.' });
  }
}

async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Enter your username and password.' });
  }

  try {
    const { username, password } = req.body;
    const user = await userModel.findByUsername(username);
    const isMatch = user && (await bcrypt.compare(password, user.password));

    if (!isMatch) {
      return res.status(400).json({ message: 'Username or password is incorrect.' });
    }

    const payload = { userId: user.id, email: user.email, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, { ...COOKIE_BASE, maxAge: WEEK_MS });
    return res.json({ user: payload });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not log you in. Try again.' });
  }
}

function logout(req, res) {
  res.clearCookie('token', COOKIE_BASE);
  return res.json({ message: 'Logged out' });
}

function me(req, res) {
  const { userId, username, email } = req.user;
  return res.json({ user: { userId, username, email } });
}

module.exports = { register, login, logout, me };
