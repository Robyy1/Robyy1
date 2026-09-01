#!/usr/bin/env node

const Database = require("better-sqlite3");
const path = require("path");
require("dotenv").config();

const dbPath =
  process.env.DB_PATH || path.join(__dirname, "..", "data", "keystroke.db");

try {
  const db = new Database(dbPath);
  const result = db.prepare("PRAGMA integrity_check;").get();
  if (result && result.integrity_check === "ok") {
    console.log("[integrity] Database integrity check passed.");
    process.exit(0);
  }

  console.error("[integrity] Database integrity check failed.");
  console.error(result);
  process.exit(1);
} catch (err) {
  console.error("[integrity] Failed to open database for integrity check.");
  console.error(err.message);
  process.exit(1);
}
