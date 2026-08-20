// settings.js — Settings page logic: theme toggle, font selector, account details, change password, delete account

(function () {
  'use strict';

  const API_BASE = '/api';

  // --- DOM references ---
  const themeToggle = document.getElementById('theme-toggle');
  const fontSelector = document.getElementById('font-selector');
  const fontPreview = document.getElementById('font-preview-text');
  const accountEmail = document.getElementById('account-email');
  const accountUsername = document.getElementById('account-username');
  const accountCreated = document.getElementById('account-created');
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

  // --- Theme toggle ---
  function initThemeToggle() {
    if (!themeToggle) return;
    const currentTheme = localStorage.getItem('keystroke-theme') || 'dark';
    themeToggle.checked = currentTheme === 'dark';
    updateTheme(currentTheme);

    themeToggle.addEventListener('change', async () => {
      const newTheme = themeToggle.checked ? 'dark' : 'light';
      updateTheme(newTheme);
      localStorage.setItem('keystroke-theme', newTheme);
      try {
        await fetch(`${API_BASE}/user/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ theme: newTheme })
        });
      } catch (e) { /* silent */ }
    });
  }

  function updateTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('theme-dark', theme === 'dark');
    document.body.classList.toggle('theme-light', theme === 'light');
  }

  // --- Font selector with live preview ---
  const FONTS = [
    { name: 'JetBrains Mono', value: 'jetbrains-mono' },
    { name: 'Fira Code', value: 'fira-code' },
    { name: 'Cascadia Code', value: 'cascadia-code' },
    { name: 'IBM Plex Mono', value: 'ibm-plex-mono' },
    { name: 'Source Code Pro', value: 'source-code-pro' }
  ];

  function initFontSelector() {
    if (!fontSelector) return;
    const savedFont = localStorage.getItem('keystroke-font') || 'jetbrains-mono';
    fontSelector.value = savedFont;
    applyFont(savedFont);

    // Load the selected Google Font for preview
    loadGoogleFont(savedFont);

    fontSelector.addEventListener('change', async () => {
      const chosen = fontSelector.value;
      applyFont(chosen);
      localStorage.setItem('keystroke-font', chosen);
      loadGoogleFont(chosen);
      try {
        await fetch(`${API_BASE}/user/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ fontPref: chosen })
        });
      } catch (e) { /* silent */ }
    });
  }

  function applyFont(fontValue) {
    document.documentElement.style.setProperty('--font-mono', `'${fontValue}', monospace`);
    if (fontPreview) {
      fontPreview.style.fontFamily = `'${fontValue}', monospace`;
    }
  }

  function loadGoogleFont(fontValue) {
    // Map font values to Google Fonts family names and weights
    const fontMap = {
      'jetbrains-mono': "JetBrains+Mono",
      'fira-code': "Fira+Code",
      'cascadia-code': "Cascadia+Code",
      'ibm-plex-mono': "IBM+Plex+Mono",
      'source-code-pro': "Source+Code+Pro"
    };
    const family = fontMap[fontValue];
    if (!family) return;

    // Avoid duplicate link elements
    if (document.querySelector(`link[href*="${family}"]`)) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700&display=swap`;
    link.onload = () => {
      if (fontPreview) {
        fontPreview.textContent = 'The quick brown fox jumps over the lazy dog. 0123456789 {}[]()';
      }
    };
    document.head.appendChild(link);
  }

  // --- Load account details ---
  async function loadAccountDetails() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
      if (!res.ok) {
        // User not logged in — show guest state
        if (accountEmail) accountEmail.textContent = 'Not logged in';
        if (accountUsername) accountUsername.textContent = 'Guest';
        return;
      }
      const user = await res.json();
      if (accountEmail) accountEmail.textContent = user.email || '';
      if (accountUsername) accountUsername.textContent = user.username || '';
      if (accountCreated && user.created_at) {
        const date = new Date(user.created_at);
        accountCreated.textContent = `Member since ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
      }
    } catch (e) {
      if (accountEmail) accountEmail.textContent = 'Unable to load';
    }
  }

  // --- Change password ---
  async function handleChangePassword(e) {
    e.preventDefault();
    passwordMessage.textContent = '';
    passwordMessage.className = 'settings-message';

    const currentPw = currentPasswordInput.value.trim();
    const newPw = newPasswordInput.value;
    const confirmPw = confirmPasswordInput.value;

    if (!currentPw || !newPw || !confirmPw) {
      setPasswordMessage('All fields are required.', 'error');
      return;
    }
    if (newPw.length < 6) {
      setPasswordMessage('New password must be at least 6 characters.', 'error');
      return;
    }
    if (newPw !== confirmPw) {
      setPasswordMessage('New passwords do not match.', 'error');
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
        setPasswordMessage('Password changed successfully.', 'success');
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
      } else {
        const data = await res.json().catch(() => ({}));
        setPasswordMessage(data.message || 'Current password is incorrect.', 'error');
      }
    } catch (err) {
      setPasswordMessage('Network error. Please try again.', 'error');
    }
  }

  function setPasswordMessage(text, type) {
    passwordMessage.textContent = text;
    passwordMessage.className = `settings-message settings-message--${type}`;
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
      const res = await fetch(`${API_BASE}/user/me`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        // Redirect to landing page after successful deletion
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
    initFontSelector();
    loadAccountDetails();

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

    // Close modal on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && deleteModal && deleteModal.style.display === 'flex') {
        closeDeleteModal();
      }
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
