// Keystroke — Stats & Chart Rendering
// WPM/accuracy math, chart rendering (hand-rolled SVG), and stat formatting utilities.

(function () {
  'use strict';

  // --- Constants ---
  var STANDARD_WORD_LENGTH = 5;
  var CHART_PADDING = { top: 20, right: 20, bottom: 40, left: 50 };
  var ANIMATION_DURATION = 600; // ms for chart transitions

  // --- Formatting utilities ---
  function formatWPM(wpm) {
    return Math.round(wpm || 0);
  }

  function formatAccuracy(accuracy) {
    return (accuracy != null ? accuracy : 0).toFixed(1);
  }

  function formatConsistency(consistency) {
    return (consistency != null ? consistency : 0).toFixed(0);
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

  function formatNumber(num) {
    if (num == null || isNaN(num)) return '—';
    return num.toLocaleString();
  }

  // --- Difficulty label from WPM ---
  function getDifficultyLabel(wpm) {
    if (!wpm || wpm <= 0) return 'novice';
    if (wpm < 25) return 'novice';
    if (wpm < 45) return 'beginner';
    if (wpm < 65) return 'intermediate';
    if (wpm < 85) return 'advanced';
    return 'expert';
  }

  function getDifficultyColor(wpm) {
    var label = getDifficultyLabel(wpm);
    var colors = {
      novice: '#FF6B6B',
      beginner: '#F2C14E',
      intermediate: '#4FD69C',
      advanced: '#5BA3F7',
      expert: '#A78BFA'
    };
    return colors[label] || '#7D8B99';
  }

  // --- Stat card rendering ---
  function renderStatCard(container, label, value, unit, color) {
    if (!container) return null;

    var card = document.createElement('div');
    card.className = 'stat-card';
    card.setAttribute('role', 'status');
    card.setAttribute('aria-label', label + ': ' + value);

    var statLabel = document.createElement('span');
    statLabel.className = 'stat-label';
    statLabel.textContent = label;

    var statValueWrap = document.createElement('div');
    statValueWrap.className = 'stat-value-wrap';

    var statValue = document.createElement('span');
    statValue.className = 'stat-value';
    statValue.style.color = color || 'var(--accent)';
    statValue.textContent = value;

    if (unit) {
      var statUnit = document.createElement('span');
      statUnit.className = 'stat-unit';
      statUnit.textContent = unit;
      statValueWrap.appendChild(statValue);
      statValueWrap.appendChild(statUnit);
    } else {
      statValueWrap.appendChild(statValue);
    }

    card.appendChild(statLabel);
    card.appendChild(statValueWrap);
    container.appendChild(card);
    return card;
  }

  // --- Results panel rendering ---
  function renderResultsPanel(container, metrics) {
    if (!container || !metrics) return null;

    var panel = document.createElement('div');
    panel.className = 'results-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Test results');

    // Title
    var title = document.createElement('h2');
    title.className = 'results-title';
    title.textContent = 'Results';
    panel.appendChild(title);

    // Stats grid
    var statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';

    renderStatCard(statsGrid, 'WPM', formatWPM(metrics.wpm), '', getDifficultyColor(metrics.wpm));
    renderStatCard(statsGrid, 'Raw WPM', formatWPM(metrics.rawWpm), '', 'var(--text-muted)');
    renderStatCard(statsGrid, 'Accuracy', formatAccuracy(metrics.accuracy), '%', metrics.accuracy >= 90 ? 'var(--success)' : metrics.accuracy >= 75 ? 'var(--accent)' : 'var(--error)');
    renderStatCard(statsGrid, 'Consistency', formatConsistency(metrics.consistency), '%', metrics.consistency >= 80 ? 'var(--success)' : metrics.consistency >= 60 ? 'var(--accent)' : 'var(--error)');
    renderStatCard(statsGrid, 'Errors', formatNumber(metrics.errorCount || 0), '', 'var(--error)');

    panel.appendChild(statsGrid);

    // Difficulty badge
    var diffBadge = document.createElement('div');
    diffBadge.className = 'difficulty-badge';
    diffBadge.style.backgroundColor = getDifficultyColor(metrics.wpm);
    diffBadge.textContent = getDifficultyLabel(metrics.wpm).toUpperCase();
    panel.appendChild(diffBadge);

    container.innerHTML = '';
    container.appendChild(panel);
    return panel;
  }

  // --- Hand-rolled SVG Line Chart (WPM over time) ---
  function createLineChart(container, dataPoints, options) {
    if (!container || !dataPoints || dataPoints.length < 2) {
      if (container) container.innerHTML = '<p class="chart-empty">No data to display yet.</p>';
      return null;
    }

    options = options || {};
    var width = container.clientWidth || 600;
    var height = options.height || 250;
    var chartWidth = width - CHART_PADDING.left - CHART_PADDING.right;
    var chartHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;

    // Clear previous content
    container.innerHTML = '';

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', options.title || 'WPM over time chart');
    svg.style.width = '100%';
    svg.style.height = 'auto';

    // Defs for gradients and patterns
    var defs = document.createElementNS(svgNS, 'defs');

    // Gradient for line fill
    var gradientId = 'chart-gradient-' + Date.now();
    var gradient = document.createElementNS(svgNS, 'linearGradient');
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('x1', '0');
    gradient.setAttribute('y1', '0');
    gradient.setAttribute('x2', '0');
    gradient.setAttribute('y2', '1');

    var stop1 = document.createElementNS(svgNS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', options.lineColor || '#F2C14E');
    stop1.setAttribute('stop-opacity', '0.3');

    var stop2 = document.createElementNS(svgNS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', options.lineColor || '#F2C14E');
    stop2.setAttribute('stop-opacity', '0.02');

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);

    // Clip path for animation
    var clipPathId = 'chart-clip-' + Date.now();
    var clipPath = document.createElementNS(svgNS, 'clipPath');
    clipPath.setAttribute('id', clipPathId);
    var clipRect = document.createElementNS(svgNS, 'rect');
    clipRect.setAttribute('x', CHART_PADDING.left);
    clipRect.setAttribute('y', CHART_PADDING.top);
    clipRect.setAttribute('width', chartWidth);
    clipRect.setAttribute('height', chartHeight);
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);

    svg.appendChild(defs);

    // Compute scales
    var maxWpm = 0;
    var maxX = 0;
    for (var i = 0; i < dataPoints.length; i++) {
      if (dataPoints[i].wpm > maxWpm) maxWpm = dataPoints[i].wpm;
      if (dataPoints[i].x > maxX) maxX = dataPoints[i].x;
    }

    // Add 10% headroom to Y axis
    var yMax = Math.max(maxWpm * 1.1, 10);
    var xMax = Math.max(maxX, 1);

    function scaleX(val) {
      return CHART_PADDING.left + (val / xMax) * chartWidth;
    }

    function scaleY(val) {
      return CHART_PADDING.top + chartHeight - (val / yMax) * chartHeight;
    }

    // Grid lines and Y-axis labels
    var gridGroup = document.createElementNS(svgNS, 'g');
    gridGroup.setAttribute('class', 'chart-grid');

    var yTicks = 5;
    for (var t = 0; t <= yTicks; t++) {
      var yVal = (yMax / yTicks) * t;
      var yPos = scaleY(yVal);

      // Horizontal grid line
      var gridLine = document.createElementNS(svgNS, 'line');
      gridLine.setAttribute('x1', CHART_PADDING.left);
      gridLine.setAttribute('y1', yPos);
      gridLine.setAttribute('x2', CHART_PADDING.left + chartWidth);
      gridLine.setAttribute('y2', yPos);
      gridLine.setAttribute('stroke', 'var(--border)');
      gridLine.setAttribute('stroke-width', '0.5');
      gridLine.setAttribute('stroke-dasharray', '4,4');
      gridGroup.appendChild(gridLine);

      // Y-axis label
      var yLabel = document.createElementNS(svgNS, 'text');
      yLabel.setAttribute('x', CHART_PADDING.left - 8);
      yLabel.setAttribute('y', yPos + 4);
      yLabel.setAttribute('text-anchor', 'end');
      yLabel.setAttribute('fill', 'var(--text-muted)');
      yLabel.setAttribute('font-size', '11');
      yLabel.setAttribute('font-family', 'monospace');
      yLabel.textContent = Math.round(yVal);
      gridGroup.appendChild(yLabel);
    }

    // X-axis labels (time markers)
    var xTicks = Math.min(dataPoints.length, 6);
    for (var xt = 0; xt <= xTicks; xt++) {
      var xVal = (xMax / xTicks) * xt;
      var xPos = scaleX(xVal);

      // Vertical grid line
      if (xt > 0) {
        var vGridLine = document.createElementNS(svgNS, 'line');
        vGridLine.setAttribute('x1', xPos);
        vGridLine.setAttribute('y1', CHART_PADDING.top);
        vGridLine.setAttribute('x2', xPos);
        vGridLine.setAttribute('y2', CHART_PADDING.top + chartHeight);
        vGridLine.setAttribute('stroke', 'var(--border)');
        vGridLine.setAttribute('stroke-width', '0.5');
        vGridLine.setAttribute('stroke-dasharray', '4,4');
        gridGroup.appendChild(vGridLine);
      }

      // X-axis label (seconds or minutes)
      var xLabel = document.createElementNS(svgNS, 'text');
      xLabel.setAttribute('x', xPos);
      xLabel.setAttribute('y', CHART_PADDING.top + chartHeight + 20);
      xLabel.setAttribute('text-anchor', 'middle');
      xLabel.setAttribute('fill', 'var(--text-muted)');
      xLabel.setAttribute('font-size', '11');
      xLabel.setAttribute('font-family', 'monospace');

      if (xVal >= 60) {
        xLabel.textContent = (xVal / 60).toFixed(1) + 'm';
      } else {
        xLabel.textContent = Math.round(xVal) + 's';
      }
      gridGroup.appendChild(xLabel);
    }

    svg.appendChild(gridGroup);

    // Axis labels
    var axisLabelsGroup = document.createElementNS(svgNS, 'g');

    var yTitle = document.createElementNS(svgNS, 'text');
    yTitle.setAttribute('x', -(CHART_PADDING.top + chartHeight / 2));
    yTitle.setAttribute('y', 14);
    yTitle.setAttribute('transform', 'rotate(-90)');
    yTitle.setAttribute('text-anchor', 'middle');
    yTitle.setAttribute('fill', 'var(--text-muted)');
    yTitle.setAttribute('font-size', '12');
    yTitle.textContent = 'WPM';
    axisLabelsGroup.appendChild(yTitle);

    var xTitle = document.createElementNS(svgNS, 'text');
    xTitle.setAttribute('x', CHART_PADDING.left + chartWidth / 2);
    xTitle.setAttribute('y', height - 4);
    xTitle.setAttribute('text-anchor', 'middle');
    xTitle.setAttribute('fill', 'var(--text-muted)');
    xTitle.setAttribute('font-size', '12');
    xTitle.textContent = 'Time';
    axisLabelsGroup.appendChild(xTitle);

    svg.appendChild(axisLabelsGroup);

    // Build path data for the line and fill area
    var linePathD = '';
    var fillPathD = '';
    var points = [];

    for (var p = 0; p < dataPoints.length; p++) {
      var px = scaleX(dataPoints[p].x);
      var py = scaleY(Math.max(0, dataPoints[p].wpm));
      points.push({ x: px, y: py });

      if (p === 0) {
        linePathD += 'M ' + px + ' ' + py;
        fillPathD += 'M ' + px + ' ' + scaleY(0);
      } else {
        // Smooth curve using cubic bezier
        var prev = points[p - 1];
        var cpx1 = prev.x + (px - prev.x) / 3;
        var cpy1 = prev.y;
        var cpx2 = px - (px - prev.x) / 3;
        var cpy2 = py;
        linePathD += ' C ' + cpx1 + ' ' + cpy1 + ', ' + cpx2 + ' ' + cpy2 + ', ' + px + ' ' + py;

        fillPathD += ' L ' + px + ' ' + py;
      }
    }

    // Fill area path (close the shape at bottom)
    if (points.length > 0) {
      var lastPt = points[points.length - 1];
      var firstPt = points[0];
      fillPathD += ' L ' + lastPt.x + ' ' + scaleY(0);
      // Close path along the bottom, then back to start
      fillPathD += ' Z';
    }

    // Draw fill area (behind line)
    var fillPath = document.createElementNS(svgNS, 'path');
    fillPath.setAttribute('d', fillPathD);
    fillPath.setAttribute('fill', 'url(#' + gradientId + ')');
    fillPath.setAttribute('clip-path', 'url(#' + clipPathId + ')');

    // Animate fill appearance
    var fillGroup = document.createElementNS(svgNS, 'g');
    fillGroup.setAttribute('clip-path', 'url(#' + clipPathId + ')');
    fillGroup.appendChild(fillPath);
    svg.appendChild(fillGroup);

    // Draw line path
    var linePath = document.createElementNS(svgNS, 'path');
    linePath.setAttribute('d', linePathD);
    linePath.setAttribute('fill', 'none');
    linePath.setAttribute('stroke', options.lineColor || '#F2C14E');
    linePath.setAttribute('stroke-width', '2.5');
    linePath.setAttribute('stroke-linecap', 'round');
    linePath.setAttribute('stroke-linejoin', 'round');

    // Animate stroke drawing
    var totalLength = 0;
    try {
      totalLength = linePath.getTotalLength();
    } catch (e) {
      totalLength = 2000;
    }
    linePath.setAttribute('stroke-dasharray', totalLength);
    linePath.setAttribute('stroke-dashoffset', totalLength);

    svg.appendChild(linePath);

    // Draw data point dots at each measurement
    var dotsGroup = document.createElementNS(svgNS, 'g');
    for (var d = 0; d < points.length; d++) {
      var dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', points[d].x);
      dot.setAttribute('cy', points[d].y);
      dot.setAttribute('r', options.dotRadius || '3');
      dot.setAttribute('fill', options.lineColor || '#F2C14E');
      dot.setAttribute('stroke', 'var(--surface)');
      dot.setAttribute('stroke-width', '1.5');
      dotsGroup.appendChild(dot);
    }
    svg.appendChild(dotsGroup);

    // Tooltip group (hidden by default)
    var tooltipGroup = document.createElementNS(svgNS, 'g');
    tooltipGroup.setAttribute('class', 'chart-tooltip');
    tooltipGroup.style.display = 'none';

    var tooltipRect = document.createElementNS(svgNS, 'rect');
    tooltipRect.setAttribute('rx', '4');
    tooltipRect.setAttribute('ry', '4');
    tooltipRect.setAttribute('fill', 'var(--surface-raised)');
    tooltipRect.setAttribute('stroke', 'var(--border)');
    tooltipRect.setAttribute('stroke-width', '1');
    tooltipGroup.appendChild(tooltipRect);

    var tooltipText = document.createElementNS(svgNS, 'text');
    tooltipText.setAttribute('fill', 'var(--text)');
    tooltipText.setAttribute('font-size', '12');
    tooltipText.setAttribute('font-family', 'monospace');
    tooltipGroup.appendChild(tooltipText);

    svg.appendChild(tooltipGroup);
    container.appendChild(svg);

    // --- Animation ---
    var startTime = null;
    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / ANIMATION_DURATION, 1);
      // Ease out cubic
      var eased = 1 - Math.pow(1 - progress, 3);

      linePath.setAttribute('stroke-dashoffset', totalLength * (1 - eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Remove animation attributes after completion
        linePath.removeAttribute('stroke-dasharray');
        linePath.removeAttribute('stroke-dashoffset');
      }
    }
    requestAnimationFrame(animate);

    // --- Tooltip interaction ---
    svg.addEventListener('mousemove', function (e) {
      var rect = svg.getBoundingClientRect();
      var mouseX = ((e.clientX - rect.left) / rect.width) * width;
      var mouseY = ((e.clientY - rect.top) / rect.height) * height;

      // Find nearest data point
      var closestIdx = -1;
      var closestDist = Infinity;
      for (var ci = 0; ci < points.length; ci++) {
        var dist = Math.abs(points[ci].x - mouseX);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = ci;
        }
      }

      if (closestIdx >= 0 && closestDist < 30) {
        var cp = points[closestIdx];
        var dataPt = dataPoints[closestIdx];

        tooltipGroup.style.display = '';
        tooltipRect.setAttribute('x', cp.x + 10);
        tooltipRect.setAttribute('y', cp.y - 45);
        tooltipRect.setAttribute('width', '120');
        tooltipRect.setAttribute('height', '36');

        tooltipText.setAttribute('x', cp.x + 18);
        tooltipText.setAttribute('y', cp.y - 28);
        tooltipText.textContent = dataPt.wpm + ' WPM';

        // Keep tooltip within bounds
        if (cp.x + 130 > width) {
          tooltipRect.setAttribute('x', cp.x - 130);
          tooltipText.setAttribute('x', cp.x - 122);
        }
      } else {
        tooltipGroup.style.display = 'none';
      }
    });

    svg.addEventListener('mouseleave', function () {
      tooltipGroup.style.display = 'none';
    });

    return { svg: svg, points: points };
  }

  // --- Bar chart for personal bests by mode/language ---
  function createBarChart(container, data, options) {
    if (!container || !data || data.length === 0) {
      if (container) container.innerHTML = '<p class="chart-empty">No data to display yet.</p>';
      return null;
    }

    options = options || {};
    var width = container.clientWidth || 600;
    var height = options.height || 250;
    var chartWidth = width - CHART_PADDING.left - CHART_PADDING.right;
    var chartHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;

    container.innerHTML = '';

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.style.width = '100%';
    svg.style.height = 'auto';

    var maxVal = 0;
    for (var i = 0; i < data.length; i++) {
      if (data[i].value > maxVal) maxVal = data[i].value;
    }
    var yMax = Math.max(maxVal * 1.2, 10);

    function scaleY(val) {
      return CHART_PADDING.top + chartHeight - (val / yMax) * chartHeight;
    }

    // Grid lines
    var gridGroup = document.createElementNS(svgNS, 'g');
    var yTicks = 5;
    for (var t = 0; t <= yTicks; t++) {
      var yVal = (yMax / yTicks) * t;
      var yPos = scaleY(yVal);

      var gridLine = document.createElementNS(svgNS, 'line');
      gridLine.setAttribute('x1', CHART_PADDING.left);
      gridLine.setAttribute('y1', yPos);
      gridLine.setAttribute('x2', CHART_PADDING.left + chartWidth);
      gridLine.setAttribute('y2', yPos);
      gridLine.setAttribute('stroke', 'var(--border)');
      gridLine.setAttribute('stroke-width', '0.5');
      gridLine.setAttribute('stroke-dasharray', '4,4');
      gridGroup.appendChild(gridLine);

      var yLabel = document.createElementNS(svgNS, 'text');
      yLabel.setAttribute('x', CHART_PADDING.left - 8);
      yLabel.setAttribute('y', yPos + 4);
      yLabel.setAttribute('text-anchor', 'end');
      yLabel.setAttribute('fill', 'var(--text-muted)');
      yLabel.setAttribute('font-size', '11');
      yLabel.setAttribute('font-family', 'monospace');
      yLabel.textContent = Math.round(yVal);
      gridGroup.appendChild(yLabel);
    }
    svg.appendChild(gridGroup);

    // Bars
    var barWidth = Math.min(chartWidth / data.length * 0.6, 50);
    var barGap = chartWidth / data.length;
    var barsGroup = document.createElementNS(svgNS, 'g');

    for (var b = 0; b < data.length; b++) {
      var barX = CHART_PADDING.left + b * barGap + (barGap - barWidth) / 2;
      var barH = (data[b].value / yMax) * chartHeight;
      var barY = CHART_PADDING.top + chartHeight - barH;

      var bar = document.createElementNS(svgNS, 'rect');
      bar.setAttribute('x', barX);
      bar.setAttribute('y', barY);
      bar.setAttribute('width', barWidth);
      bar.setAttribute('height', Math.max(barH, 0));
      bar.setAttribute('rx', '3');
      bar.setAttribute('fill', data[b].color || options.barColor || '#F2C14E');
      bar.setAttribute('class', 'bar-item');

      // Animate bar growth
      bar.setAttribute('height', '0');
      bar.setAttribute('y', CHART_PADDING.top + chartHeight);

      barsGroup.appendChild(bar);

      // Label below bar
      var label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', barX + barWidth / 2);
      label.setAttribute('y', CHART_PADDING.top + chartHeight + 18);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', 'var(--text-muted)');
      label.setAttribute('font-size', '10');
      label.setAttribute('font-family', 'monospace');

      // Truncate long labels
      var labelText = data[b].label || '';
      if (labelText.length > 8) {
        labelText = labelText.substring(0, 7) + '…';
      }
      label.textContent = labelText;
      barsGroup.appendChild(label);

      // Value on top of bar
      var valLabel = document.createElementNS(svgNS, 'text');
      valLabel.setAttribute('x', barX + barWidth / 2);
      valLabel.setAttribute('y', barY - 5);
      valLabel.setAttribute('text-anchor', 'middle');
      valLabel.setAttribute('fill', data[b].color || options.barColor || '#F2C14E');
      valLabel.setAttribute('font-size', '11');
      valLabel.setAttribute('font-family', 'monospace');
      valLabel.textContent = Math.round(data[b].value);
      barsGroup.appendChild(valLabel);
    }

    svg.appendChild(barsGroup);

    // Animate bars growing up
    var startTime = null;
    function animateBars(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / ANIMATION_DURATION, 1);
      var eased = 1 - Math.pow(1 - progress, 3);

      var bars = barsGroup.querySelectorAll('.bar-item');
      for (var bi = 0; bi < bars.length; bi++) {
        var originalH = 0;
        if (bi < data.length) {
          originalH = (data[bi].value / yMax) * chartHeight;
        }
        bars[bi].setAttribute('height', String(originalH * eased));
        bars[bi].setAttribute('y', String(CHART_PADDING.top + chartHeight - originalH * eased));

        // Update value label position
        var valLabels = barsGroup.querySelectorAll('text');
        var valIdx = bi;
        if (valIdx < valLabels.length) {
          valLabels[valIdx].setAttribute('y', String(CHART_PADDING.top + chartHeight - originalH * eased - 5));
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animateBars);
      }
    }
    requestAnimationFrame(animateBars);

    container.appendChild(svg);
    return { svg: svg };
  }

  // --- Activity streak visualization ---
  function createStreakChart(container, daysData, options) {
    if (!container || !daysData || daysData.length === 0) {
      if (container) container.innerHTML = '<p class="chart-empty">No activity data yet.</p>';
      return null;
    }

    options = options || {};
    var cols = Math.min(daysData.length, 365);
    var rows = 7;
    var cellSize = options.cellSize || 12;
    var gap = 2;
    var width = cols * (cellSize + gap) + CHART_PADDING.left + CHART_PADDING.right;
    var height = rows * (cellSize + gap) + CHART_PADDING.top + CHART_PADDING.bottom + 30;

    container.innerHTML = '';

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.style.width = '100%';
    svg.style.height = 'auto';

    var levels = [0, 1, 3, 6, 10]; // thresholds for color intensity
    function getColor(count) {
      if (count <= 0) return 'var(--border)';
      for (var li = levels.length - 1; li >= 0; li--) {
        if (count >= levels[li]) {
          var colors = ['var(--success)', '#2D9F7A', '#1FA97C', '#4FD69C'];
          return colors[Math.min(li, colors.length - 1)];
        }
      }
      return 'var(--border)';
    }

    // Offset: start from the most recent day, going backwards
    var offset = options.offset || 0;
    var startX = CHART_PADDING.left;
    var startY = CHART_PADDING.top;

    for (var d = 0; d < cols; d++) {
      for (var r = 0; r < rows; r++) {
        var dataIdx = offset + d * rows + r;
        if (dataIdx >= daysData.length) continue;

        var dayData = daysData[dataIdx];
        var count = dayData ? (dayData.count || 0) : 0;

        var cell = document.createElementNS(svgNS, 'rect');
        cell.setAttribute('x', startX + d * (cellSize + gap));
        cell.setAttribute('y', startY + r * (cellSize + gap));
        cell.setAttribute('width', cellSize);
        cell.setAttribute('height', cellSize);
        cell.setAttribute('rx', '2');
        cell.setAttribute('fill', getColor(count));
        cell.setAttribute('class', 'streak-cell');

        // Tooltip via title
        var title = document.createElementNS(svgNS, 'title');
        var dateStr = dayData ? dayData.date : '';
        title.textContent = dateStr + ': ' + count + ' test' + (count !== 1 ? 's' : '');
        cell.appendChild(title);

        svg.appendChild(cell);
      }
    }

    // Legend
    var legendY = startY + rows * (cellSize + gap) + 10;
    var legendLabels = ['Less', 'More'];
    for (var ll = 0; ll < legendLabels.length; ll++) {
      var lx = startX + (ll === 0 ? 0 : cols * (cellSize + gap) / 2);
      var cellColor = document.createElementNS(svgNS, 'rect');
      cellColor.setAttribute('x', lx - 30);
      cellColor.setAttribute('y', legendY);
      cellColor.setAttribute('width', '8');
      cellColor.setAttribute('height', '8');
      cellColor.setAttribute('rx', '1');
      cellColor.setAttribute('fill', ll === 0 ? 'var(--border)' : 'var(--success)');
      svg.appendChild(cellColor);

      var labelText = document.createElementNS(svgNS, 'text');
      labelText.setAttribute('x', lx - 18);
      labelText.setAttribute('y', legendY + 8);
      labelText.setAttribute('fill', 'var(--text-muted)');
      labelText.setAttribute('font-size', '10');
      labelText.textContent = legendLabels[ll];
      svg.appendChild(labelText);
    }

    container.appendChild(svg);
    return { svg: svg };
  }

  // --- Fetch and render dashboard stats ---
  function loadDashboardStats(userId, callback) {
    var authCookie = getAuthCookie();
    var headers = {};
    if (authCookie) {
      headers['Authorization'] = 'Bearer ' + authCookie.token;
    }

    fetch('/api/results/me?limit=100', {
      method: 'GET',
      headers: headers
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load results');
        return res.json();
      })
      .then(function (data) {
        var results = data.results || [];
        callback(null, processResultsForDashboard(results));
      })
      .catch(function (err) {
        callback(err, null);
      });
  }

  function getAuthCookie() {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i].trim();
      if (cookie.startsWith('token=')) {
        return { token: cookie.substring(6) };
      }
    }
    return null;
  }

  function processResultsForDashboard(results) {
    if (!results || results.length === 0) {
      return { wpmTimeline: [], personalBests: [], recentResults: [], streakData: [] };
    }

    // Sort by date ascending for timeline
    var sorted = results.slice().sort(function (a, b) {
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    // WPM timeline: aggregate into time buckets (per day or per session)
    var wpmTimeline = [];
    for (var i = 0; i < sorted.length; i++) {
      var date = new Date(sorted[i].created_at);
      wpmTimeline.push({
        x: Math.floor((date.getTime() - new Date(sorted[0].created_at).getTime()) / 1000),
        wpm: sorted[i].wpm || 0,
        accuracy: sorted[i].accuracy || 0,
        date: date.toISOString().split('T')[0]
      });
    }

    // Personal bests by mode/language
    var bestMap = {};
    for (var j = 0; j < sorted.length; j++) {
      var r = sorted[j];
      var key = (r.mode === 'code' ? 'Code: ' + (r.language || 'all') : 'General') + ' — ' + getDifficultyLabel(r.wpm);
      if (!bestMap[key] || r.wpm > bestMap[key].wpm) {
        bestMap[key] = { wpm: r.wpm, mode: r.mode, language: r.language };
      }
    }

    var personalBests = [];
    var bestColors = ['#F2C14E', '#4FD69C', '#5BA3F7', '#A78BFA', '#FF6B6B'];
    var bestKeys = Object.keys(bestMap);
    for (var bk = 0; bk < bestKeys.length && bk < 8; bk++) {
      personalBests.push({
        label: bestKeys[bk],
        value: Math.round(bestMap[bestKeys[bk]].wpm),
        color: bestColors[bk % bestColors.length]
      });
    }

    // Recent results (last 10, descending)
    var recentResults = sorted.slice(-10).reverse();

    // Streak data: last N days with test counts
    var streakData = [];
    var now = new Date();
    for (var sd = 29; sd >= 0; sd--) {
      var checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() - sd);
      var dateStr = checkDate.toISOString().split('T')[0];
      var dayResults = sorted.filter(function (r) {
        return r.created_at && r.created_at.split('T')[0] === dateStr;
      });
      streakData.push({
        date: dateStr,
        count: dayResults.length
      });
    }

    return {
      wpmTimeline: wpmTimeline,
      personalBests: personalBests,
      recentResults: recentResults,
      streakData: streakData
    };
  }

  // --- Render leaderboard chart (top scores) ---
  function renderLeaderboardChart(container, entries, options) {
    if (!container || !entries || entries.length === 0) return null;

    options = options || {};
    var maxWpm = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].wpm > maxWpm) maxWpm = entries[i].wpm;
    }

    var barData = [];
    for (var ei = 0; ei < Math.min(entries.length, 15); ei++) {
      var entry = entries[ei];
      barData.push({
        label: (entry.username || 'Anonymous').substring(0, 12),
        value: entry.wpm || 0,
        color: '#F2C14E'
      });
    }

    return createBarChart(container, barData, { barColor: '#F2C14E', height: Math.min(entries.length * 35 + 60, 500) });
  }

  // --- Expose public API ---
  window.stats = {
    formatWPM: formatWPM,
    formatAccuracy: formatAccuracy,
    formatConsistency: formatConsistency,
    formatDuration: formatDuration,
    formatNumber: formatNumber,
    getDifficultyLabel: getDifficultyLabel,
    getDifficultyColor: getDifficultyColor,
    renderStatCard: renderStatCard,
    renderResultsPanel: renderResultsPanel,
    createLineChart: createLineChart,
    createBarChart: createBarChart,
    createStreakChart: createStreakChart,
    loadDashboardStats: loadDashboardStats,
    processResultsForDashboard: processResultsForDashboard,
    renderLeaderboardChart: renderLeaderboardChart
  };

})();
