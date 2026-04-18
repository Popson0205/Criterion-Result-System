// ============================================================
// CRITERION COLLEGE — MAIN APP (Web Service Edition)
// ============================================================

let currentPage = 'dashboard';
let currentClass = '';
let editStudentId = null;
let editResultId = null;
let previewStudentId = null;

function isAdmin() { return API.getRole() === 'admin'; }
function doLogout() {
  sessionStorage.removeItem('cc_token');
  sessionStorage.removeItem('cc_role');
  sessionStorage.removeItem('cc_user');
  DB.invalidate();
  currentPage = 'dashboard';
  renderLoginPage();
}

function navigate(page, params={}) {
  currentPage = page;
  if (params.classId !== undefined) currentClass = params.classId;
  if (params.studentId !== undefined) editStudentId = params.studentId;
  if (params.previewId !== undefined) previewStudentId = params.previewId;
  render();
  window.scrollTo(0,0);
}

// ── LOGIN PAGE ────────────────────────────────────────────────
function renderLoginPage() {
  const logoHTML = (typeof SCHOOL_LOGO !== 'undefined' && SCHOOL_LOGO)
    ? `<img src="${SCHOOL_LOGO}" style="width:90px;height:90px;object-fit:contain;border-radius:50%;display:block;margin:0 auto;" />`
    : `<div style="width:90px;height:90px;background:linear-gradient(135deg,#1a6e3c,#55A845);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:28px;margin:0 auto;">CC</div>`;

  document.getElementById('app').innerHTML = `
  <div class="login-screen">
    <div class="card login-card">
      <div class="login-logo">
        ${logoHTML}
        <div class="login-school">CRITERION COLLEGE</div>
        <div class="login-sub">OSOGBO &nbsp;·&nbsp; Result Management System</div>
      </div>

      <div class="role-selector">
        <button class="role-btn active" id="btn-admin" onclick="selectRole('admin')">
          <div class="role-icon">🔐</div>
          <div class="role-label">Admin</div>
          <div class="role-desc">Full access</div>
        </button>
        <button class="role-btn" id="btn-teacher" onclick="selectRole('teacher')">
          <div class="role-icon">👩‍🏫</div>
          <div class="role-label">Teacher</div>
          <div class="role-desc">Score entry</div>
        </button>
        <button class="role-btn" id="btn-bursar" onclick="selectRole('bursar')">
          <div class="role-icon">💰</div>
          <div class="role-label">Bursar</div>
          <div class="role-desc">Receipts</div>
        </button>
      </div>

      <div class="form-group" style="margin-bottom:14px;">
        <label>Username</label>
        <input id="login-username" type="text" class="input" placeholder="admin"
          value="admin" onkeydown="if(event.key==='Enter')doLogin()" />
      </div>
      <div class="form-group" style="margin-bottom:20px;">
        <label>Password</label>
        <input id="login-password" type="password" class="input" placeholder="••••••••"
          onkeydown="if(event.key==='Enter')doLogin()" />
      </div>
      <div id="login-error" style="color:#dc2626;font-size:13px;margin-bottom:12px;min-height:18px;"></div>
      <button class="btn btn-primary" style="width:100%;" onclick="doLogin()">Sign In →</button>
    </div>
  </div>`;
}

let _selectedRole = 'admin';
function selectRole(role) {
  _selectedRole = role;
  document.getElementById('btn-admin').classList.toggle('active', role === 'admin');
  document.getElementById('btn-teacher').classList.toggle('active', role === 'teacher');
  const bursarBtn = document.getElementById('btn-bursar');
  if (bursarBtn) bursarBtn.classList.toggle('active', role === 'bursar');
  document.getElementById('login-username').value = role === 'admin' ? 'admin' : '';
  document.getElementById('login-username').focus();
}

async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Enter username and password'; return; }
  try {
    const res  = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Login failed'; return; }
    sessionStorage.setItem('cc_token', data.token);
    sessionStorage.setItem('cc_role',  data.role);
    sessionStorage.setItem('cc_user',  JSON.stringify({ name: data.name, username: data.username, role: data.role }));
    currentPage = data.role === 'teacher' ? 'results' : data.role === 'bursar' ? 'receipts' : 'dashboard';
    try {
      await DB.init();
    } catch(initErr) {
      console.error('DB.init failed:', initErr);
      errEl.textContent = 'Connected but failed to load data: ' + initErr.message;
      return;
    }
    render();
  } catch(e) {
    console.error('Login error:', e);
    errEl.textContent = 'Server error: ' + e.message;
  }
}

