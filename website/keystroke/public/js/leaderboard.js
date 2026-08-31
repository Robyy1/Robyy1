// Keystroke — Leaderboard Page Logic
// Fetches global top scores, renders filterable leaderboard with mode/language/period filters,
// and displays a bar chart of top scorers.

(function () {
  'use strict';

  var LEADERBOARD_ELEMENTS = {};
  var currentFilters = { mode: 'code', language: '', period: 'all' };

  // --- DOM element cache ---
  function cacheElements() {
    LEADERBOARD_ELEMENTS.modeFilter = document.getElementById('lb-mode-filter');
    LEADERBOARD_ELEMENTS.languageFilter = document.getElementById('lb-language-filter');
    LEADERBOARD_ELEMENTS.periodFilter = document.getElementById('lb-period-filter');
    LEADERBOARD_ENTRIES_TABLE_BODY = document.getElementById('leaderboard-entries-body');
    LEADERBOARD_ELEMENTS.chartContainer = document.getElementById('leaderboard-chart');
    LEADERBOARD_ELEMENTS.loadingEl = document.getElementById('leaderboard-loading');
    LEADERBOARD_ELEMENTS.errorEl = document.getElementById('leaderboard-error');
    LEADERBOARD_ELEMENTS.emptyEl = document.getElementById('leaderboard-empty');
    LEADERBOARD_ELEMENTS.contentEl = document.getElementById('leaderboard-content');
  }

  var LEADERBOARD_ENTRIES_TABLE_BODY;

  // --- Filter options ---
  var CODE_LANGUAGES = [
    { value: '', label: 'All Languages' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'sql', label: 'SQL' }
  ];

  var PERIODS = [
    { value: 'all', label: 'All Time' },
    { value: 'week', label: 'This Week' },
    { value: 'today', label: 'Today' }
  ];

  // --- Initialize filter dropdowns ---
  function initFilters() {
    if (!LEADERBOARD_ELEMENTS.languageFilter) return;

    LEADERBOARD_ELEMENTS.languageFilter.innerHTML = '';
    for (var i = 0; i < CODE_LANGUAGES.length; i++) {
      var opt = document.createElement('option');
      opt.value = CODE_LANGUAGES[i].value;
      opt.textContent = CODE_LANGUAGES[i].label;
      LEADERBOARD_ELEMENTS.languageFilter.appendChild(opt);
    }

    // Set initial filter value
    if (currentFilters.language) {
      LEADERBOARD_ELEMENTS.languageFilter.value = currentFilters.language;
    }
  }

  // --- Fetch leaderboard data from API ---
  function loadLeaderboard() {
    showLoading(true);
    hideError();
    hideEmpty();

    var params = new URLSearchParams();
    params.set('mode', currentFilters.mode);
    if (currentFilters.language) {
      params.set('language', currentFilters.language);
    }
    params.set('period', currentFilters.period || 'all');

    fetch('/api/leaderboard?' + params.toString(), { credentials: 'include' })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load leaderboard');
        return res.json();
      })
      .then(function (data) {
        var entries = data.entries || data.leaderboard || [];
        renderEntries(entries);
        renderChart(entries);
        showLoading(false);

        if (entries.length === 0) {
          showEmpty(true);
          if (LEADERBOARD_ELEMENTS.contentEl) LEADERBOARD_ELEMENTS.contentEl.style.display = 'none';
        } else {
          showEmpty(false);
          if (LEADERBOARD_ELEMENTS.contentEl) LEADERBOARD_ELEMENTS.contentEl.style.display = 'block';
        }
      })
      .catch(function (err) {
        console.error('[leaderboard] Error:', err.message);
        showError(err.message || 'Failed to load leaderboard data.');
        showLoading(false);
      });
  }

  // --- Render entries table ---
  function renderEntries(entries) {
    if (!LEADERBOARD_ENTRIES_TABLE_BODY) return;
    LEADERBOARD_ENTRIES_TABLE_BODY.innerHTML = '';

    if (!entries || entries.length === 0) {
      var emptyRow = document.createElement('tr');
      var emptyCell = document.createElement('td');
      emptyCell.colSpan = '5';
      emptyCell.className = 'empty-state-text';
      emptyCell.textContent = 'No results yet for this filter combination. Be the first!';
      emptyRow.appendChild(emptyCell);
      LEADERBOARD_ENTRIES_TABLE_BODY.appendChild(emptyRow);
      return;
    }

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var row = document.createElement('tr');

      // Rank cell
      var rankCell = document.createElement('td');
      var rankBadge = document.createElement('span');
      rankBadge.className = 'badge badge-muted';
      rankBadge.textContent = '#' + (i + 1);

      if (i === 0) {
        rankBadge.className = 'badge badge-accent';
        rankBadge.textContent = '#1';
      } else if (i === 1) {
        rankBadge.className = 'badge badge-muted';
        rankBadge.style.backgroundColor = 'rgba(192, 192, 192, 0.15)';
        rankBadge.style.color = '#C0C0C0';
        rankBadge.textContent = '#2';
      } else if (i === 2) {
        rankBadge.className = 'badge badge-muted';
        rankBadge.style.backgroundColor = 'rgba(205, 127, 50, 0.15)';
        rankBadge.style.color = '#CD7F32';
        rankBadge.textContent = '#3';
      }

      rankCell.appendChild(rankBadge);
      row.appendChild(rankCell);

      // Username cell
      var userCell = document.createElement('td');
      if (entry.username) {
        var usernameEl = document.createElement('span');
        usernameEl.style.fontWeight = '600';
        usernameEl.textContent = entry.username;
        userCell.appendChild(usernameEl);
      } else {
        userCell.textContent = 'Anonymous';
        userCell.style.color = 'var(--text-muted)';
      }
      row.appendChild(userCell);

      // WPM cell (main stat)
      var wpmCell = document.createElement('td');
      var wpmValue = document.createElement('span');
      wpmValue.style.fontWeight = '700';
      wpmValue.style.fontSize = 'var(--font-size-lg)';
      wpmValue.style.color = getDifficultyColor(entry.wpm || 0);
      wpmValue.textContent = formatWPM(entry.wpm);
      wpmCell.appendChild(wpmValue);
      row.appendChild(wpmCell);

      // Accuracy cell
      var accCell = document.createElement('td');
      accCell.style.color = (entry.accuracy >= 95) ? 'var(--success)' : (entry.accuracy >= 85) ? 'var(--accent)' : 'var(--error)';
      accCell.textContent = entry.accuracy != null ? formatAccuracy(entry.accuracy) + '%' : '—';
      row.appendChild(accCell);

      // Date cell
      var dateCell = document.createElement('td');
      dateCell.style.color = 'var(--text-muted)';
      if (entry.created_at) {
        dateCell.textContent = formatDateRelative(new Date(entry.created_at));
      } else {
        dateCell.textContent = '—';
      }
      row.appendChild(dateCell);

      LEADERBOARD_ENTRIES_TABLE_BODY.appendChild(row);
    }
  }

  // --- Render leaderboard chart (top scores bar chart) ---
  function renderChart(entries) {
    if (!LEADERBOARD_ELEMENTS.chartContainer) return;

    if (!entries || entries.length === 0) {
      LEADERBOARD_ELEMENTS.chartContainer.innerHTML = '<p class="chart-empty">No data to display.</p>';
      return;
    }

    stats.renderLeaderboardChart(LEADERBOARD_ELEMENTS.chartContainer, entries.slice(0, 15));
  }

  // --- UI state helpers ---
  function showLoading(show) {
    if (LEADERBOARD_ELEMENTS.loadingEl) {
      LEADERBOARD_ELEMENTS.loadingEl.style.display = show ? 'flex' : 'none';
    }
  }

  function showError(message) {
    if (LEADERBOARD_ELEMENTS.errorEl) {
      LEADERBOARD_ELEMENTS.errorEl.textContent = message;
      LEADERBOARD_ELEMENTS.errorEl.style.display = 'block';
    }
  }

  function hideError() {
    if (LEADERBOARD_ELEMENTS.errorEl) {
      LEADERBOARD_ELEMENTS.errorEl.style.display = 'none';
    }
  }

  function showEmpty(show) {
    if (LEADERBOARD_ELEMENTS.emptyEl) {
      LEADERBOARD_ELEMENTS.emptyEl.style.display = show ? 'block' : 'none';
    }
  }

  function hideEmpty() {
    if (LEADERBOARD_ELEMENTS.emptyEl) {
      LEADERBOARD_ELEMENTS.emptyEl.style.display = 'none';
    }
  }

  // --- Formatting helpers ---
  function formatWPM(wpm) {
    return Math.round(wpm || 0);
  }

  function formatAccuracy(accuracy) {
    return (accuracy != null ? accuracy : 0).toFixed(1);
  }

  function getDifficultyColor(wpm) {
    if (!wpm || wpm <= 0) return '#7D8B99';
    if (wpm < 25) return '#FF6B6B';
    if (wpm < 45) return '#F2C14E';
    if (wpm < 65) return '#4FD69C';
    if (wpm < 85) return '#5BA3F7';
    return '#A78BFA';
  }

  function formatDateRelative(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '—';
    var now = new Date();
    var diffMs = now.getTime() - date.getTime();
    var diffSec = Math.floor(diffMs / 1000);
    var diffMin = Math.floor(diffSec / 60);
    var diffHr = Math.floor(diffMin / 60);
    var diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return diffMin + 'm ago';
    if (diffHr < 24) return diffHr + 'h ago';
    if (diffDay < 7) return diffDay + 'd ago';

    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[date.getMonth()] + ' ' + date.getDate();
  }

  // --- Filter change handlers ---
  function onModeChange(e) {
    currentFilters.mode = e.target.value;
    // Reset language filter when switching modes (general/dictionary have no language)
    if (currentFilters.mode !== 'code') {
      currentFilters.language = '';
      LEADERBOARD_ELEMENTS.languageFilter.style.display = 'none';
    } else {
      LEADERBOARD_ELEMENTS.languageFilter.style.display = '';
    }
    loadLeaderboard();
  }

  function onLanguageChange(e) {
    currentFilters.language = e.target.value;
    loadLeaderboard();
  }

  function onPeriodChange(e) {
    currentFilters.period = e.target.value;
    loadLeaderboard();
  }

  // --- Navbar update ---
  function updateNavbar(user) {
    var navUserArea = document.getElementById('nav-user-area');
    var navGuestArea = document.getElementById('nav-guest-area');
    if (!navUserArea && !navGuestArea) return;

    if (user) {
      if (navUserArea) navUserArea.style.display = 'flex';
      if (navGuestArea) navGuestArea.style.display = 'none';
      var usernameEl = document.getElementById('nav-username');
      if (usernameEl) usernameEl.textContent = user.username;
    } else {
      if (navUserArea) navUserArea.style.display = 'none';
      if (navGuestArea) navGuestArea.style.display = 'flex';
    }
  }

  // --- Init ---
  function init() {
    cacheElements();
    initFilters();

    // Check auth — leaderboard is public but shows username for logged-in users
    auth.checkAuth().then(function (user) {
      updateNavbar(user);
    }).catch(function () {});

    // Attach filter event listeners
    if (LEADERBOARD_ELEMENTS.modeFilter) {
      LEADERBOARD_ELEMENTS.modeFilter.addEventListener('change', onModeChange);
    }
    if (LEADERBOARD_ELEMENTS.languageFilter) {
      LEADERBOARD_ELEMENTS.languageFilter.addEventListener('change', onLanguageChange);
    }
    if (LEADERBOARD_ELEMENTS.periodFilter) {
      LEADERBOARD_ELEMENTS.periodFilter.addEventListener('change', onPeriodChange);
    }

    // Load initial data
    loadLeaderboard();
  }

  // --- Expose for testing / external use ---
  window.leaderboard = {
    loadLeaderboard: loadLeaderboard,
    renderEntries: renderEntries,
    renderChart: renderChart
  };

  // --- Boot ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
