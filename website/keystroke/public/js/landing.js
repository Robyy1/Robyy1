// Keystroke — Landing page
// Live hero demo, real aggregate stats (count-up), and a course showcase
// capped at 6. No fabricated numbers — every value comes from the API.
(function () {
  'use strict';

  var ACCENT_ICONS = {
    js: 'JS', py: 'PY', git: 'GIT', sql: 'SQL', regex: '.*', ai: 'AI',
    dv: 'DV', bl: 'BL',
  };

  // Hero demo snippets - rotating through real code patterns
  var DEMO_SNIPPETS = [
    'const debounce = (fn, delay) => {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  };\n};',
    'async function fetchUser(id) {\n  const res = await fetch(`/api/users/${id}`);\n  if (!res.ok) throw new Error("Not found");\n  return res.json();\n}',
    'const users = [\n  { name: "Ada", role: "admin" },\n  { name: "Grace", role: "dev" }\n];\nconst admins = users.filter(u => u.role === "admin");',
    'def fibonacci(n):\n    a, b = 0, 1\n    for _ in range(n):\n        yield a\n        a, b = b, a + b\n\nlist(fibonacci(10))',
    'with open("data.json", "r") as f:\n    data = json.load(f)\n\nresults = [x for x in data if x["active"]]',
    'class Component {\n  constructor(props) {\n    this.props = props;\n    this.state = {};\n  }\n  render() {\n    return `<div>${this.props.children}</div>`;\n  }\n}'
  ];

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function isReducedMotion() {
    var osReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var motion = document.documentElement.dataset.motion || 'system';
    if (motion === 'on') return true;
    if (motion === 'off') return false;
    return osReduced;
  }

  // --- Live hero demo: auto-types snippets so code "writes itself" ---
  function initHeroDemo() {
    var demoTextEl = document.getElementById('hero-demo-text');
    if (!demoTextEl) return;

    // Auto-cycle through snippets, ~10s total loop time
    var SNIPPETS_TO_TYPE = DEMO_SNIPPETS.slice(0, 5);
    var TOTAL_TARGET_MS = 10000;
    var SWITCH_PAUSE_MS = 450;

    var totalChars = 0;
    for (var s = 0; s < SNIPPETS_TO_TYPE.length; s++) totalChars += SNIPPETS_TO_TYPE[s].length;
    var perCharDelay = Math.max(1, (TOTAL_TARGET_MS - SWITCH_PAUSE_MS * SNIPPETS_TO_TYPE.length) / totalChars);

    var currentIndex = 0;
    var snippet = SNIPPETS_TO_TYPE[currentIndex];
    var typedIndex = 0;
    var typing = false;

    function renderDemo() {
      var html = '';
      for (var i = 0; i < snippet.length; i++) {
        html += '<span class="char-untyped">' + escapeHtml(snippet[i]) + '</span>';
      }
      demoTextEl.innerHTML = html;
    }

    function spans() { return demoTextEl.querySelectorAll('span'); }

    function updateCaret() {
      var list = spans();
      for (var i = 0; i < list.length; i++) {
        if (list[i].className === 'char-current') list[i].className = 'char-untyped';
      }
      if (typedIndex < snippet.length) list[typedIndex].className = 'char-current';
    }

    function finishSnippet() {
      var list = spans();
      for (var i = 0; i < list.length; i++) list[i].className = 'char-correct';
      updateCaret();
      setTimeout(function () {
        currentIndex = (currentIndex + 1) % SNIPPETS_TO_TYPE.length;
        snippet = SNIPPETS_TO_TYPE[currentIndex];
        typedIndex = 0;
        renderDemo();
        updateCaret();
        typeNextChar();
      }, SWITCH_PAUSE_MS);
    }

    function typeNextChar() {
      if (typing) return;
      typing = true;
      if (typedIndex >= snippet.length) { finishSnippet(); typing = false; return; }
      typedIndex++;
      var list = spans();
      var span = list[typedIndex - 1];
      if (span) span.className = 'char-correct';
      updateCaret();
      var delay = perCharDelay * (Math.random() * 0.6 + 0.7);
      setTimeout(function () { typing = false; typeNextChar(); }, delay);
    }

    renderDemo();
    updateCaret();
    typeNextChar();
  }

  // --- Stats bar ---
  function animateCount(el, target, duration) {
    if (isReducedMotion() || !('requestAnimationFrame' in window)) {
      el.textContent = String(target);
      return;
    }
    var start = null;
    var from = 0;
    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var value = Math.round(from + (target - from) * easeOut(progress));
      el.textContent = String(value);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function loadStats() {
    fetch('/api/stats/public')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.totalTests !== undefined) animateCount(document.getElementById('statTotalTests'), data.totalTests, 900);
        if (data.totalLessons !== undefined) animateCount(document.getElementById('statTotalLessons'), data.totalLessons, 900);
        if (data.totalUsers !== undefined) animateCount(document.getElementById('statTotalUsers'), data.totalUsers, 900);
        var accEl = document.getElementById('statWeeklyAccuracy');
        if (data.weeklyAvgAccuracy === null || data.weeklyAvgAccuracy === undefined) {
          accEl.textContent = '\u2014';
        } else {
          animateCount(accEl, data.weeklyAvgAccuracy, 900);
        }
      })
      .catch(function () {
        document.getElementById('statTotalTests').textContent = '\u2014';
        document.getElementById('statTotalLessons').textContent = '\u2014';
        document.getElementById('statTotalUsers').textContent = '\u2014';
        document.getElementById('statWeeklyAccuracy').textContent = '\u2014';
      });
  }

  // --- Popularity (live GitHub repo counts) ---
  function formatCount(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function loadPopularity() {
    var list = document.getElementById('popularityList');
    if (!list) return;
    var note = document.getElementById('popularityNote');

    fetch('/api/stats/popularity')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var langs = data.languages || [];
        if (langs.length === 0) {
          list.innerHTML = '<li class="empty-text">No popularity data available.</li>';
          return;
        }

        var max = 0;
        for (var i = 0; i < langs.length; i++) {
          if (langs[i].repos > max) max = langs[i].repos;
        }

        var html = '';
        for (var j = 0; j < langs.length; j++) {
          var lang = langs[j];
          var pct = max > 0 ? Math.round((lang.repos / max) * 100) : 0;
          html +=
            '<li class="popularity-item">' +
              '<span class="popularity-rank">' + (j + 1) + '</span>' +
              '<span class="popularity-label">' + escapeHtml(lang.label) + '</span>' +
              '<span class="popularity-bar"><span class="popularity-bar-fill" data-pct="' + pct + '"></span></span>' +
              '<span class="popularity-count">' + formatCount(lang.repos) + ' repos</span>' +
            '</li>';
        }
        list.innerHTML = html;

        // Animate the bars on the next frame so the CSS width transition runs.
        requestAnimationFrame(function () {
          var fills = list.querySelectorAll('.popularity-bar-fill');
          for (var k = 0; k < fills.length; k++) {
            fills[k].style.width = fills[k].getAttribute('data-pct') + '%';
          }
        });

        if (note) {
          var fetched = data.fetchedAt ? ' Fetched ' + new Date(data.fetchedAt).toLocaleString() + '.' : '';
          note.innerHTML = escapeHtml(data.note || '') + fetched +
            ' <a href="https://docs.github.com/en/rest/search" target="_blank" rel="noopener">GitHub Search API</a>';
        }
      })
      .catch(function () {
        list.innerHTML = '<li class="empty-text">Could not load popularity data.</li>';
      });
  }

  // --- Course showcase (max 6, filtered to JS & Python only) ---
  function courseCard(course) {
    var icon = ACCENT_ICONS[course.icon] || '&#128214;';
    return '<article class="card course-card" data-reveal>' +
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
        '<a href="/course.html?slug=' + encodeURIComponent(course.slug) + '" class="btn btn-accent btn-block course-cta">' +
          (course.completedCount > 0 ? 'Continue' : 'Start course') +
        '</a>' +
      '</article>';
  }

  function loadCourses() {
    var grid = document.getElementById('landingCourseGrid');
    fetch('/api/courses', { credentials: 'include' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        // Filter to only JavaScript and Python courses
        var allowedCategories = ['language'];
        var allowedIcons = ['js', 'py'];
        var filteredCourses = (data.courses || []).filter(function(course) {
          return allowedCategories.includes(course.category) && allowedIcons.includes(course.icon);
        });
        var courses = filteredCourses.slice(0, 6);
        if (courses.length === 0) {
          grid.innerHTML = '<p class="empty-text">No courses available yet.</p>';
        } else {
          var html = '';
          for (var i = 0; i < courses.length; i++) {
            html += courseCard(courses[i]);
          }
          grid.innerHTML = html;
        }
        if (window.initScrollReveal) window.initScrollReveal();
      })
      .catch(function () {
        grid.innerHTML = '<p class="empty-text">Could not load courses. Try again later.</p>';
      });
  }

  // --- Init ---
  function init() {
    initHeroDemo();
    loadStats();
    loadPopularity();
    loadCourses();
    if (window.initScrollReveal) window.initScrollReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();