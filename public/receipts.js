// ============================================================
// receipts.js — Criterion College Receipt Module
// ============================================================

const DEFAULT_FEE_ITEMS = [
  'School Fees',
  'PTA Levy',
  'Uniform',
  'Books',
  'Exam Fees',
  'Development Levy',
  'ICT Levy',
  'Sports Levy',
  'Feeding',
  'Bus Levy',
];

// ── Helpers ──────────────────────────────────────────────────
function numberToWords(n) {
  const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
    'Seventeen','Eighteen','Nineteen'];
  const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if (n === 0) return 'Zero';
  if (n < 0) return 'Minus ' + numberToWords(-n);
  let str = '';
  if (Math.floor(n / 1000000) > 0) { str += numberToWords(Math.floor(n / 1000000)) + ' Million '; n %= 1000000; }
  if (Math.floor(n / 1000) > 0)    { str += numberToWords(Math.floor(n / 1000)) + ' Thousand '; n %= 1000; }
  if (Math.floor(n / 100) > 0)     { str += numberToWords(Math.floor(n / 100)) + ' Hundred '; n %= 100; }
  if (n > 0) {
    str += (str ? 'and ' : '');
    str += n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? '-' + a[n % 10] : '');
  }
  return str.trim();
}

function rcptFormatMoney(val) {
  const n = parseFloat(val) || 0;
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Determine payment status label
function rcptPaymentStatus(total, balance) {
  const bal = parseFloat(balance) || 0;
  if (bal > 0) return 'PART PAYMENT';
  return 'FULL PAYMENT';
}

// ── Receipts List Page ───────────────────────────────────────
async function renderReceiptsPage() {
  const canCreate = isAdmin() || API.getRole() === 'bursar';
  document.getElementById('main-content').innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🧾 Receipts</h1>
        ${canCreate ? `<button class="btn btn-primary" onclick="renderNewReceiptForm()">+ New Receipt</button>` : ''}
      </div>
      <div style="margin-bottom:14px;">
        <input id="receipt-search" type="text" class="input"
          placeholder="Search by student name, class or receipt no…"
          oninput="filterReceipts(this.value)"
          style="max-width:420px;width:100%;" />
      </div>
      <div id="receipts-table-wrap" class="card" style="padding:0;overflow:hidden;">
        <div style="padding:40px;text-align:center;color:var(--text-muted);">Loading…</div>
      </div>
`;

  try {
    const receipts = await API.get('/api/receipts');
    window._allReceipts = receipts;
    renderReceiptsTable(receipts);
  } catch (e) {
    document.getElementById('receipts-table-wrap').innerHTML =
      `<div style="padding:32px;text-align:center;color:#dc2626;">${e.message}</div>`;
  }
}

function filterReceipts(q) {
  const all = window._allReceipts || [];
  const lq  = q.toLowerCase();
  renderReceiptsTable(all.filter(r =>
    (r.studentName || '').toLowerCase().includes(lq) ||
    (r.classId     || '').toLowerCase().includes(lq) ||
    (r.receipt_number || '').toLowerCase().includes(lq)
  ));
}

function renderReceiptsTable(receipts) {
  const wrap = document.getElementById('receipts-table-wrap');
  if (!wrap) return;
  if (!receipts.length) {
    wrap.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-muted);">No receipts found.</div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Receipt No.</th>
          <th>Student</th>
          <th>Class</th>
          <th>Date</th>
          <th style="text-align:right;">Total</th>
          <th style="text-align:center;">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${receipts.map(r => {
          const total = (r.items || []).reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
          return `
            <tr>
              <td style="font-weight:700;color:#1a6e3c;">${r.receipt_number}</td>
              <td style="font-weight:600;">${r.studentName || '—'}</td>
              <td><span class="badge">${r.classId || '—'}</span></td>
              <td style="color:var(--text-muted);font-size:12px;">${r.date || '—'}</td>
              <td style="text-align:right;font-weight:700;">${rcptFormatMoney(total)}</td>
              <td style="text-align:center;">
                <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
                  <button class="btn btn-secondary btn-sm" onclick="renderReceiptPreview('${r.id}')">View</button>
                  <button class="btn btn-primary btn-sm" onclick="shareReceipt('${r.id}')">🔗 Share</button>
                  ${isAdmin() ? `<button class="btn btn-ghost btn-sm" style="color:#dc2626;" onclick="deleteReceipt('${r.id}')">Delete</button>` : ''}
                </div>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ── Student search dropdown helper ───────────────────────────
function rcptInitStudentSearch(students) {
  window._rcptStudents = students.sort((a, b) => a.name.localeCompare(b.name));
  window._rcptSelectedStudentId = '';

  const wrap = document.getElementById('student-search-wrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <div style="position:relative;">
      <input id="student-search-input" type="text" class="input" autocomplete="off"
        placeholder="Type to search student…"
        oninput="rcptFilterStudents(this.value)"
        onfocus="rcptShowDropdown()"
        style="width:100%;" />
      <input type="hidden" id="r-student" value="" />
      <div id="student-dropdown" style="
        display:none;position:absolute;top:100%;left:0;right:0;
        background:#fff;border:1.5px solid #55A845;border-top:none;
        border-radius:0 0 8px 8px;max-height:220px;overflow-y:auto;
        z-index:200;box-shadow:0 6px 20px rgba(0,0,0,0.12);"></div>
    </div>`;

  rcptRenderDropdown(window._rcptStudents);
}

function rcptRenderDropdown(list) {
  const dd = document.getElementById('student-dropdown');
  if (!dd) return;
  if (!list.length) {
    dd.innerHTML = `<div style="padding:10px 14px;color:var(--text-muted);font-size:13px;">No students found</div>`;
    return;
  }
  dd.innerHTML = list.map(s => `
    <div onclick="rcptSelectStudent('${s.id}','${s.name.replace(/'/g,"\\'")} (${s.classId})')"
      style="padding:9px 14px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f0f0f0;"
      onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='#fff'">
      ${s.passport
        ? `<img src="${s.passport}" style="width:30px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #55A845;flex-shrink:0;" />`
        : `<div style="width:30px;height:34px;background:#e8f5e9;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">👤</div>`}
      <div>
        <div style="font-weight:600;color:#111;">${s.name}</div>
        <div style="font-size:11px;color:#888;">${s.classId}</div>
      </div>
    </div>`).join('');
}

function rcptFilterStudents(q) {
  const all = window._rcptStudents || [];
  const lq  = q.toLowerCase();
  const filtered = q
    ? all.filter(s => s.name.toLowerCase().includes(lq) || s.classId.toLowerCase().includes(lq))
    : all;
  rcptRenderDropdown(filtered);
  rcptShowDropdown();
  document.getElementById('r-student').value = '';
  window._rcptSelectedStudentId = '';
}

function rcptShowDropdown() {
  const dd = document.getElementById('student-dropdown');
  if (dd) dd.style.display = 'block';
}

function rcptSelectStudent(id, label) {
  document.getElementById('r-student').value = id;
  document.getElementById('student-search-input').value = label;
  window._rcptSelectedStudentId = id;
  const dd = document.getElementById('student-dropdown');
  if (dd) dd.style.display = 'none';
}

// ── New Receipt Form ─────────────────────────────────────────
async function renderNewReceiptForm() {
  let students = [];
  try { students = await API.get('/api/students'); } catch(e) {}
  const settings = await API.get('/api/settings').catch(() => ({}));
  const today = new Date().toISOString().split('T')[0];
  window._itemCounter = 0;

  document.getElementById('main-content').innerHTML = `
      <div class="page-header">
        <h1 class="page-title">New Receipt</h1>
        <button class="btn btn-ghost" onclick="renderReceiptsPage()">← Back</button>
      </div>

      <div class="card" style="max-width:680px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">

          <div class="form-group" style="grid-column:1/-1;">
            <label>Student *</label>
            <div id="student-search-wrap"></div>
          </div>

          <div class="form-group">
            <label>Session</label>
            <input type="text" id="r-session" class="input" value="${settings.session || '2024/2025'}" placeholder="e.g. 2024/2025">
          </div>
          <div class="form-group">
            <label>Term</label>
            <select id="r-term" class="input">
              <option value="1ST TERM" ${(settings.term||'') === '1ST TERM' ? 'selected':''}>1ST TERM</option>
              <option value="2ND TERM" ${(settings.term||'') === '2ND TERM' ? 'selected':''}>2ND TERM</option>
              <option value="3RD TERM" ${(settings.term||'') === '3RD TERM' ? 'selected':''}>3RD TERM</option>
            </select>
          </div>
          <div class="form-group">
            <label>Date *</label>
            <input type="date" id="r-date" class="input" value="${today}" required>
          </div>
          <div class="form-group">
            <label>Bursar Name</label>
            <input type="text" id="r-bursar" class="input" value="${API.getUser()?.name || ''}">
          </div>
        </div>

        <h3 style="color:#1a6e3c;margin:0 0 10px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Fee Items</h3>
        <div id="receipt-items-wrap"></div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
          <button type="button" class="btn btn-primary btn-sm" onclick="rcptAddPresetRow()">+ Preset Item</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="rcptAddCustomRow()">+ Custom Item</button>
        </div>

        <div style="margin-top:16px;padding:14px 16px;background:#f0fdf4;border-radius:8px;border:1px solid #c3e6cb;">
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px;color:#1a6e3c;">
            <span>TOTAL</span>
            <span id="rcpt-total-display">₦0.00</span>
          </div>
          <div style="margin-top:5px;font-size:12px;color:#555;" id="rcpt-words-display">Total amount in words: —</div>
        </div>

        <h3 style="color:#1a6e3c;margin:16px 0 10px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Payment Method</h3>
        <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:12px;">
          ${['Cash','Cheque','Bank Transfer','Others'].map(m =>
            `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;">
              <input type="checkbox" name="rcpt_payment" value="${m}"> ${m}
            </label>`).join('')}
        </div>
        <div class="form-group" style="max-width:200px;">
          <label>To Balance (₦) <span style="font-size:11px;color:#888;font-weight:400;">(leave 0 for full payment)</span></label>
          <input type="number" id="r-balance" class="input" placeholder="0.00" min="0" step="0.01" value="0">
        </div>

        <div style="margin-top:20px;display:flex;gap:10px;">
          <button class="btn btn-primary" onclick="rcptSubmit()">Generate Receipt</button>
          <button class="btn btn-ghost" onclick="renderReceiptsPage()">Cancel</button>
        </div>
      </div>
`;

  rcptInitStudentSearch(students);
  document.addEventListener('click', function _outsideClick(e) {
    if (!e.target.closest('#student-search-wrap')) {
      const dd = document.getElementById('student-dropdown');
      if (dd) dd.style.display = 'none';
    }
  }, { once: false, capture: false });

  DEFAULT_FEE_ITEMS.slice(0, 5).forEach(name => rcptAddPresetRow(name));
  rcptRecalc();
}

function rcptAddPresetRow(defaultName) {
  window._itemCounter = (window._itemCounter || 0) + 1;
  const id   = `rcpt-item-${window._itemCounter}`;
  const wrap = document.getElementById('receipt-items-wrap');
  if (!wrap) return;
  const div  = document.createElement('div');
  div.id     = id;
  div.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px;';
  div.innerHTML = `
    <select class="rcpt-item-name input" oninput="rcptRecalc()" style="flex:2;padding:7px 10px;font-size:13px;">
      <option value="">— Select item —</option>
      ${DEFAULT_FEE_ITEMS.map(f => `<option value="${f}" ${f === defaultName ? 'selected' : ''}>${f}</option>`).join('')}
    </select>
    <input type="number" class="rcpt-item-amount input" placeholder="Amount" min="0" step="0.01"
      oninput="rcptRecalc()" style="flex:1;padding:7px 10px;font-size:13px;">
    <button type="button" onclick="document.getElementById('${id}').remove();rcptRecalc();"
      style="background:none;border:none;color:#dc2626;font-size:20px;cursor:pointer;padding:0 4px;line-height:1;">✕</button>`;
  wrap.appendChild(div);
}

function rcptAddCustomRow() {
  window._itemCounter = (window._itemCounter || 0) + 1;
  const id   = `rcpt-item-${window._itemCounter}`;
  const wrap = document.getElementById('receipt-items-wrap');
  if (!wrap) return;
  const div  = document.createElement('div');
  div.id     = id;
  div.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px;';
  div.innerHTML = `
    <input type="text" class="rcpt-item-name input" placeholder="Item description" oninput="rcptRecalc()"
      style="flex:2;padding:7px 10px;font-size:13px;">
    <input type="number" class="rcpt-item-amount input" placeholder="Amount" min="0" step="0.01"
      oninput="rcptRecalc()" style="flex:1;padding:7px 10px;font-size:13px;">
    <button type="button" onclick="document.getElementById('${id}').remove();rcptRecalc();"
      style="background:none;border:none;color:#dc2626;font-size:20px;cursor:pointer;padding:0 4px;line-height:1;">✕</button>`;
  wrap.appendChild(div);
}

function rcptRecalc() {
  let total = 0;
  document.querySelectorAll('.rcpt-item-amount').forEach(el => {
    total += parseFloat(el.value) || 0;
  });
  const disp  = document.getElementById('rcpt-total-display');
  const words = document.getElementById('rcpt-words-display');
  if (disp)  disp.textContent  = rcptFormatMoney(total);
  if (words) words.textContent = 'Total amount in words: ' +
    (total > 0 ? numberToWords(Math.floor(total)) + ' Naira Only' : '—');
}

async function rcptSubmit() {
  const studentId   = document.getElementById('r-student')?.value;
  const date        = document.getElementById('r-date')?.value;
  const session     = document.getElementById('r-session')?.value.trim();
  const term        = document.getElementById('r-term')?.value;
  const bursar_name = document.getElementById('r-bursar')?.value.trim();
  const to_balance  = document.getElementById('r-balance')?.value || '0';

  if (!studentId) { alert('Please select a student'); return; }
  if (!date)      { alert('Please enter a date'); return; }

  const items = [];
  document.querySelectorAll('#receipt-items-wrap > div').forEach(row => {
    const nameEl = row.querySelector('.rcpt-item-name');
    const amtEl  = row.querySelector('.rcpt-item-amount');
    const name   = (nameEl?.value || '').trim();
    const amount = parseFloat(amtEl?.value) || 0;
    if (name && amount > 0) items.push({ name, amount });
  });

  if (!items.length) { alert('Please add at least one fee item with an amount'); return; }

  const methods        = [...document.querySelectorAll('input[name="rcpt_payment"]:checked')].map(c => c.value);
  const payment_method = methods.join(', ');

  const btn = document.querySelector('button[onclick="rcptSubmit()"]');
  if (btn) { btn.textContent = 'Generating…'; btn.disabled = true; }

  try {
    const receipt = await API.post('/api/receipts', {
      studentId, session, term, date, items, payment_method, to_balance, bursar_name
    });
    renderReceiptPreview(receipt.id, receipt);
  } catch (e) {
    alert('Error: ' + e.message);
    if (btn) { btn.textContent = 'Generate Receipt'; btn.disabled = false; }
  }
}

// ── Receipt Preview ──────────────────────────────────────────
async function renderReceiptPreview(id, data) {
  let r = data;
  if (!r) {
    try { r = await API.get(`/api/receipts/${id}`); }
    catch(e) { alert('Could not load receipt: ' + e.message); return; }
  }

  if (!r.passport && r.studentId) {
    try {
      const students = await API.get('/api/students');
      const stu = students.find(s => s.id === r.studentId);
      if (stu) r.passport = stu.passport || '';
    } catch(e) {}
  }

  const total      = (r.items || []).reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
  const totalWords = numberToWords(Math.floor(total)) + ' Naira Only';
  const settings   = DB.getSettings ? DB.getSettings() : {};

  document.getElementById('main-content').innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Receipt — ${r.receipt_number}</h1>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-ghost" onclick="renderReceiptsPage()">← Back</button>
          <button class="btn btn-secondary" onclick="shareReceipt('${r.id}')">🔗 Share Link</button>
          <button class="btn btn-primary" onclick="rcptPrint('${r.id}','${(r.studentName||'').replace(/'/g,"\\'")}','${r.term||''}','${r.session||''}','${r.to_balance||'0'}')">📄 Export PDF</button>
        </div>
      </div>

      <div id="receipt-printable" style="background:#fff;border:1px solid #ddd;border-radius:10px;padding:28px 32px;max-width:680px;font-family:Arial,sans-serif;">
        ${buildReceiptCardHTML(r, total, totalWords, settings)}
      </div>

      <!-- Share Modal — link only, no WhatsApp/print buttons -->
      <div id="rcpt-share-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;">
        <div style="background:#fff;border-radius:12px;padding:28px;max-width:440px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
          <h3 style="margin:0 0 8px;color:#1a6e3c;">🔗 Receipt Link</h3>
          <p style="font-size:13px;color:#555;margin-bottom:14px;">Share this link — recipient can view the receipt only (no print/share buttons shown)</p>
          <div style="display:flex;gap:8px;margin-bottom:16px;">
            <input id="rcpt-share-link" type="text" readonly class="input"
              style="flex:1;font-size:12px;background:#f9f9f9;">
            <button class="btn btn-primary btn-sm" onclick="rcptCopyLink()">Copy</button>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('rcpt-share-modal').style.display='none'">Close</button>
        </div>
      </div>
`;
}

// ── PDF Export — exact receipt clone, auto-named, auto-prints ─
function rcptPrint(id, studentName, term, session, balance) {
  const card = document.getElementById('receipt-printable');
  if (!card) return;

  // Build filename: StudentName_Term_Session_FullPayment or PartPayment
  const bal     = parseFloat(balance) || 0;
  const status  = bal > 0 ? 'PartPayment' : 'FullPayment';
  const safeName = (studentName || 'Receipt').replace(/[^a-zA-Z0-9]/g, '_');
  const safeTerm = (term || '').replace(/\s+/g, '_');
  const safeSess = (session || '').replace(/\//g, '-');
  const filename = `${safeName}_${safeTerm}_${safeSess}_${status}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${filename}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #fff; }
    @page { size: A4; margin: 15mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
  <script>
    window.onload = function() {
      // Set suggested filename via document title (browsers use this for Save As PDF)
      document.title = '${filename}';
      setTimeout(function() { window.print(); }, 400);
    };
  <\/script>
</head>
<body>
  ${card.innerHTML}
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}

// ── Receipt Card HTML ─────────────────────────────────────────
function buildReceiptCardHTML(r, total, totalWords, settings) {
  settings = settings || {};

  const logoHTML = (typeof SCHOOL_LOGO !== 'undefined' && SCHOOL_LOGO)
    ? `<img src="${SCHOOL_LOGO}" style="width:70px;height:70px;object-fit:contain;border-radius:50%;border:2px solid #1a6e3c;">`
    : `<div style="width:70px;height:70px;background:linear-gradient(135deg,#1a6e3c,#55A845);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:24px;">CC</div>`;

  const passportHTML = r.passport
    ? `<img src="${r.passport}" style="width:70px;height:80px;object-fit:cover;border-radius:4px;border:2px solid #1a6e3c;display:block;" />`
    : `<div style="width:70px;height:80px;background:#e8f5e9;border-radius:4px;border:2px solid #1a6e3c;display:flex;align-items:center;justify-content:center;font-size:28px;">👤</div>`;

  const stampHTML = settings.stampImage
    ? `<img src="${settings.stampImage}" style="width:90px;height:90px;object-fit:contain;display:block;margin:0 auto;" />`
    : `<div style="width:90px;height:40px;"></div>`;

  const methods         = ['Cash','Cheque','Bank Transfer','Others'];
  const selectedMethods = (r.payment_method || '').split(',').map(m => m.trim());
  const filledRows      = r.items || [];
  const blankCount      = Math.max(0, 5 - filledRows.length);
  const balance         = parseFloat(r.to_balance) || 0;
  const payStatus       = rcptPaymentStatus(total, balance);
  const payStatusColor  = balance > 0 ? '#dc2626' : '#1a6e3c';

  return `
    <!-- Header: Logo centred, school name centred, passport top-right -->
    <div style="display:flex;align-items:flex-start;margin-bottom:10px;">
      <!-- Left spacer same width as passport to balance layout -->
      <div style="width:80px;flex-shrink:0;"></div>

      <!-- Centre: logo + school name -->
      <div style="flex:1;text-align:center;">
        <div style="display:inline-block;">${logoHTML}</div>
        <div style="font-size:18px;font-weight:900;color:#1a6e3c;letter-spacing:0.5px;margin-top:6px;text-transform:uppercase;">CRITERION COLLEGE, OSOGBO</div>
        <div style="background:#222;color:#fff;font-weight:700;font-size:12px;padding:2px 14px;border-radius:4px;display:inline-block;margin-top:4px;">08063224872</div>
      </div>

      <!-- Right: student passport -->
      <div style="width:80px;flex-shrink:0;text-align:center;">
        ${passportHTML}
        <div style="font-size:10px;color:#888;margin-top:3px;">Student Photo</div>
      </div>
    </div>

    <!-- Payment status banner -->
    <div style="text-align:center;margin-bottom:6px;">
      <span style="font-size:13px;font-weight:800;color:#fff;background:${payStatusColor};padding:3px 18px;border-radius:4px;letter-spacing:1px;">
        ${payStatus}
      </span>
    </div>

    <div style="text-align:center;font-size:12px;text-decoration:underline;color:#333;margin-bottom:6px;font-weight:700;">CASH RECEIPT</div>

    <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;border-bottom:1px solid #ccc;padding-bottom:8px;margin-bottom:10px;">
      <span>Receipt No: <strong style="color:#1a6e3c;">${r.receipt_number}</strong></span>
      <span>Date: <strong>${r.date || ''}</strong></span>
    </div>

    <div style="font-size:13px;margin-bottom:4px;">
      Name: <span style="border-bottom:1px solid #333;display:inline-block;min-width:260px;padding-bottom:2px;"><strong>${r.studentName || ''}</strong></span>
    </div>
    <div style="display:flex;gap:40px;font-size:13px;margin-bottom:10px;">
      <span>Class: <span style="border-bottom:1px solid #333;display:inline-block;min-width:100px;padding-bottom:2px;"><strong>${r.classId || ''}</strong></span></span>
      <span>Session: <strong>${r.session || ''}</strong> &nbsp;|&nbsp; Term: <strong>${r.term || ''}</strong></span>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-top:4px;">
      <thead>
        <tr style="background:#1a7a3c;color:#fff;">
          <th style="padding:8px 10px;text-align:center;width:42px;font-size:12px;">S/N</th>
          <th style="padding:8px 10px;text-align:left;font-size:12px;">ITEM(S)</th>
          <th style="padding:8px 10px;text-align:right;width:130px;font-size:12px;">AMOUNT (₦)</th>
        </tr>
      </thead>
      <tbody>
        ${filledRows.map((it, i) => `
          <tr style="background:${i % 2 === 0 ? '#d4edda' : '#a8e6a3'};">
            <td style="padding:8px 10px;text-align:center;font-size:12px;border-bottom:1px solid #c3e6cb;">${i + 1}</td>
            <td style="padding:8px 10px;font-size:12px;border-bottom:1px solid #c3e6cb;">${it.name}</td>
            <td style="padding:8px 10px;text-align:right;font-size:12px;border-bottom:1px solid #c3e6cb;">${rcptFormatMoney(it.amount)}</td>
          </tr>`).join('')}
        ${Array.from({ length: blankCount }).map((_, i) => `
          <tr style="background:${(filledRows.length + i) % 2 === 0 ? '#d4edda' : '#a8e6a3'};">
            <td style="padding:8px 10px;border-bottom:1px solid #c3e6cb;">&nbsp;</td>
            <td style="padding:8px 10px;border-bottom:1px solid #c3e6cb;">&nbsp;</td>
            <td style="padding:8px 10px;border-bottom:1px solid #c3e6cb;">&nbsp;</td>
          </tr>`).join('')}
        <tr style="background:#1a7a3c;color:#fff;">
          <td colspan="2" style="padding:9px 10px;text-align:center;font-weight:700;font-size:13px;">TOTAL</td>
          <td style="padding:9px 10px;text-align:right;font-weight:700;font-size:13px;">${rcptFormatMoney(total)}</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top:8px;font-size:12px;color:#333;font-style:italic;text-align:center;">
      Total Amount in Words: <strong>${totalWords}</strong>
    </div>

    <div style="margin-top:10px;display:flex;align-items:center;gap:24px;flex-wrap:wrap;font-size:12px;">
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        ${methods.map(m => `
          <label style="display:flex;align-items:center;gap:5px;">
            <span style="display:inline-block;width:14px;height:14px;border:2px solid #333;border-radius:2px;background:${selectedMethods.includes(m)?'#1a6e3c':'#fff'};"></span>
            ${m}
          </label>`).join('')}
      </div>
      ${balance > 0 ? `
      <div style="margin-left:auto;font-size:13px;font-weight:700;color:#dc2626;">
        Balance Due: ${rcptFormatMoney(balance)}
      </div>` : ''}
    </div>

    <!-- Signatures -->
    <div style="margin-top:24px;display:flex;justify-content:space-between;align-items:flex-end;font-size:12px;">
      <div style="text-align:center;">
        <div style="border-top:1px solid #333;width:160px;padding-top:4px;">Parent/Guardian Signature</div>
      </div>
      <div style="text-align:center;">
        ${stampHTML}
        <div style="border-top:1px solid #333;width:160px;padding-top:4px;margin-top:4px;">
          ${r.bursar_name || 'Bursar'}
        </div>
        <div style="font-size:10px;color:#888;margin-top:2px;">Authorised Signatory</div>
      </div>
    </div>

    <div style="margin-top:14px;text-align:center;font-size:11px;color:#888;border-top:1px dashed #ccc;padding-top:8px;">
      This receipt is computer generated. Please keep it safe.
    </div>
  `;
}

// ── Share receipt — view-only link (no print/share on destination) ─
async function shareReceipt(id) {
  try {
    const res = await API.post(`/api/receipts/${id}/share`, {});
    let url = res.url;
    // Append student name slug for readable URL
    const allReceipts = window._allReceipts || [];
    const rcpt = allReceipts.find(r => r.id === id);
    if (rcpt && rcpt.studentName) {
      const slug = rcpt.studentName.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '');
      if (!url.includes('student=')) url = url + '&student=' + encodeURIComponent(slug);
    }

    const modal = document.getElementById('rcpt-share-modal');
    if (modal) {
      document.getElementById('rcpt-share-link').value = url;
      modal.style.display = 'flex';
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
      prompt('Share this link:', url);
    }
  } catch(e) {
    alert('Could not generate share link: ' + e.message);
  }
}

function rcptCopyLink() {
  const inp = document.getElementById('rcpt-share-link');
  if (inp) {
    inp.select();
    navigator.clipboard.writeText(inp.value).catch(() => { document.execCommand('copy'); });
    const btn = document.querySelector('#rcpt-share-modal .btn-primary');
    if (btn) { btn.textContent = '✓ Copied!'; setTimeout(() => { btn.textContent = 'Copy'; }, 1500); }
  }
}

async function deleteReceipt(id) {
  if (!confirm('Delete this receipt? This cannot be undone.')) return;
  try {
    await API.del('/api/receipts/' + id);
    renderReceiptsPage();
  } catch(e) {
    alert('Error: ' + e.message);
  }
}
