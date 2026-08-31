const express = require('express');
const db = require('../db/db.js');
const { authMiddleware, optionalAuth } = require('../middleware/auth.js');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCourse(courseId) {
  return db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
}

// Only JavaScript and Python courses are exposed on the site. Everything else
// (Git, SQL, regex, AI prompting, tool shortcuts, etc.) is fully hidden all the
// way down to individual lessons, so the API never leaks or serves them.
const VISIBLE_TRACKS = ['js', 'py'];
function isVisibleCourse(course) {
  return !!course && VISIBLE_TRACKS.indexOf(course.icon) !== -1;
}

function getLesson(lessonId) {
  return db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId);
}

function getCourseLessons(courseId) {
  return db.prepare(
    'SELECT id, order_index, title, lesson_type, snippet_language, min_accuracy, xp_reward FROM lessons WHERE course_id = ? ORDER BY order_index ASC'
  ).all(courseId);
}

function getShortcuts(lessonId) {
  return db.prepare(
    'SELECT id, order_index, action_label, keys_win, keys_mac FROM shortcuts WHERE lesson_id = ? ORDER BY order_index ASC'
  ).all(lessonId);
}

function getLessonCounts() {
  const rows = db.prepare(
    'SELECT course_id, COUNT(*) as cnt FROM lessons GROUP BY course_id'
  ).all();
  const map = {};
  for (const row of rows) map[row.course_id] = row.cnt;
  return map;
}

// Progress keyed by (courseId -> completed count) and (lessonId -> row)
function getProgress(userId) {
  if (!userId) return { byCourse: {}, byLesson: {}, total: 0, thisWeek: 0 };
  const rows = db.prepare(
    `SELECT p.lesson_id, p.completion_method, p.completed_at, l.course_id
     FROM user_lesson_progress p
     JOIN lessons l ON l.id = p.lesson_id
     WHERE p.user_id = ? AND p.completed_at IS NOT NULL`
  ).all(userId);

  const byCourse = {};
  const byLesson = {};
  let thisWeek = 0;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const row of rows) {
    byLesson[row.lesson_id] = row;
    byCourse[row.course_id] = (byCourse[row.course_id] || 0) + 1;
    const t = new Date(row.completed_at).getTime();
    if (!isNaN(t) && t >= weekAgo) thisWeek++;
  }

  return { byCourse, byLesson, total: rows.length, thisWeek };
}

// A course is unlocked if it is the first, or the previous course (by
// order_index) is fully completed. Guests only see the first course unlocked.
function isCourseUnlocked(userId, progress, courseId) {
  const course = getCourse(courseId);
  if (!course) return false;
  if (course.order_index <= 1) return true;
  if (!userId) return false;
  const prev = db.prepare(
    'SELECT id FROM courses WHERE order_index = ?'
  ).get(course.order_index - 1);
  if (!prev) return true;
  const total = getLessonCounts()[prev.id] || 0;
  const done = progress.byCourse[prev.id] || 0;
  return total > 0 && done >= total;
}

// A lesson is unlocked if it is the first in its course, or the previous
// lesson has been completed. For guests there is no saved progress, so treat
// every lesson as unlocked (the client gates the session flow).
function isLessonUnlocked(userId, progress, lessonId) {
  const lesson = getLesson(lessonId);
  if (!lesson) return false;
  if (lesson.order_index <= 1) return true;
  if (!userId) return true;
  const prev = db.prepare(
    'SELECT id FROM lessons WHERE course_id = ? AND order_index = ?'
  ).get(lesson.course_id, lesson.order_index - 1);
  if (!prev) return true;
  return !!progress.byLesson[prev.id];
}

function getNextLesson(courseId, orderIndex) {
  return db.prepare(
    'SELECT id FROM lessons WHERE course_id = ? AND order_index = ?'
  ).get(courseId, orderIndex + 1);
}

// ---------------------------------------------------------------------------
// GET /api/courses — list with per-course progress + summary
// ---------------------------------------------------------------------------

