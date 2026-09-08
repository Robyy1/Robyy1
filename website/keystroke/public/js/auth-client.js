// Keystroke — Client-Side Authentication
// Handles login, signup, logout, session persistence, and UI state.
//
// Auth is cookie-based: the server sets an httpOnly JWT in a `token` cookie.
// Because the cookie is httpOnly it can NOT be read from document.cookie, so
// auth state is detected by calling /api/auth/me (the browser sends the cookie
// automatically on same-origin requests with credentials: 'include').

(function () {
  'use strict';

  var TOKEN_KEY = 'token';
  var currentUser = null;

  // --- Token storage ---
  // The auth token lives in an httpOnly cookie set by the server, so we cannot
  // (and do not need to) read it from document.cookie. getToken is kept for
  // backwards compatibility but auth state is resolved via /api/auth/me instead.

  function getToken() {
    var match = document.cookie.match(new RegExp('(^| )' + TOKEN_KEY + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function clearToken() {
    // The cookie is httpOnly so we cannot clear it client-side; logout is
    // handled by the server route. This is a no-op fallback for safety.
    document.cookie = TOKEN_KEY + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;';
  }

  // --- API helpers ---

  function apiFetch(url, options) {
    options = options || {};
    options.credentials = 'include';
    if (!options.headers) options.headers = {};
    return fetch(url, options).then(function (res) {
      var contentType = res.headers.get('content-type');
      if (contentType && contentType.indexOf('application/json') !== -1) {
        return res.json().then(function (json) {
          if (!res.ok) {
            var err = new Error(json.error || 'Request failed');
            err.status = res.status;
            err.data = json;
            throw err;
          }
          return json;
        });
      }
      return res;
    });
  }

  // --- Auth actions ---

  function signup(username, email, password) {
    return apiFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, email: email, password: password })
    });
  }

  function login(emailOrUsername, password) {
    return apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrUsername: emailOrUsername, password: password })
    });
  }

  function logout() {
    return apiFetch('/api/auth/logout', { method: 'POST' }).then(function () {
      currentUser = null;
      clearToken();
      window.location.href = '/';
    }).catch(function () {
      currentUser = null;
      clearToken();
      window.location.href = '/';
    });
  }

  function getMe() {
    return apiFetch('/api/auth/me').then(function (data) {
      // The /me endpoint returns { user: {...} }; unwrap it.
      currentUser = (data && data.user) ? data.user : null;
      return currentUser;
    }).catch(function () {
      currentUser = null;
      return null;
    });
  }

  function isLoggedIn() {
    return !!currentUser;
  }

  function checkAuth() {
    return getMe();
  }

  // --- Validation ---

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validateUsername(username) {
    return username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(username);
  }

  function validatePassword(password) {
    return password.length >= 6;
  }

  function setFieldError(inputEl, errorEl, message) {
    if (inputEl) inputEl.classList.add('error');
    if (errorEl && message) errorEl.textContent = message;
  }

  function clearFieldError(inputEl, errorEl) {
    if (inputEl) inputEl.classList.remove('error');
    if (errorEl) errorEl.textContent = '';
  }

  // --- UI: Update navbar based on auth state ---

  function fitUsernameButton(el) {
    if (!el) return;
    var full = el.getAttribute('data-fullname') || el.textContent || '';
    if (!full) return;
    // Reset to base state
    el.textContent = full;
    el.style.fontSize = '13px';
    // If it already fits, we're done
    if (el.scrollWidth <= el.clientWidth) return;
    // Try shrinking font slightly (not too much per spec)
    var sizes = ['12.5px', '12px', '11.5px', '11px'];
    for (var i = 0; i < sizes.length; i++) {
      el.style.fontSize = sizes[i];
      if (el.scrollWidth <= el.clientWidth) return;
    }
    // Still overflows: truncate with ellipsis (keep font at smallest)
    el.style.fontSize = '11px';
    var text = full;
    while (text.length > 1 && el.scrollWidth > el.clientWidth) {
      text = text.slice(0, -1);
      el.textContent = text + '...';
    }
  }

  function updateNavbar(user) {
    var navUserArea = document.getElementById('nav-user-area');
    var navGuestArea = document.getElementById('nav-guest-area');
    // Legacy fallbacks: some old pages used different ids
    var legacyNavActions = document.getElementById('navActions');
    var legacyAuthLinks = document.getElementById('nav-auth-links');
    var hasModern = !!(navUserArea || navGuestArea);
    var hasLegacy = !!(legacyNavActions || legacyAuthLinks);

    if (!hasModern && !hasLegacy) return;

    if (user) {
      if (navUserArea) navUserArea.style.display = 'flex';
      if (navGuestArea) navGuestArea.style.display = 'none';
      var usernameEl = document.getElementById('nav-username');
      if (usernameEl) {
        usernameEl.setAttribute('data-fullname', user.username);
        usernameEl.setAttribute('title', user.username + ' — Open settings');
        // Ensure it's an anchor to settings
        if (usernameEl.tagName.toLowerCase() !== 'a') {
          usernameEl.setAttribute('href', '/settings.html');
        } else {
          usernameEl.href = '/settings.html';
        }
        usernameEl.textContent = user.username;
        // Fit after render
        requestAnimationFrame(function () {
          fitUsernameButton(usernameEl);
        });
        window.addEventListener('resize', function onResize() {
          fitUsernameButton(usernameEl);
        });
      }
      // Legacy: render into old containers if modern not present
      if (!hasModern && legacyNavActions) {
        legacyNavActions.innerHTML =
          '<a href="/settings.html" class="btn btn-primary navbar-username-btn" data-fullname="' + escapeHtml(user.username) + '" title="' + escapeHtml(user.username) + '">' + escapeHtml(user.username) + '</a>' +
          '<button type="button" class="btn btn-ghost logout-btn">Logout</button>';
        var fitted = legacyNavActions.querySelector('[data-fullname]');
        if (fitted) requestAnimationFrame(function () { fitUsernameButton(fitted); });
        var lb = legacyNavActions.querySelector('.logout-btn');
        if (lb) lb.addEventListener('click', function () { if (confirm('Are you sure you want to log out?')) logout(); });
      }
      if (!hasModern && legacyAuthLinks) {
        legacyAuthLinks.innerHTML = '<a href="/settings.html" class="btn btn-primary navbar-username-btn">' + escapeHtml(user.username) + '</a>';
      }
    } else {
      if (navUserArea) navUserArea.style.display = 'none';
      if (navGuestArea) navGuestArea.style.display = 'flex';
      if (!hasModern && legacyNavActions) {
        legacyNavActions.innerHTML =
          '<a href="/login.html" class="btn btn-ghost">Log in</a>' +
          '<a href="/signup.html" class="btn btn-primary">Sign up</a>';
      }
      if (!hasModern && legacyAuthLinks) {
        legacyAuthLinks.innerHTML = '<a href="/login.html" class="btn btn-ghost">Log in</a> <a href="/signup.html" class="btn btn-primary">Sign up</a>';
      }
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // --- Page-specific init ---

  function handleSignupPage() {
    var form = document.getElementById('signup-form');
    if (!form) return;

    var usernameInput = document.getElementById('signup-username');
    var emailInput = document.getElementById('signup-email');
    var passwordInput = document.getElementById('signup-password');
    var confirmInput = document.getElementById('signup-confirm');

    var usernameErr = document.getElementById('signup-username-error');
    var emailErr = document.getElementById('signup-email-error');
    var passwordErr = document.getElementById('signup-password-error');
    var confirmErr = document.getElementById('signup-confirm-error');
    var formMsg = document.getElementById('signup-form-msg');

    // Inline validation on blur
    usernameInput.addEventListener('blur', function () {
      if (usernameInput.value && !validateUsername(usernameInput.value)) {
        setFieldError(usernameInput, usernameErr, '3-20 chars. Letters, numbers, _ and - only.');
      } else {
        clearFieldError(usernameInput, usernameErr);
      }
    });

    emailInput.addEventListener('blur', function () {
      if (emailInput.value && !validateEmail(emailInput.value)) {
        setFieldError(emailInput, emailErr, 'Enter a valid email address.');
      } else {
        clearFieldError(emailInput, emailErr);
      }
    });

    passwordInput.addEventListener('blur', function () {
      if (passwordInput.value && !validatePassword(passwordInput.value)) {
        setFieldError(passwordInput, passwordErr, 'At least 6 characters.');
      } else {
        clearFieldError(passwordInput, passwordErr);
      }
    });

    confirmInput.addEventListener('blur', function () {
      if (confirmInput.value && confirmInput.value !== passwordInput.value) {
        setFieldError(confirmInput, confirmErr, 'Passwords do not match.');
      } else {
        clearFieldError(confirmInput, confirmErr);
      }
    });

    // Password visibility toggle
    var signupToggle = document.getElementById('signup-pass-toggle');
    if (signupToggle) {
      signupToggle.addEventListener('click', function () {
        var isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        confirmInput.type = isPassword ? 'text' : 'password';
        this.textContent = isPassword ? '\uD83D\uDE48' : '\uD83D\uDE4A';
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;

      if (!validateUsername(usernameInput.value)) {
        setFieldError(usernameInput, usernameErr, '3-20 chars. Letters, numbers, _ and - only.');
        valid = false;
      } else {
        clearFieldError(usernameInput, usernameErr);
      }

      if (!validateEmail(emailInput.value)) {
        setFieldError(emailInput, emailErr, 'Enter a valid email address.');
        valid = false;
      } else {
        clearFieldError(emailInput, emailErr);
      }

      if (!validatePassword(passwordInput.value)) {
        setFieldError(passwordInput, passwordErr, 'At least 6 characters.');
        valid = false;
      } else {
        clearFieldError(passwordInput, passwordErr);
      }

      if (passwordInput.value !== confirmInput.value) {
        setFieldError(confirmInput, confirmErr, 'Passwords do not match.');
        valid = false;
      } else {
        clearFieldError(confirmInput, confirmErr);
      }

      if (!valid) return;

      formMsg.className = 'alert alert-success';
      formMsg.textContent = '';

      signup(usernameInput.value, emailInput.value, passwordInput.value).then(function () {
        window.location.href = '/login.html?registered=1';
      }).catch(function (err) {
        formMsg.className = 'alert alert-error';
        formMsg.textContent = err.message || 'Signup failed. Try again.';
      });
    });
  }

  function handleLoginPage() {
    var form = document.getElementById('login-form');
    if (!form) return;

    var emailInput = document.getElementById('login-email');
    var passwordInput = document.getElementById('login-password');
    var emailErr = document.getElementById('login-email-error');
    var formMsg = document.getElementById('login-form-msg');

    // Password visibility toggle
    var passToggle = document.getElementById('login-pass-toggle');
    if (passToggle) {
      passToggle.addEventListener('click', function () {
        var isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        this.textContent = isPassword ? '\uD83D\uDE48' : '\uD83D\uDE4A';
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearFieldError(emailInput, emailErr);
      formMsg.className = 'alert alert-success';
      formMsg.textContent = '';

      login(emailInput.value, passwordInput.value).then(function () {
        // Redirect to home — dashboard.html is not built yet.
        window.location.href = '/';
      }).catch(function (err) {
        formMsg.className = 'alert alert-error';
        formMsg.textContent = err.message || 'Login failed. Check your credentials.';
      });
    });
  }

  function handleLogoutButton() {
    var logoutBtns = document.querySelectorAll('.logout-btn');
    for (var i = 0; i < logoutBtns.length; i++) {
      logoutBtns[i].addEventListener('click', function () {
        if (confirm('Are you sure you want to log out?')) {
          logout();
        }
      });
    }
  }

  // --- Protected route check ---

  function requireAuth(redirectUrl) {
    redirectUrl = redirectUrl || '/login.html';
    return getMe().then(function (user) {
      if (!user) {
        window.location.href = redirectUrl;
        return null;
      }
      updateNavbar(user);
      return user;
    });
  }

  // --- Redirect logged-in users away from auth pages ---

  function redirectToDashboardIfLoggedIn() {
    return getMe().then(function (user) {
      if (user) {
        window.location.href = '/';
      }
    });
  }

  // --- Init ---

  function init() {
    // Always verify the session via /api/auth/me (the cookie is httpOnly and
    // cannot be read from JS). This populates `currentUser` so isLoggedIn()
    // works and the navbar reflects the real auth state.
    getMe().then(function (user) {
      updateNavbar(user);
      onAuthReady(user);
    });

    handleSignupPage();
    handleLoginPage();
    handleLogoutButton();
  }

  function onAuthReady(user) {
    window.authUser = user;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API
  window.auth = {
    getToken: getToken,
    signup: signup,
    login: login,
    logout: logout,
    getMe: getMe,
    isLoggedIn: isLoggedIn,
    checkAuth: checkAuth,
    validateEmail: validateEmail,
    validateUsername: validateUsername,
    validatePassword: validatePassword,
    setFieldError: setFieldError,
    clearFieldError: clearFieldError,
    updateNavbar: updateNavbar,
    requireAuth: requireAuth,
    redirectToDashboardIfLoggedIn: redirectToDashboardIfLoggedIn,
    apiFetch: apiFetch
  };

})();
