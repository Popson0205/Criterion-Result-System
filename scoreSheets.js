// ============================================================
// scoreSheets.js — Excel score sheets for teachers
//
//   buildTemplate()  → a class .xlsx with every student's Admission No and
//                      one CA + Exam column per subject (current scores pre-filled)
//   parseWorkbook()  → reads an uploaded sheet back
//   planImport()     → checks every row and works out exactly what would change
//
// Students are matched ONLY by Admission No, never by name or row position,
// so sorting the sheet or a typo in a name can't put a score on the wrong child.
// The same plan is used for the preview and for the real import, so what the
// teacher sees in the preview is exactly what gets saved.
// ============================================================

const ExcelJS = require('exceljs');

const SHEET_NAME = 'Scores';
const META_SHEET = '_meta';
const FIRST_DATA_ROW = 5;
const MAX_CA = 40;
const MAX_EXAM = 60;
const TERMS = ['1ST TERM', '2ND TERM', '3RD TERM'];

// Creche 1 & 2 are scored on a fixed skills list (mirrors CRECHE_SECTIONS in
// public/creche_print.js — a test keeps the two in step). Subjects the admin
// has added for these classes are appended after the first section's skills,
// exactly like the on-screen entry form does.
const CRECHE_SECTIONS = {
  'Creche 1': [
    ['WRITING', 'READING', 'SPEAKING', 'NUMERACY', 'ARTS', "QUR'AN"],
    ['FRIENDLY', 'PUNCTUAL', 'CLEAN AND ORDERLY', 'ATTENTIVE', 'RESPECTFUL'],
  ],
  'Creche 2': [
    ['WRITING', 'READING', 'SPEAKING', 'NUMERACY', 'ARTS', "QUR'AN"],
    ['FRIENDLY', 'PUNCTUAL', 'CLEAN AND ORDERLY', 'ATTENTIVE', 'RESPECTFUL'],
  ],
};
function isCrecheClass(classId) { return Object.prototype.hasOwnProperty.call(CRECHE_SECTIONS, classId); }

// The ordered list of things a teacher scores for this class.
function subjectsForClass(classId, dbSubjects) {
  const db = Array.isArray(dbSubjects) ? dbSubjects : [];
  if (!isCrecheClass(classId)) return db.slice();
  const [first, second] = CRECHE_SECTIONS[classId];
  const known = new Set([...first, ...second].map(s => s.toLowerCase()));
  const extra = db.filter(s => !known.has(String(s).toLowerCase()));
  return [...first, ...extra, ...second];
}

