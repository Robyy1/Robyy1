// Keystroke — Course page
// Shows the lesson list for one course with lock state and per-lesson status.
(function () {
  'use strict';

  function getSlug() {
    return new URLSearchParams(window.location.search).get('slug') || '';
  }

  function renderNav(user) {
    var actions = document.getElementById('navActions');
    if (!actions) return;
    if (user) {
      actions.innerHTML =
        '<span class="nav-username" id="navUsername">' + escapeHtml(user.username) + '</span>' +
        '<button type="button" class="btn btn-ghost btn-sm logout-btn">Logout</button>';
      var btn = actions.querySelector('.logout-btn');
      if (btn) btn.addEventListener('click', function () { window.auth.logout(); });
    } else {
      actions.innerHTML =
        '<a href="/login.html" class="nav-link">Login</a>' +
        '<a href="/signup.html" class="btn btn-accent btn-sm">Sign up</a>';
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function statusMeta(status) {
    switch (status) {
      case 'completed': return { label: 'Completed', cls: 'lesson-status-completed', glyph: '&#10003;' };
      case 'read':      return { label: 'Read',       cls: 'lesson-status-read',      glyph: '&#128214;' };
      case 'unlocked':  return { label: 'Ready',      cls: 'lesson-status-unlocked',  glyph: '&#9654;' };
      default:          return { label: 'Locked',     cls: 'lesson-status-locked',    glyph: '&#128274;' };
    }
  }

  function lessonRow(lesson, courseLocked) {
    var meta = statusMeta(lesson.status);
    var canOpen = lesson.status === 'unlocked' || lesson.status === 'completed' || lesson.status === 'read';
    var href = '/lesson.html?id=' + lesson.id;
    var isNext = lesson.status === 'unlocked' && !courseLocked;

    var row =
      '<li class="lesson-row ' + meta.cls + (isNext ? ' lesson-row-next' : '') + '">' +
        '<span class="lesson-index">' + lesson.orderIndex + '</span>' +
        '<span class="lesson-title">' + escapeHtml(lesson.title) + '</span>' +
        '<span class="lesson-meta">' +
          '<span class="lesson-lang">' + (lesson.lessonType === 'shortcut' ? 'shortcut' : escapeHtml(lesson.snippetLanguage || 'code')) + '</span>' +
          '<span class="lesson-xp">+' + lesson.xpReward + ' XP</span>' +
        '</span>' +
        '<span class="lesson-status">' + meta.glyph + ' ' + meta.label + '</span>' +
      '</li>';

    if (canOpen && !courseLocked) {
      row = '<a class="lesson-row-link" href="' + href + '">' + row + '</a>';
    }

    return row;
  }

  function renderCourse(data) {
    var hero = document.getElementById('courseHero');
    var list = document.getElementById('lessonList');
    var loading = document.getElementById('courseLoading');
    if (loading) loading.remove();

    var course = data.course;
    var pct = course.lessonCount > 0
      ? Math.round((course.completedCount / course.lessonCount) * 100)
      : 0;

    hero.innerHTML =
      '<div class="course-hero-header">' +
        '<span class="course-category">' + escapeHtml(course.category) + '</span>' +
        '<h1 class="course-title">' + escapeHtml(course.title) + '</h1>' +
        '<p class="course-desc">' + escapeHtml(course.description) + '</p>' +
      '</div>' +
      '<div class="course-progress">' +
        '<div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="' + course.lessonCount + '" aria-valuenow="' + course.completedCount + '">' +
          '<div class="progress-fill" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<span class="course-progress-label">' + course.completedCount + ' / ' + course.lessonCount + ' lessons completed</span>' +
      '</div>';

    if (data.locked) {
      list.innerHTML =
        '<div class="card locked-banner">' +
          '<p>Complete every lesson in the previous course to unlock this one.</p>' +
        '</div>';
      return;
    }

    if (!data.lessons || data.lessons.length === 0) {
      list.innerHTML = '<p class="empty-text">No lessons in this course yet.</p>';
      return;
    }

    var html = '<ol class="lesson-list-ol">';
    for (var i = 0; i < data.lessons.length; i++) {
      html += lessonRow(data.lessons[i], data.locked);
    }
    html += '</ol>';
    list.innerHTML = html;
  }

  function init() {
    var slug = getSlug();
    if (!slug) {
      window.location.href = '/learning.html';
      return;
    }

    window.auth.getMe().then(function (user) {
      renderNav(user);
      return fetch('/api/courses/' + encodeURIComponent(slug), { credentials: 'include' })
        .then(function (res) {
          if (res.status === 404) throw new Error('Course not found');
          if (!res.ok) throw new Error('Failed to load course');
          return res.json();
        })
        .then(renderCourse)
        .catch(function () {
          var hero = document.getElementById('courseHero');
          var loading = document.getElementById('courseLoading');
          if (loading) loading.remove();
          if (hero) hero.innerHTML = '<p class="empty-text">Course not found.</p>';
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();