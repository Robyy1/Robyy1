const express = require('express');
const db = require('../db/db.js');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { mode, language, period } = req.query;

    if (!mode || !['general', 'code', 'dictionary'].includes(mode)) {
      return res.status(400).json({ error: 'Mode is required and must be "general", "code", or "dictionary"' });
    }

    let whereClauses = [`results.mode = '${mode}'`];
    const params = [];

    if (language) {
      const validLanguages = ['javascript', 'python', 'java', 'cpp', 'go', 'rust', 'typescript', 'sql'];
      if (!validLanguages.includes(language)) {
        return res.status(400).json({ error: 'Invalid language' });
      }
      whereClauses.push(`results.language = '${language.replace(/'/g, "''")}'`);
    }

    if (period) {
      let timeClause;
      switch (period) {
        case 'today':
          timeClause = `datetime(results.created_at) >= datetime('now', 'start of day')`;
          break;
        case 'week':
          timeClause = `datetime(results.created_at) >= datetime('now', '-7 days')`;
          break;
        case 'month':
          timeClause = `datetime(results.created_at) >= datetime('now', '-30 days')`;
          break;
        case 'alltime':
        default:
          timeClause = '1=1';
          break;
      }
      whereClauses.push(timeClause);
    }

    const whereSql = whereClauses.join(' AND ');

    let query;
    if (mode === 'code') {
      query = `
        SELECT results.wpm, results.raw_wpm, results.accuracy, results.consistency,
               results.error_count, results.duration_seconds, results.char_count,
               results.created_at, users.username, results.language, results.difficulty
        FROM results
        LEFT JOIN users ON results.user_id = users.id
        WHERE ${whereSql} AND results.language IS NOT NULL
        ORDER BY results.wpm DESC
        LIMIT 100
      `;
    } else {
      query = `
        SELECT results.wpm, results.raw_wpm, results.accuracy, results.consistency,
               results.error_count, results.duration_seconds, results.char_count,
               results.created_at, users.username
        FROM results
        LEFT JOIN users ON results.user_id = users.id
        WHERE ${whereSql} AND results.language IS NULL
        ORDER BY results.wpm DESC
        LIMIT 100
      `;
    }

    const leaderboard = db.prepare(query).all();

    res.json({ leaderboard });
  } catch (err) {
    console.error('[leaderboard] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