function colLetter(n) { // 1 → A
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// ── Template ──────────────────────────────────────────────────
async function buildTemplate({ schoolName, classId, session, term, students, subjects, results }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = schoolName;
  wb.created = new Date();

  const ws = wb.addWorksheet(SHEET_NAME, {
    views: [{ state: 'frozen', xSplit: 3, ySplit: FIRST_DATA_ROW - 1 }],
    properties: { defaultRowHeight: 20 },
  });

  const columns = []; // [{ col, subject, type }]
  let col = 4;
  for (const subject of subjects) {
    columns.push({ col: col++, subject, type: 'ca' });
    columns.push({ col: col++, subject, type: 'exam' });
  }
  const lastCol = Math.max(col - 1, 3);

  const green = 'FF1A6E3C', light = 'FFE8F5E9', grey = 'FFEFEFEF';
  const thin = { style: 'thin', color: { argb: 'FFBBBBBB' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  ws.mergeCells(1, 1, 1, Math.max(lastCol, 9));
  ws.getCell('A1').value = `${schoolName} — Score Sheet`;
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: green } };
  ws.mergeCells(2, 1, 2, Math.max(lastCol, 9));
  ws.getCell('A2').value = `Class: ${classId}     Session: ${session}     Term: ${term}`;
  ws.getCell('A2').font = { bold: true, size: 11 };
  ws.mergeCells(3, 1, 3, Math.max(lastCol, 9));
  ws.getCell('A3').value =
    `Fill only the white cells. CA is out of ${MAX_CA}, Exam is out of ${MAX_EXAM}. ` +
    `Leave a cell empty to keep the score already saved. Do not edit the Admission No column — it is how each student is matched.`;
  ws.getCell('A3').font = { italic: true, size: 10, color: { argb: 'FF7C2D12' } };
  ws.getCell('A3').alignment = { wrapText: true, vertical: 'top' };
  ws.getRow(3).height = 30;

  // Header row
  const head = ws.getRow(FIRST_DATA_ROW - 1);
  head.height = 48;
  const setHead = (c, text) => {
    const cell = head.getCell(c);
    cell.value = text;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: green } };
    cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
    cell.border = border;
  };
  setHead(1, 'S/N'); setHead(2, 'Admission No'); setHead(3, 'Student Name');
  columns.forEach(c => setHead(c.col, `${c.subject}\n${c.type === 'ca' ? `CA (${MAX_CA})` : `Exam (${MAX_EXAM})`}`));

  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 17;
  ws.getColumn(3).width = 34;
  columns.forEach(c => { ws.getColumn(c.col).width = 12; });

  // Student rows
  const byStudent = new Map((results || []).map(r => [r.studentId, r]));
  students.forEach((s, i) => {
    const r = FIRST_DATA_ROW + i;
    const row = ws.getRow(r);
    const lock = (c, v, extra = {}) => {
      const cell = row.getCell(c);
      cell.value = v;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: grey } };
      cell.border = border;
      cell.protection = { locked: true };
      Object.assign(cell, extra);
    };
    lock(1, i + 1, { alignment: { horizontal: 'center' } });
    lock(2, s.admissionNo || '');
    lock(3, s.name);
    const existing = byStudent.get(s.id);
    columns.forEach(c => {
      const cell = row.getCell(c.col);
      const raw = existing && existing.scores && existing.scores[c.subject] ? existing.scores[c.subject][c.type] : undefined;
      const n = raw === undefined || raw === null || raw === '' ? null : Number(raw);
      cell.value = n !== null && Number.isFinite(n) ? n : null;
      cell.border = border;
      cell.alignment = { horizontal: 'center' };
      cell.protection = { locked: false };
      const max = c.type === 'ca' ? MAX_CA : MAX_EXAM;
      cell.dataValidation = {
        type: 'decimal', operator: 'between', formulae: [0, max],
        allowBlank: true, showErrorMessage: true, errorStyle: 'stop',
        errorTitle: 'Invalid score', error: `Enter a number from 0 to ${max}.`,
      };
    });
    row.commit();
  });

  // Protect the sheet (no password) so the grey cells can't be overwritten by accident.
  await ws.protect('', {
    selectLockedCells: true, selectUnlockedCells: true,
    formatColumns: true, formatRows: false, sort: false, autoFilter: false,
  });

  // Hidden sheet: what this file is for + which column holds which subject.
  const meta = wb.addWorksheet(META_SHEET, { state: 'veryHidden' });
  meta.getCell('A1').value = JSON.stringify({
    v: 1, classId, session, term, firstRow: FIRST_DATA_ROW, columns,
    maxCa: MAX_CA, maxExam: MAX_EXAM, generatedAt: new Date().toISOString(),
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── Reading an uploaded sheet ─────────────────────────────────
function cellText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString();
    if ('result' in v) return cellText(v.result);
    if ('richText' in v) return v.richText.map(t => t.text).join('');
    if ('text' in v) return String(v.text);
    return '';
  }
  return String(v).trim();
}
function cellRaw(v) {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return cellRaw(v.result);
    if ('richText' in v) return v.richText.map(t => t.text).join('');
    if ('text' in v) return v.text;
    return '';
  }
  return v;
}

async function parseWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buffer); }
  catch (e) { throw new Error('That file could not be read. Please upload the .xlsx score sheet you downloaded from the portal.'); }

  const metaSheet = wb.getWorksheet(META_SHEET);
  const ws = wb.getWorksheet(SHEET_NAME);
  if (!metaSheet || !ws) {
    throw new Error('This is not a score sheet from the portal. Please download the Excel sheet for your class from the Results page and fill that in.');
  }
  let meta;
  try { meta = JSON.parse(cellText(metaSheet.getCell('A1').value)); } catch (_) { meta = null; }
  if (!meta || !meta.classId || !Array.isArray(meta.columns)) {
    throw new Error('This score sheet is damaged (its hidden information is missing). Please download a fresh sheet and copy your scores into it.');
  }

  const rows = [];
  for (let r = meta.firstRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const admissionNo = cellText(row.getCell(2).value).toUpperCase();
    const cells = {};
    let hasScore = false;
    for (const c of meta.columns) {
      const raw = cellRaw(row.getCell(c.col).value);
      cells[c.col] = raw;
      if (raw !== null && raw !== undefined && String(raw).trim() !== '') hasScore = true;
    }
    if (!admissionNo && !hasScore) continue; // empty row
    rows.push({ rowNum: r, admissionNo, name: cellText(row.getCell(3).value), cells });
  }
  return { meta, rows };
}

