#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
require("dotenv").config();

const dbPath =
  process.env.DB_PATH || path.join(__dirname, "..", "data", "keystroke.db");
const migrationsDir = path.join(__dirname, "..", "migrations");

if (!fs.existsSync(migrationsDir)) {
  console.log("[migrate] No migrations directory found; nothing to run.");
  process.exit(0);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const files = fs
  .readdirSync(migrationsDir)
  .filter((file) => /^\d+_.*\.sql$/.test(file))
  .sort();

if (files.length === 0) {
  console.log("[migrate] No pending migration files found.");
  db.close();
  process.exit(0);
}

let applied = 0;
for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  try {
    db.exec(sql);
    applied += 1;
    console.log(`[migrate] Applied ${file}`);
  } catch (error) {
    console.error(`[migrate] Failed to apply ${file}`);
    console.error(error.message);
    db.close();
    process.exit(1);
  }
}

console.log(`[migrate] Completed ${applied} migration(s).`);
db.close();
