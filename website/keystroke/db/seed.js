require("dotenv").config();

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");
const { runMigrations } = require("./db.js");

const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, "..", "data", "keystroke.db");

function initDatabase() {
  const db = new Database(DB_PATH);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);

  // Apply pending migrations (non-destructive on existing databases).
  runMigrations(db);

  return db;
}

function seedAdminUser(db) {
  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get("admin");
  if (existing) {
    console.log("[seed] Admin user already exists, skipping.");
    return;
  }

  const cost = parseInt(process.env.BCRYPT_COST || "12", 10);
  const hash = bcrypt.hashSync("admin123", cost);

  db.prepare(
    `INSERT INTO users (username, email, password_hash, theme, font_pref, accent_pref, learning_mode, indent_width_pref, reduce_motion_pref, sound_enabled, os_pref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "admin",
    "admin@keystroke.local",
    hash,
    "dark",
    "jetbrains-mono",
    "amber",
    "type",
    2,
    "system",
    0,
    "auto",
  );

  console.log("[seed] Created admin user: admin / admin123");
}

function seedDemoUser(db) {
  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get("demo");
  if (existing) {
    console.log("[seed] Demo user already exists, skipping.");
    return;
  }

  const cost = parseInt(process.env.BCRYPT_COST || "12", 10);
  const hash = bcrypt.hashSync("demo123", cost);

  db.prepare(
    `INSERT INTO users (username, email, password_hash, theme, font_pref) VALUES (?, ?, ?, ?, ?)`,
  ).run("demo", "demo@keystroke.dev", hash, "dark", "jetbrains-mono");

  console.log("[seed] Created demo user: demo / demo123");
}

function seedSampleResults(db) {
  const demo = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get("demo");
  if (!demo) return;

  const existingCount = db
    .prepare("SELECT COUNT(*) as cnt FROM results")
    .get().cnt;
  if (existingCount > 0) {
    console.log(
      `[seed] ${existingCount} results already exist, skipping sample data.`,
    );
    return;
  }

  const languages = [
    "javascript",
    "python",
    "typescript",
    "go",
    "rust",
    "java",
    "cpp",
    "sql",
  ];
  const difficulties = ["beginner", "intermediate", "advanced"];
  const modes = ["general", "code"];

  const insertResult = db.prepare(
    `INSERT INTO results (user_id, mode, language, difficulty, wpm, raw_wpm, accuracy, consistency, error_count, duration_seconds, char_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const randomBetween = (min, max) => Math.random() * (max - min) + min;

  for (let i = 0; i < 50; i++) {
    const mode = modes[Math.floor(Math.random() * modes.length)];
    const language =
      mode === "code"
        ? languages[Math.floor(Math.random() * languages.length)]
        : null;
    const difficulty =
      mode === "code"
        ? difficulties[Math.floor(Math.random() * difficulties.length)]
        : null;

    let wpm,
      rawWpm,
      accuracy,
      consistency,
      errorCount,
      durationSeconds,
      charCount;

    if (mode === "general") {
      wpm = randomBetween(30, 120);
      rawWpm = wpm + randomBetween(5, 20);
      accuracy = randomBetween(85, 99.9);
      consistency = randomBetween(60, 98);
      errorCount = Math.floor(randomBetween(0, 15));
      durationSeconds = randomBetween(15, 120);
      charCount = Math.floor(((wpm * durationSeconds) / 60) * 5);
    } else {
      const diffMod =
        difficulty === "beginner"
          ? 0.8
          : difficulty === "intermediate"
            ? 1
            : 1.2;
      wpm = randomBetween(20, 90) * diffMod;
      rawWpm = wpm + randomBetween(5, 25);
      accuracy = randomBetween(75, 98);
      consistency = randomBetween(40, 95);
      errorCount = Math.floor(randomBetween(1, 30));
      durationSeconds = randomBetween(30, 180);
      charCount = Math.floor(((wpm * durationSeconds) / 60) * 5);
    }

    const daysAgo = Math.floor(Math.random() * 90);
    const createdAt = new Date(
      Date.now() - daysAgo * 24 * 60 * 60 * 1000,
    ).toISOString();

    insertResult.run(
      demo.id,
      mode,
      language,
      difficulty,
      Math.round(wpm * 10) / 10,
      Math.round(rawWpm * 10) / 10,
      Math.round(accuracy * 10) / 10,
      Math.round(consistency * 10) / 10,
      errorCount,
      durationSeconds,
      charCount,
    );
    db.prepare(
      "UPDATE results SET created_at = ? WHERE id = (SELECT id FROM results ORDER BY id DESC LIMIT 1)",
    ).run(createdAt);
  }

  console.log("[seed] Inserted 50 sample results for demo user.");
}

function seedCourses(db) {
  let coursesData;
  try {
    const coursesPath = path.join(__dirname, "..", "data", "courses.json");
    coursesData = JSON.parse(fs.readFileSync(coursesPath, "utf-8"));
  } catch (err) {
    console.error("[seed] Could not load courses.json:", err.message);
    return;
  }

  const courses = Array.isArray(coursesData)
    ? coursesData
    : coursesData.courses || [];

  const findCourse = db.prepare(
    "SELECT id, order_index FROM courses WHERE slug = ?",
  );
  const insertCourse = db.prepare(
    "INSERT INTO courses (slug, title, description, tagline, estimated_minutes, featured, category, icon, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const updateCourse = db.prepare(
    "UPDATE courses SET title = ?, description = ?, tagline = ?, estimated_minutes = ?, featured = ?, category = ?, icon = ? WHERE id = ?",
  );
  const findLesson = db.prepare(
    "SELECT id FROM lessons WHERE course_id = ? AND order_index = ?",
  );
  const insertLesson = db.prepare(
    "INSERT INTO lessons (course_id, order_index, title, explanation, lesson_type, snippet_language, snippet_code, min_accuracy, xp_reward) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const updateLesson = db.prepare(
    "UPDATE lessons SET title = ?, explanation = ?, lesson_type = ?, snippet_language = ?, snippet_code = ?, min_accuracy = ?, xp_reward = ? WHERE id = ?",
  );
  const clearShortcuts = db.prepare(
    "DELETE FROM shortcuts WHERE lesson_id = ?",
  );
  const insertShortcut = db.prepare(
    "INSERT INTO shortcuts (lesson_id, order_index, action_label, keys_win, keys_mac) VALUES (?, ?, ?, ?, ?)",
  );

  const insertTx = db.transaction(() => {
    for (let c = 0; c < courses.length; c++) {
      const course = courses[c];
      const existingCourse = findCourse.get(course.slug);

      let courseId;
      if (existingCourse) {
        updateCourse.run(
          course.title,
          course.description,
          course.tagline || "",
          course.estimated_minutes || 20,
          course.featured || 0,
          course.category || "language",
          course.icon || null,
          existingCourse.id,
        );
        courseId = existingCourse.id;
      } else {
        courseId = insertCourse.run(
          course.slug,
          course.title,
          course.description,
          course.tagline || "",
          course.estimated_minutes || 20,
          course.featured || 0,
          course.category || "language",
          course.icon || null,
          c + 1,
        ).lastInsertRowid;
      }

      const lessons = course.lessons || [];
      for (let l = 0; l < lessons.length; l++) {
        const lesson = lessons[l];
        const lessonType = lesson.lesson_type || "typing";
        const snippetCode =
          lessonType === "shortcut" ? "" : lesson.snippet_code || "";
        const existingLesson = findLesson.get(courseId, l + 1);

        let lessonId;
        if (existingLesson) {
          updateLesson.run(
            lesson.title,
            lesson.explanation || "",
            lessonType,
            lesson.snippet_language || null,
            snippetCode,
            lesson.min_accuracy != null ? lesson.min_accuracy : 95,
            lesson.xp_reward != null ? lesson.xp_reward : 10,
            existingLesson.id,
          );
          lessonId = existingLesson.id;
        } else {
          lessonId = insertLesson.run(
            courseId,
            l + 1,
            lesson.title,
            lesson.explanation || "",
            lessonType,
            lesson.snippet_language || null,
            snippetCode,
            lesson.min_accuracy != null ? lesson.min_accuracy : 95,
            lesson.xp_reward != null ? lesson.xp_reward : 10,
          ).lastInsertRowid;
        }

        const shortcuts = lesson.shortcuts || [];
        clearShortcuts.run(lessonId);
        for (let s = 0; s < shortcuts.length; s++) {
          const shortcut = shortcuts[s];
          insertShortcut.run(
            lessonId,
            s + 1,
            shortcut.action,
            shortcut.keys_win,
            shortcut.keys_mac,
          );
        }
      }
    }
  });

  insertTx();
  const totalCourses = db
    .prepare("SELECT COUNT(*) as cnt FROM courses")
    .get().cnt;
  const totalLessons = db
    .prepare("SELECT COUNT(*) as cnt FROM lessons")
    .get().cnt;
  const totalShortcuts = db
    .prepare("SELECT COUNT(*) as cnt FROM shortcuts")
    .get().cnt;
  console.log(
    `[seed] Seeded ${totalCourses} courses with ${totalLessons} lessons and ${totalShortcuts} shortcuts.`,
  );
}

function main() {
  try {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    console.log("[seed] Initializing database at:", DB_PATH);
    const db = initDatabase();

    seedAdminUser(db);
    seedDemoUser(db);
    seedSampleResults(db);
    seedCourses(db);

    db.close();
    console.log("[seed] Done.");
  } catch (err) {
    console.error("[seed] Error:", err.message);
    process.exit(1);
  }
}

main();
