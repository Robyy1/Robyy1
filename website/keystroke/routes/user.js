const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/db.js');
const { authMiddleware } = require('../middleware/auth.js');

const router = express.Router();

const validThemes = ['dark', 'light'];

const validFonts = [
  'jetbrains-mono',
  'fira-code',
  'cascadia-code',
  'ibm-plex-mono',
  'source-code-pro',
];

const validAccents = ['amber', 'cyan', 'violet', 'rose', 'mono'];

const validLearningModes = ['type', 'read'];

const validReduceMotions = ['system', 'on', 'off'];

const validOsPrefs = ['auto', 'win', 'mac'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Column -> validation for the settings update endpoint.
const SETTING_COLUMNS = {
  theme: { col: 'theme', validate: (v) => validThemes.includes(v) },
  fontPref: { col: 'font_pref', validate: (v) => validFonts.includes(v) },
  accentPref: { col: 'accent_pref', validate: (v) => validAccents.includes(v) },
  learningMode: { col: 'learning_mode', validate: (v) => validLearningModes.includes(v) },
  indentWidthPref: { col: 'indent_width_pref', validate: (v) => Number.isInteger(v) && v >= 1 && v <= 8 },
  reduceMotionPref: { col: 'reduce_motion_pref', validate: (v) => validReduceMotions.includes(v) },
  soundEnabled: { col: 'sound_enabled', validate: (v) => v === true || v === false },
  osPref: { col: 'os_pref', validate: (v) => validOsPrefs.includes(v) },
};

router.put('/settings', authMiddleware, (req, res) => {
  try {
    const { email } = req.body;
    const updates = [];
    const params = [];

    for (const [key, spec] of Object.entries(SETTING_COLUMNS)) {
      const value = req.body[key];
      if (value === undefined) continue;
      if (!spec.validate(value)) {
        return res.status(400).json({ error: `Invalid value for "${key}"` });
      }
      updates.push(`${spec.col} = ?`);
      params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
      const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id);
      if (taken) {
        return res.status(409).json({ error: 'Email is already in use' });
      }
      updates.push('email = ?');
      params.push(email);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid settings provided' });
    }

    params.push(req.user.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const user = db.prepare(
      'SELECT id, username, email, theme, font_pref, accent_pref, learning_mode, indent_width_pref, reduce_motion_pref, sound_enabled, os_pref FROM users WHERE id = ?'
    ).get(req.user.id);

    res.json({
      message: 'Settings updated',
      settings: {
        id: user.id,
        username: user.username,
        email: user.email,
        theme: user.theme,
        fontPref: user.font_pref,
        accentPref: user.accent_pref,
        learningMode: user.learning_mode,
        indentWidthPref: user.indent_width_pref,
reduceMotionPref: user.reduce_motion_pref,
        soundEnabled: user.sound_enabled === 1,
        osPref: user.os_pref || 'auto',
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error('[user/settings] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const cost = parseInt(process.env.BCRYPT_COST || '12', 10);
    const newHash = await bcrypt.hash(newPassword, cost);

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('[user/password] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/me', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM results WHERE user_id = ?').run(req.user.id);
    db.prepare('DELETE FROM user_lesson_progress WHERE user_id = ?').run(req.user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('[user/delete] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = db.prepare(
      'SELECT id, username, email, theme, font_pref, accent_pref, learning_mode, indent_width_pref, reduce_motion_pref, sound_enabled, os_pref, created_at FROM users WHERE id = ?'
    ).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const stats = db.prepare(
      `SELECT COUNT(*) as total_tests,
              AVG(wpm) as avg_wpm,
              MAX(wpm) as best_wpm,
              AVG(accuracy) as avg_accuracy
       FROM results WHERE user_id = ?`
    ).get(req.user.id);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        theme: user.theme,
        fontPref: user.font_pref,
        accentPref: user.accent_pref,
        learningMode: user.learning_mode,
        indentWidthPref: user.indent_width_pref,
        reduceMotionPref: user.reduce_motion_pref,
        soundEnabled: user.sound_enabled === 1,
        createdAt: user.created_at,
      },
      stats: {
        totalTests: stats?.total_tests || 0,
        avgWpm: stats?.avg_wpm ? Math.round(stats.avg_wpm * 10) / 10 : null,
        bestWpm: stats?.best_wpm ? Math.round(stats.best_wpm * 10) / 10 : null,
        avgAccuracy: stats?.avg_accuracy ? Math.round(stats.avg_accuracy * 10) / 10 : null,
      },
    });
  } catch (err) {
    console.error('[user/me] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/export', authMiddleware, (req, res) => {
  try {
    const user = db.prepare(
      'SELECT id, username, email, theme, font_pref, accent_pref, learning_mode, indent_width_pref, reduce_motion_pref, sound_enabled, os_pref, created_at FROM users WHERE id = ?'
    ).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const results = db.prepare(
      `SELECT id, mode, language, difficulty, wpm, raw_wpm, accuracy, consistency, error_count,
              duration_seconds, char_count, created_at
       FROM results
       WHERE user_id = ?
       ORDER BY created_at ASC`
    ).all(req.user.id);

    const learningProgress = db.prepare(
      `SELECT p.lesson_id, l.course_id, c.slug AS course_slug, l.title AS lesson_title,
              p.completion_method, p.completed_at, p.best_accuracy, p.best_wpm, p.attempts
       FROM user_lesson_progress p
       JOIN lessons l ON l.id = p.lesson_id
       JOIN courses c ON c.id = l.course_id
       WHERE p.user_id = ?
       ORDER BY p.completed_at ASC`
    ).all(req.user.id);

    const payload = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        theme: user.theme,
        fontPref: user.font_pref,
        accentPref: user.accent_pref,
        learningMode: user.learning_mode,
        indentWidthPref: user.indent_width_pref,
        reduceMotionPref: user.reduce_motion_pref,
        soundEnabled: user.sound_enabled === 1,
        osPref: user.os_pref || 'auto',
        createdAt: user.created_at,
      },
      results,
      learningProgress,
    };

    const filename = `keystroke-export-${user.username}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(payload);
  } catch (err) {
    console.error('[user/export] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
