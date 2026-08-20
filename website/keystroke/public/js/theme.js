// Keystroke — Theme & Font Management
// Sets data-theme attribute before first paint, persists to localStorage,
// and syncs with user account settings if logged in.

(function () {
  'use strict';

  const THEME_STORAGE_KEY = 'keystroke_theme';
  const FONT_STORAGE_KEY = 'keystroke_font_pref';
  const AVAILABLE_FONTS = [
    'JetBrains Mono',
    'Fira Code',
    'Cascadia Code',
    'IBM Plex Mono',
    'Source Code Pro'
  ];

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
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    const icon = toggle.querySelector('.theme-icon');
    if (icon) {
      icon.textContent = theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
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
    return localStorage.getItem(FONT_STORAGE_KEY) || 'JetBrains Mono';
  }

  function applyFont(fontName) {
    document.documentElement.setAttribute('data-font', fontName);
    localStorage.setItem(FONT_STORAGE_KEY, fontName);
    updateFontPreview(fontName);
    // Notify server if logged in
    if (window.auth && window.auth.isLoggedIn()) {
      fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fontPref: fontName })
      }).catch(function () {});
    }
  }

  function updateFontPreview(fontName) {
    var previews = document.querySelectorAll('.font-preview-text');
    for (var i = 0; i < previews.length; i++) {
      previews[i].style.fontFamily = "'" + fontName.replace(/\s+/g, '') + "', monospace";
    }
  }

  function loadFontCSS(fontName) {
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

  // --- Init ---

  function init() {
    var theme = getPreferredTheme();
    applyTheme(theme);

    var font = getPreferredFont();
    loadFontCSS(font);
    applyFont(font);

    // Theme toggle button (if present on page)
    var themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }

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
    AVAILABLE_FONTS: AVAILABLE_FONTS
  };

})();
