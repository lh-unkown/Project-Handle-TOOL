/**
 * Gantt Chart Renderer for Project Follow-Up Tool
 * Renders interactive SVG/HTML timeline with dependency lines, summary brackets, milestones, and deadline indicators.
 */

class GanttRenderer {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.viewMode = options.viewMode || 'Day'; // 'Day', 'Week', 'Month'
    this.rowHeight = options.rowHeight || 36;
    this.dayWidth = options.dayWidth || 28; // width in px per day in Day view
    this.project = null;
    this.onTaskClick = options.onTaskClick || null;
    
    // Calculated bounds
    this.minDate = null;
    this.maxDate = null;
    this.totalDays = 0;
  }

  setProject(project, viewMode = null) {
    this.project = project;
    if (viewMode) this.viewMode = viewMode;
    this.render();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    if (mode === 'Day') this.dayWidth = 28;
    else if (mode === 'Week') this.dayWidth = 10;
    else if (mode === 'Month') this.dayWidth = 4;
    this.render();
  }

  parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(dateStr);
  }

  // Calculate project date bounds
  calculateDateBounds() {
    if (!this.project || !this.project.tasks || this.project.tasks.length === 0) {
      this.minDate = new Date();
      this.maxDate = new Date();
      this.maxDate.setDate(this.maxDate.getDate() + 30);
      return;
    }

    let min = null;
    let max = null;

    this.project.tasks.forEach(t => {
      if (t._computedStart) {
        if (!min || t._computedStart < min) min = new Date(t._computedStart);
      }
      if (t._computedFinish) {
        if (!max || t._computedFinish > max) max = new Date(t._computedFinish);
      }
    });

    if (!min) min = new Date();
    if (!max) max = new Date(min.getTime());

    // Pad start date by 3 days before and end date by 10 days after
    min.setDate(min.getDate() - 3);
    max.setDate(max.getDate() + 14);

    this.minDate = min;
    this.maxDate = max;

    const diffTime = Math.abs(this.maxDate - this.minDate);
    this.totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Get X coordinate for a specific date
  getXForDate(date) {
    if (!date || !this.minDate) return 0;
    const diffTime = date - this.minDate;
    const days = diffTime / (1000 * 60 * 60 * 24);
    return Math.max(0, days * this.dayWidth);
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    if (!this.project || !this.project.tasks || this.project.tasks.length === 0) {
      this.container.innerHTML = '<div class="p-8 text-center text-slate-400">No project tasks to display.</div>';
      return;
    }

    this.calculateDateBounds();

    const chartWidth = Math.max(this.container.clientWidth, this.totalDays * this.dayWidth);
    const visibleTasks = this.project.tasks.filter(t => t._visible !== false);
    const chartHeight = visibleTasks.length * this.rowHeight + 60; // 60px header

    // Wrapper container
    const wrapper = document.createElement('div');
    wrapper.className = 'gantt-wrapper relative overflow-x-auto select-none bg-slate-900 text-slate-200 border border-slate-700 rounded-lg shadow-inner';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';

    // Build Time Header HTML
    const headerHTML = this.buildHeaderHTML(chartWidth);
    
    // SVG overlay for bars, grid lines, dependency arrows, today marker
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', chartWidth);
    svg.setAttribute('height', chartHeight);
    svg.setAttribute('class', 'gantt-svg absolute left-0 top-0');

    // Render Grid Lines
    this.renderGridLines(svg, chartWidth, chartHeight);

    // Render Dependency Arrows
    this.renderDependencies(svg, visibleTasks);

    // Render Task Bars
    this.renderTaskBars(svg, visibleTasks);

    // Render Today Marker
    this.renderTodayMarker(svg, chartHeight);

    // Assembly
    const contentContainer = document.createElement('div');
    contentContainer.className = 'gantt-content-area relative';
    contentContainer.style.width = `${chartWidth}px`;
    contentContainer.style.height = `${chartHeight}px`;

    contentContainer.innerHTML = headerHTML;
    contentContainer.appendChild(svg);
    wrapper.appendChild(contentContainer);
    this.container.appendChild(wrapper);

    // Add interactivity tooltips
    this.attachEvents();
  }

  buildHeaderHTML(chartWidth) {
    let topHeader = '';
    let subHeader = '';

    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    let curr = new Date(this.minDate.getTime());

    if (this.viewMode === 'Day') {
      let currentMonthYear = '';
      let monthDaysCount = 0;
      let monthStartLeft = 0;
      let topHeadersArr = [];

      for (let i = 0; i < this.totalDays; i++) {
        const mName = curr.toLocaleString('default', { month: 'short', year: '2-digit' });
        const dayChar = days[curr.getDay()];
        const dayNum = curr.getDate();
        const isWeekend = curr.getDay() === 0 || curr.getDay() === 6;

        if (mName !== currentMonthYear) {
          if (currentMonthYear !== '') {
            topHeadersArr.push({ name: currentMonthYear, left: monthStartLeft, width: monthDaysCount * this.dayWidth });
          }
          currentMonthYear = mName;
          monthDaysCount = 0;
          monthStartLeft = i * this.dayWidth;
        }
        monthDaysCount++;

        const bgClass = isWeekend ? 'bg-slate-800/80 text-amber-400/70 font-semibold' : 'bg-slate-900/90 text-slate-300';
        subHeader += `<div class="absolute text-[11px] flex flex-col items-center justify-center border-r border-slate-700/60 ${bgClass}" style="left:${i * this.dayWidth}px; width:${this.dayWidth}px; height:28px;">
          <span>${dayChar}</span>
        </div>`;

        curr.setDate(curr.getDate() + 1);
      }
      topHeadersArr.push({ name: currentMonthYear, left: monthStartLeft, width: monthDaysCount * this.dayWidth });

      topHeadersArr.forEach(th => {
        topHeader += `<div class="absolute text-xs font-semibold text-cyan-400 border-r border-b border-slate-700 px-2 py-1 flex items-center bg-slate-800/90" style="left:${th.left}px; width:${th.width}px; height:28px;">
          ${th.name}
        </div>`;
      });
    } else if (this.viewMode === 'Week') {
      let weekStartLeft = 0;
      let weekCount = 0;
      
      for (let i = 0; i < this.totalDays; i += 7) {
        const wDate = new Date(curr.getTime());
        const wLabel = `${wDate.toLocaleString('default', { month: 'short' })} ${wDate.getDate()}, '${String(wDate.getFullYear()).slice(-2)}`;
        const wWidth = 7 * this.dayWidth;

        topHeader += `<div class="absolute text-xs font-semibold text-cyan-400 border-r border-b border-slate-700 px-2 py-1 bg-slate-800/90" style="left:${i * this.dayWidth}px; width:${wWidth}px; height:28px;">
          Week of ${wLabel}
        </div>`;

        subHeader += `<div class="absolute text-[10px] text-slate-400 border-r border-slate-700/60 px-1 py-1 bg-slate-900/90 flex items-center justify-center" style="left:${i * this.dayWidth}px; width:${wWidth}px; height:28px;">
          ${wLabel}
        </div>`;

        curr.setDate(curr.getDate() + 7);
      }
    } else {
      // Month view
      for (let i = 0; i < this.totalDays; i += 30) {
        const mDate = new Date(curr.getTime());
        const mLabel = mDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        const mWidth = 30 * this.dayWidth;

        topHeader += `<div class="absolute text-xs font-semibold text-cyan-400 border-r border-b border-slate-700 px-2 py-1 bg-slate-800/90" style="left:${i * this.dayWidth}px; width:${mWidth}px; height:56px; line-height:48px;">
          ${mLabel}
        </div>`;

        curr.setDate(curr.getDate() + 30);
      }
    }

    return `<div class="gantt-header sticky top-0 z-20 bg-slate-900 border-b border-slate-700 shadow-md" style="width:${chartWidth}px; height:56px;">
      <div class="relative w-full h-[28px]">${topHeader}</div>
      <div class="relative w-full h-[28px] top-[28px]">${subHeader}</div>
    </div>`;
  }

  renderGridLines(svg, chartWidth, chartHeight) {
    const headerOffset = 56;
    let curr = new Date(this.minDate.getTime());

    for (let i = 0; i < this.totalDays; i++) {
      const x = i * this.dayWidth;
      const isWeekend = curr.getDay() === 0 || curr.getDay() === 6;

      if (isWeekend && this.viewMode === 'Day') {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', headerOffset);
        rect.setAttribute('width', this.dayWidth);
        rect.setAttribute('height', chartHeight - headerOffset);
        rect.setAttribute('fill', 'rgba(30, 41, 59, 0.45)');
        svg.appendChild(rect);
      }

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', headerOffset);
      line.setAttribute('x2', x);
      line.setAttribute('y2', chartHeight);
      line.setAttribute('stroke', 'rgba(51, 65, 85, 0.35)');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);

      curr.setDate(curr.getDate() + 1);
    }

    // Horizontal row lines
    const visibleTasks = this.project.tasks.filter(t => t._visible !== false);
    visibleTasks.forEach((t, idx) => {
      const y = headerOffset + idx * this.rowHeight;
      const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hLine.setAttribute('x1', 0);
      hLine.setAttribute('y1', y);
      hLine.setAttribute('x2', chartWidth);
      hLine.setAttribute('y2', y);
      hLine.setAttribute('stroke', 'rgba(51, 65, 85, 0.4)');
      hLine.setAttribute('stroke-width', '1');
      svg.appendChild(hLine);
    });
  }

  renderTaskBars(svg, visibleTasks) {
    const headerOffset = 56;
    const taskPosMap = new Map();

    visibleTasks.forEach((t, idx) => {
      const y = headerOffset + idx * this.rowHeight;
      const startX = this.getXForDate(t._computedStart);
      const finishX = this.getXForDate(t._computedFinish);
      let barWidth = Math.max(finishX - startX, this.dayWidth * 0.8);

      taskPosMap.set(t.id, {
        x: startX,
        y: y + this.rowHeight / 2,
        startX: startX,
        endX: startX + barWidth,
        idx: idx
      });

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'gantt-task-group cursor-pointer hover:opacity-90');
      g.setAttribute('data-task-id', t.id);

      if (t.isSummary) {
        // Summary / Module Bracket Bar
        const barHeight = 12;
        const barY = y + (this.rowHeight - barHeight) / 2;

        // Parent Summary Bar (Dark charcoal/grey bar with end bracket hooks like MS Project)
        const summaryRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        summaryRect.setAttribute('x', startX);
        summaryRect.setAttribute('y', barY);
        summaryRect.setAttribute('width', barWidth);
        summaryRect.setAttribute('height', barHeight);
        summaryRect.setAttribute('fill', '#334155');
        summaryRect.setAttribute('rx', '2');
        g.appendChild(summaryRect);

        // Left bracket hook
        const leftBracket = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        leftBracket.setAttribute('d', `M ${startX} ${barY} L ${startX} ${barY + barHeight + 4} L ${startX + 5} ${barY + barHeight}`);
        leftBracket.setAttribute('fill', '#0f172a');
        g.appendChild(leftBracket);

        // Right bracket hook
        const rightBracket = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        rightBracket.setAttribute('d', `M ${startX + barWidth} ${barY} L ${startX + barWidth} ${barY + barHeight + 4} L ${startX + barWidth - 5} ${barY + barHeight}`);
        rightBracket.setAttribute('fill', '#0f172a');
        g.appendChild(rightBracket);

        // Summary Progress Fill
        if (t.progress > 0) {
          const progWidth = (barWidth * Math.min(100, t.progress)) / 100;
          const progRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          progRect.setAttribute('x', startX);
          progRect.setAttribute('y', barY + 2);
          progRect.setAttribute('width', progWidth);
          progRect.setAttribute('height', barHeight - 4);
          progRect.setAttribute('fill', '#38bdf8');
          g.appendChild(progRect);
        }
      } else if (t.duration === 0) {
        // Milestone Diamond
        const diamondSize = 12;
        const centerX = startX;
        const centerY = y + this.rowHeight / 2;
        const points = `${centerX},${centerY - diamondSize} ${centerX + diamondSize},${centerY} ${centerX},${centerY + diamondSize} ${centerX - diamondSize},${centerY}`;
        
        const milestone = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        milestone.setAttribute('points', points);
        milestone.setAttribute('fill', '#a855f7');
        milestone.setAttribute('stroke', '#c084fc');
        milestone.setAttribute('stroke-width', '1.5');
        g.appendChild(milestone);
      } else {
        // Standard Task Bar
        const barHeight = 18;
        const barY = y + (this.rowHeight - barHeight) / 2;
        const isOverdue = t.isOverdue;

        const mainColor = isOverdue ? '#ef4444' : (t.progress === 100 ? '#22c55e' : '#38bdf8');
        const strokeColor = isOverdue ? '#f87171' : (t.progress === 100 ? '#4ade80' : '#7dd3fc');

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', startX);
        rect.setAttribute('y', barY);
        rect.setAttribute('width', barWidth);
        rect.setAttribute('height', barHeight);
        rect.setAttribute('fill', mainColor);
        rect.setAttribute('fill-opacity', '0.85');
        rect.setAttribute('stroke', strokeColor);
        rect.setAttribute('stroke-width', '1');
        rect.setAttribute('rx', '4');
        g.appendChild(rect);

        // Inner Progress bar overlay
        if (t.progress > 0 && t.progress < 100) {
          const progWidth = (barWidth * t.progress) / 100;
          const progRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          progRect.setAttribute('x', startX);
          progRect.setAttribute('y', barY);
          progRect.setAttribute('width', progWidth);
          progRect.setAttribute('height', barHeight);
          progRect.setAttribute('fill', '#0284c7');
          progRect.setAttribute('rx', '4');
          g.appendChild(progRect);
        }
      }

      // Resource Names text label placed to the right of task bar
      if (t.resources) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', startX + barWidth + 8);
        text.setAttribute('y', y + this.rowHeight / 2 + 4);
        text.setAttribute('font-size', '11');
        text.setAttribute('fill', '#cbd5e1');
        text.setAttribute('font-weight', t.isSummary ? '600' : '400');
        text.textContent = t.resources;
        g.appendChild(text);
      }

      // Deadline Marker (Green downward arrow on deadline date)
      if (t.deadline) {
        const dDate = this.parseDate(t.deadline);
        if (dDate) {
          const deadlineX = this.getXForDate(dDate);
          const dArrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const dY = y + 4;
          // Down arrow icon path
          dArrow.setAttribute('d', `M ${deadlineX - 4} ${dY} L ${deadlineX + 4} ${dY} L ${deadlineX + 4} ${dY + 8} L ${deadlineX + 7} ${dY + 8} L ${deadlineX} ${dY + 16} L ${deadlineX - 7} ${dY + 8} L ${deadlineX - 4} ${dY + 8} Z`);
          dArrow.setAttribute('fill', t.isOverdue ? '#f87171' : '#4ade80');
          dArrow.setAttribute('stroke', '#0f172a');
          dArrow.setAttribute('stroke-width', '1');
          g.appendChild(dArrow);
        }
      }

      svg.appendChild(g);
    });

    this._taskPosMap = taskPosMap;
  }

  renderDependencies(svg, visibleTasks) {
    if (!this._taskPosMap) return;

    visibleTasks.forEach(t => {
      if (!t.predecessors) return;
      const predIds = String(t.predecessors).split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      const targetPos = this._taskPosMap.get(t.id);
      if (!targetPos) return;

      predIds.forEach(pId => {
        const sourcePos = this._taskPosMap.get(pId);
        if (!sourcePos) return;

        // Draw stepped dependency line from predecessor finish to task start
        const x1 = sourcePos.endX;
        const y1 = sourcePos.y;
        const x2 = targetPos.startX;
        const y2 = targetPos.y;

        const midX = x1 + Math.max((x2 - x1) / 2, 8);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const pathData = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#0284c7');
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('stroke-dasharray', '3,3');
        path.setAttribute('marker-end', 'url(#arrow)');

        svg.appendChild(path);
      });
    });

    // Define Arrow Marker in SVG
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svg.prepend(defs);
    }
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrow');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '6');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto-start-reverse');

    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    arrowPath.setAttribute('fill', '#0284c7');
    marker.appendChild(arrowPath);
    defs.appendChild(marker);
  }

  renderTodayMarker(svg, chartHeight) {
    const today = new Date();
    if (today >= this.minDate && today <= this.maxDate) {
      const todayX = this.getXForDate(today);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', todayX);
      line.setAttribute('y1', 56);
      line.setAttribute('x2', todayX);
      line.setAttribute('y2', chartHeight);
      line.setAttribute('stroke', '#10b981');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '4,4');
      svg.appendChild(line);

      // Today Label badge
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', todayX - 22);
      rect.setAttribute('y', 58);
      rect.setAttribute('width', 44);
      rect.setAttribute('height', 18);
      rect.setAttribute('fill', '#10b981');
      rect.setAttribute('rx', '3');
      svg.appendChild(rect);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', todayX);
      text.setAttribute('y', 71);
      text.setAttribute('font-size', '10');
      text.setAttribute('fill', '#0f172a');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = 'TODAY';
      svg.appendChild(text);
    }
  }

  attachEvents() {
    const taskGroups = this.container.querySelectorAll('.gantt-task-group');
    taskGroups.forEach(g => {
      g.addEventListener('click', (e) => {
        const taskId = parseInt(g.getAttribute('data-task-id'), 10);
        if (this.onTaskClick && !isNaN(taskId)) {
          const task = this.project.tasks.find(t => t.id === taskId);
          if (task) this.onTaskClick(task);
        }
      });
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GanttRenderer;
}