router.get('/courses', optionalAuth, (req, res) => {
  try {
    const userId = req.user?.id || null;
    const progress = getProgress(userId);
    const counts = getLessonCounts();

    const courses = db.prepare(
      'SELECT * FROM courses ORDER BY order_index ASC'
    ).all()
      .filter(isVisibleCourse)
      .map((course) => {
      const total = counts[course.id] || 0;
      const done = progress.byCourse[course.id] || 0;
      return {
        id: course.id,
        slug: course.slug,
        title: course.title,
        description: course.description,
        tagline: course.tagline || '',
        estimatedMinutes: course.estimated_minutes || 0,
        featured: course.featured || 0,
        category: course.category,
        icon: course.icon,
        orderIndex: course.order_index,
        lessonCount: total,
        completedCount: done,
        locked: !isCourseUnlocked(userId, progress, course.id),
      };
    });

    res.json({
      courses,
      summary: {
        coursesStarted: courses.filter((c) => c.completedCount > 0).length,
        lessonsCompleted: progress.total,
        lessonsCompletedThisWeek: progress.thisWeek,
      },
    });
  } catch (err) {
    console.error('[learning/list] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/courses/:slug — course detail with lesson lock state
// ---------------------------------------------------------------------------

router.get('/courses/:slug', optionalAuth, (req, res) => {
  try {
    const userId = req.user?.id || null;
    const course = db.prepare(
      'SELECT * FROM courses WHERE slug = ?'
    ).get(req.params.slug);

    // Hidden courses (anything other than JS/Python) return 404 so direct URL
    // access to them is impossible.
    if (!course || !isVisibleCourse(course)) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const progress = getProgress(userId);
    const lessons = getCourseLessons(course.id).map((lesson) => {
      const done = progress.byLesson[lesson.id];
      let status = 'locked';
      if (done) {
        status = done.completion_method === 'read' ? 'read' : 'completed';
      } else if (isLessonUnlocked(userId, progress, lesson.id)) {
        status = 'unlocked';
      }
      return {
        id: lesson.id,
        orderIndex: lesson.order_index,
        title: lesson.title,
        lessonType: lesson.lesson_type || 'typing',
        snippetLanguage: lesson.snippet_language,
        minAccuracy: lesson.min_accuracy,
        xpReward: lesson.xp_reward,
        status,
      };
    });

    res.json({
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        description: course.description,
        tagline: course.tagline || '',
        estimatedMinutes: course.estimated_minutes || 0,
        featured: course.featured || 0,
        category: course.category,
        icon: course.icon,
        orderIndex: course.order_index,
        lessonCount: lessons.length,
        completedCount: lessons.filter((l) => l.status !== 'locked').length,
      },
      locked: !isCourseUnlocked(userId, progress, course.id),
      lessons,
    });
  } catch (err) {
    console.error('[learning/course] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/lessons/:id — explanation + snippet for one lesson
// ---------------------------------------------------------------------------

router.get('/lessons/:id', optionalAuth, (req, res) => {
  try {
    const userId = req.user?.id || null;
    const lesson = getLesson(req.params.id);

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Hidden courses hide their lessons too.
    const course = getCourse(lesson.course_id);
    if (!course || !isVisibleCourse(course)) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const progress = getProgress(userId);
    if (userId && !isLessonUnlocked(userId, progress, lesson.id)) {
      return res.status(403).json({ error: 'Complete the previous lesson first' });
    }

    const courseLessons = getCourseLessons(course.id);
    const currentIndex = courseLessons.findIndex((l) => l.id === lesson.id);

    const done = progress.byLesson[lesson.id];
    const lessonType = lesson.lesson_type || 'typing';
    res.json({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        explanation: lesson.explanation,
        lessonType,
        snippetLanguage: lesson.snippet_language,
        snippetCode: lesson.snippet_code,
        shortcuts: lessonType === 'shortcut' ? getShortcuts(lesson.id) : [],
        minAccuracy: lesson.min_accuracy,
        xpReward: lesson.xp_reward,
        courseId: course.id,
        courseSlug: course.slug,
        courseTitle: course.title,
        lessonIndex: currentIndex + 1,
        totalLessons: courseLessons.length,
      },
      status: done ? (done.completion_method === 'read' ? 'read' : 'completed') : 'unlocked',
      nextLessonId: currentIndex >= 0 && currentIndex < courseLessons.length - 1
        ? courseLessons[currentIndex + 1].id
        : null,
    });
  } catch (err) {
    console.error('[learning/lesson] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/lessons/:id/attempt — typed completion with pass/fail gate
// ---------------------------------------------------------------------------

router.post('/lessons/:id/attempt', optionalAuth, (req, res) => {
  try {
    const userId = req.user?.id || null;
    const lesson = getLesson(req.params.id);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Hidden courses hide their lessons too.
    const course = getCourse(lesson.course_id);
    if (!course || !isVisibleCourse(course)) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const lessonType = lesson.lesson_type || 'typing';
    const { accuracy, errorCount, durationSeconds } = req.body;

    if (typeof accuracy !== 'number' || typeof errorCount !== 'number' || typeof durationSeconds !== 'number') {
      return res.status(400).json({ error: 'accuracy, errorCount, and durationSeconds are required numbers' });
    }
    if (accuracy < 0 || accuracy > 100 || errorCount < 0 || durationSeconds <= 0) {
      return res.status(400).json({ error: 'Invalid metric values' });
    }

    let wpm = null;
    let rawWpm = null;
    let consistency = null;

    if (lessonType === 'shortcut') {
      // Shortcut drills measure correctness and reaction time, not speed.
      const { avgReactionMs } = req.body;
      if (typeof avgReactionMs !== 'number' || avgReactionMs < 0) {
        return res.status(400).json({ error: 'avgReactionMs must be a number' });
      }
    } else {
      wpm = req.body.wpm;
      rawWpm = req.body.rawWpm;
      consistency = req.body.consistency;
      if (typeof wpm !== 'number' || typeof rawWpm !== 'number' || typeof consistency !== 'number') {
        return res.status(400).json({ error: 'wpm, rawWpm, and consistency are required for typing lessons' });
      }
      if (wpm < 0 || rawWpm < 0 || consistency < 0 || consistency > 100) {
        return res.status(400).json({ error: 'Invalid metric values' });
      }
    }

    const progress = getProgress(userId);
    if (userId && !isLessonUnlocked(userId, progress, lesson.id)) {
      return res.status(403).json({ error: 'Complete the previous lesson first' });
    }

    const passed = accuracy >= lesson.min_accuracy;

    if (userId) {
      const existing = db.prepare(
        'SELECT * FROM user_lesson_progress WHERE user_id = ? AND lesson_id = ?'
      ).get(userId, lesson.id);

      if (existing) {
        db.prepare(
          `UPDATE user_lesson_progress
           SET completed_at = ?,
               completion_method = 'typed',
               best_accuracy = MAX(COALESCE(best_accuracy, 0), ?),
               best_wpm = CASE WHEN ? IS NULL THEN best_wpm ELSE MAX(COALESCE(best_wpm, 0), ?) END,
               attempts = attempts + 1
           WHERE id = ?`
        ).run(new Date().toISOString(), accuracy, wpm, wpm, existing.id);
      } else {
        db.prepare(
          `INSERT INTO user_lesson_progress (user_id, lesson_id, completed_at, completion_method, best_accuracy, best_wpm, attempts)
           VALUES (?, ?, ?, 'typed', ?, ?, 1)`
        ).run(userId, lesson.id, new Date().toISOString(), accuracy, wpm);
      }
    }

    const next = getNextLesson(lesson.course_id, lesson.order_index);

    res.json({
      passed,
      accuracy: Math.round(accuracy * 10) / 10,
      minAccuracy: lesson.min_accuracy,
      lessonType,
      nextLessonId: next ? next.id : null,
      courseComplete: !next,
      saved: !!userId,
    });
  } catch (err) {
    console.error('[learning/attempt] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/lessons/:id/mark-read — read-mode completion (no metrics)
// ---------------------------------------------------------------------------

router.post('/lessons/:id/mark-read', optionalAuth, (req, res) => {
  try {
    const userId = req.user?.id || null;
    const lesson = getLesson(req.params.id);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Hidden courses hide their lessons too.
    const course = getCourse(lesson.course_id);
    if (!course || !isVisibleCourse(course)) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const progress = getProgress(userId);
    if (userId && !isLessonUnlocked(userId, progress, lesson.id)) {
      return res.status(403).json({ error: 'Complete the previous lesson first' });
    }

    if (userId) {
      db.prepare(
        `INSERT INTO user_lesson_progress (user_id, lesson_id, completed_at, completion_method, attempts)
         VALUES (?, ?, ?, 'read', 1)
         ON CONFLICT(user_id, lesson_id) DO UPDATE SET
           completed_at = excluded.completed_at,
           completion_method = 'read'`
      ).run(userId, lesson.id, new Date().toISOString());
    }

    const next = getNextLesson(lesson.course_id, lesson.order_index);

    res.json({
      success: true,
      method: 'read',
      nextLessonId: next ? next.id : null,
      courseComplete: !next,
      saved: !!userId,
    });
  } catch (err) {
    console.error('[learning/mark-read] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;