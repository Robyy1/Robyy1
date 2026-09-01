#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

require("dotenv").config();

const dbPath =
  process.env.DB_PATH || path.join(__dirname, "..", "data", "keystroke.db");
const backupDir = path.join(__dirname, "..", "backups");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(backupDir, `keystroke-${timestamp}.db`);

fs.mkdirSync(backupDir, { recursive: true });

try {
  execFileSync("cp", [dbPath, target], { stdio: "inherit" });
  console.log(`[backup] Created backup: ${target}`);
} catch (err) {
  console.error("[backup] Failed to create database backup");
  console.error(err.message);
  process.exit(1);
}
