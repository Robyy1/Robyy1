// Keystroke — Learning page
// Loads the course list from /api/courses and renders the course grid.
(function () {
  'use strict';

  const ACCENT_ICONS = {
    js: 'JS', py: 'PY', git: 'GIT', sql: 'SQL', regex: '.*', ai: 'AI',
    dv: 'DV', bl: 'BL',
  };

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

  function courseCard(course) {
    var icon = ACCENT_ICONS[course.icon] || '&#128214;';
    var pct = course.lessonCount > 0
      ? Math.round((course.completedCount / course.lessonCount) * 100)
      : 0;

    var body =
      '<article class="card course-card' + (course.locked ? ' course-card-locked' : '') + '" data-reveal>' +
        '<div class="course-card-top">' +
          '<span class="course-icon" aria-hidden="true">' + icon + '</span>' +
          '<span class="course-category">' + escapeHtml(course.category) + '</span>' +
        '</div>' +
        '<h3 class="course-title">' + escapeHtml(course.title) + '</h3>' +
        '<p class="course-tagline">' + escapeHtml(course.tagline || course.description) + '</p>' +
        '<div class="course-card-stats">' +
          '<span>' + course.lessonCount + ' lessons</span>' +
          '<span class="course-card-stats-dot" aria-hidden="true">&middot;</span>' +
          '<span>~' + (course.estimatedMinutes || 20) + ' min</span>' +
        '</div>' +
        '<div class="course-progress">' +
          '<div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="' + course.lessonCount + '" aria-valuenow="' + course.completedCount + '">' +
            '<div class="progress-fill" style="width:' + pct + '%"></div>' +
          '</div>' +
          '<span class="course-progress-label">' + course.completedCount + ' / ' + course.lessonCount + ' lessons</span>' +
        '</div>' +
        '<a href="/course.html?slug=' + encodeURIComponent(course.slug) + '" class="btn btn-accent btn-block course-cta">' +
          (course.locked ? 'Locked' : (course.completedCount > 0 ? 'Continue' : 'Start course')) +
        '</a>' +
        '<div class="course-card-desc"><p class="course-desc">' + escapeHtml(course.description) + '</p></div>' +
      '</article>';

    return body;
  }

  function renderCourses(data) {
    var grid = document.getElementById('courseGrid');
    var loading = document.getElementById('courseGridLoading');
    if (loading) loading.remove();

    // Filter to only JavaScript and Python courses
    var allowedCategories = ['language'];
    var allowedIcons = ['js', 'py'];
    var filteredCourses = (data.courses || []).filter(function(course) {
      return allowedCategories.includes(course.category) && allowedIcons.includes(course.icon);
    });

    if (!filteredCourses || filteredCourses.length === 0) {
      grid.innerHTML = '<p class="empty-text">No courses available yet.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < filteredCourses.length; i++) {
      html += courseCard(filteredCourses[i]);
    }
    grid.innerHTML = html;

    // Locked courses are not clickable.
    var ctas = grid.querySelectorAll('.course-card-locked .course-cta');
    for (var j = 0; j < ctas.length; j++) {
      ctas[j].addEventListener('click', function (e) { e.preventDefault(); });
      ctas[j].classList.add('course-cta-locked');
    }

    if (window.initScrollReveal) window.initScrollReveal();
  }

  function renderSummary(summary) {
    var el;
    el = document.getElementById('summaryStarted');
    if (el) el.textContent = summary ? summary.coursesStarted : 0;
    el = document.getElementById('summaryCompleted');
    if (el) el.textContent = summary ? summary.lessonsCompleted : 0;
    el = document.getElementById('summaryWeek');
    if (el) el.textContent = summary ? summary.lessonsCompletedThisWeek : 0;
  }

  function init() {
    window.auth.getMe().then(function (user) {
      renderNav(user);
      var guest = document.getElementById('guestBanner');
      if (guest) guest.classList.toggle('hidden', !!user);

      return fetch('/api/courses', { credentials: 'include' })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to load courses');
          return res.json();
        })
        .then(function (data) {
          renderSummary(data.summary);
          renderCourses(data);
        })
        .catch(function () {
          var grid = document.getElementById('courseGrid');
          var loading = document.getElementById('courseGridLoading');
          if (loading) loading.remove();
          if (grid) grid.innerHTML = '<p class="empty-text">Could not load courses. Try again later.</p>';
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();