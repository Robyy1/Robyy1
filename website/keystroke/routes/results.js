const express = require('express');
const db = require('../db/db.js');
const { authMiddleware, optionalAuth } = require('../middleware/auth.js');

const router = express.Router();

router.post('/', optionalAuth, (req, res) => {
  try {
    const { mode, language, difficulty, wpm, rawWpm, accuracy, consistency, errorCount, durationSeconds, charCount } = req.body;

    if (!mode || !['general', 'code', 'dictionary'].includes(mode)) {
      return res.status(400).json({ error: 'Mode is required and must be "general", "code", or "dictionary"' });
    }

    if (typeof wpm !== 'number' || typeof rawWpm !== 'number' || typeof accuracy !== 'number') {
      return res.status(400).json({ error: 'wpm, rawWpm, and accuracy must be numbers' });
    }

    if (typeof consistency !== 'number' || typeof errorCount !== 'number') {
      return res.status(400).json({ error: 'consistency and errorCount must be numbers' });
    }

    if (typeof durationSeconds !== 'number' || typeof charCount !== 'number') {
      return res.status(400).json({ error: 'durationSeconds and charCount must be numbers' });
    }

    if (wpm < 0 || rawWpm < 0 || accuracy < 0 || accuracy > 100) {
      return res.status(400).json({ error: 'Invalid metric ranges' });
    }

    if (consistency < 0 || consistency > 100) {
      return res.status(400).json({ error: 'Consistency must be between 0 and 100' });
    }

    if (errorCount < 0 || durationSeconds <= 0 || charCount <= 0) {
      return res.status(400).json({ error: 'Invalid value for duration, char count, or error count' });
    }

    if (mode === 'code') {
      const validLanguages = ['javascript', 'python', 'java', 'cpp', 'go', 'rust', 'typescript', 'sql'];
      if (!language || !validLanguages.includes(language)) {
        return res.status(400).json({ error: 'Valid language is required for code mode' });
      }

      const validDifficulties = ['beginner', 'intermediate', 'advanced'];
      if (!difficulty || !validDifficulties.includes(difficulty)) {
        return res.status(400).json({ error: 'Valid difficulty is required for code mode' });
      }
    }

    const result = db.prepare(
      `INSERT INTO results (user_id, mode, language, difficulty, wpm, raw_wpm, accuracy, consistency, error_count, duration_seconds, char_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user?.id || null,
      mode,
      mode === 'code' ? language : null,
      mode === 'code' ? difficulty : null,      Math.round(wpm * 10) / 10,
      Math.round(rawWpm * 10) / 10,
      Math.round(accuracy * 10) / 10,
      Math.round(consistency * 10) / 10,
      errorCount,
      durationSeconds,
      charCount
    );

    res.status(201).json({
      message: 'Result saved',
      id: result.lastInsertRowid,
    });
  } catch (err) {
    console.error('[results/post] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  try {
    const results = db.prepare(
      `SELECT id, mode, language, difficulty, wpm, raw_wpm, accuracy, consistency, error_count, duration_seconds, char_count, created_at
       FROM results WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`
    ).all(req.user.id);

    res.json({ results });
  } catch (err) {
    console.error('[results/me] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me/stats', authMiddleware, (req, res) => {
  try {
    const overall = db.prepare(
      `SELECT COUNT(*) as total_tests,
              AVG(wpm) as avg_wpm,
              MAX(wpm) as best_wpm,
              AVG(accuracy) as avg_accuracy
       FROM results WHERE user_id = ?`
    ).get(req.user.id);

    const byMode = db.prepare(
      `SELECT mode, COUNT(*) as count, AVG(wpm) as avg_wpm, MAX(wpm) as best_wpm
       FROM results WHERE user_id = ? GROUP BY mode`
    ).all(req.user.id);

    const recentResults = db.prepare(
      `SELECT wpm, accuracy, duration_seconds, created_at
       FROM results WHERE user_id = ? AND created_at >= datetime('now', '-30 days')
       ORDER BY created_at ASC`
    ).all(req.user.id);

    res.json({
      overall: {
        total_tests: overall?.total_tests || 0,
        avg_wpm: overall?.avg_wpm ? Math.round(overall.avg_wpm * 10) / 10 : null,
        best_wpm: overall?.best_wpm ? Math.round(overall.best_wpm * 10) / 10 : null,
        avg_accuracy: overall?.avg_accuracy ? Math.round(overall.avg_accuracy * 10) / 10 : null,
      },
      byMode,
      wpmHistory: recentResults.map(r => ({
        wpm: r.wpm,
        accuracy: r.accuracy,
        date: r.created_at,
      })),
    });
  } catch (err) {
    console.error('[results/stats] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