// ── Check for share token in URL ─────────────────────────────
async function checkShareToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('share');
  if (token) {
    try {
      const data = await fetch('/api/share/' + token).then(r => r.json());
      if (data && data.student) {
        window._shareStudent = data.student;
        window._shareResult  = data.result;
        if (data.settings) DB._settings = data.settings;
        previewStudentId = data.student.id;
        currentPage = 'public_result';
        render();
        return true;
      }
    } catch(e) {}
  }
  return false;
}

// ── Main Render ──────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  if (currentPage === 'public_result') { app.innerHTML = renderPublicResult(); return; }
  if (!API.getToken()) { renderLoginPage(); return; }
  app.innerHTML = `
    <div class="layout">
      ${renderSidebar()}
      <div class="main-area" id="main-content">
        ${renderPage()}
      </div>
    </div>`;
  attachPageEvents();
}

// ── LOGIN (handled by renderLoginPage above) ─────────────────
function attachLoginEvents() {}  // no-op, kept for compat

// ── SIDEBAR ──────────────────────────────────────────────────
function renderSidebar() {
  const admin = isAdmin();
  const user  = API.getUser() || {};
  const logoImgHTML = (typeof SCHOOL_LOGO !== 'undefined' && SCHOOL_LOGO)
    ? `<img src="${SCHOOL_LOGO}" style="width:38px;height:38px;border-radius:50%;object-fit:contain;border:2px solid rgba(255,255,255,0.3);" />`
    : `<div class="logo-circle-sm">CC</div>`;
  const nav = [
    ...(admin ? [{ id:'dashboard',   icon:'🏠', label:'Dashboard' }]   : []),
    ...(admin ? [{ id:'students',    icon:'👥', label:'Students' }]    : []),
    { id:'results',     icon:'📋', label:'Results' },
    ...(admin ? [{ id:'batch_print', icon:'🖨️', label:'Batch Print' }] : []),
    ...(admin ? [{ id:'teachers',    icon:'👩‍🏫', label:'Teachers' }]   : []),
    ...(admin ? [{ id:'settings',    icon:'⚙️', label:'Settings' }]    : []),
    ...((admin || API.getRole() === 'bursar') ? [{ id:'receipts', icon:'🧾', label:'Receipts' }] : []),
    ...(admin ? [{ id:'bursars', icon:'💰', label:'Bursars' }] : []),
  ];
  return `
  <aside class="sidebar">
    <div class="sidebar-logo">
      ${logoImgHTML}
      <div>
        <div class="sidebar-school">Criterion College</div>
        <div class="sidebar-sub">${admin ? 'Admin Portal' : 'Teacher Portal'}</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      ${nav.map(n=>`
        <button class="nav-item ${currentPage===n.id?'active':''}" onclick="navigate('${n.id}')">
          <span class="nav-icon">${n.icon}</span>
          <span>${n.label}</span>
        </button>`).join('')}
    </nav>
    <div style="padding:8px 8px 4px;">
      <div style="padding:8px 12px;font-size:11px;color:rgba(255,255,255,0.5);">
        ${user.name || user.username || ''}<br/>
        <span style="background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.9);padding:1px 7px;border-radius:99px;font-weight:700;font-size:10px;">${(user.role||'').toUpperCase()}</span>
      </div>
    </div>
    <button class="nav-item logout-btn" onclick="doLogout()">
      <span class="nav-icon">🚪</span><span>Logout</span>
    </button>
  </aside>`;
}

// ── PAGE ROUTER ──────────────────────────────────────────────
function renderPage() {
  const admin = isAdmin();
  switch(currentPage) {
    case 'dashboard':     return admin ? renderDashboard() : renderResults();
    case 'students':      return admin ? renderStudents()  : renderResults();
    case 'add_student':   return admin ? renderAddStudent() : renderResults();
    case 'edit_student':  return admin ? renderAddStudent(editStudentId) : renderResults();
    case 'results':       return renderResults();
    case 'enter_result':  return renderEnterResult();
    case 'preview_result':return renderPreviewResult();
    case 'batch_print':   return admin ? renderBatchPrint() : renderResults();
    case 'teachers':      return admin ? renderTeachers()   : renderResults();
    case 'settings':      return admin ? renderSettings()   : renderResults();
    case 'receipts':      if (admin || API.getRole() === 'bursar') { setTimeout(renderReceiptsPage, 0); return '<div style="padding:40px;text-align:center;color:var(--text-muted);">Loading receipts…</div>'; } return renderResults();
    case 'bursars':       return admin ? renderBursars()    : renderResults();
    default:              return admin ? renderDashboard()  : renderResults();
  }
}