// ── Checking + planning ───────────────────────────────────────
// Pure function (no database): everything it needs is passed in.
//   meta       – from the sheet's hidden tab
//   rows       – from parseWorkbook
//   students   – the class roster [{ id, name, admissionNo }]
//   subjects   – subjects currently valid for this class
//   existing   – Map studentId → saved result (or undefined)
// Returns { updates, report }.
function planImport({ meta, rows, students, subjects, existing }) {
  const errors = [], warnings = [], updates = [], previews = [];
  const byNo = new Map(students.filter(s => s.admissionNo).map(s => [String(s.admissionNo).toUpperCase(), s]));
  const validSubjects = new Set(subjects);
  const seen = new Set();
  const touched = new Set();
  let unchanged = 0, skipped = 0;

  // Subjects that were on the sheet but have since been removed from the class.
  const gone = [...new Set(meta.columns.map(c => c.subject))].filter(s => !validSubjects.has(s));
  if (gone.length) warnings.push(`Ignored subject(s) no longer on this class's list: ${gone.join(', ')}.`);
  const usable = meta.columns.filter(c => validSubjects.has(c.subject));

  for (const row of rows) {
    const fail = (message) => { errors.push({ row: row.rowNum, admissionNo: row.admissionNo, name: row.name, message }); skipped++; };

    if (!row.admissionNo) { fail('Admission No is empty — this row was not imported.'); continue; }
    const student = byNo.get(row.admissionNo);
    if (!student) { fail(`Admission No ${row.admissionNo} is not a student in ${meta.classId}.`); continue; }
    if (seen.has(student.id)) { fail(`${row.admissionNo} appears more than once in the sheet — only the first row is used.`); continue; }
    seen.add(student.id);

    // Read every score cell on this row first; one bad cell skips the whole row.
    const incoming = {}; // subject → { ca?, exam? }
    let bad = null;
    for (const c of usable) {
      const raw = row.cells[c.col];
      if (raw === null || raw === undefined || String(raw).trim() === '') continue; // blank = keep what's saved
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(/,/g, '.'));
      const max = c.type === 'ca' ? (meta.maxCa || MAX_CA) : (meta.maxExam || MAX_EXAM);
      if (!Number.isFinite(n)) { bad = `${c.subject} ${c.type === 'ca' ? 'CA' : 'Exam'}: "${String(raw).trim()}" is not a number.`; break; }
      if (n < 0 || n > max) { bad = `${c.subject} ${c.type === 'ca' ? 'CA' : 'Exam'}: ${n} is outside 0–${max}.`; break; }
      (incoming[c.subject] = incoming[c.subject] || {})[c.type] = Math.round(n * 100) / 100;
    }
    if (bad) { fail(bad); continue; }

    // Merge into what is already saved.
    const prev = existing.get(student.id);
    const scores = JSON.parse(JSON.stringify((prev && prev.scores) || {}));
    let changes = 0;
    for (const [subject, vals] of Object.entries(incoming)) {
      scores[subject] = scores[subject] || {};
      for (const [type, val] of Object.entries(vals)) {
        const before = scores[subject][type];
        const beforeNum = before === undefined || before === null || before === '' ? null : Number(before);
        if (beforeNum !== val) changes++;
        scores[subject][type] = val;
      }
    }
    if (changes === 0) { unchanged++; touched.add(student.id); continue; }
    touched.add(student.id);
    updates.push({
      studentId: student.id,
      result: {
        studentId: student.id,
        session: meta.session,
        term: meta.term,
        scores,
        teacherComment: (prev && prev.teacherComment) || '',
        principalComment: (prev && prev.principalComment) || '',
        isCreche: isCrecheClass(meta.classId),
      },
    });
    previews.push({ admissionNo: student.admissionNo, name: student.name, changes, isNew: !prev });
  }

  const notInSheet = students.filter(s => !touched.has(s.id) && !errors.some(e => e.admissionNo === String(s.admissionNo).toUpperCase()))
    .map(s => ({ admissionNo: s.admissionNo, name: s.name }));

  return {
    updates,
    report: {
      classId: meta.classId, session: meta.session, term: meta.term,
      totals: { rows: rows.length, willUpdate: updates.length, unchanged, skipped },
      errors, warnings, previews, notInSheet,
    },
  };
}

module.exports = {
  TERMS, MAX_CA, MAX_EXAM, SHEET_NAME, META_SHEET,
  CRECHE_SECTIONS, isCrecheClass, subjectsForClass,
  buildTemplate, parseWorkbook, planImport,
};
