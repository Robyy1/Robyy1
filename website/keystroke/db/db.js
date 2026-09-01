require("dotenv").config();

const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");

const dbPath =
  process.env.DB_PATH || path.join(__dirname, "..", "data", "keystroke.db");

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---------------------------------------------------------------------------
// Migration runner
//
// The database may already contain production data, so we can never blow away
// existing rows. Fresh installs create everything from schema.sql; upgrades on
// an existing DB apply the pending migrations below exactly once, tracked via
// `PRAGMA user_version`. Every ALTER/CREATE here is also safe to run on a fresh
// schema (guarded by existence checks / IF NOT EXISTS).
// ---------------------------------------------------------------------------

function tableColumnNames(targetDb, table) {
  return targetDb
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((c) => c.name);
}

function ensureColumn(targetDb, table, columnDef) {
  const name = columnDef.split(" ")[0];
  const existing = tableColumnNames(targetDb, table);
  if (!existing.includes(name)) {
    targetDb.prepare(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`).run();
    console.log(`[db] Added column ${table}.${name}`);
  }
}

const MIGRATIONS = [
  {
    version: 1,
    name: "accent / learning / preferences + learning schema",
    apply(targetDb) {
      // users preference columns
      ensureColumn(targetDb, "users", "accent_pref TEXT DEFAULT 'amber'");
      ensureColumn(targetDb, "users", "learning_mode TEXT DEFAULT 'type'");
      ensureColumn(targetDb, "users", "indent_width_pref INTEGER DEFAULT 2");
      ensureColumn(
        targetDb,
        "users",
        "reduce_motion_pref TEXT DEFAULT 'system'",
      );
      ensureColumn(targetDb, "users", "sound_enabled INTEGER DEFAULT 0");

      // learning tables (idempotent for fresh installs)
      targetDb.exec(`
        CREATE TABLE IF NOT EXISTS courses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          icon TEXT,
          order_index INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS lessons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          course_id INTEGER REFERENCES courses(id),
          order_index INTEGER NOT NULL,
          title TEXT NOT NULL,
          explanation TEXT NOT NULL,
          snippet_language TEXT,
          snippet_code TEXT NOT NULL,
          min_accuracy REAL DEFAULT 95,
          xp_reward INTEGER DEFAULT 10
        );

        CREATE TABLE IF NOT EXISTS user_lesson_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id),
          lesson_id INTEGER REFERENCES lessons(id),
          completed_at DATETIME,
          completion_method TEXT,
          best_accuracy REAL,
          best_wpm REAL,
          attempts INTEGER DEFAULT 0,
          UNIQUE(user_id, lesson_id)
        );

        CREATE INDEX IF NOT EXISTS idx_progress_user ON user_lesson_progress(user_id);
        CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id, order_index);
      `);
    },
  },
  {
    version: 2,
    name: "course cards + software shortcut lessons",
    apply(targetDb) {
      // Course card content
      ensureColumn(targetDb, "courses", "tagline TEXT");
      ensureColumn(targetDb, "courses", "estimated_minutes INTEGER");
      ensureColumn(targetDb, "courses", "featured INTEGER DEFAULT 0");

      // Lesson type: 'typing' | 'shortcut'
      ensureColumn(targetDb, "lessons", "lesson_type TEXT DEFAULT 'typing'");

      // Per-OS preference for shortcut drills: 'auto' | 'win' | 'mac'
      ensureColumn(targetDb, "users", "os_pref TEXT DEFAULT 'auto'");

      // Shortcut drill entries (idempotent for fresh installs)
      targetDb.exec(`
        CREATE TABLE IF NOT EXISTS shortcuts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lesson_id INTEGER REFERENCES lessons(id),
          order_index INTEGER NOT NULL,
          action_label TEXT NOT NULL,
          keys_win TEXT NOT NULL,
          keys_mac TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_shortcuts_lesson ON shortcuts(lesson_id, order_index);
      `);
    },
  },
  {
    version: 3,
    name: "security + auth reset columns",
    apply(targetDb) {
      ensureColumn(targetDb, "users", "email_verified INTEGER DEFAULT 0");
      ensureColumn(targetDb, "users", "email_verification_token TEXT");
      ensureColumn(targetDb, "users", "reset_token TEXT");
      ensureColumn(targetDb, "users", "reset_token_expires_at DATETIME");
    },
  },
];

function runMigrations(targetDb) {
  const current = targetDb.pragma("user_version", { simple: true });
  for (const migration of MIGRATIONS) {
    if (migration.version > current) {
      targetDb.transaction(() => {
        migration.apply(targetDb);
        targetDb.pragma(`user_version = ${migration.version}`);
      })();
      console.log(
        `[db] Applied migration v${migration.version} (${migration.name})`,
      );
    }
  }
}

// Make sure the base tables exist (idempotent) before migrations run.
const schemaPath = path.join(__dirname, "schema.sql");
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schema);
}
runMigrations(db);

module.exports = db;
module.exports.runMigrations = runMigrations;
