const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/db.js');
const { generateToken, signCookie, clearCookie, authMiddleware } = require('../middleware/auth.js');
const { rateLimiter } = require('../middleware/errorHandler.js');

const router = express.Router();

const LOGIN_RATE_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid input types' });
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password;

    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      return res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (trimmedPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(trimmedUsername, trimmedEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const cost = parseInt(process.env.BCRYPT_COST || '12', 10);
    const passwordHash = await bcrypt.hash(trimmedPassword, cost);

    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
    ).run(trimmedUsername, trimmedEmail, passwordHash);

    const user = { id: result.lastInsertRowid, username: trimmedUsername };
    const token = generateToken(user);

    signCookie(res, token);

    res.status(201).json({
      message: 'User created successfully',
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    console.error('[auth/signup] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', rateLimiter(LOGIN_RATE_LIMIT, LOGIN_WINDOW_MS), async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: 'Email/username and password are required' });
    }

    const input = emailOrUsername.trim();

    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? OR email = ?'
    ).get(input, input.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({ id: user.id, username: user.username });
    signCookie(res, token);

    res.json({
      message: 'Logged in successfully',
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    console.error('[auth/login] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => {
  clearCookie(res);
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, email, theme, font_pref, created_at FROM users WHERE id = ?'
  ).get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
});

module.exports = router;
