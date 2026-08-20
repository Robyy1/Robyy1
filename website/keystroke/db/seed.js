const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'keystroke.db');

function initDatabase() {
  const db = new Database(DB_PATH);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  return db;
}

function seedDemoUser(db) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('demo');
  if (existing) {
    console.log('[seed] Demo user already exists, skipping.');
    return;
  }

  const cost = parseInt(process.env.BCRYPT_COST || '12', 10);
  const hash = bcrypt.hashSync('demo123', cost);

  db.prepare(
    `INSERT INTO users (username, email, password_hash, theme, font_pref) VALUES (?, ?, ?, ?, ?)`
  ).run('demo', 'demo@keystroke.dev', hash, 'dark', 'jetbrains-mono');

  console.log('[seed] Created demo user: demo / demo123');
}

function seedSampleResults(db) {
  const demo = db.prepare('SELECT id FROM users WHERE username = ?').get('demo');
  if (!demo) return;

  const existingCount = db.prepare('SELECT COUNT(*) as cnt FROM results').get().cnt;
  if (existingCount > 0) {
    console.log(`[seed] ${existingCount} results already exist, skipping sample data.`);
    return;
  }

  const languages = ['javascript', 'python', 'typescript', 'go', 'rust', 'java', 'cpp', 'sql'];
  const difficulties = ['beginner', 'intermediate', 'advanced'];
  const modes = ['general', 'code'];

  const insertResult = db.prepare(
    `INSERT INTO results (user_id, mode, language, difficulty, wpm, raw_wpm, accuracy, consistency, error_count, duration_seconds, char_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const randomBetween = (min, max) => Math.random() * (max - min) + min;

  for (let i = 0; i < 50; i++) {
    const mode = modes[Math.floor(Math.random() * modes.length)];
    const language = mode === 'code' ? languages[Math.floor(Math.random() * languages.length)] : null;
    const difficulty = mode === 'code' ? difficulties[Math.floor(Math.random() * difficulties.length)] : null;

    let wpm, rawWpm, accuracy, consistency, errorCount, durationSeconds, charCount;

    if (mode === 'general') {
      wpm = randomBetween(30, 120);
      rawWpm = wpm + randomBetween(5, 20);
      accuracy = randomBetween(85, 99.9);
      consistency = randomBetween(60, 98);
      errorCount = Math.floor(randomBetween(0, 15));
      durationSeconds = randomBetween(15, 120);
      charCount = Math.floor(wpm * durationSeconds / 60 * 5);
    } else {
      const diffMod = difficulty === 'beginner' ? 0.8 : difficulty === 'intermediate' ? 1 : 1.2;
      wpm = randomBetween(20, 90) * diffMod;
      rawWpm = wpm + randomBetween(5, 25);
      accuracy = randomBetween(75, 98);
      consistency = randomBetween(40, 95);
      errorCount = Math.floor(randomBetween(1, 30));
      durationSeconds = randomBetween(30, 180);
      charCount = Math.floor(wpm * durationSeconds / 60 * 5);
    }

    const daysAgo = Math.floor(Math.random() * 90);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

    insertResult.run(demo.id, mode, language, difficulty, Math.round(wpm * 10) / 10, Math.round(rawWpm * 10) / 10, Math.round(accuracy * 10) / 10, Math.round(consistency * 10) / 10, errorCount, durationSeconds, charCount);
    db.prepare('UPDATE results SET created_at = ? WHERE id = (SELECT id FROM results ORDER BY id DESC LIMIT 1)').run(createdAt);
  }

  console.log('[seed] Inserted 50 sample results for demo user.');
}

function main() {
  try {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    console.log('[seed] Initializing database at:', DB_PATH);
    const db = initDatabase();

    seedDemoUser(db);
    seedSampleResults(db);

    db.close();
    console.log('[seed] Done.');
  } catch (err) {
    console.error('[seed] Error:', err.message);
    process.exit(1);
  }
}

main();
