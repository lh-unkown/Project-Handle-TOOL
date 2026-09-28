/**
 * Auto-Scheduling Engine for Project Follow-Up Tool
 * Handles predecessor dependency graphs, working day calculations, and summary rollups.
 */

class ProjectScheduler {
  constructor(options = {}) {
    this.skipWeekends = options.skipWeekends !== undefined ? options.skipWeekends : true;
  }

  // Parse YYYY-MM-DD string to Date object (local midnight)
  parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return new Date(dateStr);
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  // Format Date object to YYYY-MM-DD
  formatDate(date) {
    if (!date || isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Format Date to short display (e.g. Fri 9/18/26)
  formatDisplayDate(date) {
    if (!date || isNaN(date.getTime())) return '';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[date.getDay()];
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const y = String(date.getFullYear()).slice(-2);
    return `${dayName} ${m}/${d}/${y}`;
  }

  // Check if date is a working day
  isWorkDay(date) {
    if (!this.skipWeekends) return true;
    const day = date.getDay();
    return day !== 0 && day !== 6; // 0 = Sun, 6 = Sat
  }

  // Add N working days to a start date
  addWorkingDays(startDate, durationDays) {
    let current = new Date(startDate.getTime());
    
    // Milestone or 0 duration
    if (durationDays <= 0) {
      return new Date(current.getTime());
    }

    // Handle fractional days (e.g. 0.5 day)
    let wholeDays = Math.floor(durationDays);
    let fractional = durationDays - wholeDays;

    // Ensure start date is on a working day
    while (!this.isWorkDay(current)) {
      current.setDate(current.getDate() + 1);
    }

    // For 1 full day, start and finish are the same working day if task starts in morning
    // In MS Project: 1 day task starting Fri ends Fri.
    let remainingDays = wholeDays - 1;
    if (remainingDays < 0) remainingDays = 0; // for < 1 day

    while (remainingDays > 0) {
      current.setDate(current.getDate() + 1);
      if (this.isWorkDay(current)) {
        remainingDays--;
      }
    }

    // If fractional day exists, check end day
    if (fractional > 0 && wholeDays === 0) {
      // e.g. 0.5 day stays on same start day
    }

    return current;
  }

  // Find next valid working day on or after given date
  getNextWorkingDay(date) {
    let current = new Date(date.getTime());
    while (!this.isWorkDay(current)) {
      current.setDate(current.getDate() + 1);
    }
    return current;
  }

  // Calculate working days count between two dates inclusive
  getWorkingDaysCount(start, finish) {
    if (!start || !finish || start > finish) return 0;
    let count = 0;
    let curr = new Date(start.getTime());
    while (curr <= finish) {
      if (this.isWorkDay(curr)) count++;
      curr.setDate(curr.getDate() + 1);
    }
    return count;
  }

  /**
   * Recalculate full project schedule given tasks array and project start date
   */
  scheduleProject(project) {
    if (!project || !project.tasks || project.tasks.length === 0) return project;

    const baseStartDate = this.parseDate(project.startDate) || new Date();
    const taskMap = new Map();
    project.tasks.forEach(t => taskMap.set(t.id, t));

    // Reset dates for auto-scheduling
    project.tasks.forEach(task => {
      task._computedStart = null;
      task._computedFinish = null;
      task._calculatedDuration = task.duration || 0;
    });

    // Determine parent-child hierarchy
    let currentParents = [];
    project.tasks.forEach(task => {
      // Maintain parent pointers based on WBS levels
      while (currentParents.length > 0 && currentParents[currentParents.length - 1].level >= task.level) {
        currentParents.pop();
      }
      task._parent = currentParents.length > 0 ? currentParents[currentParents.length - 1] : null;
      if (task.isSummary) {
        currentParents.push(task);
      }
    });

    // Compute non-summary tasks first via topological dependency order
    const leafTasks = project.tasks.filter(t => !t.isSummary);
    
    // Dependency calculation
    let changed = true;
    let iterations = 0;
    const maxIter = leafTasks.length * 5;

    // Initial pass for leaf tasks without predecessors
    leafTasks.forEach(task => {
      let start = new Date(baseStartDate.getTime());
      start = this.getNextWorkingDay(start);
      task._computedStart = start;
      task._computedFinish = this.addWorkingDays(start, task.duration);
    });

    // Iteratively resolve predecessor dependencies
    while (changed && iterations < maxIter) {
      changed = false;
      iterations++;

      leafTasks.forEach(task => {
        let maxEarliestStart = new Date(baseStartDate.getTime());
        maxEarliestStart = this.getNextWorkingDay(maxEarliestStart);

        if (task.predecessors && String(task.predecessors).trim() !== "") {
          const predIds = String(task.predecessors).split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
          
          predIds.forEach(pId => {
            const predTask = taskMap.get(pId);
            if (predTask && predTask._computedFinish) {
              // Finish-to-Start: Task starts on next working day after predecessor finish
              let nextDay = new Date(predTask._computedFinish.getTime());
              nextDay.setDate(nextDay.getDate() + 1);
              nextDay = this.getNextWorkingDay(nextDay);

              if (nextDay > maxEarliestStart) {
                maxEarliestStart = nextDay;
              }
            }
          });
        }

        if (!task._computedStart || task._computedStart.getTime() !== maxEarliestStart.getTime()) {
          task._computedStart = maxEarliestStart;
          task._computedFinish = this.addWorkingDays(maxEarliestStart, task.duration);
          changed = true;
        }
      });
    }

    // Roll up Summary Tasks (bottom-up)
    // Reverse process to calculate summary node dates from leaf children
    for (let i = project.tasks.length - 1; i >= 0; i--) {
      const task = project.tasks[i];
      if (task.isSummary) {
        // Find all direct/indirect child tasks
        const children = [];
        for (let j = i + 1; j < project.tasks.length; j++) {
          const candidate = project.tasks[j];
          if (candidate.level <= task.level) break;
          children.push(candidate);
        }

        const validChildren = children.filter(c => !c.isSummary && c._computedStart && c._computedFinish);
        if (validChildren.length > 0) {
          let minStart = new Date(Math.min(...validChildren.map(c => c._computedStart.getTime())));
          let maxFinish = new Date(Math.max(...validChildren.map(c => c._computedFinish.getTime())));
          
          task._computedStart = minStart;
          task._computedFinish = maxFinish;
          task.duration = this.getWorkingDaysCount(minStart, maxFinish);
          
          // Calculate progress rollup
          let totalWork = 0;
          let completedWork = 0;
          validChildren.forEach(c => {
            const dur = c.duration || 1;
            totalWork += dur;
            completedWork += dur * ((c.progress || 0) / 100);
          });
          task.progress = totalWork > 0 ? Math.round((completedWork / totalWork) * 100) : 0;
        } else {
          task._computedStart = this.getNextWorkingDay(baseStartDate);
          task._computedFinish = task._computedStart;
          task.duration = 0;
        }
      }
    }

    // Format computed string fields and deadline checks
    project.tasks.forEach(task => {
      task.startDateStr = this.formatDate(task._computedStart);
      task.finishDateStr = this.formatDate(task._computedFinish);
      task.startDisplay = this.formatDisplayDate(task._computedStart);
      task.finishDisplay = this.formatDisplayDate(task._computedFinish);

      // Deadline check
      task.isOverdue = false;
      if (task.deadline && task._computedFinish) {
        const dDate = this.parseDate(task.deadline);
        if (dDate && task._computedFinish > dDate) {
          task.isOverdue = true;
        }
      }
    });

    return project;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProjectScheduler;
}
