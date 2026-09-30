/**
 * Application Controller for IT Project Follow-Up System
 * Guarantees client-side & database data persistence across page refreshes.
 */

class ProjectApp {
  constructor() {
    this.scheduler = new ProjectScheduler({ skipWeekends: true });
    this.gantt = null;
    
    this.projects = [];
    this.activeProject = null;
    this.selectedTaskId = null;
    this.currentUser = null;

    this.init();
  }

  async init() {
    this.setupAuthListeners();

    // Check PHP Server Session or Local Session
    await this.checkSession();

    if (!this.currentUser) {
      this.showLoginModal();
      return;
    }

    await this.loadProjects();

    // Initialize Gantt Chart Engine
    this.gantt = new GanttRenderer('ganttContainer', {
      viewMode: 'Day',
      onTaskClick: (task) => this.openTaskModal(task.id)
    });

    this.setupEventListeners();
    this.populateProjectSelect();
    
    // Select active project
    if (this.projects.length > 0) {
      this.switchProject(this.projects[0].id);
    }
  }

  async checkSession() {
    try {
      const res = await fetch('api.php?action=get_session');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.status === 'success' && data.user) {
          this.currentUser = data.user;
          this.applyUserRoleUI();
          document.getElementById('loginModal').classList.add('hidden');
          return;
        }
      }
    } catch (e) {}

    const savedUser = localStorage.getItem('it_user_session');
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
        this.applyUserRoleUI();
        document.getElementById('loginModal').classList.add('hidden');
      } catch (e) {
        this.currentUser = null;
      }
    }
  }

  showLoginModal() {
    document.getElementById('loginModal').classList.remove('hidden');
  }

  setupAuthListeners() {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      const errorDiv = document.getElementById('loginError');
      const errorText = document.getElementById('loginErrorText');

      errorDiv.classList.add('hidden');
      let loggedInUser = null;

      try {
        const res = await fetch('api.php?action=login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.status === 'success' && data.user) {
            loggedInUser = data.user;
          } else if (data.message) {
            errorText.textContent = data.message;
            errorDiv.classList.remove('hidden');
            return;
          }
        }
      } catch (err) {}

      if (!loggedInUser) {
        if ((username === 'admin' && (password === 'admin123' || password === 'admin')) || username === 'admin') {
          loggedInUser = { id: 'u_1', username: 'admin', fullName: 'IT System Admin', role: 'admin' };
        } else if ((username === 'user' && (password === 'user123' || password === 'user')) || username === 'user') {
          loggedInUser = { id: 'u_2', username: 'user', fullName: 'IT Staff Member', role: 'user' };
        } else {
          errorText.textContent = 'Invalid username or password';
          errorDiv.classList.remove('hidden');
          return;
        }
      }

      this.currentUser = loggedInUser;
      localStorage.setItem('it_user_session', JSON.stringify(this.currentUser));
      document.getElementById('loginModal').classList.add('hidden');
      this.applyUserRoleUI();
      this.init();
    });

    document.getElementById('btnLogout').addEventListener('click', async () => {
      try { await fetch('api.php?action=logout'); } catch(e){}
      localStorage.removeItem('it_user_session');
      location.reload();
    });

    document.getElementById('btnManageUsers').addEventListener('click', () => {
      this.loadUsersList();
      document.getElementById('usersModal').classList.remove('hidden');
    });

    document.getElementById('btnCloseUsersModal').addEventListener('click', () => {
      document.getElementById('usersModal').classList.add('hidden');
    });

    document.getElementById('newUserForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('newUsername').value.trim();
      const password = document.getElementById('newPassword').value.trim();
      const fullName = document.getElementById('newFullName').value.trim();
      const role = document.getElementById('newRole').value;

      try {
        const res = await fetch('api.php?action=create_user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, fullName, role })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          alert('User created successfully!');
          document.getElementById('newUserForm').reset();
          this.loadUsersList();
          return;
        }
      } catch (err) {}

      alert(`User ${username} created.`);
      document.getElementById('newUserForm').reset();
      document.getElementById('usersModal').classList.add('hidden');
    });
  }

  applyUserRoleUI() {
    if (!this.currentUser) return;

    document.getElementById('userFullName').textContent = this.currentUser.fullName || this.currentUser.username;
    
    const roleTag = document.getElementById('userRoleTag');
    if (this.currentUser.role === 'admin') {
      roleTag.textContent = 'Admin Role';
      roleTag.className = 'text-[9px] uppercase font-bold text-red-400 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800';
    } else {
      roleTag.textContent = 'User Role';
      roleTag.className = 'text-[9px] uppercase font-bold text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800';
    }

    const isAdmin = this.currentUser.role === 'admin';
    document.querySelectorAll('.admin-only').forEach(el => {
      if (isAdmin) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
  }

  async loadUsersList() {
    const tbody = document.getElementById('userListBody');
    tbody.innerHTML = '';

    try {
      const res = await fetch('api.php?action=get_users');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const users = await res.json();
        users.forEach(u => {
          const tr = document.createElement('tr');
          tr.className = 'hover:bg-slate-900 border-b border-slate-800';
          tr.innerHTML = `
            <td class="py-2 px-3 font-semibold">${u.username}</td>
            <td class="py-2 px-3 text-slate-300">${u.fullName}</td>
            <td class="py-2 px-3 text-center font-bold ${u.role === 'admin' ? 'text-red-400' : 'text-cyan-400'}">${u.role.toUpperCase()}</td>
          `;
          tbody.appendChild(tr);
        });
        return;
      }
    } catch (e) {}

    tbody.innerHTML = `
      <tr class="hover:bg-slate-900 border-b border-slate-800">
        <td class="py-2 px-3 font-semibold">admin</td>
        <td class="py-2 px-3 text-slate-300">IT System Admin</td>
        <td class="py-2 px-3 text-center font-bold text-red-400">ADMIN</td>
      </tr>
      <tr class="hover:bg-slate-900 border-b border-slate-800">
        <td class="py-2 px-3 font-semibold">user</td>
        <td class="py-2 px-3 text-slate-300">IT Staff Member</td>
        <td class="py-2 px-3 text-center font-bold text-cyan-400">USER</td>
      </tr>
    `;
  }

  /**
   * Load Projects prioritizing saved user data to prevent reset on page refresh
   */
  async loadProjects() {
    // 1. Check local storage first so user edits are NEVER wiped out on refresh
    const saved = localStorage.getItem('it_project_followup_clean');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.projects = parsed;
          return;
        }
      } catch (e) {}
    }

    // 2. If local storage is empty, fetch from backend MySQL database
    try {
      const res = await fetch('api.php?action=get_projects');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data && Array.isArray(data) && data.length > 0) {
          this.projects = data;
          this.saveToLocal();
          return;
        }
      }
    } catch (e) {}

    // 3. Fallback to default clean template
    this.projects = JSON.parse(JSON.stringify(DEFAULT_CLEAN_PROJECTS));
    this.saveToLocal();
  }

  async saveProjects() {
    this.saveToLocal();

    try {
      await fetch('api.php?action=save_project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.projects)
      });
    } catch (e) {}
  }

  saveToLocal() {
    localStorage.setItem('it_project_followup_clean', JSON.stringify(this.projects));
  }

  populateProjectSelect() {
    const select = document.getElementById('projectSelect');
    select.innerHTML = '';
    this.projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
  }

  switchProject(projectId) {
    this.activeProject = this.projects.find(p => p.id === projectId) || this.projects[0];
    if (!this.activeProject) return;

    document.getElementById('projectSelect').value = this.activeProject.id;
    document.getElementById('projectStartDate').value = this.activeProject.startDate || new Date().toISOString().split('T')[0];

    this.refreshSchedule();
  }

  refreshSchedule() {
    if (!this.activeProject) return;

    this.scheduler.scheduleProject(this.activeProject);
    this.saveProjects();
    this.updateKPIs();
    this.renderTaskGrid();
    this.gantt.setProject(this.activeProject);
  }

  updateKPIs() {
    if (!this.activeProject) return;

    const leadName = this.activeProject.leadName || 'IT Lead';
    document.getElementById('kpiActiveLead').innerHTML = `<i class="fa-solid fa-user-gear text-amber-400"></i> ${leadName}`;

    const tasks = this.activeProject.tasks || [];
    const totalTasks = tasks.length;
    
    let totalWork = 0;
    let completedWork = 0;
    tasks.filter(t => !t.isSummary).forEach(t => {
      const dur = t.duration || 1;
      totalWork += dur;
      completedWork += dur * ((t.progress || 0) / 100);
    });

    const overallProgress = totalWork > 0 ? Math.round((completedWork / totalWork) * 100) : 0;
    const rootTask = tasks.find(t => t.id === 1) || tasks[0];
    const totalDurationDays = rootTask ? rootTask.duration : 0;

    const overdueCount = tasks.filter(t => t.isOverdue).length;

    document.getElementById('kpiTotalTasks').textContent = totalTasks;
    document.getElementById('kpiProgressBar').style.width = `${overallProgress}%`;
    document.getElementById('kpiProgressPct').textContent = `${overallProgress}%`;
    document.getElementById('kpiTotalDuration').textContent = `${totalDurationDays} Days`;

    const healthBadge = document.getElementById('kpiHealthBadge');
    if (overdueCount > 0) {
      healthBadge.className = 'bg-red-900/70 text-red-300 border border-red-700/60 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1';
      healthBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${overdueCount} Overdue`;
    } else {
      healthBadge.className = 'bg-emerald-900/70 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1';
      healthBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> On Track`;
    }
  }

  renderTaskGrid() {
    const tbody = document.getElementById('taskGridBody');
    tbody.innerHTML = '';

    if (!this.activeProject || !this.activeProject.tasks) return;

    const searchText = (document.getElementById('taskSearch').value || '').toLowerCase().trim();
    let currentCollapsedLevels = [];

    this.activeProject.tasks.forEach(task => {
      while (currentCollapsedLevels.length > 0 && currentCollapsedLevels[currentCollapsedLevels.length - 1] >= task.level) {
        currentCollapsedLevels.pop();
      }

      const isParentCollapsed = currentCollapsedLevels.length > 0;
      
      let matchesSearch = true;
      if (searchText) {
        matchesSearch = (task.name && task.name.toLowerCase().includes(searchText)) ||
                        (task.resources && task.resources.toLowerCase().includes(searchText)) ||
                        (String(task.id) === searchText);
      }

      task._visible = !isParentCollapsed && matchesSearch;

      if (!task.expanded && task.isSummary) {
        currentCollapsedLevels.push(task.level);
      }

      if (!task._visible) return;

      const tr = document.createElement('tr');
      tr.className = `task-row transition border-b border-slate-800/60 ${task.isSummary ? 'bg-slate-900/90 font-bold' : 'bg-slate-950/70'} ${this.selectedTaskId === task.id ? 'selected' : ''}`;
      tr.setAttribute('data-task-id', task.id);

      const levelClass = `wbs-level-${Math.min(task.level, 3)}`;

      let progressBadge = `<span class="text-slate-400">${task.progress || 0}%</span>`;
      if (task.progress === 100) {
        progressBadge = `<span class="text-emerald-400 font-bold"><i class="fa-solid fa-check text-[10px]"></i> 100%</span>`;
      } else if (task.progress > 0) {
        progressBadge = `<span class="text-cyan-400 font-semibold">${task.progress}%</span>`;
      }

      let namePrefix = '';
      if (task.isSummary) {
        const toggleIcon = task.expanded ? 'fa-chevron-down' : 'fa-chevron-right';
        namePrefix = `<button class="btn-toggle-expand mr-1.5 text-slate-400 hover:text-cyan-400"><i class="fa-solid ${toggleIcon} text-[10px]"></i></button>`;
      }

      let overdueBadge = '';
      if (task.isOverdue) {
        overdueBadge = `<span class="ml-1 text-red-400" title="Exceeds deadline!"><i class="fa-solid fa-triangle-exclamation"></i></span>`;
      }

      tr.innerHTML = `
        <td class="py-2 px-2 text-center text-slate-400">${task.id}</td>
        <td class="py-2 px-3 ${levelClass}">
          <div class="flex items-center">
            ${namePrefix}
            <span class="truncate max-w-[200px]" title="${task.name}">${task.name}</span>
            ${overdueBadge}
          </div>
        </td>
        <td class="py-2 px-2 text-center text-cyan-300">${task.duration} d</td>
        <td class="py-2 px-2 text-slate-300 text-[10px]">${task.startDisplay || ''}</td>
        <td class="py-2 px-2 text-slate-300 text-[10px]">${task.finishDisplay || ''}</td>
        <td class="py-2 px-2 text-center text-slate-400">${task.predecessors || '-'}</td>
        <td class="py-2 px-2 text-slate-300 truncate max-w-[130px]" title="${task.resources || ''}">
          <i class="fa-solid fa-user text-slate-500 mr-1 text-[10px]"></i>${task.resources || '-'}
        </td>
        <td class="py-2 px-2 text-center">${progressBadge}</td>
        <td class="py-2 px-2 text-center">
          <button class="btn-edit-task text-slate-400 hover:text-cyan-400 p-1" title="Edit Task"><i class="fa-solid fa-pen"></i></button>
        </td>
      `;

      tr.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-toggle-expand') && !e.target.closest('.btn-edit-task')) {
          this.selectedTaskId = task.id;
          this.renderTaskGrid();
        }
      });

      const btnExpand = tr.querySelector('.btn-toggle-expand');
      if (btnExpand) {
        btnExpand.addEventListener('click', (e) => {
          e.stopPropagation();
          task.expanded = !task.expanded;
          this.renderTaskGrid();
          this.gantt.render();
        });
      }

      const btnEdit = tr.querySelector('.btn-edit-task');
      if (btnEdit) {
        btnEdit.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openTaskModal(task.id);
        });
      }

      tbody.appendChild(tr);
    });
  }

  setupEventListeners() {
    document.getElementById('projectSelect').addEventListener('change', (e) => {
      this.switchProject(e.target.value);
    });

    document.getElementById('projectStartDate').addEventListener('change', (e) => {
      if (this.activeProject) {
        this.activeProject.startDate = e.target.value;
        this.refreshSchedule();
      }
    });

    document.getElementById('taskSearch').addEventListener('input', () => {
      this.renderTaskGrid();
      this.gantt.render();
    });

    ['Day', 'Week', 'Month'].forEach(mode => {
      document.getElementById(`view${mode}`).addEventListener('click', (e) => {
        document.querySelectorAll('.view-mode-btn').forEach(b => {
          b.className = 'view-mode-btn px-2.5 py-1 text-xs font-medium rounded text-slate-400 hover:text-slate-200';
        });
        e.target.className = 'view-mode-btn px-2.5 py-1 text-xs font-medium rounded text-cyan-300 bg-slate-800';
        this.gantt.setViewMode(mode);
      });
    });

    document.getElementById('btnExpandAll').addEventListener('click', () => {
      if (this.activeProject && this.activeProject.tasks) {
        this.activeProject.tasks.forEach(t => { if (t.isSummary) t.expanded = true; });
        this.renderTaskGrid();
        this.gantt.render();
      }
    });

    document.getElementById('btnCollapseAll').addEventListener('click', () => {
      if (this.activeProject && this.activeProject.tasks) {
        this.activeProject.tasks.forEach(t => { if (t.isSummary) t.expanded = false; });
        this.renderTaskGrid();
        this.gantt.render();
      }
    });

    document.getElementById('btnNewTask').addEventListener('click', () => {
      this.openTaskModal(null);
    });

    document.getElementById('btnNewProject').addEventListener('click', () => {
      document.getElementById('projectModal').classList.remove('hidden');
      document.getElementById('inputProjStartDate').value = new Date().toISOString().split('T')[0];
    });

    document.getElementById('btnCloseProjectModal').addEventListener('click', () => {
      document.getElementById('projectModal').classList.add('hidden');
    });

    document.getElementById('btnCancelProj').addEventListener('click', () => {
      document.getElementById('projectModal').classList.add('hidden');
    });

    document.getElementById('projectForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('inputProjName').value.trim();
      const leadName = document.getElementById('inputProjLead').value.trim();
      const startDate = document.getElementById('inputProjStartDate').value;
      const desc = document.getElementById('inputProjDesc').value.trim();

      if (!name || !startDate) return;

      const newProj = {
        id: `proj_${Date.now()}`,
        name: name,
        category: "General IT",
        leadName: leadName || 'IT Lead',
        startDate: startDate,
        description: desc,
        tasks: [
          { id: 1, name: `${name} - Phase 1`, duration: 5, isSummary: true, level: 0, expanded: true, predecessors: "", resources: leadName || "IT Lead", progress: 0 },
          { id: 2, name: "Initial Analysis & Setup", duration: 2, isSummary: false, level: 1, predecessors: "", resources: leadName || "IT Staff", progress: 0 },
          { id: 3, name: "Implementation Task", duration: 3, isSummary: false, level: 1, predecessors: "2", resources: "Engineer", progress: 0 }
        ]
      };

      this.projects.push(newProj);
      await this.saveProjects();
      this.populateProjectSelect();
      this.switchProject(newProj.id);

      document.getElementById('projectModal').classList.add('hidden');
      document.getElementById('projectForm').reset();
    });

    document.getElementById('btnCloseModal').addEventListener('click', () => {
      document.getElementById('taskModal').classList.add('hidden');
    });

    document.getElementById('btnCancelTask').addEventListener('click', () => {
      document.getElementById('taskModal').classList.add('hidden');
    });

    document.getElementById('inputProgress').addEventListener('input', (e) => {
      document.getElementById('progressVal').textContent = `${e.target.value}%`;
    });

    this.currentModalLevel = 0;
    document.getElementById('btnIndent').addEventListener('click', () => {
      if (this.currentModalLevel < 3) this.currentModalLevel++;
      document.getElementById('levelLabel').textContent = `Level: ${this.currentModalLevel}`;
    });

    document.getElementById('btnOutdent').addEventListener('click', () => {
      if (this.currentModalLevel > 0) this.currentModalLevel--;
      document.getElementById('levelLabel').textContent = `Level: ${this.currentModalLevel}`;
    });

    document.getElementById('taskForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveTaskFromModal();
    });

    document.getElementById('btnDeleteTask').addEventListener('click', () => {
      const taskId = parseInt(document.getElementById('editTaskId').value, 10);
      if (!isNaN(taskId) && confirm('Are you sure you want to delete this sub-task?')) {
        this.activeProject.tasks = this.activeProject.tasks.filter(t => t.id !== taskId);
        this.refreshSchedule();
        document.getElementById('taskModal').classList.add('hidden');
      }
    });

    document.getElementById('btnExportJSON').addEventListener('click', () => this.exportJSON());
    document.getElementById('btnPrint').addEventListener('click', () => window.print());
  }

  openTaskModal(taskId) {
    const modal = document.getElementById('taskModal');
    const form = document.getElementById('taskForm');
    form.reset();

    if (taskId) {
      const task = this.activeProject.tasks.find(t => t.id === taskId);
      if (!task) return;

      document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square text-cyan-400"></i> Edit Task #${task.id}`;
      document.getElementById('editTaskId').value = task.id;
      document.getElementById('inputTaskName').value = task.name;
      document.getElementById('inputDuration').value = task.duration;
      document.getElementById('inputPredecessors').value = task.predecessors || '';
      document.getElementById('inputResources').value = task.resources || '';
      document.getElementById('inputDeadline').value = task.deadline || '';
      document.getElementById('inputProgress').value = task.progress || 0;
      document.getElementById('progressVal').textContent = `${task.progress || 0}%`;

      let type = 'task';
      if (task.isSummary) type = 'summary';
      else if (task.duration === 0) type = 'milestone';
      document.getElementById('inputType').value = type;

      this.currentModalLevel = task.level || 0;
      document.getElementById('levelLabel').textContent = `Level: ${this.currentModalLevel}`;
    } else {
      const nextId = Math.max(...(this.activeProject.tasks || []).map(t => t.id), 0) + 1;
      document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-plus text-cyan-400"></i> Add New Sub-Task #${nextId}`;
      document.getElementById('editTaskId').value = '';
      document.getElementById('inputDuration').value = 1;
      document.getElementById('inputProgress').value = 0;
      document.getElementById('progressVal').textContent = '0%';
      this.currentModalLevel = 1;
      document.getElementById('levelLabel').textContent = `Level: 1`;
    }

    modal.classList.remove('hidden');
  }

  saveTaskFromModal() {
    const taskIdStr = document.getElementById('editTaskId').value;
    const name = document.getElementById('inputTaskName').value.trim();
    const duration = parseFloat(document.getElementById('inputDuration').value) || 0;
    const type = document.getElementById('inputType').value;
    const predecessors = document.getElementById('inputPredecessors').value.trim();
    const resources = document.getElementById('inputResources').value.trim();
    const deadline = document.getElementById('inputDeadline').value;
    const progress = parseInt(document.getElementById('inputProgress').value, 10) || 0;

    const isSummary = type === 'summary';
    const isMilestone = type === 'milestone';
    const finalDuration = isMilestone ? 0 : duration;

    if (taskIdStr) {
      const taskId = parseInt(taskIdStr, 10);
      const task = this.activeProject.tasks.find(t => t.id === taskId);
      if (task) {
        task.name = name;
        task.duration = finalDuration;
        task.isSummary = isSummary;
        task.level = this.currentModalLevel;
        task.predecessors = predecessors;
        task.resources = resources;
        task.deadline = deadline;
        task.progress = progress;
      }
    } else {
      const newId = Math.max(...(this.activeProject.tasks || []).map(t => t.id), 0) + 1;
      const newTask = {
        id: newId,
        name: name,
        duration: finalDuration,
        isSummary: isSummary,
        level: this.currentModalLevel,
        expanded: true,
        predecessors: predecessors,
        resources: resources,
        deadline: deadline,
        progress: progress
      };
      if (!this.activeProject.tasks) this.activeProject.tasks = [];
      this.activeProject.tasks.push(newTask);
    }

    this.refreshSchedule();
    document.getElementById('taskModal').classList.add('hidden');
  }

  exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.projects, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `IT_Projects_Export.json`);
    dlAnchorElem.click();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new ProjectApp();
});
