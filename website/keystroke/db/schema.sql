CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  theme TEXT DEFAULT 'dark',
  font_pref TEXT DEFAULT 'jetbrains-mono',
  accent_pref TEXT DEFAULT 'amber',
  learning_mode TEXT DEFAULT 'type',
  indent_width_pref INTEGER DEFAULT 2,
  reduce_motion_pref TEXT DEFAULT 'system',
  sound_enabled INTEGER DEFAULT 0,
  os_pref TEXT DEFAULT 'auto',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  mode TEXT NOT NULL,
  language TEXT,
  difficulty TEXT,
  wpm REAL NOT NULL,
  raw_wpm REAL NOT NULL,
  accuracy REAL NOT NULL,
  consistency REAL NOT NULL,
  error_count INTEGER NOT NULL,
  duration_seconds REAL NOT NULL,
  char_count INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_results_user ON results(user_id);
CREATE INDEX IF NOT EXISTS idx_results_leaderboard ON results(mode, language, wpm DESC);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tagline TEXT,
  estimated_minutes INTEGER,
  featured INTEGER DEFAULT 0,
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
  lesson_type TEXT DEFAULT 'typing',
  snippet_language TEXT,
  snippet_code TEXT NOT NULL,
  min_accuracy REAL DEFAULT 95,
  xp_reward INTEGER DEFAULT 10
);

CREATE TABLE IF NOT EXISTS shortcuts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER REFERENCES lessons(id),
  order_index INTEGER NOT NULL,
  action_label TEXT NOT NULL,
  keys_win TEXT NOT NULL,
  keys_mac TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shortcuts_lesson ON shortcuts(lesson_id, order_index);

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