// ============================================================
// admission-admin.js — Admin Admissions Panel
// Criterion College Result Management System
// ============================================================

async function renderAdmissions() {
  const main = document.querySelector('.main-area');
  if (!main) return;
  main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">📋 Admissions</div>
        <div class="page-meta">Manage 2026/2027 applicants</div>
      </div>
      <a href="/admission" target="_blank" class="btn btn-primary" style="text-decoration:none;">
        🔗 View Public Form
      </a>
    </div>

    <div class="stats-row" id="admStats" style="margin-bottom:20px;">
      <div class="stat-card card"><div class="stat-icon" style="background:#fef3c7">📬</div><div><div class="stat-val" id="sPending">—</div><div class="stat-lbl">Pending</div></div></div>
      <div class="stat-card card"><div class="stat-icon" style="background:#d1fae5">✅</div><div><div class="stat-val" id="sAdmitted">—</div><div class="stat-lbl">Admitted</div></div></div>
      <div class="stat-card card"><div class="stat-icon" style="background:#fee2e2">❌</div><div><div class="stat-val" id="sRejected">—</div><div class="stat-lbl">Rejected</div></div></div>
      <div class="stat-card card"><div class="stat-icon" style="background:#ede9fe">📊</div><div><div class="stat-val" id="sTotal">—</div><div class="stat-lbl">Total</div></div></div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="filter-bar" style="flex-wrap:wrap;gap:10px;">
        <select id="admFilter" class="input" style="width:160px;" onchange="filterAdmissions()">
          <option value="all">All Applicants</option>
          <option value="pending">Pending</option>
          <option value="admitted">Admitted</option>
          <option value="rejected">Rejected</option>
        </select>
        <input type="text" class="input" id="admSearch" placeholder="🔍  Search name or ref…"
               style="flex:1;min-width:200px;" oninput="filterAdmissions()" />
      </div>
    </div>

    <div class="card" style="overflow-x:auto;">
      <div id="admTableWrap">
        <div style="text-align:center;padding:40px;color:#9ca3af;">Loading applicants…</div>
      </div>
    </div>

    <div id="admModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:999;overflow-y:auto;padding:20px;">
      <div id="admModalCard" style="background:white;border-radius:16px;max-width:680px;margin:0 auto;padding:32px;box-shadow:0 20px 60px rgba(0,0,0,0.2);"></div>
    </div>
  `;
  await loadAdmissions();
}

let _allApplicants = [];

async function loadAdmissions() {
  try {
    _allApplicants = await API.get('/api/admission/applicants');
    updateAdmStats();
    renderAdmTable(_allApplicants);
  } catch (e) {
    document.getElementById('admTableWrap').innerHTML =
      `<div style="padding:20px;color:#dc2626;">Error loading applicants: ${e.message}</div>`;
  }
}

function updateAdmStats() {
  const pending  = _allApplicants.filter(a => a.status === 'pending').length;
  const admitted = _allApplicants.filter(a => a.status === 'admitted').length;
  const rejected = _allApplicants.filter(a => a.status === 'rejected').length;
  document.getElementById('sPending').textContent  = pending;
  document.getElementById('sAdmitted').textContent = admitted;
  document.getElementById('sRejected').textContent = rejected;
  document.getElementById('sTotal').textContent    = _allApplicants.length;
}

function filterAdmissions() {
  const filter = document.getElementById('admFilter').value;
  const search = (document.getElementById('admSearch').value || '').toLowerCase();
  let list = _allApplicants;
  if (filter !== 'all') list = list.filter(a => a.status === filter);
  if (search) list = list.filter(a =>
    `${a.surname} ${a.first_name} ${a.ref_number}`.toLowerCase().includes(search)
  );
  renderAdmTable(list);
}

function renderAdmTable(list) {
  const wrap = document.getElementById('admTableWrap');
  if (!list.length) {
    wrap.innerHTML = `<div style="text-align:center;padding:40px;color:#9ca3af;">No applicants found.</div>`;
    return;
  }
  const badge = (s) => {
    const m = { pending:'#fef3c7:#92400e', admitted:'#d1fae5:#065f46', rejected:'#fee2e2:#991b1b' };
    const [bg, c] = (m[s] || '#f3f4f6:#374151').split(':');
    return `<span style="background:${bg};color:${c};padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;text-transform:uppercase;">${s}</span>`;
  };
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Ref No.</th><th>Name</th><th>Sex</th><th>Phone</th>
        <th>Status</th><th>Class Admitted</th><th>Date Applied</th><th>Actions</th>
      </tr></thead>
      <tbody>
        ${list.map(a => `
          <tr>
            <td><code style="font-size:12px;background:#f3f4f6;padding:2px 6px;border-radius:4px;">${a.ref_number}</code></td>
            <td><strong>${a.surname} ${a.first_name}</strong>${a.other_name ? ' ' + a.other_name : ''}</td>
            <td>${a.sex || '—'}</td>
            <td>${a.phone || '—'}</td>
            <td>${badge(a.status)}</td>
            <td>${a.class_admitted || '—'}</td>
            <td style="font-size:12px;color:#6b7280;">${new Date(a.createdAt).toLocaleDateString('en-NG')}</td>
            <td>
              <button class="btn btn-sm" onclick="openApplicantModal('${a.id}')" style="font-size:12px;padding:5px 10px;">View</button>
              ${a.status === 'admitted'
                ? `<button class="btn btn-sm" onclick="printAdmissionLetter('${a.id}')" style="font-size:12px;padding:5px 10px;margin-left:4px;background:#1a6e3c;color:white;">🖨 Letter</button>`
                : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function openApplicantModal(id) {
  const modal = document.getElementById('admModal');
  const card  = document.getElementById('admModalCard');
  modal.style.display = 'block';
  card.innerHTML = `<div style="text-align:center;padding:40px;color:#9ca3af;">Loading…</div>`;

  try {
    const a = await API.get(`/api/admission/applicants/${id}`);
    const passportHtml = a.passport
      ? `<img src="${a.passport}" style="width:100px;height:120px;object-fit:cover;border-radius:8px;border:2px solid #e5e7eb;" />`
      : `<div style="width:100px;height:120px;background:#f3f4f6;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:30px;">👤</div>`;
    const badge = (s) => {
      const m = { pending:'#fef3c7:#92400e', admitted:'#d1fae5:#065f46', rejected:'#fee2e2:#991b1b' };
      const [bg, c] = (m[s] || '#f3f4f6:#374151').split(':');
      return `<span style="background:${bg};color:${c};padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;text-transform:uppercase;">${s}</span>`;
    };
    const row = (label, value) => `
      <div>
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px;">${label}</div>
        <div style="font-size:14px;color:#111827;">${value || '—'}</div>
      </div>`;
    const classes = ['JSS 1','JSS 2','JSS 3','SSS 1','SSS 2','SSS 3','Creche',
      'Nursery 1','Nursery 2','Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'];

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-size:20px;font-weight:900;color:#1a6e3c;">${a.surname} ${a.first_name} ${a.other_name || ''}</div>
          <div style="font-size:13px;color:#6b7280;margin-top:4px;">Ref: <strong>${a.ref_number}</strong> &nbsp;|&nbsp; Applied: ${new Date(a.createdAt).toLocaleDateString('en-NG', {day:'numeric',month:'long',year:'numeric'})}</div>
          <div style="margin-top:8px;">${badge(a.status)}</div>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-start;">
          ${passportHtml}
          <button onclick="closeAdmModal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#9ca3af;">✕</button>
        </div>
      </div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:20px;" />
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
        ${row('Sex', a.sex)} ${row('Date of Birth', a.dob ? new Date(a.dob).toLocaleDateString('en-NG') : '—')}
        ${row('State of Origin', a.state_of_origin)} ${row('Local Government', a.local_govt)}
        ${row('Hometown', a.hometown)} ${row('Phone', a.phone)}
        ${row('WhatsApp', a.whatsapp || a.phone)}
        <div style="grid-column:1/-1;">${row('Home Address', a.home_address)}</div>
      </div>
      <div style="background:#f9fafb;border-radius:8px;padding:14px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:800;color:#1a6e3c;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Previous School</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${row('School Name', a.prev_school_name)} ${row('Town', a.prev_school_town)}
          ${row('Class', a.prev_school_class)} ${row('Year', a.prev_school_year)}
        </div>
      </div>
      <div style="background:#f9fafb;border-radius:8px;padding:14px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:800;color:#1a6e3c;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Parent / Guardian</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${row('Name', a.parent_name)} ${row('Relationship', a.parent_relationship)}
          ${row('Occupation', a.parent_occupation)}
          <div style="grid-column:1/-1;">${row('Office Address', a.parent_office_address)}</div>
        </div>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px;">
        <div style="font-size:13px;font-weight:800;color:#1a6e3c;margin-bottom:14px;">📝 Admission Decision</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div>
            <label style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.4px;display:block;margin-bottom:5px;">Status</label>
            <select id="decisionStatus" style="width:100%;padding:8px 10px;border:1.5px solid #d1d5db;border-radius:7px;font-size:14px;font-family:inherit;">
              <option value="pending" ${a.status==='pending'?'selected':''}>Pending</option>
              <option value="admitted" ${a.status==='admitted'?'selected':''}>Admitted</option>
              <option value="rejected" ${a.status==='rejected'?'selected':''}>Rejected</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.4px;display:block;margin-bottom:5px;">Class Admitted</label>
            <select id="decisionClass" style="width:100%;padding:8px 10px;border:1.5px solid #d1d5db;border-radius:7px;font-size:14px;font-family:inherit;">
              <option value="">— Select Class —</option>
              ${classes.map(c => `<option ${a.class_admitted===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.4px;display:block;margin-bottom:5px;">Remark (optional)</label>
          <textarea id="decisionRemark" style="width:100%;padding:8px 10px;border:1.5px solid #d1d5db;border-radius:7px;font-size:14px;font-family:inherit;resize:vertical;" rows="2" placeholder="e.g. Bring birth certificate on resumption">${a.remark || ''}</textarea>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="saveAdmissionDecision('${a.id}')" style="background:#1a6e3c;color:white;border-color:#1a6e3c;">💾 Save Decision</button>
          ${a.status === 'admitted'
            ? `<button class="btn" onclick="printAdmissionLetter('${a.id}')" style="background:#f5c518;color:#1a1a1a;border-color:#e6b800;font-weight:700;">🖨 Print Admission Letter</button>`
            : ''}
          <button class="btn" onclick="closeAdmModal()" style="margin-left:auto;">Cancel</button>
        </div>
        <div id="decisionMsg" style="margin-top:10px;font-size:13px;"></div>
      </div>
    `;
  } catch (e) {
    card.innerHTML = `<div style="color:#dc2626;padding:20px;">Error: ${e.message}</div>`;
  }
}

function closeAdmModal() {
  document.getElementById('admModal').style.display = 'none';
}
document.addEventListener('click', e => {
  const modal = document.getElementById('admModal');
  if (modal && e.target === modal) closeAdmModal();
});

async function saveAdmissionDecision(id) {
  const status        = document.getElementById('decisionStatus').value;
  const classAdmitted = document.getElementById('decisionClass').value;
  const remark        = document.getElementById('decisionRemark').value.trim();
  const msgEl         = document.getElementById('decisionMsg');

  if (status === 'admitted' && !classAdmitted) {
    msgEl.style.color = '#dc2626';
    msgEl.textContent = 'Please select a class before admitting.';
    return;
  }
  msgEl.style.color = '#6b7280';
  msgEl.textContent = 'Saving…';

  try {
    await API.put(`/api/admission/applicants/${id}/status`, { status, classAdmitted, remark });
    msgEl.style.color = '#059669';
    msgEl.textContent = status === 'admitted'
      ? '✅ Admitted! Student added to main system automatically.'
      : '✅ Decision saved.';
    await loadAdmissions();
    setTimeout(() => openApplicantModal(id), 800);
  } catch (e) {
    msgEl.style.color = '#dc2626';
    msgEl.textContent = 'Error: ' + e.message;
  }
}

async function printAdmissionLetter(id) {
  try {
    const a = await API.get(`/api/admission/applicants/${id}`);
    if (a.status !== 'admitted') { alert('Student must be admitted first.'); return; }
    openAdmissionLetterWindow(a);
  } catch (e) {
    alert('Error: ' + e.message);
  }
}
