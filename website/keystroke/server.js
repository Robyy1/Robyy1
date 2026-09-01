require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const db = require("./db/db.js");

const authRoutes = require("./routes/auth.js");
const textsRoutes = require("./routes/texts.js");
const resultsRoutes = require("./routes/results.js");
const leaderboardRoutes = require("./routes/leaderboard.js");
const userRoutes = require("./routes/user.js");
const learningRoutes = require("./routes/learning.js");
const statsRoutes = require("./routes/stats.js");
const { errorHandler } = require("./middleware/errorHandler.js");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || "development";

function validateEnv() {
  const required = ["JWT_SECRET", "NODE_ENV"];
  const missing = required.filter((key) => {
    const value = process.env[key];
    return !value || String(value).trim() === "";
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required env var(s): ${missing.join(", ")}. Copy .env.example to .env and fill in the values before starting the app.`,
    );
  }

  if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
    throw new Error(
      `PORT must be a valid TCP port between 1 and 65535. Received: ${process.env.PORT}`,
    );
  }

  if (process.env.JWT_SECRET.length < 32) {
    throw new Error(
      "JWT_SECRET must be at least 32 characters long for secure signing.",
    );
  }

  if (!["development", "production", "test"].includes(NODE_ENV)) {
    throw new Error(
      `NODE_ENV must be one of: development, production, test. Received: ${NODE_ENV}`,
    );
  }
}

validateEnv();

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts:
      NODE_ENV === "production"
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    frameguard: { action: "deny" },
    noSniff: true,
    xssFilter: true,
  }),
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many login attempts. Please wait a few minutes and try again.",
  },
  skipSuccessfulRequests: true,
});

const resultsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many result submissions. Please slow down." },
});

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", authLimiter);
app.use("/api/results", resultsLimiter);

// Serve static files with proper MIME types for JS modules
app.use(
  "/css",
  express.static(path.join(__dirname, "public/css"), {
    setHeaders: (res) => res.set("Content-Type", "text/css"),
  }),
);

app.use(
  "/js",
  express.static(path.join(__dirname, "public/js"), {
    setHeaders: (res) => {
      res.set("Content-Type", "application/javascript");
      res.set("Cache-Control", "no-cache");
    },
  }),
);

app.get("/favicon.ico", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "favicon.svg"));
});

app.get("/favicon.svg", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "favicon.svg"));
});

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, status: "healthy", env: NODE_ENV });
});

app.get("/readyz", (_req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.status(200).json({ ok: true, status: "ready", env: NODE_ENV });
  } catch (err) {
    console.error("[readyz] Database check failed:", err.message);
    res.status(503).json({
      ok: false,
      status: "db_unavailable",
      error: "Database is not ready",
    });
  }
});

// Serve HTML files
app.use(
  express.static(path.join(__dirname, "public"), {
    index: false,
    extensions: ["html"],
  }),
);

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/texts", textsRoutes);
app.use("/api/results", resultsRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/user", userRoutes);
app.use("/api", learningRoutes);
app.use("/api/stats", statsRoutes);

// SPA routing — serve index.html for root, then individual HTML pages.
// Only register routes for pages that actually exist so we don't try to
// sendFile a non-existent template (which would 500 instead of 404).
const htmlPages = [
  "index.html",
  "login.html",
  "signup.html",
  "type.html",
  "dashboard.html",
  "leaderboard.html",
  "settings.html",
  "learning.html",
  "course.html",
  "lesson.html",
];

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

htmlPages.forEach((page) => {
  const pagePath = path.join(__dirname, "public", page);
  // Skip the index (handled above) and any page whose file isn't built yet
  if (page === "index.html" || !fs.existsSync(pagePath)) return;
  app.get(`/${page.replace(".html", "")}`, (_req, res) => {
    res.sendFile(pagePath);
  });
});

// 404 handler for unmatched routes — respond directly so we never depend on
// a 404.html file that might not exist.
app.use((_req, res) => {
  res
    .status(404)
    .type("html")
    .send(
      '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Not Found</title></head>' +
        '<body style="font-family:system-ui;background:var(--surface);color:var(--text);text-align:center;padding:4rem;">' +
        '<h1 style="font-size:3rem;">404</h1><p>The page you are looking for does not exist.</p>' +
        '<p><a href="/" style="color:var(--accent);">Go home</a></p>' +
        "</body></html>",
    );
});

// Centralized error handler — must be last
app.use(errorHandler);

let server;

function startServer() {
  function listenOn(port) {
    server = app.listen(port, () => {
      console.log(`Keystroke running on http://localhost:${port}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });

    server.on("error", (err) => {
      if (err && err.code === "EADDRINUSE" && port === PORT) {
        const fallbackPort = port + 1;
        console.warn(`Port ${port} is busy; retrying on ${fallbackPort}.`);
        listenOn(fallbackPort);
        return;
      }
      throw err;
    });
  }

  listenOn(PORT);
  return server;
}

// Graceful shutdown
function shutdown() {
  console.log("\nShutting down...");
  if (server) {
    server.close(() => {
      console.log("Server closed.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

module.exports = app;

if (require.main === module) {
  startServer();
}
