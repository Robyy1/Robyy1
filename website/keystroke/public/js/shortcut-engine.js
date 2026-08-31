// Keystroke — Software shortcut drill engine
// Drives a lesson where the "target text" is a sequence of keyboard shortcuts
// instead of characters. Listens on the document (capture phase) while active,
// prevents default on recognized keys, and cleans up when disposed so nothing
// leaks after navigating away.
//
// Plain script, attaches window.shortcutEngine (consistent with typing-engine.js).
(function () {
  'use strict';

  var STATE = {
    IDLE: 'idle',
    RUNNING: 'running',
    FINISHED: 'finished'
  };

  // --- OS detection (auto preference) ---
  function detectOS() {
    var platform = '';
    try {
      if (navigator.userAgentData && navigator.userAgentData.platform) {
        platform = navigator.userAgentData.platform;
      } else {
        platform = navigator.platform || '';
      }
    } catch (e) {
      platform = navigator.platform || '';
    }
    return /mac|iphone|ipad|ipod/i.test(platform) ? 'mac' : 'win';
  }

  // --- Key event -> canonical combo ---
  var CODE_SPECIALS = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    Space: 'space', Enter: 'enter', Tab: 'tab', Escape: 'esc', Backspace: 'backspace',
    Minus: '-', Equal: '=', Semicolon: ';', Quote: "'", Backslash: '\\',
    Comma: ',', Period: '.', Slash: '/', Backquote: '`',
    BracketLeft: '[', BracketRight: ']',
    NumpadAdd: 'numpad+', NumpadSubtract: 'numpad-', NumpadDecimal: 'numpad.',
    NumpadMultiply: 'numpad*', NumpadDivide: 'numpad/'
  };

  function codeToKey(e) {
    var code = e.code;
    if (CODE_SPECIALS[code]) return CODE_SPECIALS[code];
    var letter = /^Key([A-Z])$/.exec(code);
    if (letter) return letter[1].toLowerCase();
    var digit = /^Digit([0-9])$/.exec(code);
    if (digit) return digit[1];
    var numpad = /^Numpad([0-9])$/.exec(code);
    if (numpad) return 'numpad' + numpad[1];
    return null;
  }

  function buildCombo(e) {
    var key = codeToKey(e);
    if (!key) return null;
    var tokens = [];
    if (e.ctrlKey) tokens.push('ctrl');
    if (e.altKey) tokens.push('alt');
    if (e.shiftKey) tokens.push('shift');
    if (e.metaKey) tokens.push('cmd');
    tokens.push(key);
    return tokens.sort().join('+');
  }

  // Canonicalize a stored combo ("cmd+opt+q" -> "alt+cmd+q").
  function normalizeCombo(raw) {
    var tokens = String(raw || '').toLowerCase().split('+');
    var mapped = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i].trim();
      if (!t) continue;
      if (t === 'opt') t = 'alt';
      mapped.push(t);
    }
    return mapped.sort().join('+');
  }

  function isModifierOnly(e) {
    return e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta';
  }

  // --- Engine ---
  function ShortcutEngine(options) {
    options = options || {};
    this.shortcuts = options.shortcuts || [];
    this.osPref = options.osPref || 'auto';
    this.onUpdate = options.onUpdate || function () {};
    this.onFinish = options.onFinish || function () {};

    var self = this;
    this._targets = this.shortcuts.map(function (s) {
      var os = self.osPref === 'auto' ? detectOS() : self.osPref;
      var raw = os === 'mac' ? s.keys_mac : s.keys_win;
      return normalizeCombo(raw);
    });

    this._index = 0;
    this._errors = 0;
    this._reactionTimes = [];
    this._startedAt = 0;
    this._promptShownAt = 0;
    this.state = STATE.IDLE;
    this.metrics = {
      accuracy: 0,
      avgReactionMs: 0,
      errorCount: 0,
      durationSeconds: 0,
      completed: 0,
      total: this.shortcuts.length
    };
    this._handler = this._handler.bind(this);
  }

  ShortcutEngine.STATE = STATE;

  ShortcutEngine.prototype.currentTarget = function () {
    return this._index < this._targets.length ? this._targets[this._index] : null;
  };

  ShortcutEngine.prototype.currentAction = function () {
    return this._index < this.shortcuts.length ? this.shortcuts[this._index].action_label : '';
  };

  ShortcutEngine.prototype.start = function () {
    if (this.state === STATE.RUNNING) return;
    this.state = STATE.RUNNING;
    this._startedAt = Date.now();
    this._promptShownAt = this._startedAt;
    document.addEventListener('keydown', this._handler, true);
    this._emit();
  };

  ShortcutEngine.prototype.dispose = function () {
    document.removeEventListener('keydown', this._handler, true);
    this.state = STATE.IDLE;
  };

  ShortcutEngine.prototype._handler = function (e) {
    if (this.state !== STATE.RUNNING) return;
    if (isModifierOnly(e)) return;

    var combo = buildCombo(e);
    if (!combo) return;

    // While the drill is active, swallow keys we care about so the page and
    // browser don't react (arrow scrolling, space scroll, find dialog, etc.).
    e.preventDefault();

    var target = this._targets[this._index];
    if (target && combo === target) {
      this._reactionTimes.push(Date.now() - this._promptShownAt);
      this._index++;
      this._promptShownAt = Date.now();
      if (this._index >= this._targets.length) {
        this._finish();
        return;
      }
      this._emit('correct');
    } else {
      this._errors++;
      this._emit('error');
    }
  };

  ShortcutEngine.prototype._finish = function () {
    this.state = STATE.FINISHED;
    document.removeEventListener('keydown', this._handler, true);

    var completed = this._index;
    var totalPresses = completed + this._errors;
    var sum = 0;
    for (var i = 0; i < this._reactionTimes.length; i++) sum += this._reactionTimes[i];

    this.metrics = {
      accuracy: totalPresses > 0 ? Math.round((completed / totalPresses) * 1000) / 10 : 0,
      avgReactionMs: this._reactionTimes.length > 0 ? Math.round(sum / this._reactionTimes.length) : 0,
      errorCount: this._errors,
      durationSeconds: Math.round((Date.now() - this._startedAt) / 1000),
      completed: completed,
      total: this.shortcuts.length
    };

    this._emit('done');
    this.onFinish(this.metrics);
  };

  ShortcutEngine.prototype._emit = function (feedback) {
    var completed = this._index;
    var totalPresses = completed + this._errors;
    var label = '';
    if (this._index < this.shortcuts.length) {
      var os = this.osPref === 'auto' ? detectOS() : this.osPref;
      label = os === 'mac' ? this.shortcuts[this._index].keys_mac : this.shortcuts[this._index].keys_win;
    }
    this.onUpdate({
      completed: completed,
      total: this.shortcuts.length,
      errors: this._errors,
      accuracy: totalPresses > 0 ? Math.round((completed / totalPresses) * 1000) / 10 : 100,
      avgReactionMs: this._reactionTimes.length > 0
        ? Math.round(this._reactionTimes.reduce(function (a, b) { return a + b; }, 0) / this._reactionTimes.length)
        : 0,
      feedback: feedback || null,
      actionLabel: this.currentAction(),
      target: this.currentTarget(),
      comboLabel: label
    });
  };

  window.shortcutEngine = {
    ShortcutEngine: ShortcutEngine,
    STATE: STATE,
    detectOS: detectOS,
    normalizeCombo: normalizeCombo
  };
})();