const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/db.js');
const { authMiddleware } = require('../middleware/auth.js');

const router = express.Router();

router.put('/settings', authMiddleware, (req, res) => {
  try {
    const { theme, fontPref } = req.body;

    const validThemes = ['dark', 'light'];
    if (theme !== undefined && !validThemes.includes(theme)) {
      return res.status(400).json({ error: 'Theme must be "dark" or "light"' });
    }

    const validFonts = [
      'jetbrains-mono',
      'fira-code',
      'cascadia-code',
      'ibm-plex-mono',
      'source-code-pro',
    ];
    if (fontPref !== undefined && !validFonts.includes(fontPref)) {
      return res.status(400).json({ error: 'Invalid font preference' });
    }

    const updates = [];
    const params = [];

    if (theme !== undefined) {
      updates.push('theme = ?');
      params.push(theme);
    }

    if (fontPref !== undefined) {
      updates.push('font_pref = ?');
      params.push(fontPref);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid settings provided' });
    }

    params.push(req.user.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const user = db.prepare('SELECT theme, font_pref FROM users WHERE id = ?').get(req.user.id);

    res.json({ message: 'Settings updated', settings: user });
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
      'SELECT id, username, email, theme, font_pref, created_at FROM users WHERE id = ?'
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

module.exports = router;
