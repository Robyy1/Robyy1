const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const db = require("../db/db.js");
const {
  generateToken,
  signCookie,
  clearCookie,
  authMiddleware,
} = require("../middleware/auth.js");
const { rateLimiter } = require("../middleware/errorHandler.js");

const router = express.Router();

const LOGIN_RATE_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const loginAttempts = new Map();

function getClientKey(req) {
  return req.ip || req.headers["x-forwarded-for"] || "unknown";
}

function recordFailedLogin(req) {
  const key = getClientKey(req);
  const record = loginAttempts.get(key) || { count: 0, lastFailureAt: 0 };
  const now = Date.now();
  const next = { count: record.count + 1, lastFailureAt: now };
  loginAttempts.set(key, next);
  return next;
}

function clearFailedLogin(req) {
  loginAttempts.delete(getClientKey(req));
}

function isLockedOut(req) {
  const key = getClientKey(req);
  const record = loginAttempts.get(key);

  if (!record) return false;
  if (record.count < LOGIN_RATE_LIMIT) return false;

  const elapsed = Date.now() - record.lastFailureAt;
  if (elapsed > LOGIN_LOCKOUT_MS) {
    loginAttempts.delete(key);
    return false;
  }

  return true;
}

router.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: "Username, email, and password are required" });
    }

    if (
      typeof username !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({ error: "Invalid input types" });
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password;

    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      return res
        .status(400)
        .json({ error: "Username must be between 3 and 30 characters" });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      return res.status(400).json({
        error:
          "Username can only contain letters, numbers, underscores, and hyphens",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (trimmedPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long" });
    }

    const existingUser = db
      .prepare("SELECT id FROM users WHERE username = ? OR email = ?")
      .get(trimmedUsername, trimmedEmail);
    if (existingUser) {
      return res
        .status(409)
        .json({ error: "Username or email already exists" });
    }

    const verificationToken = crypto.randomBytes(24).toString("hex");
    const cost = parseInt(process.env.BCRYPT_COST || "12", 10);
    const passwordHash = await bcrypt.hash(trimmedPassword, cost);

    const result = db
      .prepare(
        "INSERT INTO users (username, email, password_hash, email_verified, email_verification_token) VALUES (?, ?, ?, ?, ?)",
      )
      .run(trimmedUsername, trimmedEmail, passwordHash, 0, verificationToken);

    const user = { id: result.lastInsertRowid, username: trimmedUsername };
    const token = generateToken(user);

    signCookie(res, token);

    console.log(
      `[auth] Email verification token for ${trimmedEmail}: ${verificationToken}`,
    );

    res.status(201).json({
      message: "User created successfully",
      user: { id: user.id, username: user.username, emailVerified: false },
    });
  } catch (err) {
    console.error("[auth/signup] Error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/login",
  rateLimiter(LOGIN_RATE_LIMIT, LOGIN_WINDOW_MS),
  async (req, res) => {
    try {
      const { emailOrUsername, password } = req.body;

      if (!emailOrUsername || !password) {
        return res
          .status(400)
          .json({ error: "Email/username and password are required" });
      }

      if (isLockedOut(req)) {
        return res.status(429).json({
          error: "Too many failed login attempts. Please try again later.",
        });
      }

      const input = emailOrUsername.trim();

      const user = db
        .prepare("SELECT * FROM users WHERE username = ? OR email = ?")
        .get(input, input.toLowerCase());

      if (!user) {
        recordFailedLogin(req);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        recordFailedLogin(req);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      clearFailedLogin(req);

      const token = generateToken({ id: user.id, username: user.username });
      signCookie(res, token);

      res.json({
        message: "Logged in successfully",
        user: {
          id: user.id,
          username: user.username,
          emailVerified: !!user.email_verified,
        },
      });
    } catch (err) {
      console.error("[auth/login] Error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.post("/logout", (req, res) => {
  clearCookie(res);
  res.json({ message: "Logged out successfully" });
});

router.post("/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    return res
      .status(400)
      .json({ error: "A valid email address is required." });
  }

  const normalized = email.trim().toLowerCase();
  const user = db
    .prepare("SELECT id, email FROM users WHERE email = ?")
    .get(normalized);

  if (user) {
    const token = crypto.randomBytes(24).toString("hex");
    db.prepare(
      'UPDATE users SET reset_token = ?, reset_token_expires_at = datetime("now", "+1 hour") WHERE id = ?',
    ).run(token, user.id);
    console.log(`[auth] Password reset token for ${user.email}: ${token}`);
  }

  return res.status(200).json({
    message: "If that account exists, a reset link has been created.",
  });
});

router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res
      .status(400)
      .json({ error: "Reset token and new password are required." });
  }

  if (typeof password !== "string" || password.length < 6) {
    return res
      .status(400)
      .json({ error: "New password must be at least 6 characters long." });
  }

  const user = db
    .prepare(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires_at > datetime("now")',
    )
    .get(token);

  if (!user) {
    return res
      .status(400)
      .json({ error: "Reset token is invalid or expired." });
  }

  const cost = parseInt(process.env.BCRYPT_COST || "12", 10);
  const passwordHash = await bcrypt.hash(password, cost);
  db.prepare(
    "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?",
  ).run(passwordHash, user.id);

  return res.json({ message: "Password reset successfully." });
});

router.post("/verify-email", (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: "Verification token is required." });
  }

  const user = db
    .prepare("SELECT id FROM users WHERE email_verification_token = ?")
    .get(token);
  if (!user) {
    return res
      .status(400)
      .json({ error: "Verification token is invalid or expired." });
  }

  db.prepare(
    "UPDATE users SET email_verified = 1, email_verification_token = NULL WHERE id = ?",
  ).run(user.id);

  return res.json({ message: "Email verified successfully." });
});

router.get("/me", (req, res) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(200).json({ user: null, reason: "missing_token" });
  }

  try {
    const jwt = require("jsonwebtoken");
    const JWT_SECRET =
      process.env.JWT_SECRET || "fallback-secret-change-in-production";
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = db
      .prepare(
        "SELECT id, username, email, email_verified, theme, font_pref, created_at FROM users WHERE id = ?",
      )
      .get(decoded.userId);

    if (!user) {
      return res.status(200).json({ user: null, reason: "user_not_found" });
    }

    return res
      .status(200)
      .json({ user: { ...user, emailVerified: !!user.email_verified } });
  } catch (err) {
    clearCookie(res);
    return res.status(200).json({ user: null, reason: "session_expired" });
  }
});

module.exports = router;
