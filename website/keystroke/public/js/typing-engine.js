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
    // Full input history for faithful replay (includes backspaces with real timing)
    this.playbackEvents = []; // [{type:'input'|'backspace', char, correct, t, timestamp}]
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
      // Record backspace for faithful replay before mutating state
      var bsTime = Date.now();
      var bsT = this.startTime ? bsTime - this.startTime : 0;
      if (bsT < 0) bsT = 0;
      this.playbackEvents.push({ type: 'backspace', t: bsT, timestamp: bsTime });
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
    var now = Date.now();
    var t = this.startTime ? now - this.startTime : 0;
    if (t < 0) t = 0;
    this.keystrokes.push({
      char: ch,
      timestamp: now,
      correct: isCorrect
    });
    this.playbackEvents.push({
      type: 'input',
      char: ch,
      correct: isCorrect,
      t: t,
      timestamp: now
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

    if (this.totalTyped > 0) {
      this.runningAccuracy = Math.round((this.correctChars / this.totalTyped) * 100);
    } else {
      this.runningAccuracy = 100;
    }

    // Anti-fraud: below 40% accuracy WPM is meaningless — show 0 so mashing does not inflate graph.
    // Between 40-70% heavily penalize instead of pure correct/5.
    var rawWpmVal = elapsedMin > 0 ? (Math.round((this.totalTyped / 5) / elapsedMin) || 0) : 0;
    if (this.elapsedMs >= 1000 && elapsedMin > 0 && this.correctChars > 0) {
      var baseWpm = Math.round((this.correctChars / 5) / elapsedMin);
      if (this.runningAccuracy < 40) baseWpm = 0;
      else if (this.runningAccuracy < 70) baseWpm = Math.round(baseWpm * (this.runningAccuracy / 70));
      this.runningWpm = baseWpm;
      if (this.runningAccuracy < 40) rawWpmVal = 0;
    } else {
      this.runningWpm = 0;
    }

    var consistency = calculateConsistency(this.wpmHistory);
    this.onUpdate({
      wpm: this.runningWpm,
      rawWpm: rawWpmVal,
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
    var accuracy = totalTyped > 0 ? Math.round((correctChars / totalTyped) * 100) : 0;
    if (elapsedMin <= 0 || correctChars === 0) {
      return { wpm: 0, rawWpm: 0, accuracy: accuracy, consistency: 100, errorCount: errorCount };
    }

    var wpm = Math.round((correctChars / 5) / elapsedMin);
    var rawWpm = Math.round((totalTyped / 5) / elapsedMin);
    var consistency = calculateConsistencyFromKeystrokes(keystrokes, startTime, elapsedMs);

    // Anti-fraud gate: heavy errors must not yield a leaderboard WPM.
    // Below 40% accuracy the test is not a valid typing sample.
    if (accuracy < 40) { wpm = 0; rawWpm = 0; consistency = 0; }
    else if (accuracy < 70) {
      wpm = Math.round(wpm * (accuracy / 70));
      rawWpm = Math.round(rawWpm * (accuracy / 70));
    }

    return { wpm: wpm, rawWpm: rawWpm, accuracy: accuracy, consistency: consistency, errorCount: errorCount };
  }

  // Counts *correct* keystrokes that landed inside the 1-second window [startTime+(second-1)s, startTime+second s).
  // Incorrect spam is ignored so mashing random keys cannot inflate WPM/graph (fix for 300+ raw WPM at 1% accuracy).
  function calculateInstantWpm(keystrokes, startTime, second) {
    var count = 0;
    var winStart = startTime + (second - 1) * 1000;
    var winEnd = startTime + second * 1000;
    for (var i = 0; i < keystrokes.length; i++) {
      if (!keystrokes[i].correct) continue;
      if (keystrokes[i].timestamp >= winStart && keystrokes[i].timestamp < winEnd) {
        count++;
      }
    }
    return count; // correct chars typed in that second, converted to WPM later
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
        if (!keystrokes[i].correct) continue;
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
