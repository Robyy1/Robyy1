// Keystroke — Typing Engine (core logic)
// Character-by-character comparison driven by a hidden <input>.
// Handles IME, backspace, paste, code indentation, and live stats.

(function () {
  'use strict';

  // --- Configuration defaults ---
  var DEFAULT_CONFIG = {
    mode: 'code',          // 'general' | 'code'
    language: 'javascript',
    difficulty: 'intermediate',
    length: '60s'          // '15s' | '30s' | '60s' | '120s' | 'full'
  };

  var CONFIG_KEY = 'keystroke_config';

  function loadConfig() {
    try {
      var stored = localStorage.getItem(CONFIG_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return Object.assign({}, DEFAULT_CONFIG);
  }

  function saveConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  }

  // --- State machine ---
  var STATE = { IDLE: 'idle', RUNNING: 'running', FINISHED: 'finished' };

  // --- Core engine class ---
  function TypingEngine(options) {
    options = options || {};
    this.targetText = options.targetText || '';
    this.onStateChange = options.onStateChange || function () {};
    this.onUpdate = options.onUpdate || function () {};
    this.onFinish = options.onFinish || function () {};

    // Rendering hooks
    this.renderChar = options.renderChar || function (ch, state) { return ch; };
    this.renderAll = options.renderAll || function () {};

    this.reset();
  }

  TypingEngine.prototype.reset = function () {
    // Make sure any previous timer is actually stopped (not just the reference dropped).
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.state = STATE.IDLE;
    this.currentIndex = 0;
    this.correctChars = 0;
    this.totalTyped = 0;
    this.errorCount = 0;
    this.errorsThisTest = 0; // errors not yet corrected
    this.startTime = null;
    this.elapsedMs = 0;
    this.timerInterval = null;
    this.lastTick = Date.now();
    this.lastRecordedSecond = 0;
    this.keystrokes = []; // [{char, timestamp, correct}]
    // Per-position correctness so the renderer can show wrong chars as incorrect.
    // Indexed by the position that was typed; value is a boolean.
    this.charStates = [];
    this.wpmHistory = []; // for consistency calc
    this.runningWpm = 0;
    this.runningAccuracy = 0;
    this.isFirstKeystroke = true;
  };

  TypingEngine.prototype.start = function () {
    if (this.state !== STATE.IDLE) return;
    this.state = STATE.RUNNING;
    this.startTime = Date.now();
    this.lastTick = this.startTime;
    this.onStateChange(this.state);
    // Start live update interval (every second). The previous code used an
    // undefined `bind` global and passed `this` as the delay, which threw a
    // ReferenceError and never fired the live updates.
    this.timerInterval = setInterval(this.updateLive.bind(this), 1000);
  };

  TypingEngine.prototype.finish = function () {
    if (this.state !== STATE.RUNNING) return;
    this.state = STATE.FINISHED;
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.elapsedMs = Date.now() - this.startTime;
    this.onStateChange(this.state);
    // Calculate final metrics
    var metrics = calculateMetrics(
      this.correctChars,
      this.totalTyped,
      this.errorCount,
      this.keystrokes,
      this.startTime,
      this.elapsedMs
    );
    this.metrics = metrics;
    this.onFinish(metrics);
  };

  TypingEngine.prototype.handleInput = function (data) {
    if (this.state === STATE.FINISHED) return false;

    // Start timer on first keystroke
    if (this.isFirstKeystroke) {
      this.start();
      this.isFirstKeystroke = false;
    }

    var ch = data || '';
    var isBackspace = (typeof data === 'string' && data === '\b') || data === null;

    if (isBackspace) {
      var handledBackspace = this.handleBackspace();
      // Keep live stats current after a correction.
      if (handledBackspace) this.publishInstant();
      return handledBackspace;
    }

    // Only process single printable characters
    if (!ch || ch.length > 1) return false;

    // Don't allow typing past end of text
    if (this.currentIndex >= this.targetText.length) return false;

    var targetCh = this.targetText[this.currentIndex];
    var isCorrect = (ch === targetCh);

    // Record per-position correctness before advancing the cursor
    this.charStates[this.currentIndex] = isCorrect;

    // Record keystroke
    this.keystrokes.push({
      char: ch,
      timestamp: Date.now(),
      correct: isCorrect
    });

    this.totalTyped++;

    if (isCorrect) {
      this.correctChars++;
    } else {
      this.errorCount++;
      this.errorsThisTest++;
    }

    // Move to next character
    this.currentIndex++;

    // Check if test is complete
    if (this.currentIndex >= this.targetText.length) {
      this.finish();
      return true;
    }

    // Real-time WPM/accuracy update on every keystroke (typeracer-style).
    this.publishInstant();

    return true;
  };

  TypingEngine.prototype.handleBackspace = function () {
    if (this.currentIndex <= 0) return false;

    // Remove last keystroke record
    var lastStroke = this.keystrokes.pop();
    if (lastStroke) {
      this.totalTyped--;
      if (!lastStroke.correct) {
        this.errorCount--;
        this.errorsThisTest = Math.max(0, this.errorsThisTest - 1);
      } else {
        this.correctChars--;
      }
    }

    this.currentIndex--;
    // Clear the per-position state for the character we're re-typing
    this.charStates[this.currentIndex] = undefined;
    return true;
  };

  TypingEngine.prototype.publishInstant = function () {
    if (this.state !== STATE.RUNNING) return;

    var now = Date.now();
    this.elapsedMs = now - this.startTime;
    var elapsedMin = this.elapsedMs / 60000;

    // Avoid the first-keystroke WPM spike by waiting until a full second has passed.
    if (this.elapsedMs >= 1000 && elapsedMin > 0 && this.correctChars > 0) {
      this.runningWpm = Math.round((this.correctChars / 5) / elapsedMin);
    } else {
      this.runningWpm = 0;
    }

    if (this.totalTyped > 0) {
      this.runningAccuracy = Math.round((this.correctChars / this.totalTyped) * 100);
    } else {
      this.runningAccuracy = 100;
    }

    var consistency = calculateConsistency(this.wpmHistory);
    this.onUpdate({
      wpm: this.runningWpm,
      rawWpm: elapsedMin > 0 ? (Math.round((this.totalTyped / 5) / elapsedMin) || 0) : 0,
      accuracy: this.runningAccuracy,
      errors: this.errorsThisTest,
      elapsedSeconds: Math.floor(this.elapsedMs / 1000),
      currentIndex: this.currentIndex,
      totalLength: this.targetText.length,
      consistency: consistency
    });
  };

  TypingEngine.prototype.updateLive = function () {
    if (this.state !== STATE.RUNNING) return;

    // Record a per-second consistency bucket (once per second, relative to startTime).
    var currentSecond = Math.floor((Date.now() - this.startTime) / 1000);
    if (currentSecond > this.lastRecordedSecond) {
      this.lastRecordedSecond = currentSecond;
      this.wpmHistory.push(calculateInstantWpm(this.keystrokes, this.startTime, currentSecond));
    }

    this.publishInstant();
  };

  TypingEngine.prototype.getConfig = function () {
    return loadConfig();
  };

  TypingEngine.prototype.setConfig = function (cfg) {
    saveConfig(cfg);
  };

  // --- Metrics calculation ---
  function calculateMetrics(correctChars, totalTyped, errorCount, keystrokes, startTime, elapsedMs) {
    var elapsedMin = elapsedMs / 60000;
    if (elapsedMin <= 0 || correctChars === 0) {
      return { wpm: 0, rawWpm: 0, accuracy: totalTyped > 0 ? Math.round((correctChars / totalTyped) * 100) : 0, consistency: 100, errorCount: errorCount };
    }

    var wpm = Math.round((correctChars / 5) / elapsedMin);
    var rawWpm = Math.round((totalTyped / 5) / elapsedMin);
    var accuracy = Math.round((correctChars / totalTyped) * 100);
    var consistency = calculateConsistencyFromKeystrokes(keystrokes, startTime, elapsedMs);

    return { wpm: wpm, rawWpm: rawWpm, accuracy: accuracy, consistency: consistency, errorCount: errorCount };
  }

  // Counts keystrokes that landed inside the 1-second window [startTime+(second-1)s, startTime+second s).
  function calculateInstantWpm(keystrokes, startTime, second) {
    var count = 0;
    var winStart = startTime + (second - 1) * 1000;
    var winEnd = startTime + second * 1000;
    for (var i = 0; i < keystrokes.length; i++) {
      if (keystrokes[i].timestamp >= winStart && keystrokes[i].timestamp < winEnd) {
        count++;
      }
    }
    return count; // chars typed in that second, converted to WPM later
  }

  function calculateConsistency(wpmHistory) {
    if (wpmHistory.length < 2) return 100;
    var mean = wpmHistory.reduce(function (a, b) { return a + b; }, 0) / wpmHistory.length;
    if (mean === 0) return 100;
    var variance = 0;
    for (var i = 0; i < wpmHistory.length; i++) {
      variance += Math.pow(wpmHistory[i] - mean, 2);
    }
    variance /= wpmHistory.length;
    var stddev = Math.sqrt(variance);
    var cv = (stddev / mean) * 100; // coefficient of variation
    return Math.max(0, Math.min(100, Math.round(100 - cv)));
  }

  function calculateConsistencyFromKeystrokes(keystrokes, startTime, totalMs) {
    if (keystrokes.length < 2 || totalMs <= 1000) return 100;
    var numSeconds = Math.max(1, Math.floor(totalMs / 1000));
    var perSecond = [];
    for (var s = 1; s <= numSeconds; s++) {
      var winStart = startTime + (s - 1) * 1000;
      var winEnd = startTime + s * 1000;
      var count = 0;
      for (var i = 0; i < keystrokes.length; i++) {
        if (keystrokes[i].timestamp >= winStart && keystrokes[i].timestamp < winEnd) {
          count++;
        }
      }
      perSecond.push(count);
    }
    return calculateConsistency(perSecond);
  }

  // --- Fetch random text from server ---
  function fetchRandomText(mode, language, difficulty, length) {
    var params = new URLSearchParams();
    params.set('mode', mode);
    if (mode === 'code') {
      params.set('language', language || '');
      params.set('difficulty', difficulty || '');
    } else {
      params.set('length', length || 'medium');
    }
    return fetch('/api/texts/random?' + params.toString()).then(function (res) {
      if (!res.ok) throw new Error('Failed to load text');
      return res.json();
    });
  }

  // --- Expose public API ---
  window.typingEngine = {
    TypingEngine: TypingEngine,
    STATE: STATE,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    fetchRandomText: fetchRandomText,
    calculateMetrics: calculateMetrics
  };

})();
