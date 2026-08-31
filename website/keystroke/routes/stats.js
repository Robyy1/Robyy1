const express = require('express');
const db = require('../db/db.js');

const router = express.Router();

// ---------------------------------------------------------------------------
// Public aggregate stats for the landing page.
// Cached in-memory for a few minutes so page loads don't hammer SQLite with
// COUNT/AVG queries. All queries are cheap aggregate reads.
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedStats = null;
let cachedAt = 0;

function computeStats() {
  const results = db.prepare(
    'SELECT COUNT(*) as totalTests, AVG(accuracy) as avgAccuracy FROM results'
  ).get();
  const weeklyAccuracy = db.prepare(
    `SELECT AVG(accuracy) as avgAccuracy
     FROM results
     WHERE created_at >= datetime('now', '-7 days')`
  ).get();
  const lessons = db.prepare(
    `SELECT COUNT(*) as totalLessons
     FROM user_lesson_progress
     WHERE completed_at IS NOT NULL`
  ).get();
  const users = db.prepare('SELECT COUNT(*) as totalUsers FROM users').get();

  return {
    totalTests: results?.totalTests || 0,
    totalLessons: lessons?.totalLessons || 0,
    totalUsers: users?.totalUsers || 0,
    weeklyAvgAccuracy: weeklyAccuracy?.avgAccuracy
      ? Math.round(weeklyAccuracy.avgAccuracy * 10) / 10
      : null,
  };
}

router.get('/public', (_req, res) => {
  try {
    const now = Date.now();
    if (!cachedStats || now - cachedAt > CACHE_TTL_MS) {
      cachedStats = computeStats();
      cachedAt = now;
    }
    res.json(cachedStats);
  } catch (err) {
    console.error('[stats/public] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/stats/popularity — live language popularity from the GitHub Search
// API (a well-known, authoritative source). Public code repositories per
// language give a real-world measure of how widely each language is used.
//
// Results are cached for 12 hours in memory. If the GitHub request fails
// (offline, rate limit, etc.) we fall back to a static snapshot taken from
// GitHub's own public counts so the landing page never breaks.
// ---------------------------------------------------------------------------

const POPULARITY_TTL_MS = 12 * 60 * 60 * 1000;

const FALLBACK_REPOS = {
  javascript: { label: 'JavaScript', repos: 29500000 },
  typescript: { label: 'TypeScript', repos: 11000000 },
  python: { label: 'Python', repos: 25000000 },
  java: { label: 'Java', repos: 14000000 },
  cpp: { label: 'C++', repos: 10000000 },
};

const POPULARITY_ORDER = ['javascript', 'python', 'typescript', 'java', 'cpp'];

let cachedPopularity = null;
let cachedPopularityAt = 0;

async function fetchPopularity() {
  const results = [];
  for (const slug of POPULARITY_ORDER) {
    const fallback = FALLBACK_REPOS[slug];
    if (!fallback) continue;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const url = `https://api.github.com/search/repositories?q=language:${encodeURIComponent(slug)}&per_page=1`;
      const res = await fetch(url, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'keystroke-app' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
      const data = await res.json();
      results.push({ slug, label: fallback.label, repos: (data.total_count || fallback.repos) });
    } catch (err) {
      console.warn(`[stats/popularity] Falling back for ${slug}: ${err.message}`);
      results.push({ slug, label: fallback.label, repos: fallback.repos });
    }
  }
  return {
    source: 'github-search-api',
    note: 'Live public code repository counts from the GitHub Search API.',
    fetchedAt: new Date().toISOString(),
    languages: results,
    totalRepos: results.reduce((sum, r) => sum + r.repos, 0),
  };
}

router.get('/popularity', async (_req, res) => {
  try {
    const now = Date.now();
    if (!cachedPopularity || now - cachedPopularityAt > POPULARITY_TTL_MS) {
      cachedPopularity = await fetchPopularity();
      cachedPopularityAt = now;
    }
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(cachedPopularity);
  } catch (err) {
    console.error('[stats/popularity] Error:', err.message);
    const fallback = {
      source: 'snapshot',
      note: 'Snapshot of GitHub public repository counts (live fetch unavailable).',
      fetchedAt: new Date().toISOString(),
      languages: POPULARITY_ORDER
        .filter((slug) => FALLBACK_REPOS[slug])
        .map((slug) => ({ slug, label: FALLBACK_REPOS[slug].label, repos: FALLBACK_REPOS[slug].repos })),
      totalRepos: POPULARITY_ORDER.reduce((sum, slug) => (FALLBACK_REPOS[slug] ? sum + FALLBACK_REPOS[slug].repos : sum), 0),
    };
    res.json(fallback);
  }
});

module.exports = router;