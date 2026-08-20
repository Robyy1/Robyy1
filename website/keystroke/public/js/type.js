// Keystroke — Type Page Controller
// Orchestrates the typing engine, config bar, live stats, and results panel.

(function () {
  'use strict';

  // --- DOM references ---
  var configForm = document.getElementById('configForm');
  var modeBtns = document.querySelectorAll('.mode-btn');
  var lengthBtns = document.querySelectorAll('.length-btn');
  var codeOptions = document.getElementById('codeOptions');
  var languageSelect = document.getElementById('languageSelect');
  var difficultySelect = document.getElementById('difficultySelect');
  var startBtn = document.getElementById('startBtn');
  var randomBtn = document.getElementById('randomBtn');
  var typingSection = document.getElementById('typingSection');
  var liveStats = document.getElementById('liveStats');
  var editorPane = document.getElementById('editorPane');
  var editorTitle = document.getElementById('editorTitle');
  var lineNumbers = document.getElementById('lineNumbers');
  var typingContainer = document.getElementById('typingContainer');
  var typingText = document.getElementById('typingText');
  var caret = document.getElementById('caret');
  var hiddenInput = document.getElementById('hiddenInput');
  var countdownOverlay = document.getElementById('countdownOverlay');
  var countdownText = document.getElementById('countdownText');
  var resultsSection = document.getElementById('resultsSection');
  var resultsGrid = document.getElementById('resultsGrid');
  var resultsChartContainer = document.getElementById('resultsChartContainer');
  var resultsChart = document.getElementById('resultsChart');
  var restartBtn = document.getElementById('restartBtn');
  var nextTestBtn = document.getElementById('nextTestBtn');
  var errorMessage = document.getElementById('errorMessage');

  // Live stat elements
  var liveWpm = document.getElementById('liveWpm');
  var liveAccuracy = document.getElementById('liveAccuracy');
  var liveTimer = document.getElementById('liveTimer');
  var liveErrors = document.getElementById('liveErrors');

  // --- State ---
  var currentConfig = { mode: 'code', language: 'javascript', difficulty: 'intermediate', length: '60s' };
  var engine = null;
  var testText = '';
  var timerInterval = null;
  var remainingSeconds = 0;
  var isTestRunning = false;

  // --- Init ---
  function init() {
    renderNav();
    loadSavedConfig();
    setupEventListeners();
    setupThemeToggleFloat();
    checkAuthState();
  }

  function renderNav() {
    var navActions = document.getElementById('navActions');
    if (!navActions) return;
    // Check auth state first via auth-client
    if (window.auth && window.auth.isLoggedIn()) {
      navActions.innerHTML = '<a href="/settings.html" class="btn btn-ghost btn-sm">Settings</a>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="logoutBtn">Logout</button>';
      var logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
          window.auth.logout();
        });
      }
    } else {
      navActions.innerHTML = '<a href="/login.html" class="btn btn-ghost btn-sm">Login</a>' +
        '<a href="/signup.html" class="btn btn-accent btn-sm">Sign Up</a>';
    }
  }

  function checkAuthState() {
    if (window.auth) {
      window.auth.checkAuth().then(function () {
        renderNav();
      });
    }
  }

  function loadSavedConfig() {
    var saved = typingEngine.loadConfig();
    currentConfig.mode = saved.mode || 'code';
    currentConfig.language = saved.language || 'javascript';
    currentConfig.difficulty = saved.difficulty || 'intermediate';
    currentConfig.length = saved.length || '60s';

    // Update UI to match loaded config
    updateModeButtons();
    updateLengthButtons();
    languageSelect.value = currentConfig.language;
    difficultySelect.value = currentConfig.difficulty;
    toggleCodeOptions();
  }

  function setupEventListeners() {
    // Mode toggle buttons
    for (var i = 0; i < modeBtns.length; i++) {
      modeBtns[i].addEventListener('click', handleModeChange);
    }

    // Length toggle buttons
    for (var j = 0; j < lengthBtns.length; j++) {
      lengthBtns[j].addEventListener('click', handleLengthChange);
    }

    // Language/difficulty change
    languageSelect.addEventListener('change', function () {
      currentConfig.language = this.value;
      typingEngine.saveConfig(currentConfig);
    });

    difficultySelect.addEventListener('change', function () {
      currentConfig.difficulty = this.value;
      typingEngine.saveConfig(currentConfig);
    });

    // Start test form submission
    configForm.addEventListener('submit', handleStartTest);

    // Random test button
    randomBtn.addEventListener('click', handleRandomTest);

    // Restart and next test buttons
    restartBtn.addEventListener('click', handleRestart);
    nextTestBtn.addEventListener('click', handleNextTest);

    // Hidden input for keystroke capture
    hiddenInput.addEventListener('input', handleTextInput);
    hiddenInput.addEventListener('keydown', handleKeyDown);

    // Prevent paste in hidden input
    hiddenInput.addEventListener('paste', function (e) { e.preventDefault(); });

    // Keep focus on hidden input during test
    document.addEventListener('click', function (e) {
      if (isTestRunning && e.target !== hiddenInput && !e.target.closest('.results-card')) {
        hiddenInput.focus();
      }
    });

    // Handle window resize for editor layout
    window.addEventListener('resize', debounce(function () {
      if (engine) renderCurrentState();
    }, 200));

    // Keyboard shortcut: Escape to restart when idle
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !isTestRunning && engine && engine.state !== typingEngine.STATE.RUNNING) {
        handleRestart();
      }
    });
  }

  // --- Mode selection ---
  function handleModeChange(e) {
    var mode = e.target.dataset.mode;
    if (!mode) return;
    currentConfig.mode = mode;
    typingEngine.saveConfig(currentConfig);
    updateModeButtons();
    toggleCodeOptions();
  }

  function updateModeButtons() {
    for (var i = 0; i < modeBtns.length; i++) {
      var btn = modeBtns[i];
      if (btn.dataset.mode === currentConfig.mode) {
        btn.classList.add('mode-btn-active');
        btn.setAttribute('aria-checked', 'true');
      } else {
        btn.classList.remove('mode-btn-active');
        btn.setAttribute('aria-checked', 'false');
      }
    }
  }

  function toggleCodeOptions() {
    if (currentConfig.mode === 'code') {
      codeOptions.classList.remove('config-fieldset-hidden');
    } else {
      codeOptions.classList.add('config-fieldset-hidden');
    }
  }

  // --- Length selection ---
  function handleLengthChange(e) {
    var length = e.target.dataset.length;
    if (!length) return;
    currentConfig.length = length + 's';
    typingEngine.saveConfig(currentConfig);
    updateLengthButtons();
  }

  function updateLengthButtons() {
    for (var j = 0; j < lengthBtns.length; j++) {
      var btn = lengthBtns[j];
      var val = btn.dataset.length + 's';
      if (val === currentConfig.length) {
        btn.classList.add('length-btn-active');
        btn.setAttribute('aria-checked', 'true');
      } else {
        btn.classList.remove('length-btn-active');
        btn.removeAttribute('aria-checked');
      }
    }
  }

  // --- Start test ---
  function handleStartTest(e) {
    e.preventDefault();
    startTest();
  }

  function handleRandomTest() {
    currentConfig.mode = Math.random() > 0.5 ? 'general' : 'code';
    if (currentConfig.mode === 'code') {
      var langs = ['javascript', 'python', 'java', 'cpp', 'go', 'rust', 'typescript', 'sql'];
      currentConfig.language = langs[Math.floor(Math.random() * langs.length)];
      var diffs = ['beginner', 'intermediate', 'advanced'];
      currentConfig.difficulty = diffs[Math.floor(Math.random() * diffs.length)];
    } else {
      // General mode: random length
      var lengths = ['15s', '30s', '60s', '120s'];
      currentConfig.length = lengths[Math.floor(Math.random() * lengths.length)];
    }
    typingEngine.saveConfig(currentConfig);
    updateModeButtons();
    updateLengthButtons();
    languageSelect.value = currentConfig.language;
    difficultySelect.value = currentConfig.difficulty;
    toggleCodeOptions();
    startTest();
  }

  function startTest() {
    // Reset state
    hideError();
    resultsSection.classList.add('hidden');
    typingSection.classList.remove('hidden');
    liveStats.classList.remove('hidden');

    var config = currentConfig;

    // Fetch test text
    fetchRandomText(config.mode, config.language, config.difficulty, config.length)
      .then(function (data) {
        if (!data || !data.text) throw new Error('No text received');
        testText = data.text;
        initEngine(testText);
        startCountdown();
      })
      .catch(function (err) {
        showError('Failed to load test text. Please try again.');
        console.error(err);
      });
  }

  function fetchRandomText(mode, language, difficulty, length) {
    var params = new URLSearchParams();
    params.set('mode', mode);
    if (mode === 'code') {
      params.set('language', language || '');
      params.set('difficulty', difficulty || '');
    } else {
      // For general mode, map time-based lengths to a medium length for API
      var apiLength = 'medium';
      if (length === '15s' || length === '30s') apiLength = 'short';
      params.set('length', apiLength);
    }
    return fetch('/api/texts/random?' + params.toString())
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load text: ' + res.status);
        return res.json();
      });
  }

  function initEngine(text) {
    // Destroy previous engine if exists
    if (engine && engine.timerInterval) clearInterval(engine.timerInterval);

    var options = {
      targetText: text,
      onStateChange: handleStateChange,
      onUpdate: handleUpdate,
      onFinish: handleFinish,
      renderChar: renderCharacter,
      renderAll: renderAllCharacters
    };

    engine = new typingEngine.TypingEngine(options);
    isTestRunning = false;

    // Initial render
    renderAllCharacters();
  }

  function startCountdown() {
    countdownOverlay.classList.remove('hidden');
    var count = 3;
    countdownText.textContent = count;

    var countInterval = setInterval(function () {
      count--;
      if (count > 0) {
        countdownText.textContent = count;
      } else {
        clearInterval(countInterval);
        countdownOverlay.classList.add('hidden');
        beginTest();
      }
    }, 600);
  }

  function beginTest() {
    isTestRunning = true;
    engine.start();
    hiddenInput.focus();

    // Set remaining time for timed modes
    var lengthVal = parseInt(currentConfig.length, 10);
    if (currentConfig.length !== 'full' && !isNaN(lengthVal)) {
      remainingSeconds = lengthVal;
      startTimer();
    } else {
      liveTimer.textContent = '--';
    }

    editorTitle.textContent = currentConfig.mode === 'code' ?
      (languageSelect.value + ' — ' + difficultySelect.value) : 'typing...';
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    updateTimerDisplay();

    timerInterval = setInterval(function () {
      remainingSeconds--;
      updateTimerDisplay();

      if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        forceFinish();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    liveTimer.textContent = Math.max(0, remainingSeconds) + 's';
  }

  // --- Keystroke handling ---
  function handleTextInput(e) {
    if (!isTestRunning || !engine) return;

    var inputValue = hiddenInput.value;
    if (inputValue.length === 0) return;

    // Get the last character typed
    var ch = inputValue[inputValue.length - 1];

    // Handle special characters
    if (ch === '\n' || ch === '\r') {
      ch = '\n';
    } else if (ch === '\t') {
      // Convert tab to spaces (default 2 spaces)
      ch = '  ';
    }

    engine.handleInput(ch);
    hiddenInput.value = ''; // Clear input for next keystroke

    renderCurrentState();
  }

  function handleKeyDown(e) {
    if (!isTestRunning || !engine) return;

    // Handle backspace separately (input event doesn't fire reliably for it)
    if (e.key === 'Backspace') {
      e.preventDefault();
      var handled = engine.handleInput('\b');
      if (handled) renderCurrentState();
      return;
    }

    // Ignore modifier keys, function keys, etc.
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key.length > 1 && e.key !== 'Enter') return; // modifier or special key

    // Prevent default for most keys during test to avoid browser shortcuts
    if (!e.key.match(/^[a-zA-Z0-9\s!@#$%^&*()_+\-=\[\]{};:'",.<>\/?\\|`~]$/)) {
      e.preventDefault();
      return;
    }

    // For Enter key, convert to newline character
    if (e.key === 'Enter') {
      e.preventDefault();
      engine.handleInput('\n');
      renderCurrentState();
      return;
    }

    // Single printable character
    if (e.key.length === 1) {
      e.preventDefault();
      var handled = engine.handleInput(e.key);
      if (handled) renderCurrentState();
    }
  }

  // --- Rendering ---
  function renderCharacter(ch, state) {
    switch (state) {
      case 'correct':
        return '<span class="char char-correct">' + escapeHtml(ch) + '</span>';
      case 'incorrect':
        return '<span class="char char-incorrect">' + escapeHtml(ch) + '</span>';
      case 'current':
        return '<span class="char char-current">' + escapeHtml(ch) + '</span>';
      default:
        return '<span class="char char-untyped">' + escapeHtml(ch) + '</span>';
    }
  }

  function renderAllCharacters() {
    if (!engine || !testText) return;

    // Build the full HTML for all characters
    var html = '';
    for (var i = 0; i < testText.length; i++) {
      html += '<span class="char char-untyped" data-index="' + i + '">' + escapeHtml(testText[i]) + '</span>';
    }
    typingText.innerHTML = html;

    // Build line numbers
    buildLineNumbers();
  }

  function renderCurrentState() {
    if (!engine || !testText) return;

    var chars = typingText.querySelectorAll('.char');
    for (var i = 0; i < chars.length; i++) {
      var charEl = chars[i];
      if (i < engine.currentIndex) {
        // Use per-position correctness tracked by the engine so wrong chars
        // render as char-incorrect instead of all being green.
        var charState = engine.charStates[i];
        if (charState === false) {
          charEl.className = 'char char-incorrect';
        } else if (charState === true) {
          charEl.className = 'char char-correct';
        } else {
          charEl.className = 'char char-untyped';
        }
      } else if (i === engine.currentIndex) {
        charEl.className = 'char char-current';
      } else {
        charEl.className = 'char char-untyped';
      }
    }

    // Update caret position
    updateCaretPosition();

    // Update line numbers scroll
    updateLineNumbersScroll();
  }

  function buildLineNumbers() {
    var lines = testText.split('\n');
    var html = '';
    for (var i = 0; i < lines.length; i++) {
      html += '<div class="line-number">' + (i + 1) + '</div>';
    }
    lineNumbers.innerHTML = html;
  }

  function updateCaretPosition() {
    if (!engine || !typingText) return;

    var chars = typingText.querySelectorAll('.char');
    var currentCharEl = null;

    for (var i = 0; i < chars.length; i++) {
      if (i === engine.currentIndex) {
        currentCharEl = chars[i];
        break;
      }
    }

    if (currentCharEl) {
      var rect = currentCharEl.getBoundingClientRect();
      var containerRect = typingContainer.getBoundingClientRect();
      caret.style.left = (rect.left - containerRect.left) + 'px';
      caret.style.top = (rect.top - containerRect.top) + 'px';
      caret.style.height = rect.height + 'px';
      caret.classList.remove('hidden');
    } else if (engine.currentIndex >= testText.length) {
      // Caret at end of text
      var lastChar = chars[chars.length - 1];
      if (lastChar) {
        var rect = lastChar.getBoundingClientRect();
        var containerRect = typingContainer.getBoundingClientRect();
        caret.style.left = (rect.right - containerRect.left) + 'px';
        caret.style.top = (rect.top - containerRect.top) + 'px';
        caret.style.height = rect.height + 'px';
      }
    } else {
      caret.classList.add('hidden');
    }
  }

  function updateLineNumbersScroll() {
    if (!lineNumbers || !typingContainer) return;
    lineNumbers.scrollTop = typingContainer.scrollTop || 0;
  }

  // --- State change handler ---
  function handleStateChange(state) {
    switch (state) {
      case 'running':
        liveStats.classList.remove('hidden');
        countdownOverlay.classList.add('hidden');
        break;
      case 'finished':
        isTestRunning = false;
        if (timerInterval) clearInterval(timerInterval);
        hiddenInput.blur();
        break;
    }
  }

  // --- Live update handler ---
  function handleUpdate(data) {
    liveWpm.textContent = data.wpm || 0;
    liveAccuracy.textContent = (data.accuracy || 0).toFixed(1);
    liveErrors.textContent = data.errors || 0;

    // Color coding for accuracy
    if (data.accuracy < 80) {
      liveAccuracy.style.color = 'var(--error)';
    } else if (data.accuracy < 95) {
      liveAccuracy.style.color = 'var(--text-muted)';
    } else {
      liveAccuracy.style.color = 'var(--success)';
    }
  }

  // --- Finish handler ---
  function handleFinish(metrics) {
    isTestRunning = false;
    if (timerInterval) clearInterval(timerInterval);
    hiddenInput.blur();

    // Show results panel
    showResults(metrics);

    // Save result if logged in
    saveResult(metrics);
  }

  function forceFinish() {
    if (!engine || engine.state === typingEngine.STATE.FINISHED) return;

    // Calculate metrics for partial completion
    var elapsedMs = Date.now() - engine.startTime;
    var metrics = typingEngine.calculateMetrics(
      engine.correctChars,
      engine.totalTyped,
      engine.errorCount,
      engine.keystrokes,
      elapsedMs
    );
    engine.metrics = metrics;

    showResults(metrics);
    saveResult(metrics);
  }

  function showResults(metrics) {
    typingSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');

    // Render stat cards
    var statsHtml = '';
    var statItems = [
      { label: 'WPM', value: metrics.wpm || 0, color: 'accent' },
      { label: 'Raw WPM', value: metrics.rawWpm || 0, color: '' },
      { label: 'Accuracy', value: (metrics.accuracy || 0).toFixed(1) + '%', color: (metrics.accuracy || 0) >= 95 ? '' : ((metrics.accuracy || 0) < 80 ? 'error' : '') },
      { label: 'Consistency', value: (metrics.consistency || 0).toFixed(1) + '%', color: (metrics.consistency || 0) >= 80 ? '' : 'error' },
      { label: 'Errors', value: metrics.errorCount || 0, color: 'error' },
      { label: 'Duration', value: formatDuration((Date.now() - (engine && engine.startTime ? engine.startTime : Date.now()))), color: '' }
    ];

    for (var i = 0; i < statItems.length; i++) {
      var item = statItems[i];
      statsHtml += '<div class="stat-card">';
      statsHtml += '<span class="stat-card-label">' + item.label + '</span>';
      if (item.color) {
        statsHtml += '<span class="stat-card-value stat-card-value-' + item.color + '">' + item.value + '</span>';
      } else {
        statsHtml += '<span class="stat-card-value">' + item.value + '</span>';
      }
      statsHtml += '</div>';
    }

    resultsGrid.innerHTML = statsHtml;

    // Show chart if we have enough data points
    if (engine && engine.wpmHistory && engine.wpmHistory.length > 2) {
      resultsChartContainer.classList.remove('hidden');
      renderResultsChart();
    } else {
      resultsChartContainer.classList.add('hidden');
    }

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function formatDuration(ms) {
    if (ms <= 0) return '0s';
    var seconds = Math.floor(ms / 1000);
    if (seconds < 60) return seconds + 's';
    var minutes = Math.floor(seconds / 60);
    var secs = seconds % 60;
    return minutes + 'm ' + secs + 's';
  }

  function renderResultsChart() {
    if (!engine || !engine.wpmHistory || engine.wpmHistory.length < 2) return;

    resultsChart.innerHTML = '';

    var dataPoints = [];
    for (var i = 0; i < engine.wpmHistory.length; i++) {
      // Convert chars/sec to WPM approximation (* 12 as average word length)
      dataPoints.push({ wpm: Math.round(engine.wpmHistory[i] * 12), x: i, y: i });
    }

    var width = resultsChart.clientWidth || 600;
    var height = 200;
    var padding = { top: 20, right: 20, bottom: 30, left: 50 };
    var chartW = width - padding.left - padding.right;
    var chartH = height - padding.top - padding.bottom;

    // Find max WPM for scaling
    var maxWpm = 0;
    for (var j = 0; j < dataPoints.length; j++) {
      if (dataPoints[j].wpm > maxWpm) maxWpm = dataPoints[j].wpm;
    }
    maxWpm = Math.max(maxWpm, 1);

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.style.width = '100%';
    svg.style.height = 'auto';

    // Grid lines and Y-axis labels
    for (var g = 0; g <= 4; g++) {
      var yVal = (maxWpm / 4) * g;
      var yPos = padding.top + chartH - (g / 4) * chartH;

      var gridLine = document.createElementNS(svgNS, 'line');
      gridLine.setAttribute('x1', padding.left);
      gridLine.setAttribute('y1', yPos);
      gridLine.setAttribute('x2', width - padding.right);
      gridLine.setAttribute('y2', yPos);
      gridLine.setAttribute('stroke', 'var(--border)');
      gridLine.setAttribute('stroke-width', '0.5');
      svg.appendChild(gridLine);

      var label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', padding.left - 8);
      label.setAttribute('y', yPos + 4);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('fill', 'var(--text-muted)');
      label.setAttribute('font-size', '11');
      label.setAttribute('font-family', 'monospace');
      label.textContent = Math.round(yVal);
      svg.appendChild(label);
    }

    // Draw line path
    var pathD = '';
    for (var p = 0; p < dataPoints.length; p++) {
      var px = padding.left + (p / (dataPoints.length - 1 || 1)) * chartW;
      var py = padding.top + chartH - (dataPoints[p].wpm / maxWpm) * chartH;

      if (p === 0) {
        pathD += 'M ' + px + ' ' + py;
      } else {
        pathD += ' L ' + px + ' ' + py;
      }
    }

    var path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#F2C14E');
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('stroke-linecap', 'round');
    svg.appendChild(path);

    // Draw dots at each point
    for (var d = 0; d < dataPoints.length; d++) {
      var dotX = padding.left + (d / (dataPoints.length - 1 || 1)) * chartW;
      var dotY = padding.top + chartH - (dataPoints[d].wpm / maxWpm) * chartH;

      var circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', dotX);
      circle.setAttribute('cy', dotY);
      circle.setAttribute('r', '3');
      circle.setAttribute('fill', '#F2C14E');
      svg.appendChild(circle);
    }

    resultsChart.appendChild(svg);
  }

  function saveResult(metrics) {
    if (!window.auth || !window.auth.isLoggedIn()) return;

    var lengthVal = parseInt(currentConfig.length, 10);
    var durationSeconds = engine ? (Date.now() - engine.startTime) / 1000 : (lengthVal || 60);

    var body = {
      mode: currentConfig.mode,
      wpm: metrics.wpm || 0,
      rawWpm: metrics.rawWpm || 0,
      accuracy: metrics.accuracy || 0,
      consistency: metrics.consistency || 0,
      errorCount: metrics.errorCount || 0,
      durationSeconds: durationSeconds,
      charCount: testText ? testText.length : 0
    };

    if (currentConfig.mode === 'code') {
      body.language = currentConfig.language;
      body.difficulty = currentConfig.difficulty;
    } else {
      // Map length to a general difficulty label
      if (lengthVal <= 30) body.difficulty = 'beginner';
      else if (lengthVal <= 60) body.difficulty = 'intermediate';
      else body.difficulty = 'advanced';
    }

    fetch('/api/results', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }).catch(function (err) {
      console.error('Failed to save result:', err);
    });
  }

  // --- Restart / Next test ---
  function handleRestart() {
    resultsSection.classList.add('hidden');
    typingSection.classList.remove('hidden');
    liveStats.classList.remove('hidden');

    if (engine) {
      engine.reset();
    }

    renderAllCharacters();
    hiddenInput.value = '';
    hiddenInput.focus();

    // Reset live stats
    liveWpm.textContent = '0';
    liveAccuracy.textContent = '100.0';
    liveErrors.textContent = '0';
    liveTimer.style.color = '';

    var lengthVal = parseInt(currentConfig.length, 10);
    if (currentConfig.length !== 'full' && !isNaN(lengthVal)) {
      remainingSeconds = lengthVal;
      updateTimerDisplay();
    } else {
      liveTimer.textContent = '--';
    }

    startCountdown();
  }

  function handleNextTest() {
    resultsSection.classList.add('hidden');
    typingSection.classList.remove('hidden');
    // Start a new random test
    handleRandomTest();
  }

  // --- Error display ---
  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
  }

  function hideError() {
    errorMessage.classList.add('hidden');
    errorMessage.textContent = '';
  }

  // --- Theme toggle (floating button) ---
  function setupThemeToggleFloat() {
    var themeToggleFloat = document.getElementById('themeToggleFloat');
    if (!themeToggleFloat) return;

    themeToggleFloat.addEventListener('click', function () {
      if (window.themeManager) {
        window.theme.toggleTheme();
      }
    });
  }

  // --- Utility: debounce ---
  function debounce(fn, delay) {
    var timer = null;
    return function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(this, arguments); }.bind(this), delay);
    };
  }

  // --- Utility: escape HTML ---
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // --- Expose to global for inline handlers ---
  window.typePage = {
    init: init,
    startTest: startTest,
    handleRestart: handleRestart
  };

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
