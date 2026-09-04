// Keystroke — Type Page Controller
// Orchestrates the typing engine, config bar, live stats, and results panel.

(function () {
  "use strict";

  // --- DOM references ---
  var configForm = document.getElementById("configForm");
  var modeBtns = document.querySelectorAll("[data-mode]");
  var codeOptions = document.getElementById("codeOptions");
  var languageSelect = document.getElementById("languageSelect");
  var difficultySelect = document.getElementById("difficultySelect");
  var durationInput = document.getElementById("durationInput");
  var durationMinus = document.getElementById("durationMinus");
  var durationPlus = document.getElementById("durationPlus");
  var noLimitToggle = document.getElementById("noLimitToggle");
  var startBtn = document.getElementById("startBtn");
  var randomBtn = document.getElementById("randomBtn");
  var typingSection = document.getElementById("typingSection");
  var liveStats = document.getElementById("liveStats");
  var editorPane = document.getElementById("editorPane");
  var editorTitle = document.getElementById("editorTitle");
  var lineNumbers = document.getElementById("lineNumbers");
  var typingContainer = document.getElementById("typingContainer");
  var typingText = document.getElementById("typingText");
  var caret = document.getElementById("caret");
  var hiddenInput = document.getElementById("hiddenInput");
  var countdownOverlay = document.getElementById("countdownOverlay");
  var countdownText = document.getElementById("countdownText");
  var resultsSection = document.getElementById("resultsSection");
  var resultsWpm = document.getElementById("resultsWpm");
  var resultsAccuracy = document.getElementById("resultsAccuracy");
  var resultsStats = document.getElementById("resultsStats");
  var resultsChart = document.getElementById("resultsChart");
  var restartBtn = document.getElementById("restartBtn");
  var nextTestBtn = document.getElementById("nextTestBtn");
  var errorMessage = document.getElementById("errorMessage");
  var playbackSection = document.getElementById("playbackSection");
  var playbackBtn = document.getElementById("playbackBtn");
  var playbackContainer = document.getElementById("playbackContainer");
  var playbackPlayPause = document.getElementById("playbackPlayPause");
  var playbackProgress = document.getElementById("playbackProgress");
  var playbackTime = document.getElementById("playbackTime");
  var playbackText = document.getElementById("playbackText");
  var playbackLineNumbers = document.getElementById("playbackLineNumbers");

  // Live stat elements
  var liveWpm = document.getElementById("liveWpm");
  var liveAccuracy = document.getElementById("liveAccuracy");
  var liveTimer = document.getElementById("liveTimer");
  var liveErrors = document.getElementById("liveErrors");

  // --- State ---
  var currentConfig = {
    mode: "code",
    language: "javascript",
    difficulty: "intermediate",
    length: "60s",
    customSeconds: 60,
    noLimit: false,
    indentWidthPref: 2,
  };
  var engine = null;
  var testText = "";
  var timerInterval = null;
  var remainingSeconds = 0;
  var isTestRunning = false;

  // --- Playback state (real-time replay) ---
  var playbackEvents = null;
  var playbackDuration = 0;
  var playbackCurrentTime = 0;
  var playbackPlaying = false;
  var playbackRAF = null;
  var playbackLastTick = 0;
  var playbackControlsBound = false;
  var resultsChartInstance = null;

  // --- Init ---
  function init() {
    renderNav();
    loadSavedConfig();
    setupEventListeners();
    setupThemeToggleFloat();
    checkAuthState();
    updateIndicators();
    window.addEventListener("load", updateIndicators);
    window.addEventListener("resize", debounce(updateIndicators, 150));
  }

  function renderNav() {
    var navActions = document.getElementById("navActions");
    if (!navActions) return;
    // Check auth state first via auth-client
    if (window.auth && window.auth.isLoggedIn()) {
      navActions.innerHTML =
        '<a href="/settings.html" class="btn btn-ghost btn-sm">Settings</a>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="logoutBtn">Logout</button>';
      var logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
          window.auth.logout();
        });
      }
    } else {
      navActions.innerHTML =
        '<a href="/login.html" class="btn btn-ghost btn-sm">Login</a>' +
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
    currentConfig.mode = saved.mode || "code";
    currentConfig.language = saved.language || "javascript";
    currentConfig.difficulty = saved.difficulty || "intermediate";
    currentConfig.noLimit = Boolean(saved.noLimit);
    currentConfig.customSeconds = clampDuration(
      saved.customSeconds || saved.length || 60,
    );
    currentConfig.length = currentConfig.noLimit
      ? "full"
      : currentConfig.customSeconds + "s";
    currentConfig.indentWidthPref = saved.indentWidthPref || 2;

    updateModeButtons();
    syncDurationControls();
    if (isTimedLength(currentConfig.length)) {
      remainingSeconds = parseInt(currentConfig.length, 10) || 60;
      updateTimerDisplay();
    } else {
      liveTimer.textContent = "--";
    }
    languageSelect.value = currentConfig.language;
    difficultySelect.value = currentConfig.difficulty;
    toggleCodeOptions();
  }

  function setupEventListeners() {
    // Mode toggle buttons
    for (var i = 0; i < modeBtns.length; i++) {
      modeBtns[i].addEventListener("click", handleModeChange);
    }

    // Duration controls
    if (durationMinus) {
      durationMinus.addEventListener("click", function () {
        changeDuration(-5);
      });
    }
    if (durationPlus) {
      durationPlus.addEventListener("click", function () {
        changeDuration(5);
      });
    }
    if (noLimitToggle) {
      noLimitToggle.addEventListener("click", toggleNoLimit);
    }
    if (durationInput) {
      durationInput.addEventListener("input", handleDurationInput);
      durationInput.addEventListener("change", handleDurationInput);
    }

    // Language/difficulty change
    languageSelect.addEventListener("change", function () {
      currentConfig.language = this.value;
      typingEngine.saveConfig(currentConfig);
    });

    difficultySelect.addEventListener("change", function () {
      currentConfig.difficulty = this.value;
      typingEngine.saveConfig(currentConfig);
    });

    // Start test form submission
    configForm.addEventListener("submit", handleStartTest);

    // Random test button
    randomBtn.addEventListener("click", handleRandomTest);

    // Restart and next test buttons
    restartBtn.addEventListener("click", handleRestart);
    nextTestBtn.addEventListener("click", handleNextTest);

    // Hidden input for keystroke capture
    hiddenInput.addEventListener("input", handleTextInput);
    hiddenInput.addEventListener("keydown", handleKeyDown);

    // Prevent paste in hidden input
    hiddenInput.addEventListener("paste", function (e) {
      e.preventDefault();
    });

    // Keep focus on hidden input during test
    document.addEventListener("click", function (e) {
      if (
        isTestRunning &&
        e.target !== hiddenInput &&
        !e.target.closest(".results-card")
      ) {
        hiddenInput.focus();
      }
    });

    // Handle window resize for editor layout
    window.addEventListener(
      "resize",
      debounce(function () {
        if (engine) renderCurrentState();
      }, 200),
    );

    // Keyboard shortcut: Escape to restart when idle
    document.addEventListener("keydown", function (e) {
      if (
        e.key === "Escape" &&
        !isTestRunning &&
        engine &&
        engine.state !== typingEngine.STATE.RUNNING
      ) {
        handleRestart();
      }
    });
  }

  // --- Sliding segmented indicator ---
  function positionIndicator(toggle, indicator) {
    if (!toggle || !indicator) return;
    var active = toggle.querySelector(".mode-btn-active, .length-btn-active");
    if (!active) return;
    indicator.style.left = active.offsetLeft - toggle.clientLeft + "px";
    indicator.style.width = active.offsetWidth + "px";
  }

  function updateIndicators() {
    positionIndicator(
      document.getElementById("modeToggle"),
      document.getElementById("modeIndicator"),
    );
  }

  // --- Mode selection ---
  function handleModeChange(e) {
    var mode = e.target.dataset.mode;
    if (!mode) return;
    currentConfig.mode = mode;
    typingEngine.saveConfig(currentConfig);
    updateModeButtons();
    toggleCodeOptions();
    updateIndicators();
  }

  function updateModeButtons() {
    for (var i = 0; i < modeBtns.length; i++) {
      var btn = modeBtns[i];
      if (btn.dataset.mode === currentConfig.mode) {
        btn.classList.add("is-active");
        btn.setAttribute("aria-checked", "true");
      } else {
        btn.classList.remove("is-active");
        btn.setAttribute("aria-checked", "false");
      }
    }
  }

  function toggleCodeOptions() {
    if (currentConfig.mode === "code") {
      codeOptions.classList.remove("config-group-hidden");
    } else {
      codeOptions.classList.add("config-group-hidden");
    }
  }

  // --- Duration controls ---
  function clampDuration(value) {
    var parsed = parseInt(value, 10);
    if (isNaN(parsed)) return 60;
    var clamped = Math.max(5, Math.min(600, parsed));
    return Math.round(clamped / 5) * 5;
  }

  function normalizeLength(raw) {
    var trimmed = String(raw || "").replace(/s$/, "");
    if (trimmed === "full" || trimmed === "none" || trimmed === "")
      return "full";
    var num = parseInt(trimmed, 10);
    return isNaN(num) ? "full" : num + "s";
  }

  function isTimedLength(length) {
    return !!length && length !== "full";
  }

  function syncDurationControls() {
    if (!durationInput) return;
    durationInput.value = currentConfig.noLimit
      ? 60
      : currentConfig.customSeconds;
    durationInput.disabled = currentConfig.noLimit;
    durationInput.setAttribute("aria-disabled", String(currentConfig.noLimit));
    if (noLimitToggle) {
      noLimitToggle.classList.toggle("is-active", currentConfig.noLimit);
      noLimitToggle.setAttribute("aria-pressed", String(currentConfig.noLimit));
      noLimitToggle.textContent = currentConfig.noLimit
        ? "No limit on"
        : "No limit";
    }
  }

  function changeDuration(delta) {
    var target = currentConfig.noLimit ? 60 : currentConfig.customSeconds;
    currentConfig.customSeconds = clampDuration(target + delta);
    currentConfig.noLimit = false;
    currentConfig.length = currentConfig.customSeconds + "s";
    typingEngine.saveConfig(currentConfig);
    syncDurationControls();
    remainingSeconds = currentConfig.customSeconds;
    updateTimerDisplay();
  }

  function toggleNoLimit() {
    currentConfig.noLimit = !currentConfig.noLimit;
    if (currentConfig.noLimit) {
      currentConfig.length = "full";
    } else {
      currentConfig.customSeconds = clampDuration(
        currentConfig.customSeconds || 60,
      );
      currentConfig.length = currentConfig.customSeconds + "s";
    }
    typingEngine.saveConfig(currentConfig);
    syncDurationControls();
    if (!currentConfig.noLimit) {
      remainingSeconds = currentConfig.customSeconds;
      updateTimerDisplay();
    } else {
      liveTimer.textContent = "∞";
    }
  }

  function handleDurationInput() {
    if (!durationInput) return;
    var parsed = clampDuration(durationInput.value);
    currentConfig.customSeconds = parsed;
    currentConfig.noLimit = false;
    currentConfig.length = currentConfig.customSeconds + "s";
    typingEngine.saveConfig(currentConfig);
    syncDurationControls();
    remainingSeconds = currentConfig.customSeconds;
    updateTimerDisplay();
  }

  // --- Start test ---
  function handleStartTest(e) {
    e.preventDefault();
    startTest();
  }

  function handleRandomTest() {
    currentConfig.mode = Math.random() > 0.5 ? "general" : "code";
    if (currentConfig.mode === "code") {
      var langs = [
        "javascript",
        "python",
        "java",
        "cpp",
        "go",
        "rust",
        "typescript",
        "sql",
      ];
      currentConfig.language = langs[Math.floor(Math.random() * langs.length)];
      var diffs = ["beginner", "intermediate", "advanced"];
      currentConfig.difficulty =
        diffs[Math.floor(Math.random() * diffs.length)];
    }

    currentConfig.noLimit = Math.random() > 0.5;
    if (currentConfig.noLimit) {
      currentConfig.length = "full";
    } else {
      var custom = [20, 30, 45, 60, 90, 120, 180][
        Math.floor(Math.random() * 7)
      ];
      currentConfig.customSeconds = custom;
      currentConfig.length = custom + "s";
    }
    typingEngine.saveConfig(currentConfig);
    updateModeButtons();
    syncDurationControls();
    languageSelect.value = currentConfig.language;
    difficultySelect.value = currentConfig.difficulty;
    toggleCodeOptions();
    updateIndicators();
    startTest();
  }

  function startTest() {
    // Reset state
    pausePlayback();
    hideError();
    resultsSection.classList.add("hidden");
    typingSection.classList.remove("hidden");
    liveStats.classList.remove("hidden");

    var config = currentConfig;

    // Fetch test text
    fetchRandomText(
      config.mode,
      config.language,
      config.difficulty,
      config.length,
    )
      .then(function (data) {
        if (!data || !data.text) throw new Error("No text received");
        testText = data.text;
        initEngine(testText);
        startCountdown();
      })
      .catch(function (err) {
        showError("Failed to load test text. Please try again.");
        console.error(err);
      });
  }

  function fetchRandomText(mode, language, difficulty, length) {
    var params = new URLSearchParams();
    params.set("mode", mode);
    if (mode === "code") {
      params.set("language", language || "");
      params.set("difficulty", difficulty || "");
    } else if (mode === "dictionary") {
      params.set("length", "medium");
    } else {
      params.set("length", "medium");
    }
    return fetch("/api/texts/random?" + params.toString()).then(function (res) {
      if (!res.ok) throw new Error("Failed to load text: " + res.status);
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
      renderAll: renderAllCharacters,
    };

    engine = new typingEngine.TypingEngine(options);
    isTestRunning = false;

    // Initial render
    renderAllCharacters();
  }

  function startCountdown() {
    countdownOverlay.classList.remove("hidden");
    var count = 3;
    countdownText.textContent = count;

    var countInterval = setInterval(function () {
      count--;
      if (count > 0) {
        countdownText.textContent = count;
      } else {
        clearInterval(countInterval);
        countdownOverlay.classList.add("hidden");
        beginTest();
      }
    }, 600);
  }

  function beginTest() {
    isTestRunning = true;
    engine.start();
    hiddenInput.focus();

    // Set remaining time for timed modes; no-limit mode counts up instead.
    if (!currentConfig.noLimit && isTimedLength(currentConfig.length)) {
      remainingSeconds =
        currentConfig.customSeconds || parseInt(currentConfig.length, 10) || 60;
      startTimer();
    } else {
      liveTimer.textContent = "0s";
      startElapsedTimer();
    }

    editorTitle.textContent =
      currentConfig.mode === "code"
        ? languageSelect.value + " — " + difficultySelect.value
        : currentConfig.mode === "dictionary"
          ? "Dictionary"
          : "General Text";
  }

  // No-limit mode: show elapsed time counting up from zero.
  function startElapsedTimer() {
    if (timerInterval) clearInterval(timerInterval);
    var startedAt = engine.startTime || Date.now();
    timerInterval = setInterval(function () {
      if (!engine || engine.state === typingEngine.STATE.FINISHED) {
        clearInterval(timerInterval);
        return;
      }
      var elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      liveTimer.textContent = elapsed + "s";
    }, 500);
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
    liveTimer.textContent = Math.max(0, remainingSeconds) + "s";
  }

  // --- Keystroke handling ---
  function handleTextInput(e) {
    if (!isTestRunning || !engine) return;

    var inputValue = hiddenInput.value;
    if (inputValue.length === 0) return;

    // Get the last character typed
    var ch = inputValue[inputValue.length - 1];

    // Handle special characters
    if (ch === "\n" || ch === "\r") {
      ch = "\n";
    } else if (ch === "\t") {
      // Convert tab to configured indent width spaces, feeding each one.
      var indent = new Array((currentConfig.indentWidthPref || 2) + 1).join(
        " ",
      );
      for (var ti = 0; ti < indent.length; ti++) {
        engine.handleInput(indent[ti]);
      }
      hiddenInput.value = "";
      renderCurrentState();
      return;
    }

    engine.handleInput(ch);
    hiddenInput.value = ""; // Clear input for next keystroke

    renderCurrentState();
  }

  function handleKeyDown(e) {
    if (!isTestRunning || !engine) return;

    // Handle backspace separately (input event doesn't fire reliably for it)
    if (e.key === "Backspace") {
      e.preventDefault();
      var handled = engine.handleInput("\b");
      if (handled) renderCurrentState();
      return;
    }

    // Ignore modifier keys, function keys, etc.
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    // Handle Enter first — it must not be swallowed by the printable-char
    // guard below (which only matches single-char keys).
    if (e.key === "Enter") {
      e.preventDefault();
      engine.handleInput("\n");
      renderCurrentState();
      return;
    }

    // Tab expands to the configured indent width so code indentation can be
    // typed naturally. Feed each space through the engine individually.
    if (e.key === "Tab") {
      e.preventDefault();
      var indent = currentConfig.indentWidthPref || 2;
      for (var t = 0; t < indent; t++) {
        engine.handleInput(" ");
      }
      renderCurrentState();
      return;
    }

    if (e.key.length > 1) return; // modifier or special key

    // Allow standard letters, numbers, spaces, and common punctuation used in
    // code and prose, including hyphens and apostrophes. Some browsers emit the
    // Unicode dash form (–, —), so accept those too.
    if (
      !/^[A-Za-z0-9\s!@#$%^&*()_+\-=\[\]{};:'",.<>\/?\\|`~–—’]$/.test(e.key)
    ) {
      e.preventDefault();
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
      case "correct":
        return '<span class="char char-correct">' + escapeHtml(ch) + "</span>";
      case "incorrect":
        return (
          '<span class="char char-incorrect">' + escapeHtml(ch) + "</span>"
        );
      case "current":
        return '<span class="char char-current">' + escapeHtml(ch) + "</span>";
      default:
        return '<span class="char char-untyped">' + escapeHtml(ch) + "</span>";
    }
  }

  function renderAllCharacters() {
    if (!engine || !testText) return;

    // Build the full HTML for all characters
    var html = "";
    for (var i = 0; i < testText.length; i++) {
      html +=
        '<span class="char char-untyped" data-index="' +
        i +
        '">' +
        escapeHtml(testText[i]) +
        "</span>";
    }
    typingText.innerHTML = html;

    // Build line numbers
    buildLineNumbers();
  }

  function renderCurrentState() {
    if (!engine || !testText) return;

    var chars = typingText.querySelectorAll(".char");
    for (var i = 0; i < chars.length; i++) {
      var charEl = chars[i];
      if (i < engine.currentIndex) {
        // Use per-position correctness tracked by the engine so wrong chars
        // render as char-incorrect instead of all being green.
        var charState = engine.charStates[i];
        if (charState === false) {
          charEl.className = "char char-incorrect";
        } else if (charState === true) {
          charEl.className = "char char-correct";
        } else {
          charEl.className = "char char-untyped";
        }
      } else if (i === engine.currentIndex) {
        charEl.className = "char char-current";
      } else {
        charEl.className = "char char-untyped";
      }
    }

    // Update caret position
    updateCaretPosition();

    // Update line numbers scroll
    updateLineNumbersScroll();
  }

  function buildLineNumbers() {
    var lines = testText.split("\n");
    var html = "";
    for (var i = 0; i < lines.length; i++) {
      html += '<div class="line-number">' + (i + 1) + "</div>";
    }
    lineNumbers.innerHTML = html;
  }

  function updateCaretPosition() {
    if (!engine || !typingText) return;

    var chars = typingText.querySelectorAll(".char");
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
      caret.style.left = rect.left - containerRect.left + "px";
      caret.style.top = rect.top - containerRect.top + "px";
      caret.style.height = rect.height + "px";
      caret.classList.remove("hidden");
    } else if (engine.currentIndex >= testText.length) {
      // Caret at end of text
      var lastChar = chars[chars.length - 1];
      if (lastChar) {
        var rect = lastChar.getBoundingClientRect();
        var containerRect = typingContainer.getBoundingClientRect();
        caret.style.left = rect.right - containerRect.left + "px";
        caret.style.top = rect.top - containerRect.top + "px";
        caret.style.height = rect.height + "px";
      }
    } else {
      caret.classList.add("hidden");
    }
  }

  function updateLineNumbersScroll() {
    if (!lineNumbers || !typingContainer) return;
    lineNumbers.scrollTop = typingContainer.scrollTop || 0;
  }

  // --- State change handler ---
  function handleStateChange(state) {
    switch (state) {
      case "running":
        liveStats.classList.remove("hidden");
        countdownOverlay.classList.add("hidden");
        break;
      case "finished":
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
      liveAccuracy.style.color = "var(--error)";
    } else if (data.accuracy < 95) {
      liveAccuracy.style.color = "var(--text-muted)";
    } else {
      liveAccuracy.style.color = "var(--success)";
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

    // Stop the engine's internal live-update timer so stats freeze on the results.
    if (engine.timerInterval) {
      clearInterval(engine.timerInterval);
      engine.timerInterval = null;
    }
    engine.state = typingEngine.STATE.FINISHED;

    // Calculate metrics for partial completion
    var elapsedMs = Date.now() - engine.startTime;
    engine.elapsedMs = elapsedMs;
    var metrics = typingEngine.calculateMetrics(
      engine.correctChars,
      engine.totalTyped,
      engine.errorCount,
      engine.keystrokes,
      engine.startTime,
      elapsedMs,
    );
    engine.metrics = metrics;

    showResults(metrics);
    saveResult(metrics);
  }

  function showResults(metrics) {
    typingSection.classList.add("hidden");
    resultsSection.classList.remove("hidden");

    // Update headline WPM and accuracy
    resultsWpm.textContent = metrics.wpm || 0;
    resultsAccuracy.textContent = (metrics.accuracy || 0).toFixed(1) + "%";

    // Update detailed stats
    var statValues = {
      resultsRawWpm: metrics.rawWpm || 0,
      resultsChars: testText ? testText.length : 0,
      resultsErrors: metrics.errorCount || 0,
      resultsTime: formatDuration(
        engine && engine.startTime ? Date.now() - engine.startTime : 0,
      ),
      resultsConsistency: (metrics.consistency || 0).toFixed(1) + "%",
    };

    for (var id in statValues) {
      var el = document.getElementById(id);
      if (el) el.textContent = statValues[id];
    }

    // Show chart if we have enough data points
    if (engine && engine.wpmHistory && engine.wpmHistory.length > 2) {
      resultsChart.classList.remove("hidden");
      renderResultsChart();
    } else {
      resultsChart.classList.add("hidden");
    }

    // Show playback section
    if (engine && engine.keystrokes && engine.keystrokes.length > 0) {
      playbackSection.classList.remove("hidden");
      initPlayback();
    }

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function formatDuration(ms) {
    if (ms <= 0) return "0s";
    var seconds = Math.floor(ms / 1000);
    if (seconds < 60) return seconds + "s";
    var minutes = Math.floor(seconds / 60);
    var secs = seconds % 60;
    return minutes + "m " + secs + "s";
  }

  function renderResultsChart() {
    if (!engine || !engine.wpmHistory || engine.wpmHistory.length < 2) return;

    resultsChart.innerHTML = "";

    // wpmHistory holds chars-per-second buckets; * 12 converts to WPM (60/5).
    var dataPoints = [];
    for (var i = 0; i < engine.wpmHistory.length; i++) {
      dataPoints.push({ x: i + 1, wpm: Math.round(engine.wpmHistory[i] * 12) });
    }

    if (dataPoints.length < 2) return;

    if (window.stats && typeof window.stats.createLineChart === "function") {
      resultsChartInstance = window.stats.createLineChart(resultsChart, dataPoints, {
        lineColor: "var(--accent)",
        height: 220,
        dotRadius: "3",
        title: "WPM Over Time",
      });
      if (resultsChartInstance && resultsChartInstance.hideScrubber) resultsChartInstance.hideScrubber();
    }
  }

  function saveResult(metrics) {
    if (!window.auth || !window.auth.isLoggedIn()) return;

    var lengthVal = parseInt(currentConfig.length, 10);
    var durationSeconds = engine
      ? (Date.now() - engine.startTime) / 1000
      : currentConfig.noLimit
        ? 0
        : currentConfig.customSeconds || lengthVal || 60;

    var body = {
      mode: currentConfig.mode,
      wpm: metrics.wpm || 0,
      rawWpm: metrics.rawWpm || 0,
      accuracy: metrics.accuracy || 0,
      consistency: metrics.consistency || 0,
      errorCount: metrics.errorCount || 0,
      durationSeconds: durationSeconds,
      charCount: testText ? testText.length : 0,
    };

    if (currentConfig.mode === "code") {
      body.language = currentConfig.language;
      body.difficulty = currentConfig.difficulty;
    } else {
      // Map length to a general difficulty label
      if (!isTimedLength(currentConfig.length)) {
        body.difficulty = "intermediate";
      } else if (lengthVal <= 30) body.difficulty = "beginner";
      else if (lengthVal <= 60) body.difficulty = "intermediate";
      else body.difficulty = "advanced";
    }
    fetch("/api/results", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }).catch(function (err) {
      console.error("Failed to save result:", err);
    });
  }

  // --- Restart / Next test ---
  function handleRestart() {
    pausePlayback();
    if (resultsChartInstance && resultsChartInstance.hideScrubber) resultsChartInstance.hideScrubber();
    resultsSection.classList.add("hidden");
    typingSection.classList.remove("hidden");
    liveStats.classList.remove("hidden");

    if (engine) {
      engine.reset();
    }

    renderAllCharacters();
    hiddenInput.value = "";
    hiddenInput.focus();

    // Reset live stats
    liveWpm.textContent = "0";
    liveAccuracy.textContent = "100.0";
    liveErrors.textContent = "0";
    liveTimer.style.color = "";

    var lengthVal = parseInt(currentConfig.length, 10);
    if (
      !currentConfig.noLimit &&
      isTimedLength(currentConfig.length) &&
      !isNaN(lengthVal)
    ) {
      remainingSeconds = currentConfig.customSeconds || lengthVal;
      updateTimerDisplay();
    } else {
      liveTimer.textContent = "0s";
    }

    startCountdown();
  }

  function handleNextTest() {
    pausePlayback();
    if (resultsChartInstance && resultsChartInstance.hideScrubber) resultsChartInstance.hideScrubber();
    resultsSection.classList.add("hidden");
    typingSection.classList.remove("hidden");
    // Start a new random test
    handleRandomTest();
  }

  // --- Playback (faithful real-time replay) ---
  function initPlayback() {
    pausePlayback();
    playbackEvents = null;
    playbackDuration = 0;
    playbackCurrentTime = 0;

    if (engine && engine.playbackEvents && engine.playbackEvents.length > 0) {
      playbackEvents = engine.playbackEvents.slice();
      playbackEvents.sort(function (a, b) { return a.t - b.t; });
      var lastT = playbackEvents[playbackEvents.length - 1].t;
      playbackDuration = Math.max(lastT, engine.elapsedMs || 0);
    } else if (engine && engine.keystrokes && engine.keystrokes.length > 0) {
      // Fallback: derive from surviving keystrokes
      playbackEvents = [];
      var base = engine.keystrokes[0].timestamp;
      for (var i = 0; i < engine.keystrokes.length; i++) {
        var ks = engine.keystrokes[i];
        playbackEvents.push({ type: 'input', char: ks.char, correct: ks.correct, t: ks.timestamp - base, timestamp: ks.timestamp });
      }
      playbackDuration = engine.elapsedMs || (playbackEvents[playbackEvents.length - 1].t + 300);
    } else {
      playbackDuration = engine && engine.elapsedMs ? engine.elapsedMs : 0;
      playbackEvents = [];
    }
    if (playbackDuration < 500 && playbackEvents.length > 0) playbackDuration = Math.max(playbackDuration, 800);
    if (!playbackDuration) playbackDuration = 1000;

    if (playbackProgress) {
      playbackProgress.min = '0';
      playbackProgress.max = String(playbackDuration);
      playbackProgress.value = '0';
    }
    if (playbackPlayPause) {
      playbackPlayPause.innerHTML = '&#9654; Play';
      playbackPlayPause.disabled = false;
    }
    updatePlaybackTimeLabel();
    renderPlaybackAt(0);
    buildPlaybackLineNumbers();
    bindPlaybackControls();
    updateChartScrubber();
  }

  function bindPlaybackControls() {
    if (playbackControlsBound) return;
    playbackControlsBound = true;
    if (playbackPlayPause) {
      playbackPlayPause.addEventListener('click', function () {
        if (playbackPlaying) pausePlayback();
        else playPlayback();
      });
    }
    if (playbackProgress) {
      playbackProgress.addEventListener('input', function () {
        var v = parseInt(this.value, 10) || 0;
        playbackCurrentTime = Math.max(0, Math.min(playbackDuration, v));
        renderPlaybackAt(playbackCurrentTime);
        updatePlaybackTimeLabel();
        updateChartScrubber();
      });
      playbackProgress.addEventListener('change', function () {
        var v = parseInt(this.value, 10) || 0;
        playbackCurrentTime = Math.max(0, Math.min(playbackDuration, v));
        renderPlaybackAt(playbackCurrentTime);
        updatePlaybackTimeLabel();
        updateChartScrubber();
      });
    }
    if (playbackText) {
      playbackText.addEventListener('click', function () {
        if (playbackPlaying) pausePlayback(); else playPlayback();
      });
    }
  }

  function playPlayback() {
    if (!playbackEvents || playbackDuration <= 0) return;
    if (playbackCurrentTime >= playbackDuration) {
      playbackCurrentTime = 0;
      renderPlaybackAt(0);
      updatePlaybackProgress();
      updatePlaybackTimeLabel();
      updateChartScrubber();
    }
    if (playbackPlaying) return;
    playbackPlaying = true;
    if (playbackPlayPause) playbackPlayPause.innerHTML = '&#10074;&#10074; Pause';
    playbackLastTick = performance.now();
    function tick(now) {
      if (!playbackPlaying) return;
      var delta = now - playbackLastTick;
      playbackLastTick = now;
      playbackCurrentTime += delta;
      if (playbackCurrentTime >= playbackDuration) {
        playbackCurrentTime = playbackDuration;
        playbackPlaying = false;
        if (playbackPlayPause) playbackPlayPause.innerHTML = '&#9654; Replay';
        renderPlaybackAt(playbackCurrentTime);
        updatePlaybackProgress();
        updatePlaybackTimeLabel();
        updateChartScrubber();
        return;
      }
      renderPlaybackAt(playbackCurrentTime);
      updatePlaybackProgress();
      updatePlaybackTimeLabel();
      updateChartScrubber();
      playbackRAF = requestAnimationFrame(tick);
    }
    playbackRAF = requestAnimationFrame(tick);
  }

  function pausePlayback() {
    playbackPlaying = false;
    if (playbackRAF) { cancelAnimationFrame(playbackRAF); playbackRAF = null; }
    if (playbackPlayPause && playbackEvents) {
      if (playbackCurrentTime >= playbackDuration) playbackPlayPause.innerHTML = '&#9654; Replay';
      else playbackPlayPause.innerHTML = '&#9654; Play';
    }
  }

  function updatePlaybackProgress() {
    if (playbackProgress) playbackProgress.value = String(Math.round(playbackCurrentTime));
  }

  function updatePlaybackTimeLabel() {
    if (!playbackTime) return;
    playbackTime.textContent = formatPlaybackTime(playbackCurrentTime) + ' / ' + formatPlaybackTime(playbackDuration);
  }

  function formatPlaybackTime(ms) {
    var totalSec = Math.floor(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function updateChartScrubber() {
    if (!resultsChartInstance || !resultsChartInstance.setScrubber) return;
    var elapsedSec = playbackCurrentTime / 1000;
    resultsChartInstance.setScrubber(elapsedSec);
  }

  function renderPlaybackAt(timeMs) {
    if (!playbackText) return;
    if (!testText) {
      playbackText.innerHTML = '<span class="char char-untyped">Playback ready — press Play</span>';
      return;
    }
    // Reconstruct intended-path state: playbackIndex and per-position correctness
    var playbackIndex = 0;
    var playbackCharStates = new Array(testText.length);
    if (playbackEvents) {
      for (var i = 0; i < playbackEvents.length; i++) {
        var ev = playbackEvents[i];
        if (ev.t > timeMs) break;
        if (ev.type === 'backspace') {
          if (playbackIndex > 0) {
            playbackIndex--;
            playbackCharStates[playbackIndex] = undefined;
          }
        } else if (ev.type === 'input') {
          if (playbackIndex < testText.length) {
            playbackCharStates[playbackIndex] = !!ev.correct;
            playbackIndex++;
          }
        }
      }
    }
    if (playbackIndex < 0) playbackIndex = 0;
    if (playbackIndex > testText.length) playbackIndex = testText.length;
    var html = '';
    for (var j = 0; j < testText.length; j++) {
      var ch = testText[j];
      var cls;
      if (j < playbackIndex) {
        cls = playbackCharStates[j] === false ? 'char char-incorrect' : 'char char-correct';
      } else if (j === playbackIndex) {
        cls = 'char char-current';
      } else {
        cls = 'char char-untyped';
      }
      html += '<span class="' + cls + '" data-index="' + j + '">' + escapeHtml(ch) + '</span>';
    }
    // Edge: completed — show a trailing pale underscore after the last char
    if (playbackIndex >= testText.length) {
      html += '<span class="char char-current" aria-hidden="true">\u00a0</span>';
    }
    playbackText.innerHTML = html;
  }

  function buildPlaybackLineNumbers() {
    if (!playbackLineNumbers || !testText) return;
    var lines = testText.split('\n');
    var h = '';
    for (var i = 0; i < lines.length; i++) h += '<div class="line-number">' + (i + 1) + '</div>';
    playbackLineNumbers.innerHTML = h;
  }

  // --- Error display ---
  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove("hidden");
  }

  function hideError() {
    errorMessage.classList.add("hidden");
    errorMessage.textContent = "";
  }

  // --- Theme toggle (floating button) ---
  // Bound centrally in theme.js; kept as a safe no-op so init() is unchanged.
  function setupThemeToggleFloat() {
    var themeToggleFloat = document.getElementById("themeToggleFloat");
    if (!themeToggleFloat) return;
    if (
      themeToggleFloat.getAttribute("data-theme-bound") !== "1" &&
      window.theme
    ) {
      themeToggleFloat.setAttribute("data-theme-bound", "1");
      themeToggleFloat.addEventListener("click", function () {
        window.theme.toggleTheme();
      });
    }
  }

  // --- Utility: debounce ---
  function debounce(fn, delay) {
    var timer = null;
    return function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        function () {
          fn.apply(this, arguments);
        }.bind(this),
        delay,
      );
    };
  }

  // --- Utility: escape HTML ---
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // --- Expose to global for inline handlers ---
  window.typePage = {
    init: init,
    startTest: startTest,
    handleRestart: handleRestart,
  };

  // Auto-init when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
