/* ═══════════════════════════════════════════
   ROADMAP TRACKER — script.js
   Full app logic: state, CRUD, UI rendering,
   drag-and-drop, analytics, search, export
═══════════════════════════════════════════ */

'use strict';

// ── STATE ──────────────────────────────────────────
let state = {
  roadmaps: [],        // Array of roadmap objects
  activeRoadmapId: null,
  theme: 'dark'
};

// ── DATA MODELS ────────────────────────────────────
function createRoadmap(title, category, description) {
  return {
    id: generateId(),
    title: title.trim(),
    category: category || 'Other',
    description: description || '',
    milestones: [],
    createdAt: Date.now(),
    lastActivity: Date.now()
  };
}

function createMilestone(title, description, notes, category, deadline) {
  return {
    id: generateId(),
    title: title.trim(),
    description: description || '',
    notes: notes || '',
    category: category || 'Beginner',
    deadline: deadline || '',
    status: 'not-started',       // 'not-started' | 'in-progress' | 'completed'
    completedAt: null,
    createdAt: Date.now()
  };
}

// ── UTILITIES ──────────────────────────────────────
function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function showToast(message, duration = 2200) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function deadlineClass(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const diff = (d - now) / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'overdue';
  if (diff <= 3) return 'soon';
  return '';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── LOCAL STORAGE ──────────────────────────────────
function saveToLocalStorage() {
  try {
    localStorage.setItem('roadmapTracker_v2', JSON.stringify(state));
  } catch (e) {
    console.warn('Storage save failed:', e);
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem('roadmapTracker_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      state.roadmaps = parsed.roadmaps || [];
      state.theme = parsed.theme || 'dark';
      state.activeRoadmapId = null; // always start on dashboard
    }
  } catch (e) {
    console.warn('Storage load failed:', e);
  }
}

// ── PROGRESS CALCULATION ───────────────────────────
function calculateProgress(roadmap) {
  const total = roadmap.milestones.length;
  if (total === 0) return { pct: 0, completed: 0, inProgress: 0, notStarted: 0, total: 0 };
  const completed = roadmap.milestones.filter(m => m.status === 'completed').length;
  const inProgress = roadmap.milestones.filter(m => m.status === 'in-progress').length;
  const notStarted = total - completed - inProgress;
  const pct = Math.round((completed / total) * 100);
  return { pct, completed, inProgress, notStarted, total };
}

// ── ANALYTICS ──────────────────────────────────────
function computeAnalytics() {
  let totalCompleted = 0, totalInProgress = 0;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let weeklyProgress = 0;

  for (const rm of state.roadmaps) {
    for (const m of rm.milestones) {
      if (m.status === 'completed') {
        totalCompleted++;
        if (m.completedAt && m.completedAt >= weekAgo) weeklyProgress++;
      }
      if (m.status === 'in-progress') totalInProgress++;
    }
  }
  return {
    totalCompleted,
    totalInProgress,
    totalRoadmaps: state.roadmaps.length,
    weeklyProgress
  };
}

// ── GAMIFICATION BADGES ────────────────────────────
function computeBadges(roadmap) {
  const { pct, completed } = calculateProgress(roadmap);
  const badges = [];
  if (completed >= 1) badges.push({ label: '⚡ Started', cls: 'beginner-badge' });
  if (pct >= 50) badges.push({ label: '🔥 Halfway', cls: 'intermediate-badge' });
  if (pct === 100) badges.push({ label: '🏆 Expert', cls: 'expert-badge' });
  return badges;
}

// ── SMART RECOMMENDATIONS ──────────────────────────
const SUGGESTION_MAP = {
  'networking': ['Wireshark basics', 'TCP/IP deep dive', 'Web Security'],
  'linux': ['Bash scripting', 'System administration', 'Docker basics'],
  'web security': ['OWASP Top 10', 'Burp Suite', 'Cloud Security'],
  'html': ['CSS Flexbox/Grid', 'JavaScript basics', 'React fundamentals'],
  'javascript': ['TypeScript', 'Node.js', 'React or Vue'],
  'python': ['Data structures', 'Django/Flask', 'Machine Learning basics'],
  'data structures': ['Algorithms', 'LeetCode patterns', 'System design'],
  'react': ['State management', 'Next.js', 'Testing with Jest'],
  'docker': ['Kubernetes', 'CI/CD pipelines', 'Cloud deployment'],
  'css': ['Sass/SCSS', 'CSS animations', 'Design systems'],
  'sql': ['PostgreSQL', 'Query optimization', 'Database design'],
  'git': ['GitHub Actions', 'CI/CD', 'Code reviews'],
  'cloud': ['Serverless architecture', 'Microservices', 'Terraform'],
};

function getRecommendations(roadmap) {
  const completedTitles = roadmap.milestones
    .filter(m => m.status === 'completed')
    .map(m => m.title.toLowerCase());

  const suggestions = new Set();
  for (const title of completedTitles) {
    for (const [key, vals] of Object.entries(SUGGESTION_MAP)) {
      if (title.includes(key)) {
        vals.forEach(v => suggestions.add(v));
      }
    }
  }

  // Remove already existing milestones
  const existingTitles = roadmap.milestones.map(m => m.title.toLowerCase());
  return [...suggestions].filter(s => !existingTitles.includes(s.toLowerCase())).slice(0, 4);
}

// ── REMINDERS ──────────────────────────────────────
function getReminders() {
  const reminders = [];
  const now = Date.now();
  for (const rm of state.roadmaps) {
    const daysSince = (now - rm.lastActivity) / (1000 * 60 * 60 * 24);
    if (daysSince >= 5 && rm.milestones.some(m => m.status !== 'completed')) {
      reminders.push(`You haven't worked on "${rm.title}" in ${Math.floor(daysSince)} days`);
    }
    for (const m of rm.milestones) {
      if (m.deadline && m.status !== 'completed') {
        const daysLeft = (new Date(m.deadline + 'T00:00:00') - now) / (1000 * 60 * 60 * 24);
        if (daysLeft >= 0 && daysLeft <= 2) {
          reminders.push(`"${m.title}" in ${rm.title} is due in ${Math.ceil(daysLeft)} day(s)!`);
        }
      }
    }
  }
  return reminders;
}

// ── ROADMAP CRUD ────────────────────────────────────
function addRoadmap(title, category, description) {
  const rm = createRoadmap(title, category, description);
  state.roadmaps.push(rm);
  saveToLocalStorage();
  return rm;
}

function deleteRoadmap(id) {
  state.roadmaps = state.roadmaps.filter(r => r.id !== id);
  if (state.activeRoadmapId === id) state.activeRoadmapId = null;
  saveToLocalStorage();
}

function getRoadmap(id) {
  return state.roadmaps.find(r => r.id === id);
}

// ── MILESTONE CRUD ──────────────────────────────────
function addMilestone(roadmapId, title, description, notes, category, deadline) {
  const rm = getRoadmap(roadmapId);
  if (!rm) return;
  const milestone = createMilestone(title, description, notes, category, deadline);
  rm.milestones.push(milestone);
  rm.lastActivity = Date.now();
  saveToLocalStorage();
  return milestone;
}

function deleteMilestone(roadmapId, milestoneId) {
  const rm = getRoadmap(roadmapId);
  if (!rm) return;
  rm.milestones = rm.milestones.filter(m => m.id !== milestoneId);
  rm.lastActivity = Date.now();
  saveToLocalStorage();
}

function updateMilestoneStatus(roadmapId, milestoneId, newStatus) {
  const rm = getRoadmap(roadmapId);
  if (!rm) return;
  const m = rm.milestones.find(m => m.id === milestoneId);
  if (!m) return;
  m.status = newStatus;
  m.completedAt = newStatus === 'completed' ? Date.now() : null;
  rm.lastActivity = Date.now();
  saveToLocalStorage();
}

function updateMilestone(roadmapId, milestoneId, fields) {
  const rm = getRoadmap(roadmapId);
  if (!rm) return;
  const m = rm.milestones.find(m => m.id === milestoneId);
  if (!m) return;
  Object.assign(m, fields);
  rm.lastActivity = Date.now();
  saveToLocalStorage();
}

// ── DRAG AND DROP ───────────────────────────────────
let dragSrcIndex = null;

function initDragDrop(container, roadmapId) {
  container.addEventListener('dragstart', e => {
    const node = e.target.closest('.milestone-node');
    if (!node) return;
    dragSrcIndex = parseInt(node.dataset.index);
    node.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  container.addEventListener('dragend', e => {
    container.querySelectorAll('.milestone-node').forEach(n => {
      n.classList.remove('dragging', 'drag-over');
    });
  });

  container.addEventListener('dragover', e => {
    e.preventDefault();
    const node = e.target.closest('.milestone-node');
    if (!node) return;
    container.querySelectorAll('.milestone-node').forEach(n => n.classList.remove('drag-over'));
    node.classList.add('drag-over');
  });

  container.addEventListener('drop', e => {
    e.preventDefault();
    const node = e.target.closest('.milestone-node');
    if (!node) return;
    const dropIndex = parseInt(node.dataset.index);
    if (dragSrcIndex === null || dragSrcIndex === dropIndex) return;

    const rm = getRoadmap(roadmapId);
    if (!rm) return;

    const milestones = [...rm.milestones];
    const [removed] = milestones.splice(dragSrcIndex, 1);
    milestones.splice(dropIndex, 0, removed);
    rm.milestones = milestones;
    saveToLocalStorage();
    renderRoadmapView(roadmapId);
    showToast('Milestones reordered');
    dragSrcIndex = null;
  });
}

// ── SEARCH / FILTER ─────────────────────────────────
function getFilteredRoadmaps(query) {
  if (!query) return state.roadmaps;
  const q = query.toLowerCase();
  return state.roadmaps.filter(rm =>
    rm.title.toLowerCase().includes(q) ||
    rm.category.toLowerCase().includes(q) ||
    rm.description.toLowerCase().includes(q) ||
    rm.milestones.some(m => m.title.toLowerCase().includes(q))
  );
}

// ── EXPORT ──────────────────────────────────────────
function exportRoadmapJSON(roadmapId) {
  const rm = getRoadmap(roadmapId);
  if (!rm) return;
  const json = JSON.stringify(rm, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${rm.title.replace(/\s+/g, '_')}_roadmap.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported as JSON');
}

// ── UI: SIDEBAR ROADMAP LIST ─────────────────────────
function renderSidebarList() {
  const query = document.getElementById('searchInput').value;
  const filtered = getFilteredRoadmaps(query);
  const container = document.getElementById('roadmapList');

  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding:8px 12px; font-family:var(--font-mono); font-size:0.72rem; color:var(--text3);">No roadmaps found</div>`;
    return;
  }

  container.innerHTML = filtered.map(rm => {
    const { pct } = calculateProgress(rm);
    const isActive = rm.id === state.activeRoadmapId;
    return `
      <div class="roadmap-list-item ${isActive ? 'active' : ''}" data-id="${rm.id}">
        <div class="list-item-dot"></div>
        <div class="list-item-name">${escapeHtml(rm.title)}</div>
        <div class="list-item-pct">${pct}%</div>
      </div>`;
  }).join('');

  container.querySelectorAll('.roadmap-list-item').forEach(el => {
    el.addEventListener('click', () => {
      navigateTo(el.dataset.id);
    });
  });
}

// ── UI: SIDEBAR ANALYTICS ────────────────────────────
function renderAnalytics() {
  const a = computeAnalytics();
  document.getElementById('totalCompleted').textContent = a.totalCompleted;
  document.getElementById('totalInProgress').textContent = a.totalInProgress;
  document.getElementById('totalRoadmaps').textContent = a.totalRoadmaps;
  document.getElementById('weeklyProgress').textContent = a.weeklyProgress;
}

// ── UI: REMINDERS ────────────────────────────────────
function renderReminders() {
  const badge = document.getElementById('reminderBadge');
  const reminders = getReminders();
  if (reminders.length > 0) {
    badge.style.display = 'block';
    badge.innerHTML = '⏰ ' + reminders.slice(0, 2).map(r => escapeHtml(r)).join('<br>⏰ ');
  } else {
    badge.style.display = 'none';
  }
}

// ── UI: DASHBOARD ─────────────────────────────────────
function renderDashboard() {
  const query = document.getElementById('searchInput').value;
  const filtered = getFilteredRoadmaps(query);
  const grid = document.getElementById('dashboardGrid');
  const empty = document.getElementById('emptyDashboard');

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.classList.add('show');
    return;
  }
  empty.classList.remove('show');

  grid.innerHTML = filtered.map(rm => {
    const { pct, completed, total } = calculateProgress(rm);
    const badges = computeBadges(rm);
    const badgeHtml = badges.map(b => `<span class="badge ${b.cls}">${b.label}</span>`).join('');
    const fillClass = pct === 100 ? 'green' : '';
    return `
      <div class="roadmap-card" data-id="${rm.id}">
        <div class="card-category">${escapeHtml(rm.category)}</div>
        <div class="card-title">${escapeHtml(rm.title)}</div>
        ${rm.description ? `<div class="card-desc">${escapeHtml(rm.description)}</div>` : ''}
        <div class="card-progress-bar">
          <div class="card-progress-fill ${fillClass}" style="width:${pct}%"></div>
        </div>
        <div class="card-footer">
          <span class="card-pct">${pct}% complete</span>
          <span class="card-count">${completed}/${total} milestones</span>
        </div>
        ${badges.length > 0 ? `<div class="card-badges">${badgeHtml}</div>` : ''}
      </div>`;
  }).join('');

  grid.querySelectorAll('.roadmap-card').forEach(card => {
    card.addEventListener('click', () => navigateTo(card.dataset.id));
  });
}

// ── UI: ROADMAP VIEW ──────────────────────────────────
function renderRoadmapView(roadmapId) {
  const rm = getRoadmap(roadmapId);
  if (!rm) return;

  document.getElementById('roadmapTitle').textContent = rm.title;
  document.getElementById('roadmapCategory').textContent = rm.category;

  // Progress bar
  const { pct, completed, inProgress, notStarted, total } = calculateProgress(rm);
  document.getElementById('progressBarFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent = pct + '%';
  document.getElementById('progressStats').innerHTML = `
    <div class="progress-stat"><div class="stat-dot green"></div><span class="stat-label">Completed</span><span class="stat-val">&nbsp;${completed}</span></div>
    <div class="progress-stat"><div class="stat-dot orange"></div><span class="stat-label">In Progress</span><span class="stat-val">&nbsp;${inProgress}</span></div>
    <div class="progress-stat"><div class="stat-dot muted"></div><span class="stat-label">Not Started</span><span class="stat-val">&nbsp;${notStarted}</span></div>
    <div class="progress-stat" style="margin-left:auto"><span class="stat-label" style="color:var(--text2)">${total} total milestones</span></div>
  `;

  // Recommendations
  const recs = getRecommendations(rm);
  const recPanel = document.getElementById('recommendationsPanel');
  if (recs.length > 0) {
    recPanel.style.display = 'flex';
    document.getElementById('recChips').innerHTML = recs.map(r =>
      `<span class="rec-chip">${escapeHtml(r)}</span>`
    ).join('');
  } else {
    recPanel.style.display = 'none';
  }

  // Milestones
  renderMilestones(roadmapId);
}

function renderMilestones(roadmapId) {
  const rm = getRoadmap(roadmapId);
  if (!rm) return;
  const container = document.getElementById('milestoneTimeline');
  const catFilter = document.getElementById('filterCategory').value;

  let milestones = rm.milestones;
  if (catFilter) milestones = milestones.filter(m => m.category === catFilter);

  if (milestones.length === 0) {
    container.innerHTML = `
      <div style="padding:40px 24px; text-align:center; color:var(--text3); font-family:var(--font-mono); font-size:0.8rem;">
        ${rm.milestones.length === 0 ? 'No milestones yet. Add your first milestone to get started.' : 'No milestones match the selected filter.'}
      </div>`;
    return;
  }

  // Compute the display index (for drag-and-drop) using original array indices
  container.innerHTML = rm.milestones.map((m, originalIndex) => {
    if (catFilter && m.category !== catFilter) return '';
    const statusIcon = m.status === 'completed' ? '✓' : m.status === 'in-progress' ? '◎' : '○';
    const deadlineCls = deadlineClass(m.deadline);
    const deadlineText = m.deadline
      ? `<span class="node-deadline ${deadlineCls}">📅 ${formatDate(m.deadline)}${deadlineCls === 'overdue' ? ' (overdue)' : deadlineCls === 'soon' ? ' (soon!)' : ''}</span>`
      : '';

    return `
      <div class="milestone-node" data-id="${m.id}" data-index="${originalIndex}" draggable="true" style="animation-delay:${originalIndex * 0.04}s">
        <div class="node-dot ${m.status}" title="Click to cycle status" data-id="${m.id}">${statusIcon}</div>
        <div class="node-content ${m.status}">
          <div class="node-header">
            <div class="node-title-wrap">
              <div class="node-title ${m.status === 'completed' ? 'completed' : ''}">${escapeHtml(m.title)}</div>
              <div class="node-meta">
                <span class="node-cat ${m.category}">${m.category}</span>
                ${deadlineText}
              </div>
            </div>
            <div class="node-actions">
              <button class="node-btn edit-btn" data-id="${m.id}">Edit</button>
              <button class="node-btn danger del-btn" data-id="${m.id}">✕</button>
            </div>
          </div>
          ${m.description ? `<div class="node-desc">${escapeHtml(m.description)}</div>` : ''}
          ${m.notes ? `<div class="node-notes">📝 ${escapeHtml(m.notes)}</div>` : ''}
          <div class="status-toggle">
            <button class="status-btn ${m.status === 'not-started' ? 'active-not-started' : ''}" data-status="not-started" data-id="${m.id}">Not Started</button>
            <button class="status-btn ${m.status === 'in-progress' ? 'active-in-progress' : ''}" data-status="in-progress" data-id="${m.id}">In Progress</button>
            <button class="status-btn ${m.status === 'completed' ? 'active-completed' : ''}" data-status="completed" data-id="${m.id}">Completed</button>
          </div>
        </div>
      </div>`;
  }).join('');

  // Status buttons
  container.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      updateMilestoneStatus(roadmapId, btn.dataset.id, btn.dataset.status);
      renderRoadmapView(roadmapId);
      renderSidebarList();
      renderAnalytics();
      showToast(`Status updated to "${btn.dataset.status.replace('-', ' ')}"`);
    });
  });

  // Node dot click to cycle status
  container.querySelectorAll('.node-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const m = rm.milestones.find(x => x.id === dot.dataset.id);
      if (!m) return;
      const cycle = { 'not-started': 'in-progress', 'in-progress': 'completed', 'completed': 'not-started' };
      updateMilestoneStatus(roadmapId, m.id, cycle[m.status]);
      renderRoadmapView(roadmapId);
      renderSidebarList();
      renderAnalytics();
    });
  });

  // Edit buttons
  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = rm.milestones.find(x => x.id === btn.dataset.id);
      if (!m) return;
      document.getElementById('editMilestoneId').value = m.id;
      document.getElementById('editMilestoneTitle').value = m.title;
      document.getElementById('editMilestoneDesc').value = m.description;
      document.getElementById('editMilestoneNotes').value = m.notes;
      document.getElementById('editMilestoneCat').value = m.category;
      document.getElementById('editMilestoneDeadline').value = m.deadline;
      openModal('editMilestoneModal');
    });
  });

  // Delete buttons
  container.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Delete this milestone?')) return;
      deleteMilestone(roadmapId, btn.dataset.id);
      renderRoadmapView(roadmapId);
      renderSidebarList();
      renderAnalytics();
      showToast('Milestone deleted');
    });
  });

  // Init drag-and-drop
  initDragDrop(container, roadmapId);
}

