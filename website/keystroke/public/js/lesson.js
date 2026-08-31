// Keystroke — Lesson page
// Loads one lesson, offers a Type or Read path, and posts the result to the
// learning API so the next lesson unlocks.
(function () {
  'use strict';

  // --- DOM refs ---
  var backLink = document.getElementById('backLink');
  var lessonProgressMeta = document.getElementById('lessonProgressMeta');
  var lessonHeading = document.getElementById('lessonHeading');
  var lessonLoading = document.getElementById('lessonLoading');
  var lessonModeToggle = document.getElementById('lessonModeToggle');
  var modeBtns = document.querySelectorAll('[data-lesson-mode]');
  var typeSection = document.getElementById('lessonTypeSection');
  var readSection = document.getElementById('lessonReadSection');
  var explanationEl = document.getElementById('lessonExplanation');
  var codePreviewEl = document.getElementById('lessonCodePreview');
  var markReadBtn = document.getElementById('markReadBtn');
  var resultSection = document.getElementById('lessonResultSection');
  var resultTitle = document.getElementById('resultTitle');
  var resultGrid = document.getElementById('resultGrid');
  var nextLessonBtn = document.getElementById('nextLessonBtn');
  var retryLessonBtn = document.getElementById('retryLessonBtn');
  var startTypeBtn = document.getElementById('startTypeBtn');
  var errorMessage = document.getElementById('errorMessage');

  var liveWpm = document.getElementById('liveWpm');
  var liveWpmUnit = document.getElementById('liveWpmUnit');
  var liveAccuracy = document.getElementById('liveAccuracy');
  var liveErrors = document.getElementById('liveErrors');
  var editorTitle = document.getElementById('editorTitle');
  var lineNumbers = document.getElementById('lineNumbers');
  var typingContainer = document.getElementById('typingContainer');
  var typingText = document.getElementById('typingText');
  var caret = document.getElementById('caret');
  var hiddenInput = document.getElementById('hiddenInput');
  var countdownOverlay = document.getElementById('countdownOverlay');
  var countdownText = document.getElementById('countdownText');
  var shortcutDrill = document.getElementById('shortcutDrill');
  var shortcutFeedback = document.getElementById('shortcutFeedback');
  var shortcutProgress = document.getElementById('shortcutProgress');
  var shortcutAction = document.getElementById('shortcutAction');
  var shortcutKeys = document.getElementById('shortcutKeys');

  // --- State ---
  var lesson = null;
  var engine = null;
  var shortcutEngine = null;
  var isShortcut = false;
  var testText = '';
  var currentMode = 'type'; // 'type' | 'read'
  var isTestRunning = false;
  var completed = false;

  // --- Init ---
  function getLessonId() {
    return new URLSearchParams(window.location.search).get('id') || '';
  }

  function init() {
    var id = getLessonId();
    if (!id) {
      window.location.href = '/learning.html';
      return;
    }

    window.auth.getMe().then(function (user) {
      renderNav(user);
      return fetch('/api/lessons/' + encodeURIComponent(id), { credentials: 'include' })
        .then(function (res) {
          if (res.status === 403) throw { status: 403 };
          if (res.status === 404) throw { status: 404 };
          if (!res.ok) throw new Error('Failed to load lesson');
          return res.json();
        })
        .then(function (data) {
          lesson = data.lesson;
          if (lesson) {
            backLink.href = '/course.html?slug=' + encodeURIComponent(lesson.courseSlug);
            document.title = lesson.title + ' — Keystroke';
            isShortcut = lesson.lessonType === 'shortcut';
            var firstUnlocked = data.status === 'unlocked';
            completed = data.status === 'completed' || data.status === 'read';
            renderHeading(data);
            renderCodePreview();
            setupModeToggle();
            applyDefaultMode();
            bindTypeControls();
            bindReadControls();
            window.addEventListener('pagehide', function () {
              if (shortcutEngine) shortcutEngine.dispose();
            });
          }
        })
        .catch(function (err) {
          var heading = document.getElementById('lessonHeading');
          if (lessonLoading) lessonLoading.remove();
          if (err && err.status === 403) {
            heading.innerHTML = '<h1 class="course-title">Locked</h1><p class="course-desc">Complete the previous lesson first.</p>';
          } else {
            heading.innerHTML = '<p class="empty-text">Lesson not found.</p>';
          }
          lessonModeToggle.classList.add('hidden');
        });
    });
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

  function renderHeading(data) {
    if (lessonLoading) lessonLoading.remove();
    lessonProgressMeta.textContent = 'Lesson ' + lesson.lessonIndex + ' of ' + lesson.totalLessons +
      ' — ' + lesson.courseTitle;
    lessonHeading.innerHTML =
      '<h1 class="course-title">' + escapeHtml(lesson.title) + '</h1>' +
      '<p class="lesson-threshold">Reach ' + lesson.minAccuracy + '% accuracy to pass &nbsp; &middot; &nbsp; +' + lesson.xpReward + ' XP</p>' +
      (completed ? '<p class="lesson-already">Completed</p>' : '');
    lessonModeToggle.classList.remove('hidden');
  }

  function renderCodePreview() {
    if (isShortcut) {
      var html = '';
      for (var i = 0; i < lesson.shortcuts.length; i++) {
        var s = lesson.shortcuts[i];
        html += '<div class="shortcut-list-item">' +
          '<span class="shortcut-list-action">' + escapeHtml(s.action_label) + '</span>' +
          '<span class="shortcut-list-keys">' + renderKeyChips(s.keys_win) + '</span>' +
        '</div>';
      }
      codePreviewEl.innerHTML = html;
    } else {
      codePreviewEl.textContent = lesson.snippetCode;
    }
  }

  function renderKeyChips(combo) {
    var parts = String(combo || '').split('+');
    var html = '';
    for (var i = 0; i < parts.length; i++) {
      html += '<kbd class="key-chip">' + escapeHtml(parts[i]) + '</kbd>';
    }
    return html;
  }

  function applyDefaultMode() {
    // Honor the user's learning_mode setting unless the lesson is already done.
    var preferred = 'type';
    try {
      var saved = JSON.parse(localStorage.getItem('keystroke_config') || '{}');
      preferred = saved.learningMode || 'type';
    } catch (e) {}
    if (preferred === 'read') {
      setMode('read');
    } else {
      setMode('type');
    }
  }

  function setMode(mode) {
    currentMode = mode;
    for (var i = 0; i < modeBtns.length; i++) {
      var btn = modeBtns[i];
      var active = btn.getAttribute('data-lesson-mode') === mode;
      btn.classList.toggle('mode-btn-active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    }
    typeSection.classList.toggle('hidden', mode !== 'type');
    readSection.classList.toggle('hidden', mode !== 'read');

    if (mode === 'read') {
      renderExplanation();
    }

    if (mode === 'type' && !completed && !engine && !shortcutEngine) {
      if (isShortcut) {
        initShortcutEngine();
      } else {
        initEngine(lesson.snippetCode);
      }
    }
  }

  function setupModeToggle() {
    for (var i = 0; i < modeBtns.length; i++) {
      modeBtns[i].addEventListener('click', function () {
        setMode(this.getAttribute('data-lesson-mode'));
      });
    }
  }

  // --- Type mode ---
  function bindTypeControls() {
    if (isShortcut) {
      if (startTypeBtn) {
        startTypeBtn.textContent = 'Start drill';
        startTypeBtn.addEventListener('click', function () {
          if (!shortcutEngine) initShortcutEngine();
          startCountdown();
        });
      }
      return;
    }

    hiddenInput.addEventListener('input', handleTextInput);
    hiddenInput.addEventListener('keydown', handleKeyDown);
    hiddenInput.addEventListener('paste', function (e) { e.preventDefault(); });
    document.addEventListener('click', function (e) {
      if (isTestRunning && e.target !== hiddenInput && !e.target.closest('.results-card')) {
        hiddenInput.focus();
      }
    });
    if (startTypeBtn) {
      startTypeBtn.addEventListener('click', function () {
        if (!engine) initEngine(lesson.snippetCode);
        startCountdown();
      });
    }
  }

  function bindReadControls() {
    markReadBtn.addEventListener('click', handleMarkRead);
  }

  function initEngine(text) {
    testText = text;
    var options = {
      targetText: text,
      onStateChange: function (state) {
        if (state === typingEngine.STATE.RUNNING) {
          isTestRunning = true;
          countdownOverlay.classList.add('hidden');
        } else if (state === typingEngine.STATE.FINISHED) {
          isTestRunning = false;
          hiddenInput.blur();
        }
      },
      onUpdate: handleUpdate,
      onFinish: handleFinish,
      renderAll: renderAllCharacters
    };
    engine = new typingEngine.TypingEngine(options);
    renderAllCharacters();
  }

  function initShortcutEngine() {
    var osPref = 'auto';
    try {
      var cfg = JSON.parse(localStorage.getItem('keystroke_config') || '{}');
      osPref = cfg.osPref || 'auto';
    } catch (e) {}

    lineNumbers.classList.add('hidden');
    typingContainer.classList.add('hidden');
    caret.classList.add('hidden');
    shortcutDrill.classList.remove('hidden');

    liveWpm.textContent = '0';
    liveWpmUnit.textContent = '/ ' + lesson.shortcuts.length;
    liveAccuracy.textContent = '100.0';
    liveAccuracy.style.color = 'var(--success)';
    liveErrors.textContent = '0';
    shortcutProgress.textContent = '1 / ' + lesson.shortcuts.length;

    shortcutEngine = new window.shortcutEngine.ShortcutEngine({
      shortcuts: lesson.shortcuts,
      osPref: osPref,
      onUpdate: handleShortcutUpdate,
      onFinish: handleShortcutFinish
    });
    renderShortcutPrompt(shortcutEngine.currentAction(), shortcutEngine.currentTarget(), null, true);
  }

  function renderShortcutPrompt(actionLabel, target, comboLabel, first) {
    shortcutAction.textContent = actionLabel || '';
    if (comboLabel) {
      shortcutKeys.innerHTML = renderKeyChips(comboLabel);
    } else if (target) {
      shortcutKeys.innerHTML = renderKeyChips(target);
    } else {
      shortcutKeys.innerHTML = '';
    }
    if (first) {
      shortcutFeedback.textContent = 'Press the highlighted shortcut.';
      shortcutFeedback.className = 'shortcut-feedback shortcut-feedback-idle';
    }
  }

  function handleShortcutUpdate(data) {
    liveWpm.textContent = data.completed;
    liveWpmUnit.textContent = '/' + data.total;
    liveAccuracy.textContent = data.accuracy.toFixed(1);
    liveErrors.textContent = data.errors;

    if (data.accuracy < 80) liveAccuracy.style.color = 'var(--error)';
    else if (data.accuracy < 95) liveAccuracy.style.color = 'var(--text-muted)';
    else liveAccuracy.style.color = 'var(--success)';

    shortcutProgress.textContent = (data.completed + 1) + ' / ' + data.total;

    if (data.feedback === 'correct') {
      shortcutFeedback.textContent = 'Correct — keep going';
      shortcutFeedback.className = 'shortcut-feedback shortcut-feedback-correct';
    } else if (data.feedback === 'error') {
      shortcutFeedback.textContent = 'Wrong key — try again';
      shortcutFeedback.className = 'shortcut-feedback shortcut-feedback-error';
    }

    renderShortcutPrompt(data.actionLabel, data.target, data.comboLabel, false);
  }

  function handleShortcutFinish(metrics) {
    isTestRunning = false;
    shortcutFeedback.textContent = 'Lesson complete';
    shortcutFeedback.className = 'shortcut-feedback shortcut-feedback-correct';
    postShortcutAttempt(metrics);
  }

  function beginTest() {
    if (isShortcut) {
      if (!shortcutEngine) return;
      isTestRunning = true;
      editorTitle.textContent = lesson.title + ' — lesson';
      shortcutEngine.start();
      return;
    }
    if (!engine) return;
    isTestRunning = true;
    editorTitle.textContent = lesson.snippetLanguage + ' — lesson';
    engine.start();
    hiddenInput.focus();
  }

  function startCountdown() {
    countdownOverlay.classList.remove('hidden');
    var count = 3;
    countdownText.textContent = count;
    var interval = setInterval(function () {
      count--;
      if (count > 0) {
        countdownText.textContent = count;
      } else {
        clearInterval(interval);
        countdownOverlay.classList.add('hidden');
        beginTest();
      }
    }, 600);
  }

  function handleTextInput(e) {
    if (!isTestRunning || !engine) return;
    var value = hiddenInput.value;
    if (value.length === 0) return;
    var ch = value[value.length - 1];
    if (ch === '\n' || ch === '\r') ch = '\n';
    else if (ch === '\t') {
      var indent = 2;
      try { var cfg = JSON.parse(localStorage.getItem('keystroke_config') || '{}'); indent = cfg.indentWidthPref || 2; } catch (err) {}
      for (var i = 0; i < indent; i++) engine.handleInput(' ');
      hiddenInput.value = '';
      renderCurrentState();
      return;
    }
    engine.handleInput(ch);
    hiddenInput.value = '';
    renderCurrentState();
  }

  function handleKeyDown(e) {
    if (!isTestRunning || !engine) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      var handled = engine.handleInput('\b');
      if (handled) renderCurrentState();
      return;
    }

    if (e.ctrlKey || e.altKey || e.metaKey) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      engine.handleInput('\n');
      renderCurrentState();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      var indent = 2;
      try { var cfg = JSON.parse(localStorage.getItem('keystroke_config') || '{}'); indent = cfg.indentWidthPref || 2; } catch (err) {}
      for (var i = 0; i < indent; i++) engine.handleInput(' ');
      renderCurrentState();
      return;
    }

    if (e.key.length > 1) return;

    if (!e.key.match(/^[a-zA-Z0-9\s!@#$%^&*()_+\-=\[\]{};:'",.<>\/?\\|`~]$/)) {
      e.preventDefault();
      return;
    }

    if (e.key.length === 1) {
      e.preventDefault();
      var handled = engine.handleInput(e.key);
      if (handled) renderCurrentState();
    }
  }

  function handleUpdate(data) {
    liveWpm.textContent = data.wpm || 0;
    liveAccuracy.textContent = (data.accuracy || 0).toFixed(1);
    liveErrors.textContent = data.errors || 0;
    if (data.accuracy < 80) liveAccuracy.style.color = 'var(--error)';
    else if (data.accuracy < 95) liveAccuracy.style.color = 'var(--text-muted)';
    else liveAccuracy.style.color = 'var(--success)';
  }

  function handleFinish(metrics) {
    isTestRunning = false;
    hiddenInput.blur();
    postAttempt(metrics);
  }

  function postAttempt(metrics) {
    var durationSeconds = engine ? (Date.now() - engine.startTime) / 1000 : 0;
    var body = {
      wpm: metrics.wpm || 0,
      rawWpm: metrics.rawWpm || 0,
      accuracy: metrics.accuracy || 0,
      consistency: metrics.consistency || 0,
      errorCount: metrics.errorCount || 0,
      durationSeconds: Math.max(1, Math.round(durationSeconds))
    };

    fetch('/api/lessons/' + lesson.id + '/attempt', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) { return res.json(); })
      .then(function (data) {
        showResult(data);
      })
      .catch(function () {
        showError('Could not save your attempt. Please try again.');
        setMode('type');
      });
  }

  function postShortcutAttempt(metrics) {
    var body = {
      accuracy: metrics.accuracy || 0,
      avgReactionMs: metrics.avgReactionMs || 0,
      errorCount: metrics.errorCount || 0,
      durationSeconds: Math.max(1, metrics.durationSeconds || 0)
    };

    fetch('/api/lessons/' + lesson.id + '/attempt', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) { return res.json(); })
      .then(function (data) {
        showResult(data);
      })
      .catch(function () {
        showError('Could not save your attempt. Please try again.');
        setMode('type');
      });
  }

  function showResult(data) {
    completed = data.passed;
    typeSection.classList.add('hidden');
    readSection.classList.add('hidden');
    lessonModeToggle.classList.add('hidden');
    resultSection.classList.remove('hidden');

    if (data.passed) {
      resultTitle.textContent = 'Lesson passed!';
      resultGrid.innerHTML =
        '<div class="results-headline">' +
          '<div class="results-headline-main">' +
            '<span class="results-headline-value">' + data.accuracy.toFixed(1) + '%</span>' +
            '<span class="results-headline-label">accuracy (needed ' + lesson.minAccuracy + '%)</span>' +
          '</div>' +
        '</div>' +
        '<div class="stat-card"><span class="stat-card-label">Next lesson</span><span class="stat-card-value">' + (data.nextLessonId ? 'Unlocked' : 'Course complete!') + '</span></div>' +
        (data.saved ? '' : '<div class="stat-card"><span class="stat-card-label">Progress</span><span class="stat-card-value stat-card-value-error">Guest — not saved</span></div>');

      nextLessonBtn.classList.remove('hidden');
      retryLessonBtn.classList.add('hidden');
      if (data.nextLessonId) {
        nextLessonBtn.onclick = function () {
          window.location.href = '/lesson.html?id=' + data.nextLessonId;
        };
      } else {
        nextLessonBtn.textContent = 'Course complete — view courses';
        nextLessonBtn.onclick = function () { window.location.href = '/learning.html'; };
      }
    } else {
      resultTitle.textContent = 'Not quite — keep practicing';
      resultGrid.innerHTML =
        '<div class="results-headline">' +
          '<div class="results-headline-main">' +
            '<span class="results-headline-value results-headline-value-bad">' + data.accuracy.toFixed(1) + '%</span>' +
            '<span class="results-headline-label">accuracy (needed ' + lesson.minAccuracy + '%)</span>' +
          '</div>' +
        '</div>' +
        (isShortcut
          ? '<div class="stat-card"><span class="stat-card-label">Avg reaction</span><span class="stat-card-value">' + (shortcutEngine ? shortcutEngine.metrics.avgReactionMs : 0) + ' ms</span></div>'
          : '<div class="stat-card"><span class="stat-card-label">WPM</span><span class="stat-card-value">' + (engine ? engine.metrics.wpm : 0) + '</span></div>') +
        '<div class="stat-card"><span class="stat-card-label">Errors</span><span class="stat-card-value stat-card-value-error">' + (isShortcut ? (shortcutEngine ? shortcutEngine.metrics.errorCount : 0) : (engine ? engine.metrics.errorCount : 0)) + '</span></div>';

      nextLessonBtn.classList.add('hidden');
      retryLessonBtn.classList.remove('hidden');
      retryLessonBtn.onclick = function () {
        resultSection.classList.add('hidden');
        lessonModeToggle.classList.remove('hidden');
        setMode('type');
        retry();
      };
    }

    resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function retry() {
    if (isShortcut) {
      if (shortcutEngine) shortcutEngine.dispose();
      shortcutEngine = null;
      lineNumbers.classList.remove('hidden');
      typingContainer.classList.remove('hidden');
      shortcutDrill.classList.add('hidden');
      initShortcutEngine();
      isTestRunning = false;
      typeSection.classList.remove('hidden');
      liveWpm.textContent = '0';
      liveWpmUnit.textContent = '/ ' + lesson.shortcuts.length;
      liveAccuracy.textContent = '100.0';
      liveErrors.textContent = '0';
      startCountdown();
      return;
    }
    engine.reset();
    isTestRunning = false;
    typeSection.classList.remove('hidden');
    hiddenInput.value = '';
    hiddenInput.focus();
    liveWpm.textContent = '0';
    liveAccuracy.textContent = '100.0';
    liveErrors.textContent = '0';
    renderAllCharacters();
    startCountdown();
  }

  // --- Read mode ---
  function renderExplanation() {
    explanationEl.innerHTML = markdownToHtml(lesson.explanation);
  }

  // Renders lesson explanations (plain markdown subset) into safe HTML.
  // Supports: headings (# / ## / ###), unordered lists (- / *), paragraphs
  // separated by blank lines, inline `code`, and **bold**.
  function markdownToHtml(md) {
    function inline(text) {
      return escapeHtml(text)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }

    var blocks = String(md || '').split(/\n\s*\n/);
    var html = '';
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i].trim();
      if (!block) continue;

      var heading = block.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        var level = heading[1].length;
        html += '<h' + level + ' class="lesson-explanation-heading">' + inline(heading[2]) + '</h' + level + '>';
        continue;
      }

      if (/^([-*])\s/.test(block)) {
        var items = block.split('\n');
        html += '<ul class="lesson-explanation-list">';
        for (var j = 0; j < items.length; j++) {
          var item = items[j].trim();
          if (item && /^[-*]\s/.test(item)) {
            html += '<li>' + inline(item.replace(/^[-*]\s/, '')) + '</li>';
          }
        }
        html += '</ul>';
        continue;
      }

      // Ordinary paragraph: keep single line breaks as <br>.
      var lines = block.split('\n');
      var escapedLines = [];
      for (var k = 0; k < lines.length; k++) {
        escapedLines.push(inline(lines[k]));
      }
      html += '<p>' + escapedLines.join('<br>') + '</p>';
    }
    return html;
  }

  function handleMarkRead() {
    fetch('/api/lessons/' + lesson.id + '/mark-read', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    }).then(function (res) { return res.json(); })
      .then(function (data) {
        completed = true;
        typeSection.classList.add('hidden');
        readSection.classList.add('hidden');
        lessonModeToggle.classList.add('hidden');
        resultSection.classList.remove('hidden');

        resultTitle.textContent = 'Marked as read';
        resultGrid.innerHTML =
          '<div class="stat-card"><span class="stat-card-label">Next lesson</span><span class="stat-card-value">' + (data.nextLessonId ? 'Unlocked' : 'Course complete!') + '</span></div>' +
          (data.saved ? '' : '<div class="stat-card"><span class="stat-card-label">Progress</span><span class="stat-card-value stat-card-value-error">Guest — not saved</span></div>');

        nextLessonBtn.classList.remove('hidden');
        retryLessonBtn.classList.add('hidden');
        if (data.nextLessonId) {
          nextLessonBtn.onclick = function () {
            window.location.href = '/lesson.html?id=' + data.nextLessonId;
          };
        } else {
          nextLessonBtn.textContent = 'Course complete — view courses';
          nextLessonBtn.onclick = function () { window.location.href = '/learning.html'; };
        }
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(function () {
        showError('Could not save your progress. Please try again.');
      });
  }

  // --- Rendering ---
  function renderAllCharacters() {
    if (!engine || !testText) return;
    var html = '';
    for (var i = 0; i < testText.length; i++) {
      html += '<span class="char char-untyped" data-index="' + i + '">' + escapeHtml(testText[i]) + '</span>';
    }
    typingText.innerHTML = html;

    var lines = testText.split('\n');
    var nums = '';
    for (var j = 0; j < lines.length; j++) {
      nums += '<div class="line-number">' + (j + 1) + '</div>';
    }
    lineNumbers.innerHTML = nums;
  }

  function renderCurrentState() {
    if (!engine || !testText) return;
    var chars = typingText.querySelectorAll('.char');
    for (var i = 0; i < chars.length; i++) {
      var el = chars[i];
      if (i < engine.currentIndex) {
        if (engine.charStates[i] === false) el.className = 'char char-incorrect';
        else if (engine.charStates[i] === true) el.className = 'char char-correct';
        else el.className = 'char char-untyped';
      } else if (i === engine.currentIndex) {
        el.className = 'char char-current';
      } else {
        el.className = 'char char-untyped';
      }
    }
    updateCaret();
    lineNumbers.scrollTop = typingContainer.scrollTop || 0;
  }

  function updateCaret() {
    var chars = typingText.querySelectorAll('.char');
    var containerRect = typingContainer.getBoundingClientRect();
    var target = null;
    if (engine.currentIndex < chars.length) {
      target = chars[engine.currentIndex];
    } else if (chars.length > 0) {
      target = chars[chars.length - 1];
    }
    if (target) {
      var rect = target.getBoundingClientRect();
      var isLast = engine.currentIndex >= testText.length;
      caret.style.left = (isLast ? rect.right : rect.left) - containerRect.left + 'px';
      caret.style.top = rect.top - containerRect.top + 'px';
      caret.style.height = rect.height + 'px';
      caret.classList.remove('hidden');
    } else {
      caret.classList.add('hidden');
    }
  }

  // --- Helpers ---
  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();