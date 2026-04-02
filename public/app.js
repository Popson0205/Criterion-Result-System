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
    currentPage = data.role === 'teacher' ? 'results' : 'dashboard';
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
        // Store for public result page
        window._shareStudent = data.student;
        window._shareResult  = data.result;
        // Inject settings so stamp & resumption date render correctly
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
      <div class="main-area">
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
    default:              return admin ? renderDashboard()  : renderResults();
  }
}

// ── DASHBOARD ────────────────────────────────────────────────
function renderDashboard() {
  const students = DB.getStudents();
  const results  = DB.getResults();
  const settings = DB.getSettings();
  const classCounts = {};
  ALL_CLASSES.forEach(c => { classCounts[c] = students.filter(s=>s.classId===c).length; });
  const totalStudents = students.length;
  const totalResults  = results.length;

  return `
  <div class="page-header">
    <h1 class="page-title">Dashboard</h1>
    <div class="page-meta">${settings.session} &nbsp;·&nbsp; ${settings.term}</div>
  </div>

  <div class="stats-row">
    <div class="stat-card card">
      <div class="stat-icon" style="background:#e8f5e9;">👥</div>
      <div class="stat-body">
        <div class="stat-val">${totalStudents}</div>
        <div class="stat-lbl">Total Students</div>
      </div>
    </div>
    <div class="stat-card card">
      <div class="stat-icon" style="background:#e3f2fd;">📋</div>
      <div class="stat-body">
        <div class="stat-val">${totalResults}</div>
        <div class="stat-lbl">Results Entered</div>
      </div>
    </div>
    <div class="stat-card card">
      <div class="stat-icon" style="background:#f3e5f5;">🏫</div>
      <div class="stat-body">
        <div class="stat-val">${ALL_CLASSES.length}</div>
        <div class="stat-lbl">Classes</div>
      </div>
    </div>
    <div class="stat-card card">
      <div class="stat-icon" style="background:#fff3e0;">📊</div>
      <div class="stat-body">
        <div class="stat-val">${totalStudents>0?Math.round(totalResults/totalStudents*100)+'%':'—'}</div>
        <div class="stat-lbl">Results Complete</div>
      </div>
    </div>
  </div>

  <div class="section-title-row">
    <h2 class="section-title">Classes Overview</h2>
    <button class="btn btn-primary btn-sm" onclick="navigate('students')">Manage Students</button>
  </div>
  <div class="class-grid">
    ${ALL_CLASSES.map(cls => {
      const count = classCounts[cls];
      const classResults = results.filter(r => {
        const st = students.find(s=>s.id===r.studentId);
        return st && st.classId===cls && r.session===settings.session && r.term===settings.term;
      }).length;
      return `
      <div class="class-card card card-hover" onclick="navigate('students');currentClass='${cls}';render();">
        <div class="class-name">${cls}</div>
        <div class="class-stats">
          <span>${count} student${count!==1?'s':''}</span>
          <span class="badge ${classResults===count&&count>0?'badge-success':''}">${classResults}/${count} results</span>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ── STUDENTS ─────────────────────────────────────────────────
function renderStudents() {
  const students = DB.getStudents();
  const filterClass = currentClass || '';
  const filtered = filterClass ? students.filter(s=>s.classId===filterClass) : students;
  const settings = DB.getSettings();

  return `
  <div class="page-header">
    <h1 class="page-title">Students</h1>
    <button class="btn btn-primary" onclick="navigate('add_student');editStudentId=null;">+ Add Student</button>
  </div>

  <div class="filter-bar card" style="margin-bottom:16px;gap:16px;flex-wrap:wrap;">
    <div style="display:flex;align-items:center;gap:8px;">
      <label style="font-size:12px;font-weight:600;color:var(--text-muted);white-space:nowrap;">Filter by Class</label>
      <select class="input" style="width:180px;" onchange="currentClass=this.value;render();">
        <option value="">All Classes</option>
        ${ALL_CLASSES.map(c=>`<option value="${c}" ${filterClass===c?'selected':''}>${c}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <label style="font-size:12px;font-weight:600;color:var(--text-muted);white-space:nowrap;">Session</label>
      <input type="text" class="input" style="width:110px;" value="${settings.session}"
        onchange="const s=DB.getSettings();s.session=this.value;DB.saveSettings(s);render();" />
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <label style="font-size:12px;font-weight:600;color:var(--text-muted);">Term</label>
      <select class="input" style="width:130px;"
        onchange="const s=DB.getSettings();s.term=this.value;DB.saveSettings(s);render();">
        ${TERMS.map(t=>`<option value="${t}" ${settings.term===t?'selected':''}>${t}</option>`).join('')}
      </select>
    </div>
  </div>

  <div class="card" style="padding:0;overflow:hidden;">
    <table class="data-table">
      <thead>
        <tr>
          <th>Passport</th>
          <th>Name</th>
          <th>Class</th>
          <th>Session</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.length === 0 ? `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted);">No students yet. <a href="#" onclick="navigate('add_student');editStudentId=null;">Add one →</a></td></tr>` :
          filtered.map(s => {
            const result = DB.getResult(s.id, settings.session, settings.term);
            return `
            <tr>
              <td>
                ${s.passport
                  ? `<img src="${s.passport}" style="width:36px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #55A845;" />`
                  : `<div style="width:36px;height:40px;background:#e8f5e9;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px;">👤</div>`}
              </td>
              <td style="font-weight:600;">${s.name}</td>
              <td><span class="badge">${s.classId}</span></td>
              <td style="color:var(--text-muted);font-size:12px;">${settings.session}</td>
              <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  <button class="btn btn-secondary btn-sm" onclick="editStudentId='${s.id}';navigate('edit_student');">Edit</button>
                  ${result
                    ? `<button class="btn btn-secondary btn-sm" onclick="editStudentId='${s.id}';navigate('enter_result');">Edit Result</button>
                       <button class="btn btn-ghost btn-sm" onclick="previewStudentId='${s.id}';navigate('preview_result');">Preview</button>`
                    : `<button class="btn btn-primary btn-sm" onclick="editStudentId='${s.id}';navigate('enter_result');">Enter Result</button>`
                  }
                  <button class="btn btn-ghost btn-sm" style="color:#dc2626;" onclick="deleteStudent('${s.id}')">Delete</button>
                </div>
              </td>
            </tr>`;
          }).join('')}
      </tbody>
    </table>
  </div>`;
}

// ── ADD/EDIT STUDENT ──────────────────────────────────────────
function renderAddStudent(studentId=null) {
  const student = studentId ? DB.getStudent(studentId) : null;
  const settings = DB.getSettings();
  return `
  <div class="page-header">
    <h1 class="page-title">${student ? 'Edit Student' : 'Add Student'}</h1>
    <button class="btn btn-ghost" onclick="navigate('students')">← Back</button>
  </div>
  <div class="card" style="max-width:600px;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group" style="grid-column:1/-1;">
        <label>Full Name *</label>
        <input id="s-name" type="text" class="input" value="${student?.name||''}" placeholder="Enter student's full name" />
      </div>
      <div class="form-group">
        <label>Class *</label>
        <select id="s-class" class="input">
          <option value="">-- Select Class --</option>
          ${ALL_CLASSES.map(c=>`<option value="${c}" ${student?.classId===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Days Attended</label>
        <input id="s-days" type="number" class="input" value="${student?.daysAttended||''}" placeholder="e.g. 60" />
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label>Passport Photo</label>
        <div style="display:flex;align-items:center;gap:16px;">
          <div id="passport-preview" style="width:80px;height:90px;border:2px dashed #55A845;border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f0fdf4;">
            ${student?.passport ? `<img src="${student.passport}" style="width:100%;height:100%;object-fit:cover;" />` : '<span style="font-size:24px;">📷</span>'}
          </div>
          <div>
            <input id="s-passport" type="file" accept="image/*" style="display:none;" onchange="previewPassport(this)" />
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('s-passport').click()">Upload Photo</button>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">JPG, PNG · Max 2MB</div>
          </div>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:12px;margin-top:20px;">
      <button class="btn btn-primary" onclick="saveStudent('${studentId||''}')">
        ${student ? 'Save Changes' : 'Add Student'}
      </button>
      <button class="btn btn-ghost" onclick="navigate('students')">Cancel</button>
    </div>
  </div>`;
}

function previewPassport(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('passport-preview');
    if (prev) prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;" />`;
    window._passportData = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveStudent(id) {
  const name  = document.getElementById('s-name')?.value.trim();
  const cls   = document.getElementById('s-class')?.value;
  const days  = document.getElementById('s-days')?.value;
  if (!name) { alert('Please enter student name.'); return; }
  if (!cls)  { alert('Please select a class.'); return; }
  const students = DB.getStudents();
  const passport = window._passportData || (id ? DB.getStudent(id)?.passport : null);
  if (id) {
    const idx = students.findIndex(s=>s.id===id);
    if (idx>=0) students[idx] = { ...students[idx], name, classId:cls, daysAttended:days, passport };
  } else {
    students.push({ id:uid(), name, classId:cls, daysAttended:days, passport, createdAt:Date.now() });
  }
  await DB.saveStudent(id ? students.find(s=>s.id===id) : students[students.length-1]);
  window._passportData = null;
  navigate('students');
}

async function deleteStudent(id) {
  if (!confirm('Delete this student and all their results?')) return;
  await DB.deleteStudent(id);
  render();
}

// ── RESULTS ──────────────────────────────────────────────────
function renderResults() {
  const settings = DB.getSettings();
  const students = DB.getStudents();
  const filterClass = currentClass || '';
  const filtered = filterClass ? students.filter(s=>s.classId===filterClass) : students;

  // Compute rankings per class
  const classRankings = {};
  ALL_CLASSES.forEach(cls => {
    const clsStudents = students.filter(s=>s.classId===cls);
    const withAvg = clsStudents.map(s => {
      const r = DB.getResult(s.id, settings.session, settings.term);
      if (!r) return { id:s.id, avg:0 };
      const subjects = CLASS_SUBJECTS[cls]||[];
      const { avg } = computeResult(r.scores||{}, subjects);
      return { id:s.id, avg:parseFloat(avg)||0 };
    }).sort((a,b)=>b.avg-a.avg);
    withAvg.forEach((s,i) => { classRankings[s.id] = { rank:i+1, total:clsStudents.length }; });
  });

  return `
  <div class="page-header">
    <h1 class="page-title">Results</h1>
    <div style="display:flex;gap:8px;align-items:center;"><div style="font-size:13px;color:var(--text-muted);">${settings.session} · ${settings.term}</div><button class="btn btn-secondary btn-sm" onclick="navigate('batch_print')">🖨️ Batch Print</button></div>
  </div>
  <div class="filter-bar card" style="margin-bottom:16px;">
    <label style="font-size:12px;font-weight:600;color:var(--text-muted);">Filter by Class</label>
    <select class="input" style="width:200px;" onchange="currentClass=this.value;render();">
      <option value="">All Classes</option>
      ${ALL_CLASSES.map(c=>`<option value="${c}" ${filterClass===c?'selected':''}>${c}</option>`).join('')}
    </select>
  </div>
  <div class="card" style="padding:0;overflow:hidden;">
    <table class="data-table">
      <thead>
        <tr>
          <th>Student</th><th>Class</th><th>Avg</th><th>Rank</th><th>Grade Dist.</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(s => {
          const r = DB.getResult(s.id, settings.session, settings.term);
          const subjects = CLASS_SUBJECTS[s.classId]||[];
          const computed = r ? computeResult(r.scores||{}, subjects) : null;
          const rk = classRankings[s.id];
          return `<tr>
            <td style="font-weight:600;">${s.name}</td>
            <td><span class="badge">${s.classId}</span></td>
            <td style="font-weight:700;color:#1a6e3c;">${computed ? computed.avg : '—'}</td>
            <td style="font-weight:700;">${rk && computed ? getOrdinal(rk.rank) : '—'}</td>
            <td style="font-size:11px;">
              ${computed ? Object.entries(computed.gradeCounts).filter(([,n])=>n>0).map(([g,n])=>`<span style="margin-right:4px;font-weight:600;">${g}:${n}</span>`).join('') : '<span style="color:var(--text-muted);">Not entered</span>'}
            </td>
            <td>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-${r?'secondary':'primary'} btn-sm" onclick="editStudentId='${s.id}';navigate('enter_result');">${r?'Edit':'Enter'}</button>
                ${r ? `<button class="btn btn-ghost btn-sm" onclick="previewStudentId='${s.id}';navigate('preview_result');">Preview</button>
                       ${isAdmin() ? `<button class="btn btn-ghost btn-sm" onclick="shareResult('${s.id}')">🔗 Share</button>` : ''}
                       ${isAdmin() ? `<button class="btn btn-ghost btn-sm" onclick="printResult('${s.id}')">🖨️ Print</button>` : ''}` : ''}
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

// ── ENTER RESULT ─────────────────────────────────────────────
function renderEnterResult() {
  const settings = DB.getSettings();
  const student = DB.getStudent(editStudentId);
  if (!student) { navigate('results'); return ''; }
  const subjects = CLASS_SUBJECTS[student.classId]||[];
  // Use per-entry session/term — default to global settings but allow override
  const entrySession = window._entrySession || settings.session;
  const entryTerm    = window._entryTerm    || settings.term;
  const existing = DB.getResult(student.id, entrySession, entryTerm) || { scores:{}, teacherComment:'', principalComment:'' };

  // ── Route to Creche form FIRST — before score computation ──
  if (isCrecheClass(student.classId)) {
    return renderCrecheEntryForm(student, existing, entrySession, entryTerm);
  }

  const { rows, totalCA, totalExam, totalScore, count, avg, gradeCounts } = computeResult(existing.scores, subjects);

  const subjectRows = rows.map((r,i) => {
    const rowBg = i%2===0 ? '#f5f5f5' : '#ffffff';
    return `<tr style="background:${rowBg};">
      <td style="text-align:left;padding:6px 10px;font-weight:500;color:#111;">${r.sub}</td>
      <td style="padding:5px 8px;">
        <input type="number" class="score-inp" min="0" max="40" data-sub="${r.sub}" data-type="ca"
          value="${existing.scores[r.sub]?.ca??''}" placeholder="0-40"
          style="width:64px;text-align:center;padding:4px 6px;border:1.5px solid #aaa;border-radius:6px;background:#fff;color:#111;font-size:14px;" />
      </td>
      <td style="padding:5px 8px;">
        <input type="number" class="score-inp" min="0" max="60" data-sub="${r.sub}" data-type="exam"
          value="${existing.scores[r.sub]?.exam??''}" placeholder="0-60"
          style="width:64px;text-align:center;padding:4px 6px;border:1.5px solid #aaa;border-radius:6px;background:#fff;color:#111;font-size:14px;" />
      </td>
      <td class="comp-total" data-sub="${r.sub}" style="font-weight:700;color:#111;">${r.total}</td>
      <td class="comp-grade" data-sub="${r.sub}" style="font-weight:700;color:${r.color||'#111'};">${r.grade}</td>
      <td class="comp-remark" data-sub="${r.sub}" style="color:#111;">${r.remark}</td>
    </tr>`;
  }).join('');

  return `
  <div class="page-header">
    <h1 class="page-title">Enter Result</h1>
    <button class="btn btn-ghost" onclick="navigate('results')">← Back</button>
  </div>

  <div class="result-entry-header card" style="margin-bottom:16px;">
    <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
      ${student.passport ? `<img src="${student.passport}" style="width:56px;height:64px;object-fit:cover;border-radius:6px;border:2px solid #55A845;" />` : `<div style="width:56px;height:64px;background:#e8f5e9;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:28px;">👤</div>`}
      <div style="flex:1;min-width:200px;">
        <div style="font-size:18px;font-weight:700;margin-bottom:8px;">${student.name} &nbsp;<span style="font-size:13px;font-weight:500;color:var(--text-muted);">${student.classId}</span></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <div class="form-group">
            <label>Session</label>
            <input id="entry-session" type="text" class="input" style="width:120px;"
              value="${entrySession}"
              onchange="window._entrySession=this.value;reloadEntryResult();" />
          </div>
          <div class="form-group">
            <label>Term</label>
            <select id="entry-term" class="input" style="width:130px;"
              onchange="window._entryTerm=this.value;reloadEntryResult();">
              ${TERMS.map(t=>`<option value="${t}" ${entryTerm===t?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px;">
    <div style="padding:12px 16px;background:#55A845;color:white;font-weight:600;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
      <span>Scores Entry — ${subjects.length} Subjects</span>
      <span id="entry-progress" style="font-size:12px;">${count}/${subjects.length} entered</span>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#6ab55a;color:white;">
            <th style="text-align:left;padding:8px 10px;width:35%;">Subject</th>
            <th>CA <small>/40</small></th>
            <th>Exam <small>/60</small></th>
            <th>Total</th>
            <th>Grade</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody id="scores-body">${subjectRows}</tbody>
        <tfoot>
          <tr style="background:#1a6e3c;color:white;font-weight:bold;">
            <td style="padding:6px 10px;">Total</td>
            <td id="foot-ca" style="text-align:center;">${totalCA||''}</td>
            <td id="foot-exam" style="text-align:center;">${totalExam||''}</td>
            <td id="foot-total" style="text-align:center;">${totalScore||''}</td>
            <td colspan="2" id="foot-avg" style="text-align:center;">Avg: ${avg}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>

  <div class="card" style="margin-bottom:16px;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group" style="grid-column:1/-1;">
        <label>Teacher's Comment <span style="font-weight:400;color:var(--text-muted);text-transform:none;">(leave blank for auto-generated based on average)</span></label>
        <input id="r-teacher" type="text" class="input" value="${existing.teacherComment||''}" placeholder="Auto-generated from average score — or type to override" />
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label>Principal's Comment <span style="font-weight:400;color:var(--text-muted);text-transform:none;">(leave blank for auto-generated)</span></label>
        <input id="r-principal" type="text" class="input" value="${existing.principalComment||''}" placeholder="Auto-generated from average score — or type to override" />
      </div>
      <div class="form-group">
        <label>Days Attended</label>
        <input id="r-days" type="number" class="input" value="${student.daysAttended||''}" placeholder="${settings.daysInSchool||'e.g. 60'}" />
      </div>
    </div>
  </div>

  <div style="display:flex;gap:12px;">
    <button class="btn btn-primary" onclick="saveResult()">💾 Save Result</button>
    <button class="btn btn-secondary" onclick="saveAndPreview()">👁 Save & Preview</button>
    <button class="btn btn-ghost" onclick="navigate('results')">Cancel</button>
  </div>`;
}

// ── PREVIEW RESULT ────────────────────────────────────────────
function renderPreviewResult() {
  const settings = DB.getSettings();
  const student = DB.getStudent(previewStudentId);
  if (!student) { navigate('results'); return ''; }
  // Try current entry session/term first, then fall back to settings
  const previewSess = window._entrySession || settings.session;
  const previewTerm = window._entryTerm    || settings.term;
  const result = DB.getResult(student.id, previewSess, previewTerm)
              || DB.getResult(student.id, settings.session, settings.term);
  if (!result) { navigate('results'); return ''; }

  // Compute rank using result's own session/term
  const clsStudents = DB.getStudents().filter(s=>s.classId===student.classId);
  const ranked = clsStudents.map(s => {
    const r = DB.getResult(s.id, result.session, result.term);
    if (!r) return { id:s.id, avg:0 };
    if (isCrecheClass(s.classId)) return { id:s.id, avg:0 };
    const { avg } = computeResult(r.scores||{}, CLASS_SUBJECTS[s.classId]||[]);
    return { id:s.id, avg:parseFloat(avg)||0 };
  }).sort((a,b)=>b.avg-a.avg);
  const rank = ranked.findIndex(s=>s.id===student.id)+1;

  const html = isCrecheClass(student.classId)
    ? buildCrecheResultHTML(student, result)
    : buildResultHTML(student, result, rank, clsStudents.length, false);

  return `
  <div class="page-header">
    <h1 class="page-title">Result Preview — ${student.name}</h1>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-ghost" onclick="navigate('results')">← Back</button>
      ${isAdmin() ? `<button class="btn btn-secondary" onclick="shareResult('${student.id}')">🔗 Share Link</button>` : ''}
      ${isAdmin() ? `<button class="btn btn-primary" onclick="printResult('${student.id}')">🖨️ Print</button>` : ''}
    </div>
  </div>
  <div class="card" style="padding:0;overflow:hidden;">
    <iframe id="result-frame" style="width:100%;height:900px;border:none;" srcdoc="${html.replace(/"/g,'&quot;')}"></iframe>
  </div>`;
}

// ── PUBLIC RESULT (shareable) ─────────────────────────────────
function renderPublicResult() {
  // Data pre-loaded by checkShareToken
  const student = window._shareStudent;
  const result  = window._shareResult;
  if (!student || !result) return `<div style="text-align:center;padding:60px;font-family:Arial;"><h2>Invalid or expired link.</h2></div>`;
  const t = { studentId: student.id, session: result.session, term: result.term };
  if (!student || !result) return `<div style="text-align:center;padding:60px;font-family:Arial;"><h2>Result not found.</h2></div>`;

  const clsStudents = DB.getStudents().filter(s=>s.classId===student.classId);
  const ranked = clsStudents.map(s => {
    const r = DB.getResult(s.id, t.session, t.term);
    if (!r) return {id:s.id,avg:0};
    const {avg} = computeResult(r.scores||{}, CLASS_SUBJECTS[s.classId]||[]);
    return {id:s.id,avg:parseFloat(avg)||0};
  }).sort((a,b)=>b.avg-a.avg);
  const rank = ranked.findIndex(s=>s.id===student.id)+1;

  const html = isCrecheClass(student.classId)
    ? buildCrecheResultHTML(student, result)
    : buildResultHTML(student, result, rank, clsStudents.length, false);
  document.open(); document.write(html); document.close();
  return '';
}

// ── SETTINGS ─────────────────────────────────────────────────
function renderSettings() {
  const s = DB.getSettings();
  return `
  <div class="page-header">
    <h1 class="page-title">Settings</h1>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:900px;">

    <div class="card">
      <h3 style="margin-bottom:16px;color:#55A845;font-size:14px;border-bottom:2px solid #e8f5e9;padding-bottom:8px;">📚 Academic Settings</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <div class="form-group">
          <label>Academic Session</label>
          <input id="set-session" type="text" class="input" value="${s.session}" />
        </div>
        <div class="form-group">
          <label>Current Term</label>
          <select id="set-term" class="input">
            ${TERMS.map(t=>`<option value="${t}" ${s.term===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>School Days This Term</label>
          <input id="set-days" type="number" class="input" value="${s.daysInSchool}" placeholder="e.g. 65" />
        </div>
        <div class="form-group">
          <label>Next Resumption Date</label>
          <input id="set-resumption" type="date" class="input" value="${s.resumptionDate}" />
        </div>
        <div class="form-group">
          <label>Principal's Name</label>
          <input id="set-principal" type="text" class="input" value="${s.principalName}" />
        </div>
        <div class="form-group">
          <label>School Motto</label>
          <input id="set-motto" type="text" class="input" value="${s.schoolMotto}" />
        </div>
      </div>
      <button class="btn btn-primary" style="margin-top:18px;" onclick="saveSettings()">💾 Save Settings</button>
    </div>

    <div class="card">
      <h3 style="margin-bottom:16px;color:#55A845;font-size:14px;border-bottom:2px solid #e8f5e9;padding-bottom:8px;">🖼️ Branding</h3>

      <div class="form-group" style="margin-bottom:20px;">
        <label>Official Stamp Image</label>
        <div style="display:flex;align-items:center;gap:14px;margin-top:6px;">
          <div id="stamp-preview" style="width:90px;height:90px;border:2px dashed #55A845;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f0fdf4;flex-shrink:0;">
            ${s.stampImage
              ? `<img src="${s.stampImage}" style="width:100%;height:100%;object-fit:contain;" />`
              : '<span style="font-size:28px;">🔏</span>'}
          </div>
          <div>
            <input id="stamp-file" type="file" accept="image/*" style="display:none;" onchange="previewStamp(this)" />
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('stamp-file').click()">Upload Stamp</button>
            ${s.stampImage ? `<button class="btn btn-ghost btn-sm" style="margin-top:6px;display:block;color:#dc2626;" onclick="clearStamp()">Remove</button>` : ''}
            <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">PNG with transparent background works best.<br/>Appears bottom-right on every result sheet.</div>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label>School Logo</label>
        <div style="display:flex;align-items:center;gap:14px;margin-top:6px;">
          <div style="width:72px;height:72px;border:2px solid #55A845;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f0fdf4;flex-shrink:0;">
            ${typeof SCHOOL_LOGO !== 'undefined' ? `<img src="${typeof SCHOOL_LOGO !== 'undefined' ? 'logo.png' : ''}" style="width:100%;height:100%;object-fit:contain;" />` : '<span style="font-size:22px;">🏫</span>'}
            <img src="logo.png" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'" />
          </div>
          <div style="font-size:12px;color:var(--text-muted);">Criterion College logo is embedded and appears top-left on every result sheet.</div>
        </div>
      </div>

      <div style="margin-top:20px;padding:12px;background:#f0fdf4;border-radius:8px;border-left:3px solid #55A845;">
        <div style="font-size:12px;font-weight:600;color:#1a6e3c;margin-bottom:4px;">💬 Auto-Comments</div>
        <div style="font-size:12px;color:#2d6a4f;">Teacher and Principal comments are automatically generated based on each student's average score. You can still override them manually when entering results.</div>
      </div>
    </div>

  </div>`;
}

function previewStamp(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('stamp-preview');
    if (prev) prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:contain;" />`;
    window._stampData = e.target.result;
    // Save immediately
    const s = DB.getSettings();
    s.stampImage = e.target.result;
    DB.saveSettings(s).catch(()=>{});
  };
  reader.readAsDataURL(file);
}

function clearStamp() {
  window._stampData = null;
  const s = DB.getSettings();
  s.stampImage = null;
  DB.saveSettings(s).then(() => render());
}

async function saveSettings() {
  const existing = DB.getSettings();
  const s = {
    session:       document.getElementById('set-session')?.value.trim(),
    term:          document.getElementById('set-term')?.value,
    daysInSchool:  document.getElementById('set-days')?.value,
    resumptionDate:document.getElementById('set-resumption')?.value,
    principalName: document.getElementById('set-principal')?.value.trim(),
    schoolMotto:   document.getElementById('set-motto')?.value.trim(),
    stampImage:    window._stampData || existing.stampImage || null,
  };
  await DB.saveSettings(s);
  window._stampData = null;
  // Show toast
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1a6e3c;color:white;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.2);';
  toast.textContent = '✓ Settings saved!';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// ── RESULT ACTIONS ────────────────────────────────────────────
async function saveResult(andPreview=false) {
  const settings = DB.getSettings();
  const student  = DB.getStudent(editStudentId);
  if (!student) return;
  const subjects = CLASS_SUBJECTS[student.classId]||[];
  const scores = {};
  document.querySelectorAll('.score-inp').forEach(inp => {
    const sub  = inp.dataset.sub;
    const type = inp.dataset.type;
    if (!scores[sub]) scores[sub] = {};
    scores[sub][type] = inp.value;
  });
  const days = document.getElementById('r-days')?.value;
  // Update days attended on student
  const students = DB.getStudents();
  const si = students.findIndex(s=>s.id===editStudentId);
  if (si>=0) students[si].daysAttended = days;
  if (si >= 0) await DB.saveStudent({ ...students[si], daysAttended: days });

  const saveSession = document.getElementById('entry-session')?.value || settings.session;
  const saveTerm    = document.getElementById('entry-term')?.value    || settings.term;
  await DB.saveResult({
    studentId:        student.id,
    session:          saveSession,
    term:             saveTerm,
    scores,
    teacherComment:   document.getElementById('r-teacher')?.value||'',
    principalComment: document.getElementById('r-principal')?.value||'',
  });
  // Reset entry overrides after save
  window._entrySession = null;
  window._entryTerm    = null;
  if (andPreview) { previewStudentId = editStudentId; navigate('preview_result'); }
  else { navigate('results'); }
}

function saveAndPreview() { saveResult(true); }

function reloadEntryResult() {
  // Re-render enter_result page with new session/term to load correct existing result
  navigate('enter_result');
}

function printResult(studentId) {
  const settings = DB.getSettings();
  const student  = DB.getStudent(studentId);
  const result   = DB.getResult(studentId, settings.session, settings.term);
  if (!student || !result) return;
  const clsStudents = DB.getStudents().filter(s=>s.classId===student.classId);
  // Position only assigned when ALL students in the class have results entered
  const clsWithResults = clsStudents.filter(s => !!DB.getResult(s.id, settings.session, settings.term));
  const allHaveResults = clsWithResults.length === clsStudents.length && clsStudents.length > 0;
  const ranked = clsWithResults.map(s => {
    const r = DB.getResult(s.id, settings.session, settings.term);
    const {avg} = computeResult(r.scores||{}, CLASS_SUBJECTS[s.classId]||[]);
    return {id:s.id,avg:parseFloat(avg)||0};
  }).sort((a,b)=>b.avg-a.avg);
  const rank = allHaveResults ? ranked.findIndex(s=>s.id===studentId)+1 : 0;
  const html = isCrecheClass(student.classId)
    ? buildCrecheResultHTML(student, result)
    : buildResultHTML(student, result, rank, clsWithResults.length, true);
  const win = window.open('','_blank');
  win.document.write(html);
  win.document.close();
  win.document.title = student.name.trim() + ' - ' + student.classId;
  setTimeout(()=>win.print(), 600);
}

async function shareResult(studentId) {
  const settings = DB.getSettings();
  const token = await DB.createShareToken(studentId, settings.session, settings.term);
  const student = DB.getStudent(studentId);
  const nameSlug = student ? student.name.trim().replace(/\s+/g, '-') : 'result';
  const url = window.location.origin + window.location.pathname + '?share=' + token + '&name=' + encodeURIComponent(nameSlug);
  // Copy to clipboard
  navigator.clipboard.writeText(url).catch(()=>{});
  // Show modal
  const modal = document.createElement('div');
  modal.id = 'share-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:24px;max-width:480px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <h3 style="margin-bottom:8px;color:#55A845;">🔗 Shareable Link Created</h3>
      <p style="font-size:13px;color:#555;margin-bottom:12px;">Share this link with board members or parents. Anyone with this link can view the result.</p>
      <div style="background:#f5f5f5;border-radius:8px;padding:10px 12px;font-size:12px;word-break:break-all;margin-bottom:16px;border:1px solid #ddd;color:#111;">${url}</div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${url}');this.textContent='✓ Copied!';setTimeout(()=>document.getElementById('share-modal').remove(),800);">📋 Copy Link</button>
        <button class="btn btn-ghost" onclick="document.getElementById('share-modal').remove()">Close</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// ── LIVE SCORE CALCULATION ────────────────────────────────────
function attachPageEvents() {
  document.querySelectorAll('.score-inp').forEach(inp => {
    inp.addEventListener('input', updateLiveScores);
  });
}

function updateLiveScores() {
  const settings = DB.getSettings();
  const student  = DB.getStudent(editStudentId);
  if (!student) return;
  const subjects = CLASS_SUBJECTS[student.classId]||[];
  const scores = {};
  document.querySelectorAll('.score-inp').forEach(inp => {
    const sub=inp.dataset.sub, type=inp.dataset.type;
    if (!scores[sub]) scores[sub]={};
    scores[sub][type]=inp.value;
  });
  let totalCA=0,totalExam=0,totalScore=0,count=0;
  subjects.forEach(sub => {
    const ca   = parseFloat(scores[sub]?.ca)||0;
    const exam = parseFloat(scores[sub]?.exam)||0;
    const total = ca+exam;
    const has = scores[sub]?.ca!==''&&scores[sub]?.ca!==undefined&&scores[sub]?.exam!==''&&scores[sub]?.exam!==undefined;
    if (has) { totalCA+=ca; totalExam+=exam; totalScore+=total; count++; }
    const {grade,remark,color} = getGrade(total);
    const tEl = document.querySelector(`.comp-total[data-sub="${sub}"]`);
    const gEl = document.querySelector(`.comp-grade[data-sub="${sub}"]`);
    const rEl = document.querySelector(`.comp-remark[data-sub="${sub}"]`);
    if (tEl) tEl.textContent = has ? total : '';
    if (gEl) { gEl.textContent = has?grade:''; gEl.style.color=has?color:'inherit'; }
    if (rEl) rEl.textContent = has?remark:'';
  });
  const avg = count>0?(totalScore/count).toFixed(2):'—';
  const fCA=document.getElementById('foot-ca'), fEx=document.getElementById('foot-exam');
  const fTo=document.getElementById('foot-total'), fAv=document.getElementById('foot-avg');
  const prog=document.getElementById('entry-progress');
  if (fCA) fCA.textContent=totalCA||'';
  if (fEx) fEx.textContent=totalExam||'';
  if (fTo) fTo.textContent=totalScore||'';
  if (fAv) fAv.textContent='Avg: '+avg;
  if (prog) prog.textContent=count+'/'+subjects.length+' entered';
}

// ── BOOT ─────────────────────────────────────────────────────
async function boot() {
  if (await checkShareToken()) return;
  const token = API.getToken();
  if (!token) { renderLoginPage(); return; }
  try {
    await DB.init();
    render();
  } catch(e) {
    sessionStorage.removeItem('cc_token');
    sessionStorage.removeItem('cc_role');
    sessionStorage.removeItem('cc_user');
    renderLoginPage();
  }
}
boot();


// ============================================================
// TEACHER MANAGEMENT (Admin only)
// ============================================================
function renderTeachers() {
  const teachers = DB._teachersList || [];
  // Load teachers async and re-render
  if (!DB._teachersLoaded) {
    DB._teachersLoaded = true;
    DB.getTeachers().then(list => {
      DB._teachersList = list || [];
      render();
    });
    return `<div style="padding:40px;text-align:center;color:var(--text-muted);">Loading teachers...</div>`;
  }

  return `
  <div class="page-header">
    <h1 class="page-title">Teachers</h1>
    <button class="btn btn-primary" onclick="showTeacherModal()">+ Add Teacher</button>
  </div>

  <div class="card" style="padding:0;overflow:hidden;">
    ${teachers.length === 0
      ? `<div style="padding:32px;text-align:center;color:var(--text-muted);">No teacher accounts yet. Add one to get started.</div>`
      : `<table class="data-table">
          <thead><tr>
            <th>Name</th><th>Username</th><th>Created</th><th style="width:120px;"></th>
          </tr></thead>
          <tbody>
            ${teachers.map(t => `
            <tr>
              <td style="font-weight:600;">${t.name || t.username}</td>
              <td style="color:var(--text-muted);">${t.username}</td>
              <td style="color:var(--text-muted);font-size:12px;">${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</td>
              <td>
                <button class="btn btn-ghost btn-sm" onclick="showTeacherModal('${t.id}','${t.username}','${t.name||t.username}')">Edit</button>
                <button class="btn btn-ghost btn-sm" style="color:#dc2626;" onclick="deleteTeacher('${t.id}')">Delete</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`}
  </div>

  <!-- Teacher Modal -->
  <div id="teacher-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;align-items:center;justify-content:center;">
    <div class="card" style="width:400px;padding:28px;">
      <h3 id="teacher-modal-title" style="margin-bottom:20px;color:#1a6e3c;">Add Teacher</h3>
      <input type="hidden" id="teacher-id" value="" />
      <div class="form-group" style="margin-bottom:14px;">
        <label>Full Name</label>
        <input id="teacher-name" type="text" class="input" placeholder="e.g. Mrs. Adewale" />
      </div>
      <div class="form-group" style="margin-bottom:14px;">
        <label>Username</label>
        <input id="teacher-username" type="text" class="input" placeholder="e.g. adewale" />
      </div>
      <div class="form-group" style="margin-bottom:20px;">
        <label>Password <span id="teacher-pass-hint" style="font-weight:400;color:var(--text-muted);text-transform:none;">(required for new)</span></label>
        <input id="teacher-password" type="password" class="input" placeholder="Leave blank to keep existing" />
      </div>
      <div id="teacher-error" style="color:#dc2626;font-size:13px;margin-bottom:12px;min-height:16px;"></div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-primary" onclick="saveTeacher()">Save</button>
        <button class="btn btn-ghost" onclick="closeTeacherModal()">Cancel</button>
      </div>
    </div>
  </div>`;
}

function showTeacherModal(id='', username='', name='') {
  DB._teachersLoaded = false; // force reload on next render
  document.getElementById('teacher-modal').style.display = 'flex';
  document.getElementById('teacher-modal-title').textContent = id ? 'Edit Teacher' : 'Add Teacher';
  document.getElementById('teacher-id').value = id;
  document.getElementById('teacher-username').value = username;
  document.getElementById('teacher-name').value = name;
  document.getElementById('teacher-password').value = '';
  document.getElementById('teacher-error').textContent = '';
  document.getElementById('teacher-pass-hint').textContent = id ? '(leave blank to keep existing)' : '(required)';
}

function closeTeacherModal() {
  document.getElementById('teacher-modal').style.display = 'none';
}

async function saveTeacher() {
  const id       = document.getElementById('teacher-id').value;
  const username = document.getElementById('teacher-username').value.trim();
  const name     = document.getElementById('teacher-name').value.trim();
  const password = document.getElementById('teacher-password').value;
  const errEl    = document.getElementById('teacher-error');
  errEl.textContent = '';

  if (!username) { errEl.textContent = 'Username is required'; return; }
  if (!id && !password) { errEl.textContent = 'Password is required for new teacher'; return; }

  try {
    if (id) {
      await DB.updateTeacher(id, { username, name, password: password || undefined });
    } else {
      await DB.createTeacher({ username, password, name });
    }
    DB._teachersList = null;
    DB._teachersLoaded = false;
    closeTeacherModal();
    navigate('teachers');
  } catch(e) {
    errEl.textContent = e.message || 'Failed to save teacher';
  }
}

async function deleteTeacher(id) {
  if (!confirm('Delete this teacher account?')) return;
  await DB.deleteTeacher(id);
  DB._teachersList = null;
  DB._teachersLoaded = false;
  navigate('teachers');
}

// ============================================================
// BATCH PRINT — all students in a class
// ============================================================
function batchPrintClass(classId) {
  const settings = DB.getSettings();
  const students = DB.getStudents().filter(s => s.classId === classId);
  if (students.length === 0) { alert('No students found in ' + classId); return; }

  // Position only assigned when ALL students in the class have results entered
  const studentsWithResults = students.filter(s => !!DB.getResult(s.id, settings.session, settings.term));
  const allHaveResults = studentsWithResults.length === students.length && students.length > 0;
  const withAvg = studentsWithResults.map(s => {
    const r = DB.getResult(s.id, settings.session, settings.term);
    const { avg } = computeResult(r.scores || {}, CLASS_SUBJECTS[classId] || []);
    return { id: s.id, avg: parseFloat(avg) || 0 };
  }).sort((a, b) => b.avg - a.avg);

  const rankMap = {};
  withAvg.forEach((s, i) => { rankMap[s.id] = i + 1; });
  const totalRanked = studentsWithResults.length;

  // Build all pages — only students who have results
  const pages = [];
  studentsWithResults.forEach(s => {
    const r = DB.getResult(s.id, settings.session, settings.term);
    const rank = allHaveResults ? rankMap[s.id] : 0;
    if (isCrecheClass(classId)) {
      pages.push(buildCrecheResultHTML(s, r));
    } else {
      pages.push(buildResultHTML(s, r, rank, totalRanked, true));
    }
  });

  if (pages.length === 0) { alert('No results entered for ' + classId + ' yet.'); return; }

  const combined = pages.join('<div style="page-break-after:always;"></div>');
  const win = window.open('', '_blank');
  win.document.write(combined);
  win.document.close();
  win.document.title = classId + ' - Results';
  setTimeout(() => win.print(), 700);
}

// ============================================================
// BATCH PRINT PAGE
// ============================================================
function renderBatchPrint() {
  const settings = DB.getSettings();
  const students = DB.getStudents();

  // Count results per class
  const classData = ALL_CLASSES.map(cls => {
    const clsStudents = students.filter(s => s.classId === cls);
    const withResult  = clsStudents.filter(s => DB.getResult(s.id, settings.session, settings.term));
    return { cls, total: clsStudents.length, withResult: withResult.length };
  }).filter(d => d.total > 0);

  return `
  <div class="page-header">
    <h1 class="page-title">Batch Print</h1>
    <div class="page-meta">${settings.session} &nbsp;·&nbsp; ${settings.term}</div>
  </div>

  <div class="card" style="margin-bottom:20px;padding:16px 20px;background:linear-gradient(135deg,#f0fdf4,#e8f5e9);border-left:4px solid #55A845;">
    <div style="font-weight:700;color:#1a6e3c;margin-bottom:4px;">How Batch Print Works</div>
    <div style="font-size:13px;color:#2d6a4f;">Select a class and click Print — every student's result sheet prints on a separate page, with correct class rankings auto-calculated. Only students with entered results are included.</div>
  </div>

  <div class="card" style="padding:0;overflow:hidden;">
    <table class="data-table">
      <thead>
        <tr>
          <th>Class</th>
          <th>Total Students</th>
          <th>Results Ready</th>
          <th>Coverage</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${classData.length === 0
          ? `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted);">No students added yet. Go to Students to add them.</td></tr>`
          : classData.map(d => {
              const pct = d.total > 0 ? Math.round(d.withResult / d.total * 100) : 0;
              const barColor = pct === 100 ? '#55A845' : pct > 50 ? '#d97706' : '#dc2626';
              return `<tr>
                <td style="font-weight:700;color:#1a6e3c;">${d.cls}</td>
                <td style="text-align:center;">${d.total}</td>
                <td style="text-align:center;font-weight:600;">${d.withResult}</td>
                <td style="min-width:140px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <div style="flex:1;height:6px;background:#e5e7eb;border-radius:99px;overflow:hidden;">
                      <div style="height:100%;width:${pct}%;background:${barColor};border-radius:99px;transition:width 0.3s;"></div>
                    </div>
                    <span style="font-size:12px;font-weight:600;color:${barColor};min-width:32px;">${pct}%</span>
                  </div>
                </td>
                <td>
                  <div style="display:flex;gap:8px;">
                    ${d.withResult > 0
                      ? `<button class="btn btn-primary btn-sm" onclick="batchPrintClass('${d.cls}')">
                          🖨️ Print All ${d.withResult} Result${d.withResult !== 1 ? 's' : ''}
                        </button>`
                      : `<span style="font-size:12px;color:var(--text-muted);">No results yet</span>`}
                  </div>
                </td>
              </tr>`;
            }).join('')}
      </tbody>
    </table>
  </div>

  <div style="margin-top:20px;" class="card">
    <div style="font-weight:600;margin-bottom:12px;color:var(--text-primary);">Print All Classes at Once</div>
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
      Prints every result sheet across all classes in one go. Make sure all results are entered first.
    </div>
    <button class="btn btn-primary" onclick="printAllClasses()">
      🖨️ Print Entire School (${classData.reduce((a,d)=>a+d.withResult,0)} results)
    </button>
  </div>`;
}

function printAllClasses() {
  const settings = DB.getSettings();
  const students  = DB.getStudents();
  const pages = [];

  ALL_CLASSES.forEach(cls => {
    const clsStudents = students.filter(s => s.classId === cls);
    if (clsStudents.length === 0) return;

    const clsWithResults = clsStudents.filter(s => !!DB.getResult(s.id, settings.session, settings.term));
    const allHaveResults = clsWithResults.length === clsStudents.length && clsStudents.length > 0;
    const withAvg = clsWithResults.map(s => {
      const r = DB.getResult(s.id, settings.session, settings.term);
      const { avg } = computeResult(r.scores || {}, CLASS_SUBJECTS[cls] || []);
      return { id: s.id, avg: parseFloat(avg) || 0 };
    }).sort((a, b) => b.avg - a.avg);

    const rankMap = {};
    withAvg.forEach((s, i) => { rankMap[s.id] = i + 1; });
    const totalRanked = clsWithResults.length;

    clsWithResults.forEach(s => {
      const r = DB.getResult(s.id, settings.session, settings.term);
      const rank = allHaveResults ? rankMap[s.id] : 0;
      if (isCrecheClass(cls)) {
        pages.push(buildCrecheResultHTML(s, r));
      } else {
        pages.push(buildResultHTML(s, r, rank, totalRanked, true));
      }
    });
  });

  if (pages.length === 0) { alert('No results found across any class.'); return; }
  const combined = pages.join('<div style="page-break-after:always;"></div>');
  const win = window.open('', '_blank');
  win.document.write(combined);
  win.document.close();
  const settings2 = DB.getSettings();
  win.document.title = 'Criterion College - All Results - ' + settings2.session + ' ' + settings2.term;
  setTimeout(() => win.print(), 700);
}

// ============================================================
// CRECHE ENTRY FORM
// ============================================================
function renderCrecheEntryForm(student, existing, entrySession, entryTerm) {
  const classDef = CRECHE_SECTIONS[student.classId] || CRECHE_SECTIONS['Creche 1'];
  const ratings  = existing.scores || {};

  const sectionRows = classDef.sections.map(section => {
    const headerRow = `
      <tr>
        <td colspan="2" style="background:${section.color};color:#fff;font-weight:700;font-size:13px;padding:8px 12px;text-align:left;">
          ${section.title}
        </td>
      </tr>`;

    const skillRows = section.skills.map((skill, i) => {
      const rowBg  = i % 2 === 0 ? '#ffffff' : '#f5f5f5';
      const ca   = ratings[skill]?.ca   ?? '';
      const exam = ratings[skill]?.exam ?? '';
      const total = (ca !== '' && exam !== '') ? parseFloat(ca||0) + parseFloat(exam||0) : '';
      const grade = total !== '' ? getCrecheGrade(total) : null;
      return `<tr style="background:${rowBg};" data-creche-row="${skill}">
        <td style="text-align:left;padding:7px 12px;font-weight:500;font-size:13px;width:40%;color:#111;">${skill}</td>
        <td style="padding:5px 8px;width:15%;">
          <input type="number" class="score-inp creche-ca" min="0" max="40"
            data-sub="${skill}" data-type="ca"
            value="${ca}" placeholder="0-40"
            style="width:64px;text-align:center;padding:4px 6px;border:1.5px solid #aaa;border-radius:6px;background:#fff;color:#111;font-size:14px;"
            oninput="updateCrecheRow(this)" />
        </td>
        <td style="padding:5px 8px;width:15%;">
          <input type="number" class="score-inp creche-exam" min="0" max="60"
            data-sub="${skill}" data-type="exam"
            value="${exam}" placeholder="0-60"
            style="width:64px;text-align:center;padding:4px 6px;border:1.5px solid #aaa;border-radius:6px;background:#fff;color:#111;font-size:14px;"
            oninput="updateCrecheRow(this)" />
        </td>
        <td class="creche-grade-cell" data-sub="${skill}" style="padding:7px 12px;font-weight:bold;font-size:13px;color:${grade?grade.color:'#888'};">
          ${grade ? grade.rating : '—'}
        </td>
      </tr>`;
    }).join('');

    return headerRow + skillRows;
  }).join('');

  return `
  <div class="page-header">
    <h1 class="page-title">Enter Result <span style="font-size:14px;font-weight:500;color:var(--text-muted);">(Creche)</span></h1>
    <button class="btn btn-ghost" onclick="window._entrySession=null;window._entryTerm=null;navigate('results')">← Back</button>
  </div>

  <div class="result-entry-header card" style="margin-bottom:16px;">
    <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
      ${student.passport
        ? `<img src="${student.passport}" style="width:56px;height:64px;object-fit:cover;border-radius:6px;border:2px solid #00B050;" />`
        : `<div style="width:56px;height:64px;background:#e8f5e9;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:28px;">👤</div>`}
      <div style="flex:1;min-width:200px;">
        <div style="font-size:18px;font-weight:700;margin-bottom:8px;">${student.name} &nbsp;<span style="font-size:13px;font-weight:500;color:var(--text-muted);">${student.classId}</span></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <div class="form-group">
            <label>Session</label>
            <input id="entry-session" type="text" class="input" style="width:120px;"
              value="${entrySession}"
              onchange="window._entrySession=this.value;reloadEntryResult();" />
          </div>
          <div class="form-group">
            <label>Term</label>
            <select id="entry-term" class="input" style="width:130px;"
              onchange="window._entryTerm=this.value;reloadEntryResult();">
              ${TERMS.map(t=>`<option value="${t}" ${entryTerm===t?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px;">
    <div style="padding:12px 16px;background:#00B050;color:white;font-weight:600;font-size:13px;">
      Skills &amp; Character Ratings — ${student.classId}
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#e8f5e9;">
            <th style="text-align:left;padding:8px 12px;font-size:12px;color:#1a6e3c;text-transform:uppercase;letter-spacing:0.5px;width:40%;">Skill / Area</th>
            <th style="padding:8px 12px;font-size:12px;color:#1a6e3c;text-transform:uppercase;letter-spacing:0.5px;width:15%;">CA /40</th>
            <th style="padding:8px 12px;font-size:12px;color:#1a6e3c;text-transform:uppercase;letter-spacing:0.5px;width:15%;">Exam /60</th>
            <th style="padding:8px 12px;font-size:12px;color:#1a6e3c;text-transform:uppercase;letter-spacing:0.5px;width:30%;">Rating</th>
          </tr>
        </thead>
        <tbody>${sectionRows}</tbody>
      </table>
    </div>
  </div>

  <div class="card" style="margin-bottom:16px;">
    <div class="form-group">
      <label>Principal's Comment <span style="font-weight:400;color:var(--text-muted);text-transform:none;">(leave blank for auto-generated)</span></label>
      <input id="r-principal" type="text" class="input" value="${existing.principalComment||''}"
        placeholder="Auto-generated based on ratings — or type to override" />
    </div>
    <div class="form-group" style="margin-top:12px;">
      <label>Days Attended</label>
      <input id="r-days" type="number" class="input" style="width:140px;" value="${student.daysAttended||''}" placeholder="e.g. 60" />
    </div>
  </div>

  <div style="display:flex;gap:12px;">
    <button class="btn btn-primary" onclick="saveCrecheResult()">💾 Save Result</button>
    <button class="btn btn-secondary" onclick="saveCrecheAndPreview()">👁 Save &amp; Preview</button>
    <button class="btn btn-ghost" onclick="window._entrySession=null;window._entryTerm=null;navigate('results')">Cancel</button>
  </div>`;
}

function updateCrecheRow(input) {
  const sub  = input.dataset.sub;
  const row  = document.querySelector(`tr[data-creche-row="${sub}"]`);
  if (!row) return;
  const caEl   = row.querySelector('.creche-ca');
  const examEl = row.querySelector('.creche-exam');
  const gradeEl = row.querySelector('.creche-grade-cell');
  if (!caEl || !examEl || !gradeEl) return;
  const ca   = parseFloat(caEl.value)   || 0;
  const exam = parseFloat(examEl.value) || 0;
  const has  = caEl.value !== '' && examEl.value !== '';
  if (has) {
    const { rating, color } = getCrecheGrade(ca + exam);
    gradeEl.textContent = rating;
    gradeEl.style.color = color;
  } else {
    gradeEl.textContent = '—';
    gradeEl.style.color = '#aaa';
  }
}

async function saveCrecheResult(andPreview=false) {
  const settings = DB.getSettings();
  const student  = DB.getStudent(editStudentId);
  if (!student) return;

  const saveSession = document.getElementById('entry-session')?.value || settings.session;
  const saveTerm    = document.getElementById('entry-term')?.value    || settings.term;

  // Collect CA+Exam scores
  const scores = {};
  document.querySelectorAll('.score-inp').forEach(inp => {
    const sub  = inp.dataset.sub;
    const type = inp.dataset.type;
    if (!sub || !type) return;
    if (!scores[sub]) scores[sub] = {};
    scores[sub][type] = inp.value;
  });

  // Update days attended on student
  const days = document.getElementById('r-days')?.value;
  const students = DB.getStudents();
  const si = students.findIndex(s=>s.id===editStudentId);
  if (si>=0) students[si].daysAttended = days;
  await DB.saveStudent({ ...students[si], daysAttended: days });

  await DB.saveResult({
    studentId:        student.id,
    session:          saveSession,
    term:             saveTerm,
    scores,
    teacherComment:   '',
    principalComment: document.getElementById('r-principal')?.value || '',
    isCreche:         true,
  });

  window._entrySession = null;
  window._entryTerm    = null;

  if (andPreview) { previewStudentId = editStudentId; navigate('preview_result'); }
  else { navigate('results'); }
}

function saveCrecheAndPreview() { saveCrecheResult(true); }
