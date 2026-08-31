// settings.js — Settings page logic: profile, appearance (theme/accent/font/motion),
// learning mode, typing preferences, password, export, and delete account.

(function () {
  'use strict';

  const API_BASE = '/api';
  const THEME_STORAGE_KEY = 'keystroke-theme';
  const FONT_STORAGE_KEY = 'keystroke-font';
  const ACCENT_STORAGE_KEY = 'keystroke-accent';
  const MOTION_STORAGE_KEY = 'keystroke-motion';
  const DENSITY_STORAGE_KEY = 'keystroke-density';
  const FOCUS_MODE_STORAGE_KEY = 'keystroke-focus-mode';
  const CONFIG_KEY = 'keystroke_config';

  // --- DOM references ---
  const themeToggle = document.getElementById('theme-toggle');
  const accentGroup = document.querySelector('[data-accent-group]');
  const fontSelector = document.getElementById('font-selector');
  const fontPreview = document.getElementById('font-preview-text');
  const motionGroup = document.querySelector('[data-motion-group]');
  const densityGroup = document.querySelector('[data-density-group]');
  const learningModeGroup = document.querySelector('[data-learning-mode-group]');
  const osPrefGroup = document.querySelector('[data-os-pref-group]');
  const focusModeToggle = document.getElementById('focus-mode-toggle');
  const indentWidth = document.getElementById('indent-width');
  const soundEnabled = document.getElementById('sound-enabled');
  const accountEmail = document.getElementById('account-email');
  const accountUsername = document.getElementById('account-username');
  const accountCreated = document.getElementById('account-created');
  const emailMessage = document.getElementById('email-message');
  const exportBtn = document.getElementById('export-btn');
  const changePasswordForm = document.getElementById('change-password-form');
  const currentPasswordInput = document.getElementById('current-password');
  const newPasswordInput = document.getElementById('new-password');
  const confirmPasswordInput = document.getElementById('confirm-new-password');
  const passwordMessage = document.getElementById('password-message');
  const deleteAccountBtn = document.getElementById('delete-account-btn');
  const deleteConfirmInput = document.getElementById('delete-confirm-input');
  const deleteModal = document.getElementById('delete-modal');
  const deleteCancelBtn = document.getElementById('delete-cancel-btn');
  const deleteConfirmBtn = document.getElementById('delete-confirm-btn');

  // --- Helpers ---
  function putSetting(payload) {
    return fetch(`${API_BASE}/user/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
  }

  function setMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = type ? 'settings-message settings-message--' + type : 'settings-message';
  }

  function getStoredConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); } catch (e) { return {}; }
  }

  function saveConfigPatch(patch) {
    const cfg = getStoredConfig();
    Object.assign(cfg, patch);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  }

  // --- Theme toggle ---
  function initThemeToggle() {
    if (!themeToggle) return;
    const currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
    themeToggle.checked = currentTheme === 'dark';
    themeToggle.setAttribute('aria-checked', currentTheme === 'dark' ? 'true' : 'false');

    themeToggle.addEventListener('change', () => {
      const newTheme = themeToggle.checked ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      themeToggle.setAttribute('aria-checked', themeToggle.checked ? 'true' : 'false');
      if (window.theme) window.theme.applyTheme(newTheme);
      putSetting({ theme: newTheme }).catch(function () {});
    });
  }

  // --- Accent swatches (bound by theme.js for radio-group keyboard nav) ---
  function initAccent() {
    if (!accentGroup) return;
    // theme.js already applied the stored accent on load; make sure the
    // swatches reflect it and sync a change to the server.
    const current = localStorage.getItem(ACCENT_STORAGE_KEY) || 'amber';
    const swatches = accentGroup.querySelectorAll('.accent-swatch');
    for (let i = 0; i < swatches.length; i++) {
      const active = swatches[i].getAttribute('data-accent') === current;
      swatches[i].classList.toggle('active', active);
      swatches[i].setAttribute('aria-checked', active ? 'true' : 'false');
    }

    document.addEventListener('keystroke-accent-changed', function (e) {
      const accent = e.detail;
      for (let i = 0; i < swatches.length; i++) {
        const active = swatches[i].getAttribute('data-accent') === accent;
        swatches[i].classList.toggle('active', active);
        swatches[i].setAttribute('aria-checked', active ? 'true' : 'false');
      }
    });
  }

  // --- Font selector with live preview ---
  const FONTS = [
    { name: 'JetBrains Mono', value: 'jetbrains-mono', cssFamily: 'JetBrains Mono' },
    { name: 'Fira Code', value: 'fira-code', cssFamily: 'Fira Code' },
    { name: 'Cascadia Code', value: 'cascadia-code', cssFamily: 'Cascadia Code' },
    { name: 'IBM Plex Mono', value: 'ibm-plex-mono', cssFamily: 'IBM Plex Mono' },
    { name: 'Source Code Pro', value: 'source-code-pro', cssFamily: 'Source Code Pro' }
  ];

  function initFontSelector() {
    if (!fontSelector) return;
    const savedFont = localStorage.getItem(FONT_STORAGE_KEY) || 'jetbrains-mono';
    fontSelector.value = savedFont;
    applyFont(savedFont);
    loadGoogleFont(savedFont);

    fontSelector.addEventListener('change', async () => {
      const chosen = fontSelector.value;
      applyFont(chosen);
      localStorage.setItem(FONT_STORAGE_KEY, chosen);
      loadGoogleFont(chosen);
      putSetting({ fontPref: chosen }).catch(function () {});
    });
  }

  function applyFont(fontValue) {
    const font = FONTS.find((candidate) => candidate.value === fontValue);
    const cssFamily = font ? font.cssFamily : 'JetBrains Mono';
    document.documentElement.style.setProperty('--font-mono', `'${cssFamily}', monospace`);
    if (fontPreview) {
      fontPreview.style.fontFamily = `'${cssFamily}', monospace`;
      fontPreview.textContent = 'The quick brown fox jumps over the lazy dog. 0123456789 {}[]()';
    }
  }

  function loadGoogleFont(fontValue) {
    const fontMap = {
      'jetbrains-mono': 'JetBrains+Mono',
      'fira-code': 'Fira+Code',
      'ibm-plex-mono': 'IBM+Plex+Mono',
      'source-code-pro': 'Source+Code+Pro'
    };
    const family = fontMap[fontValue];
    if (!family) return;
    if (document.querySelector(`link[href*="${family}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }

  // --- Reduce motion segmented control ---
  function initMotion() {
    if (!motionGroup) return;
    const current = localStorage.getItem(MOTION_STORAGE_KEY) || 'system';
    const btns = motionGroup.querySelectorAll('[data-motion-pref]');
    for (let i = 0; i < btns.length; i++) {
      const active = btns[i].getAttribute('data-motion-pref') === current;
      btns[i].classList.toggle('active', active);
      btns[i].setAttribute('aria-checked', active ? 'true' : 'false');
      btns[i].addEventListener('click', function () {
        const value = this.getAttribute('data-motion-pref');
        document.documentElement.setAttribute('data-motion', value);
        localStorage.setItem(MOTION_STORAGE_KEY, value);
        for (let j = 0; j < btns.length; j++) {
          const isActive = btns[j] === this;
          btns[j].classList.toggle('active', isActive);
          btns[j].setAttribute('aria-checked', isActive ? 'true' : 'false');
        }
        putSetting({ reduceMotionPref: value }).catch(function () {});
      });
    }
  }

  // --- Layout density segmented control ---
  function initDensity() {
    if (!densityGroup) return;
    const current = localStorage.getItem(DENSITY_STORAGE_KEY) || 'comfortable';
    const btns = densityGroup.querySelectorAll('[data-density-pref]');
    const apply = function (value) {
      document.documentElement.setAttribute('data-density', value);
      localStorage.setItem(DENSITY_STORAGE_KEY, value);
      saveConfigPatch({ density: value });
      for (let i = 0; i < btns.length; i++) {
        const active = btns[i].getAttribute('data-density-pref') === value;
        btns[i].classList.toggle('active', active);
        btns[i].setAttribute('aria-checked', active ? 'true' : 'false');
      }
    };

    apply(current);
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        apply(this.getAttribute('data-density-pref'));
      });
    });
  }

  // --- Focus mode toggle ---
  function initFocusMode() {
    if (!focusModeToggle) return;
    const checked = localStorage.getItem(FOCUS_MODE_STORAGE_KEY) === 'true';
    focusModeToggle.checked = checked;
    focusModeToggle.setAttribute('aria-checked', checked ? 'true' : 'false');
    document.body.classList.toggle('focus-mode', checked);

    focusModeToggle.addEventListener('change', function () {
      const isActive = this.checked;
      localStorage.setItem(FOCUS_MODE_STORAGE_KEY, String(isActive));
      saveConfigPatch({ focusMode: isActive });
      document.body.classList.toggle('focus-mode', isActive);
      this.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });
  }

  // --- Learning mode segmented control ---
  function initLearningMode() {
    if (!learningModeGroup) return;
    const cfg = getStoredConfig();
    const current = cfg.learningMode || 'type';
    const btns = learningModeGroup.querySelectorAll('[data-learning-mode]');
    for (let i = 0; i < btns.length; i++) {
      const active = btns[i].getAttribute('data-learning-mode') === current;
      btns[i].classList.toggle('active', active);
      btns[i].setAttribute('aria-checked', active ? 'true' : 'false');
      btns[i].addEventListener('click', function () {
        const value = this.getAttribute('data-learning-mode');
        saveConfigPatch({ learningMode: value });
        for (let j = 0; j < btns.length; j++) {
          const isActive = btns[j] === this;
          btns[j].classList.toggle('active', isActive);
          btns[j].setAttribute('aria-checked', isActive ? 'true' : 'false');
        }
        putSetting({ learningMode: value }).catch(function () {});
      });
    }
  }

  // --- Shortcut key OS preference segmented control ---
  function initOsPref() {
    if (!osPrefGroup) return;
    const cfg = getStoredConfig();
    const current = cfg.osPref || 'auto';
    const btns = osPrefGroup.querySelectorAll('[data-os-pref]');
    for (let i = 0; i < btns.length; i++) {
      const active = btns[i].getAttribute('data-os-pref') === current;
      btns[i].classList.toggle('active', active);
      btns[i].setAttribute('aria-checked', active ? 'true' : 'false');
      btns[i].addEventListener('click', function () {
        const value = this.getAttribute('data-os-pref');
        saveConfigPatch({ osPref: value });
        for (let j = 0; j < btns.length; j++) {
          const isActive = btns[j] === this;
          btns[j].classList.toggle('active', isActive);
          btns[j].setAttribute('aria-checked', isActive ? 'true' : 'false');
        }
        putSetting({ osPref: value }).catch(function () {});
      });
    }
  }

  // --- Indent width & sound ---
  function initTypingPrefs() {
    if (indentWidth) {
      const cfg = getStoredConfig();
      indentWidth.value = String(cfg.indentWidthPref || 2);
      indentWidth.addEventListener('change', function () {
        const value = parseInt(this.value, 10) || 2;
        saveConfigPatch({ indentWidthPref: value });
        putSetting({ indentWidthPref: value }).catch(function () {});
      });
    }

    if (soundEnabled) {
      const cfg = getStoredConfig();
      soundEnabled.checked = !!cfg.soundEnabled;
      soundEnabled.setAttribute('aria-checked', soundEnabled.checked ? 'true' : 'false');
      soundEnabled.addEventListener('change', function () {
        saveConfigPatch({ soundEnabled: this.checked });
        putSetting({ soundEnabled: this.checked }).catch(function () {});
      });
    }
  }

  // --- Load account details & editable email ---
  function applyPersistedUserSettings(user) {
    if (!user || typeof user !== 'object') return;

    const nextTheme = user.theme && ['dark', 'light'].includes(user.theme) ? user.theme : null;
    const nextAccent = user.accentPref && ['amber', 'cyan', 'violet', 'rose', 'mono'].includes(user.accentPref) ? user.accentPref : null;
    const nextMotion = user.reduceMotionPref && ['system', 'on', 'off'].includes(user.reduceMotionPref) ? user.reduceMotionPref : null;

    if (nextTheme && !localStorage.getItem(THEME_STORAGE_KEY)) {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    }
    if (nextAccent && !localStorage.getItem(ACCENT_STORAGE_KEY)) {
      localStorage.setItem(ACCENT_STORAGE_KEY, nextAccent);
    }
    if (nextMotion && !localStorage.getItem(MOTION_STORAGE_KEY)) {
      localStorage.setItem(MOTION_STORAGE_KEY, nextMotion);
    }

    if (nextTheme && document.documentElement.getAttribute('data-theme') !== nextTheme) {
      document.documentElement.setAttribute('data-theme', nextTheme);
      if (window.theme && typeof window.theme.applyTheme === 'function') {
        window.theme.applyTheme(nextTheme);
      }
    }
    if (nextAccent && document.documentElement.getAttribute('data-accent') !== nextAccent) {
      document.documentElement.setAttribute('data-accent', nextAccent);
      if (window.theme && typeof window.theme.applyAccent === 'function') {
        window.theme.applyAccent(nextAccent);
      }
    }
    if (nextMotion && document.documentElement.getAttribute('data-motion') !== nextMotion) {
      document.documentElement.setAttribute('data-motion', nextMotion);
      if (window.theme && typeof window.theme.applyMotion === 'function') {
        window.theme.applyMotion(nextMotion);
      }
    }
  }

  async function loadAccountDetails() {
    try {
      const res = await fetch(`${API_BASE}/user/me`, { credentials: 'include' });
      if (!res.ok) {
        if (accountEmail) accountEmail.value = '';
        if (accountUsername) accountUsername.textContent = 'Guest';
        if (accountCreated) accountCreated.textContent = '—';
        return;
      }
      const data = await res.json();
      const user = data.user || {};
      if (accountEmail) accountEmail.value = user.email || '';
      if (accountUsername) accountUsername.textContent = user.username || '';
      if (accountCreated && user.createdAt) {
        const date = new Date(user.createdAt);
        accountCreated.textContent = `Member since ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
      }
      applyPersistedUserSettings(user);
    } catch (e) {
      if (accountEmail) accountEmail.value = '';
      if (accountUsername) accountUsername.textContent = 'Unable to load';
    }
  }

  function initEmailEditor() {
    if (!accountEmail) return;
    accountEmail.addEventListener('change', async () => {
      const email = accountEmail.value.trim();
      setMessage(emailMessage, '', null);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setMessage(emailMessage, 'Enter a valid email address.', 'error');
        return;
      }
      try {
        const res = await putSetting({ email: email });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setMessage(emailMessage, 'Email updated.', 'success');
        } else {
          setMessage(emailMessage, data.error || 'Could not update email.', 'error');
        }
      } catch (err) {
        setMessage(emailMessage, 'Network error. Please try again.', 'error');
      }
    });
  }

  // --- Export data ---
  function initExport() {
    if (!exportBtn) return;
    exportBtn.addEventListener('click', async () => {
      exportBtn.disabled = true;
      exportBtn.textContent = 'Preparing export…';
      try {
        const res = await fetch(`${API_BASE}/user/export`, { credentials: 'include' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(data.error || 'Export failed. Are you logged in?');
          return;
        }
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `keystroke-export-${(data.user && data.user.username) || 'user'}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        alert('Network error. Please try again.');
      } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = 'Download JSON Export';
      }
    });
  }

  // --- Change password ---
  async function handleChangePassword(e) {
    e.preventDefault();
    setMessage(passwordMessage, '', null);

    const currentPw = currentPasswordInput.value.trim();
    const newPw = newPasswordInput.value;
    const confirmPw = confirmPasswordInput.value;

    if (!currentPw || !newPw || !confirmPw) {
      setMessage(passwordMessage, 'All fields are required.', 'error');
      return;
    }
    if (newPw.length < 6) {
      setMessage(passwordMessage, 'New password must be at least 6 characters.', 'error');
      return;
    }
    if (newPw !== confirmPw) {
      setMessage(passwordMessage, 'New passwords do not match.', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/user/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw })
      });

      if (res.ok) {
        setMessage(passwordMessage, 'Password changed successfully.', 'success');
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(passwordMessage, data.error || data.message || 'Current password is incorrect.', 'error');
      }
    } catch (err) {
      setMessage(passwordMessage, 'Network error. Please try again.', 'error');
    }
  }

  // --- Delete account ---
  function openDeleteModal() {
    if (!deleteModal || !deleteConfirmInput) return;
    deleteConfirmInput.value = '';
    deleteModal.style.display = 'flex';
    deleteConfirmInput.focus();
  }

  function closeDeleteModal() {
    if (deleteModal) deleteModal.style.display = 'none';
  }

  async function confirmDeleteAccount() {
    if (!deleteConfirmInput) return;
    if (deleteConfirmInput.value !== 'DELETE') {
      deleteConfirmInput.classList.add('input--error');
      return;
    }
    deleteConfirmInput.classList.remove('input--error');
    closeDeleteModal();

    try {
      const res = await fetch(`${API_BASE}/user/me`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        window.location.href = '/';
      } else {
        alert('Failed to delete account. Please try again.');
      }
    } catch (err) {
      alert('Network error. Please try again.');
    }
  }

  // --- Init ---
  function init() {
    initThemeToggle();
    initAccent();
    initFontSelector();
    initMotion();
    initDensity();
    initFocusMode();
    initLearningMode();
    initOsPref();
    initTypingPrefs();
    loadAccountDetails();
    initEmailEditor();
    initExport();

    if (changePasswordForm) {
      changePasswordForm.addEventListener('submit', handleChangePassword);
    }
    if (deleteAccountBtn) {
      deleteAccountBtn.addEventListener('click', openDeleteModal);
    }
    if (deleteCancelBtn) {
      deleteCancelBtn.addEventListener('click', closeDeleteModal);
    }
    if (deleteConfirmBtn) {
      deleteConfirmBtn.addEventListener('click', confirmDeleteAccount);
    }
    if (deleteModal) {
      deleteModal.addEventListener('click', function (e) {
        if (e.target === deleteModal) closeDeleteModal();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && deleteModal && deleteModal.style.display === 'flex') {
        closeDeleteModal();
      }
    });

    // Load server-side settings into the UI once auth resolves.
    if (window.auth) {
      window.auth.getMe().then(function () {
        loadAccountDetails();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();