// ── NAVIGATION ────────────────────────────────────────
function navigateTo(roadmapId) {
  state.activeRoadmapId = roadmapId;

  document.getElementById('dashboardView').classList.add('hidden');
  document.getElementById('roadmapView').classList.remove('hidden');

  renderRoadmapView(roadmapId);
  renderSidebarList();

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
}

function navigateToDashboard() {
  state.activeRoadmapId = null;
  document.getElementById('roadmapView').classList.add('hidden');
  document.getElementById('dashboardView').classList.remove('hidden');
  renderSidebarList();
  renderDashboard();
  renderReminders();
}

// ── MODALS ────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ── THEME ─────────────────────────────────────────────
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeToggle').querySelector('.theme-icon').textContent = theme === 'dark' ? '◐' : '●';
  saveToLocalStorage();
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

// ── FULL RENDER ───────────────────────────────────────
function renderUI() {
  renderSidebarList();
  renderAnalytics();
  if (state.activeRoadmapId && getRoadmap(state.activeRoadmapId)) {
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('roadmapView').classList.remove('hidden');
    renderRoadmapView(state.activeRoadmapId);
  } else {
    navigateToDashboard();
  }
}

// ── EVENT WIRING ──────────────────────────────────────
function wireEvents() {

  // Create roadmap
  document.getElementById('openCreateModal').addEventListener('click', () => openModal('createRoadmapModal'));
  document.getElementById('emptyCreateBtn').addEventListener('click', () => openModal('createRoadmapModal'));

  document.getElementById('confirmCreateRoadmap').addEventListener('click', () => {
    const title = document.getElementById('newRoadmapTitle').value.trim();
    if (!title) { showToast('Please enter a roadmap title'); return; }
    const cat = document.getElementById('newRoadmapCategory').value;
    const desc = document.getElementById('newRoadmapDesc').value;
    const rm = addRoadmap(title, cat, desc);
    closeModal('createRoadmapModal');
    document.getElementById('newRoadmapTitle').value = '';
    document.getElementById('newRoadmapDesc').value = '';
    renderDashboard();
    renderSidebarList();
    renderAnalytics();
    navigateTo(rm.id);
    showToast('Roadmap created!');
  });

  // Add milestone
  document.getElementById('openAddMilestone').addEventListener('click', () => openModal('addMilestoneModal'));

  document.getElementById('confirmAddMilestone').addEventListener('click', () => {
    const title = document.getElementById('milestoneTitle').value.trim();
    if (!title) { showToast('Please enter a milestone title'); return; }
    const desc = document.getElementById('milestoneDesc').value;
    const notes = document.getElementById('milestoneNotes').value;
    const cat = document.getElementById('milestoneCat').value;
    const deadline = document.getElementById('milestoneDeadline').value;
    addMilestone(state.activeRoadmapId, title, desc, notes, cat, deadline);
    closeModal('addMilestoneModal');
    // Reset fields
    ['milestoneTitle','milestoneDesc','milestoneNotes','milestoneDeadline'].forEach(id => {
      document.getElementById(id).value = '';
    });
    renderRoadmapView(state.activeRoadmapId);
    renderSidebarList();
    renderAnalytics();
    showToast('Milestone added!');
  });

  // Edit milestone
  document.getElementById('confirmEditMilestone').addEventListener('click', () => {
    const id = document.getElementById('editMilestoneId').value;
    const title = document.getElementById('editMilestoneTitle').value.trim();
    if (!title) { showToast('Title required'); return; }
    updateMilestone(state.activeRoadmapId, id, {
      title,
      description: document.getElementById('editMilestoneDesc').value,
      notes: document.getElementById('editMilestoneNotes').value,
      category: document.getElementById('editMilestoneCat').value,
      deadline: document.getElementById('editMilestoneDeadline').value,
    });
    closeModal('editMilestoneModal');
    renderRoadmapView(state.activeRoadmapId);
    renderSidebarList();
    showToast('Milestone updated');
  });

  // Back button
  document.getElementById('backBtn').addEventListener('click', navigateToDashboard);

  // Delete roadmap
  document.getElementById('deleteRoadmapBtn').addEventListener('click', () => {
    const rm = getRoadmap(state.activeRoadmapId);
    if (!rm) return;
    if (!confirm(`Delete "${rm.title}" and all its milestones?`)) return;
    deleteRoadmap(state.activeRoadmapId);
    renderAnalytics();
    navigateToDashboard();
    showToast('Roadmap deleted');
  });

  // Export JSON
  document.getElementById('exportJsonBtn').addEventListener('click', () => {
    exportRoadmapJSON(state.activeRoadmapId);
  });

  // Print
  document.getElementById('printBtn').addEventListener('click', () => window.print());

  // Filter category
  document.getElementById('filterCategory').addEventListener('change', () => {
    if (state.activeRoadmapId) renderMilestones(state.activeRoadmapId);
  });

  // Search
  document.getElementById('searchInput').addEventListener('input', () => {
    renderSidebarList();
    if (!state.activeRoadmapId) renderDashboard();
  });

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Mobile menu toggle
  document.getElementById('mobileMenuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Modal close buttons (data-modal attribute)
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Keyboard: close modals with Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => closeModal(m.id));
    }
    if (e.key === 'Enter') {
      // Confirm modals on Enter
      const openModal = document.querySelector('.modal-overlay:not(.hidden)');
      if (openModal) {
        const confirm = openModal.querySelector('.btn-primary');
        if (confirm) confirm.click();
      }
    }
  });
}

// ── BOOT ──────────────────────────────────────────────
function boot() {
  loadFromLocalStorage();
  applyTheme(state.theme);
  wireEvents();
  renderUI();
}

document.addEventListener('DOMContentLoaded', boot);
