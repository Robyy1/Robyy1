const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs');

const authRoutes = require('./routes/auth.js');
const textsRoutes = require('./routes/texts.js');
const resultsRoutes = require('./routes/results.js');
const leaderboardRoutes = require('./routes/leaderboard.js');
const userRoutes = require('./routes/user.js');
const { errorHandler } = require('./middleware/errorHandler.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cookieParser());

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files with proper MIME types for JS modules
app.use('/css', express.static(path.join(__dirname, 'public/css'), {
  setHeaders: (res) => res.set('Content-Type', 'text/css'),
}));

app.use('/js', express.static(path.join(__dirname, 'public/js'), {
  setHeaders: (res) => {
    res.set('Content-Type', 'application/javascript');
    res.set('Cache-Control', 'no-cache');
  },
}));

// Serve HTML files
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  extensions: ['html'],
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/texts', textsRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/user', userRoutes);

// SPA routing — serve index.html for root, then individual HTML pages.
// Only register routes for pages that actually exist so we don't try to
// sendFile a non-existent template (which would 500 instead of 404).
const htmlPages = [
  'index.html',
  'login.html',
  'signup.html',
  'type.html',
  'dashboard.html',
  'leaderboard.html',
  'settings.html',
];

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

htmlPages.forEach((page) => {
  const pagePath = path.join(__dirname, 'public', page);
  // Skip the index (handled above) and any page whose file isn't built yet
  if (page === 'index.html' || !fs.existsSync(pagePath)) return;
  app.get(`/${page.replace('.html', '')}`, (_req, res) => {
    res.sendFile(pagePath);
  });
});

// 404 handler for unmatched routes — respond directly so we never depend on
// a 404.html file that might not exist.
app.use((_req, res) => {
  res.status(404).type('html').send(
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Not Found</title></head>' +
    '<body style="font-family:system-ui;background:var(--surface);color:var(--text);text-align:center;padding:4rem;">' +
    '<h1 style="font-size:3rem;">404</h1><p>The page you are looking for does not exist.</p>' +
    '<p><a href="/" style="color:var(--accent);">Go home</a></p>' +
    '</body></html>'
  );
});

// Centralized error handler — must be last
app.use(errorHandler);

let server;

function startServer() {
  server = app.listen(PORT, () => {
    console.log(`Keystroke running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  return server;
}

// Graceful shutdown
function shutdown() {
  console.log('\nShutting down...');
  if (server) {
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;

if (require.main === module) {
  startServer();
}
