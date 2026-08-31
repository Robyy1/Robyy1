// Keystroke — Theme & Font Management
// Sets data-theme attribute before first paint, persists to localStorage,
// and syncs with user account settings if logged in.

(function () {
  'use strict';

  const THEME_STORAGE_KEY = 'keystroke-theme';
  const FONT_STORAGE_KEY = 'keystroke-font';
  const ACCENT_STORAGE_KEY = 'keystroke-accent';
  const MOTION_STORAGE_KEY = 'keystroke-motion';
  const DENSITY_STORAGE_KEY = 'keystroke-density';
  const FOCUS_MODE_STORAGE_KEY = 'keystroke-focus-mode';
  const ACCENTS = ['amber', 'cyan', 'violet', 'rose', 'mono'];
  const MOTION_OPTIONS = ['system', 'on', 'off'];
  const AVAILABLE_FONTS = [
    'JetBrains Mono',
    'Fira Code',
    'Cascadia Code',
    'IBM Plex Mono',
    'Source Code Pro'
  ];
  const FONT_ALIASES = {
    'jetbrains-mono': 'JetBrains Mono',
    'fira-code': 'Fira Code',
    'cascadia-code': 'Cascadia Code',
    'ibm-plex-mono': 'IBM Plex Mono',
    'source-code-pro': 'Source Code Pro'
  };

  // --- Theme ---

  function getPreferredTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    updateThemeIcon(theme);
  }

  function updateThemeIcon(theme) {
    const isDark = theme === 'dark';
    // Floating circular toggles use a sun/moon pair of spans.
    const floats = document.querySelectorAll('.theme-toggle-float, #theme-toggle-float, #themeToggleFloat');
    for (let i = 0; i < floats.length; i++) {
      const sun = floats[i].querySelector('.theme-icon-sun');
      const moon = floats[i].querySelector('.theme-icon-moon');
      if (sun) sun.style.display = isDark ? 'inline' : 'none';
      if (moon) moon.style.display = isDark ? 'none' : 'inline';
      if (!sun && !moon) {
        // No icon spans present — fall back to a single glyph.
        const icon = floats[i].querySelector('.theme-icon');
        if (icon) icon.textContent = isDark ? '\u2600\uFE0F' : '\uD83C\uDF19';
      }
    }
    // Settings page checkbox (if present).
    const settingsToggle = document.getElementById('theme-toggle');
    if (settingsToggle && settingsToggle.type === 'checkbox') {
      settingsToggle.checked = isDark;
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
    // Notify server if logged in
    if (window.auth && window.auth.isLoggedIn()) {
      fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ theme: current === 'dark' ? 'light' : 'dark' })
      }).catch(function () {});
    }
  }

  // --- Font ---

  function getPreferredFont() {
    const stored = localStorage.getItem(FONT_STORAGE_KEY) || 'JetBrains Mono';
    return FONT_ALIASES[stored] || (AVAILABLE_FONTS.includes(stored) ? stored : 'JetBrains Mono');
  }

  function applyFont(fontName) {
    var fontValue = Object.keys(FONT_ALIASES).find(function (value) {
      return FONT_ALIASES[value] === fontName;
    }) || fontName;
    document.documentElement.setAttribute('data-font', fontName);
    document.documentElement.style.setProperty('--font-mono', "'" + fontName + "', monospace");
    localStorage.setItem(FONT_STORAGE_KEY, fontValue);
    updateFontPreview(fontName);
    // Notify server if logged in
    if (window.auth && window.auth.isLoggedIn()) {
      fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fontPref: fontValue })
      }).catch(function () {});
    }
  }

  function updateFontPreview(fontName) {
    var previews = document.querySelectorAll('.font-preview-text');
    for (var i = 0; i < previews.length; i++) {
      previews[i].style.fontFamily = "'" + fontName + "', monospace";
    }
  }

  function loadFontCSS(fontName) {
    if (fontName === 'Cascadia Code') return;
    // Load the Google Fonts CSS link for the selected font if not already loaded
    var linkId = 'font-css-' + fontName.replace(/\s+/g, '-').toLowerCase();
    if (document.getElementById(linkId)) return;
    var safeName = fontName.replace(/\s+/g, '+');
    var link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + safeName + '&display=swap';
    document.head.appendChild(link);
  }

  // --- Settings page font grid ---

  function renderFontGrid() {
    var container = document.getElementById('font-grid');
    if (!container) return;
    var currentFont = getPreferredFont();
    var html = '';
    for (var i = 0; i < AVAILABLE_FONTS.length; i++) {
      var font = AVAILABLE_FONTS[i];
      var selected = font === currentFont ? 'active' : '';
      html += '<button class="btn btn-sm ' + selected + ' font-option" data-font="' + font + '" type="button"' + (selected === 'active' ? ' aria-selected="true"' : '') + '>' + font + '</button>';
    }
    container.innerHTML = html;

    var options = container.querySelectorAll('.font-option');
    for (var j = 0; j < options.length; j++) {
      options[j].addEventListener('click', function () {
        var f = this.getAttribute('data-font');
        loadFontCSS(f);
        applyFont(f);
        // Update active state
        for (var k = 0; k < options.length; k++) {
          options[k].classList.remove('active');
          options[k].setAttribute('aria-selected', 'false');
        }
        this.classList.add('active');
        this.setAttribute('aria-selected', 'true');
      });
    }
  }

  // --- Accent ---

  function getPreferredAccent() {
    var stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (stored && ACCENTS.indexOf(stored) !== -1) return stored;
    return 'amber';
  }

  function applyAccent(accent) {
    if (ACCENTS.indexOf(accent) === -1) return;
    document.documentElement.setAttribute('data-accent', accent);
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
    updateAccentSwatches(accent);
    // Let other scripts (settings.js) react to the change.
    document.dispatchEvent(new CustomEvent('keystroke-accent-changed', { detail: accent }));
    // Notify server if logged in
    if (window.auth && window.auth.isLoggedIn()) {
      fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accentPref: accent })
      }).catch(function () {});
    }
  }

  function updateAccentSwatches(accent) {
    var swatches = document.querySelectorAll('.accent-swatch');
    for (var i = 0; i < swatches.length; i++) {
      var isActive = swatches[i].getAttribute('data-accent') === accent;
      swatches[i].setAttribute('aria-checked', isActive ? 'true' : 'false');
      if (isActive) swatches[i].classList.add('active');
      else swatches[i].classList.remove('active');
    }
  }

  function bindAccentSwatches() {
    var group = document.querySelector('[role="radiogroup"][data-accent-group]');
    if (!group) return;
    if (group.getAttribute('data-accent-bound') === '1') return;
    group.setAttribute('data-accent-bound', '1');

    var swatches = group.querySelectorAll('.accent-swatch');
    var current = getPreferredAccent();

    function select(swatch) {
      var accent = swatch.getAttribute('data-accent');
      applyAccent(accent);
      swatch.focus();
    }

    for (var i = 0; i < swatches.length; i++) {
      swatches[i].setAttribute('role', 'radio');
      swatches[i].setAttribute('aria-checked', swatches[i].getAttribute('data-accent') === current ? 'true' : 'false');
      if (swatches[i].getAttribute('data-accent') === current) swatches[i].classList.add('active');

      swatches[i].addEventListener('click', function () {
        select(this);
      });

      swatches[i].addEventListener('keydown', function (e) {
        var dir = 0;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') dir = 1;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') dir = -1;
        if (!dir) return;
        e.preventDefault();
        var list = Array.prototype.slice.call(group.querySelectorAll('.accent-swatch'));
        var idx = list.indexOf(this);
        var next = list[(idx + dir + list.length) % list.length];
        select(next);
      });
    }
  }

  // --- Reduce motion ---

  function getPreferredMotion() {
    var stored = localStorage.getItem(MOTION_STORAGE_KEY);
    if (stored && MOTION_OPTIONS.indexOf(stored) !== -1) return stored;
    return 'system';
  }

  function applyMotion(pref) {
    if (MOTION_OPTIONS.indexOf(pref) === -1) return;
    document.documentElement.setAttribute('data-motion', pref);
    localStorage.setItem(MOTION_STORAGE_KEY, pref);
    document.dispatchEvent(new CustomEvent('keystroke-motion-changed', { detail: pref }));
    if (window.auth && window.auth.isLoggedIn()) {
      fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reduceMotionPref: pref })
      }).catch(function () {});
    }
  }

  // --- Density / focus ---
  function getPreferredDensity() {
    var stored = localStorage.getItem(DENSITY_STORAGE_KEY);
    return stored === 'compact' ? 'compact' : 'comfortable';
  }

  function applyDensity(pref) {
    var value = pref === 'compact' ? 'compact' : 'comfortable';
    document.documentElement.setAttribute('data-density', value);
    localStorage.setItem(DENSITY_STORAGE_KEY, value);
  }

  function getPreferredFocusMode() {
    return localStorage.getItem(FOCUS_MODE_STORAGE_KEY) === 'true';
  }

  function applyFocusMode(enabled) {
    var shouldEnable = !!enabled;
    document.body.classList.toggle('focus-mode', shouldEnable);
    localStorage.setItem(FOCUS_MODE_STORAGE_KEY, String(shouldEnable));
  }

  // --- Init ---

  function bindThemeToggles() {
    // Bind every theme toggle on the page. A `data-theme-bound` flag keeps
    // pages from double-binding when multiple scripts touch the same element.
    var selectors = ['#theme-toggle', '#theme-toggle-float', '#themeToggleFloat', '.theme-toggle-float'];
    for (var s = 0; s < selectors.length; s++) {
      var toggles = document.querySelectorAll(selectors[s]);
      for (var i = 0; i < toggles.length; i++) {
        if (toggles[i].getAttribute('data-theme-bound') === '1') continue;
        toggles[i].setAttribute('data-theme-bound', '1');
        toggles[i].addEventListener('click', function (e) {
          // The settings page uses a checkbox — let its `change` handler run
          // normally, and only react to button-style toggles.
          if (this.type === 'checkbox') {
            updateThemeIcon(this.checked ? 'dark' : 'light');
            return;
          }
          toggleTheme();
          e.preventDefault();
        });
      }
    }
  }

  function init() {
    var theme = getPreferredTheme();
    applyTheme(theme);

    var font = getPreferredFont();
    loadFontCSS(font);
    applyFont(font);

    var accent = getPreferredAccent();
    applyAccent(accent);

    var motion = getPreferredMotion();
    applyMotion(motion);

    var density = getPreferredDensity();
    applyDensity(density);

    var focusMode = getPreferredFocusMode();
    applyFocusMode(focusMode);

    bindThemeToggles();
    bindAccentSwatches();

    // Settings page font grid
    renderFontGrid();
  }

  // Run immediately — before first paint
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for use from other scripts
  window.theme = {
    getPreferredTheme: getPreferredTheme,
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,
    getPreferredFont: getPreferredFont,
    applyFont: applyFont,
    loadFontCSS: loadFontCSS,
    getPreferredAccent: getPreferredAccent,
    applyAccent: applyAccent,
    getPreferredMotion: getPreferredMotion,
    applyMotion: applyMotion,
    getPreferredDensity: getPreferredDensity,
    applyDensity: applyDensity,
    getPreferredFocusMode: getPreferredFocusMode,
    applyFocusMode: applyFocusMode,
    ACCENTS: ACCENTS,
    MOTION_OPTIONS: MOTION_OPTIONS,
    AVAILABLE_FONTS: AVAILABLE_FONTS
  };

})();
