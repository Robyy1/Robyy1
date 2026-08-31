// Keystroke — Dashboard Page Logic
// Loads user stats, renders WPM timeline chart, personal bests bar chart,
// recent results table, and activity streak visualization.

(function () {
  'use strict';

  var DASHBOARD_ELEMENTS = {};

  // --- DOM element cache ---
  function cacheElements() {
    DASHBOARD_ELEMENTS.wpmChartContainer = document.getElementById('dashboard-wpm-chart');
    DASHBOARD_ELEMENTS.personalBestsContainer = document.getElementById('dashboard-personal-bests');
    DASHBOARD_ELEMENTS.recentResultsTableBody = document.getElementById('dashboard-recent-results-body');
    DASHBOARD_ELEMENTS.streakChartContainer = document.getElementById('dashboard-streak-chart');
    DASHBOARD_ELEMENTS.dashboardLoading = document.getElementById('dashboard-loading');
    DASHBOARD_ELEMENTS.dashboardError = document.getElementById('dashboard-error');
    DASHBOARD_ELEMENTS.dashboardEmpty = document.getElementById('dashboard-empty');
    DASHBOARD_ELEMENTS.dashboardContent = document.getElementById('dashboard-content');
    DASHBOARD_ELEMENTS.overallStatsGrid = document.getElementById('overall-stats-grid');
    DASHBOARD_ELEMENTS.learningWidget = document.getElementById('dashboard-learning');
  }

  // --- Fetch user stats from API ---
  function loadDashboardData() {
    showLoading(true);
    hideError();
    hideEmpty();

    var authCookie = getAuthToken();
    var headers = {};
    if (authCookie) {
      headers['Authorization'] = 'Bearer ' + authCookie;
    }

    // Fetch both stats summary and raw results in parallel
    Promise.all([
      fetch('/api/results/me/stats', { method: 'GET', headers: headers, credentials: 'include' })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to load dashboard stats');
          return res.json();
        }),
      fetch('/api/results/me?limit=100', { method: 'GET', headers: headers, credentials: 'include' })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to load results history');
          return res.json();
        })
    ])
      .then(function ([statsData, resultsData]) {
        var results = resultsData.results || [];
        renderOverallStats(statsData.overall);
        renderWpmTimelineChart(statsData.wpmHistory || []);
        renderPersonalBests(results);
        renderRecentResults(results.slice(0, 10));
        renderStreakChart(results);
        loadLearningWidget();
        showLoading(false);

        if (results.length === 0) {
          showEmpty(true);
          if (DASHBOARD_ELEMENTS.dashboardContent) {
            DASHBOARD_ELEMENTS.dashboardContent.style.display = 'none';
          }
        } else {
          showEmpty(false);
          if (DASHBOARD_ELEMENTS.dashboardContent) {
            DASHBOARD_ELEMENTS.dashboardContent.style.display = 'block';
          }
        }
      })
      .catch(function (err) {
        console.error('[dashboard] Error loading data:', err.message);
        showError(err.message || 'Failed to load dashboard data.');
        showLoading(false);
      });
  }

  // --- Render overall stats summary cards ---
  function renderOverallStats(overall) {
    if (!DASHBOARD_ELEMENTS.overallStatsGrid) return;
    DASHBOARD_ELEMENTS.overallStatsGrid.innerHTML = '';

    var stats = [
      { label: 'Total Tests', value: overall.total_tests || 0, color: 'var(--text)' },
      { label: 'Best WPM', value: overall.best_wpm != null ? formatWPM(overall.best_wpm) : '—', color: getDifficultyColor(overall.best_wpm || 0) },
      { label: 'Avg WPM', value: overall.avg_wpm != null ? formatWPM(overall.avg_wpm) : '—', color: 'var(--text-muted)' },
      { label: 'Avg Accuracy', value: overall.avg_accuracy != null ? formatAccuracy(overall.avg_accuracy) + '%' : '—', color: getDifficultyColor(overall.avg_accuracy || 0) }
    ];

    for (var i = 0; i < stats.length; i++) {
      var statItem = document.createElement('div');
      statItem.className = 'stat-box';

      var statValueEl = document.createElement('div');
      statValueEl.className = 'stat-value';
      statValueEl.style.color = stats[i].color;
      statValueEl.textContent = stats[i].value;

      var statLabelEl = document.createElement('div');
      statLabelEl.className = 'stat-label';
      statLabelEl.textContent = stats[i].label;

      statItem.appendChild(statValueEl);
      statItem.appendChild(statLabelEl);
      DASHBOARD_ELEMENTS.overallStatsGrid.appendChild(statItem);
    }
  }

  // --- Render WPM timeline chart ---
  function renderWpmTimelineChart(wpmHistory) {
    if (!DASHBOARD_ELEMENTS.wpmChartContainer) return;

    if (!wpmHistory || wpmHistory.length < 2) {
      DASHBOARD_ELEMENTS.wpmChartContainer.innerHTML = '<p class="chart-empty">Complete more tests to see your WPM progress over time.</p>';
      return;
    }

    // Transform API data into chart-compatible format
    var chartData = [];
    for (var i = 0; i < wpmHistory.length; i++) {
      var entry = wpmHistory[i];
      var dateObj = new Date(entry.date);
      if (isNaN(dateObj.getTime())) continue;

      // Use sequential index as X axis since dates may not be evenly spaced
      chartData.push({
        x: i + 1,
        wpm: entry.wpm || 0
      });
    }

    if (chartData.length < 2) {
      DASHBOARD_ELEMENTS.wpmChartContainer.innerHTML = '<p class="chart-empty">Complete more tests to see your WPM progress over time.</p>';
      return;
    }

    stats.createLineChart(DASHBOARD_ELEMENTS.wpmChartContainer, chartData, {
      lineColor: 'var(--accent)',
      height: 280,
      dotRadius: '3'
    });
  }

  // --- Render personal bests bar chart by mode/language ---
  function renderPersonalBests(results) {
    if (!DASHBOARD_ELEMENTS.personalBestsContainer) return;

    if (!results || results.length === 0) {
      DASHBOARD_ELEMENTS.personalBestsContainer.innerHTML = '<p class="chart-empty">No personal bests yet.</p>';
      return;
    }

    // Find best WPM per mode/language combination
    var bestMap = {};
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var modeLabel = r.mode === 'code' ? 'Code: ' + (r.language || 'all') : 'General';
      var key = modeLabel;

      if (!bestMap[key] || r.wpm > bestMap[key]) {
        bestMap[key] = r.wpm;
      }
    }

    var barData = [];
    var colors = ['#F2C14E', '#4FD69C', '#5BA3F7', '#A78BFA', '#FF6B6B', '#E879A0', '#7DD3FC', '#FDBA74'];
    var keys = Object.keys(bestMap);

    // Sort by WPM descending, take top 8
    keys.sort(function (a, b) { return bestMap[b] - bestMap[a]; });
    for (var j = 0; j < Math.min(keys.length, 8); j++) {
      barData.push({
        label: keys[j],
        value: Math.round(bestMap[keys[j]]),
        color: colors[j % colors.length]
      });
    }

    if (barData.length === 0) {
      DASHBOARD_ELEMENTS.personalBestsContainer.innerHTML = '<p class="chart-empty">No personal bests yet.</p>';
      return;
    }

    stats.createBarChart(DASHBOARD_ELEMENTS.personalBestsContainer, barData, { height: Math.min(barData.length * 40 + 60, 450) });
  }

  // --- Render recent results table ---
  function renderRecentResults(results) {
    if (!DASHBOARD_ELEMENTS.recentResultsTableBody) return;
    DASHBOARD_ELEMENTS.recentResultsTableBody.innerHTML = '';

    if (!results || results.length === 0) {
      var emptyRow = document.createElement('tr');
      var emptyCell = document.createElement('td');
      emptyCell.colSpan = '6';
      emptyCell.className = 'empty-state-text';
      emptyCell.textContent = 'No results yet. Complete a typing test to see your history.';
      emptyRow.appendChild(emptyCell);
      DASHBOARD_ELEMENTS.recentResultsTableBody.appendChild(emptyRow);
      return;
    }

    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var row = document.createElement('tr');

      // Mode + Language cell
      var modeCell = document.createElement('td');
      if (r.mode === 'code') {
        var modeBadge = document.createElement('span');
        modeBadge.className = 'badge badge-accent';
        modeBadge.textContent = 'Code: ' + (r.language || '');
        modeCell.appendChild(modeBadge);
      } else {
        var genBadge = document.createElement('span');
        genBadge.className = 'badge badge-muted';
        genBadge.textContent = 'General';
        modeCell.appendChild(genBadge);
      }
      row.appendChild(modeCell);

      // Difficulty cell
      var diffCell = document.createElement('td');
      if (r.difficulty) {
        var diffBadge = document.createElement('span');
        diffBadge.className = 'badge badge-muted';
        diffBadge.textContent = r.difficulty.charAt(0).toUpperCase() + r.difficulty.slice(1);
        diffCell.appendChild(diffBadge);
      } else {
        diffCell.textContent = '—';
      }
      row.appendChild(diffCell);

      // WPM cell
      var wpmCell = document.createElement('td');
      var wpmValue = document.createElement('span');
      wpmValue.style.fontWeight = '700';
      wpmValue.style.color = getDifficultyColor(r.wpm || 0);
      wpmValue.textContent = formatWPM(r.wpm);
      wpmCell.appendChild(wpmValue);
      row.appendChild(wpmCell);

      // Accuracy cell
      var accCell = document.createElement('td');
      accCell.style.color = (r.accuracy >= 90) ? 'var(--success)' : (r.accuracy >= 75) ? 'var(--accent)' : 'var(--error)';
      accCell.textContent = r.accuracy != null ? formatAccuracy(r.accuracy) + '%' : '—';
      row.appendChild(accCell);

      // Duration cell
      var durCell = document.createElement('td');
      durCell.textContent = r.duration_seconds != null ? formatDuration(r.duration_seconds) : '—';
      row.appendChild(durCell);

      // Date cell
      var dateCell = document.createElement('td');
      dateCell.style.color = 'var(--text-muted)';
      if (r.created_at) {
        var dateObj = new Date(r.created_at);
        dateCell.textContent = formatDateRelative(dateObj);
      } else {
        dateCell.textContent = '—';
      }
      row.appendChild(dateCell);

      DASHBOARD_ELEMENTS.recentResultsTableBody.appendChild(row);
    }
  }

  // --- Render activity streak chart (GitHub-style heatmap) ---
  function renderStreakChart(results) {
    if (!DASHBOARD_ELEMENTS.streakChartContainer) return;

    if (!results || results.length === 0) {
      DASHBOARD_ELEMENTS.streakChartContainer.innerHTML = '<p class="chart-empty">No activity data yet.</p>';
      return;
    }

    // Build day-by-day count for last 35 days
    var now = new Date();
    now.setHours(23, 59, 59, 999);
    var streakData = [];

    for (var d = 34; d >= 0; d--) {
      var checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() - d);
      // Reset to start of day for comparison
      checkDate.setHours(0, 0, 0, 0);
      var nextDate = new Date(checkDate);
      nextDate.setDate(nextDate.getDate() + 1);

      var dateStr = checkDate.toISOString().split('T')[0];
      var dayCount = 0;

      for (var i = 0; i < results.length; i++) {
        if (results[i].created_at) {
          var resultDate = new Date(results[i].created_at);
          if (resultDate >= checkDate && resultDate < nextDate) {
            dayCount++;
          }
        }
      }

      streakData.push({
        date: dateStr,
        count: dayCount
      });
    }

    stats.createStreakChart(DASHBOARD_ELEMENTS.streakChartContainer, streakData, { cellSize: 14 });
  }

  // --- Render learning progress widget ---
  function loadLearningWidget() {
    if (!DASHBOARD_ELEMENTS.learningWidget) return;
    fetch('/api/courses', { credentials: 'include' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var summary = data.summary || {};
        DASHBOARD_ELEMENTS.learningWidget.innerHTML =
          '<div class="learning-widget-grid">' +
            '<div class="learning-widget-stat">' +
              '<span class="learning-widget-value">' + (summary.coursesStarted || 0) + '</span>' +
              '<span class="learning-widget-label">courses started</span>' +
            '</div>' +
            '<div class="learning-widget-stat">' +
              '<span class="learning-widget-value">' + (summary.lessonsCompleted || 0) + '</span>' +
              '<span class="learning-widget-label">lessons completed</span>' +
            '</div>' +
            '<div class="learning-widget-stat">' +
              '<span class="learning-widget-value">' + (summary.lessonsCompletedThisWeek || 0) + '</span>' +
              '<span class="learning-widget-label">this week</span>' +
            '</div>' +
          '</div>' +
          '<a href="/learning.html" class="btn btn-ghost btn-sm" style="margin-top:var(--space-3);">Continue learning</a>';
      })
      .catch(function () {
        DASHBOARD_ELEMENTS.learningWidget.innerHTML = '<p style="font-size: var(--font-size-sm); color: var(--text-muted);">Could not load learning progress.</p>';
      });
  }

  // --- UI state helpers ---
  function showLoading(show) {
    if (DASHBOARD_ELEMENTS.dashboardLoading) {
      DASHBOARD_ELEMENTS.dashboardLoading.style.display = show ? 'flex' : 'none';
    }
  }

  function showError(message) {
    if (DASHBOARD_ELEMENTS.dashboardError) {
      DASHBOARD_ELEMENTS.dashboardError.textContent = message;
      DASHBOARD_ELEMENTS.dashboardError.style.display = 'block';
    }
  }

  function hideError() {
    if (DASHBOARD_ELEMENTS.dashboardError) {
      DASHBOARD_ELEMENTS.dashboardError.style.display = 'none';
    }
  }

  function showEmpty(show) {
    if (DASHBOARD_ELEMENTS.dashboardEmpty) {
      DASHBOARD_ELEMENTS.dashboardEmpty.style.display = show ? 'block' : 'none';
    }
  }

  function hideEmpty() {
    if (DASHBOARD_ELEMENTS.dashboardEmpty) {
      DASHBOARD_ELEMENTS.dashboardEmpty.style.display = 'none';
    }
  }

  // --- Token helper ---
  function getAuthToken() {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i].trim();
      if (cookie.startsWith('token=')) {
        return cookie.substring(6);
      }
    }
    return null;
  }

  // --- Formatting helpers (duplicated from stats.js for standalone use) ---
  function formatWPM(wpm) {
    return Math.round(wpm || 0);
  }

  function formatAccuracy(accuracy) {
    return (accuracy != null ? accuracy : 0).toFixed(1);
  }

  function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0s';
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = Math.round(seconds % 60);
    if (h > 0) {
      return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
    } else if (m > 0) {
      return m + 'm ' + (s < 10 ? '0' : '') + s + 's';
    } else {
      return s + 's';
    }
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

    // For older dates, show the actual date
    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[date.getMonth()] + ' ' + date.getDate();
  }

  // --- Init ---
  function init() {
    cacheElements();

    // Require authentication before loading dashboard data
    auth.checkAuth().then(function (user) {
      if (!user) {
        window.location.href = '/login.html';
        return;
      }
      updateNavbar(user);
      loadDashboardData();
    }).catch(function () {
      window.location.href = '/login.html';
    });

    // Refresh button handler
    var refreshBtn = document.getElementById('dashboard-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        loadDashboardData();
      });
    }
  }

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

  // --- Expose for testing / external use ---
  window.dashboard = {
    loadDashboardData: loadDashboardData,
    renderOverallStats: renderOverallStats,
    renderWpmTimelineChart: renderWpmTimelineChart,
    renderPersonalBests: renderPersonalBests,
    renderRecentResults: renderRecentResults,
    renderStreakChart: renderStreakChart,
    loadLearningWidget: loadLearningWidget
  };

  // --- Boot ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
