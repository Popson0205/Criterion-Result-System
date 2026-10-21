// ============================================================
// server.js — Criterion College Express API
// ============================================================
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const jwt      = require('jsonwebtoken');
const path     = require('path');
const { pool, initSchema, Users, Students, Results, Settings, ShareTokens, Receipts, Applicants, ClassSubjects, Milestones, sessionIsHistorical, uid } = require('./db');

const app    = express();
const PORT   = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'criterion-secret-change-in-production';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      // Never cache HTML — every visit checks for the latest version
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (/\.(js|css|json)$/.test(filePath)) {
      // Always revalidate (cheap 304 via ETag) so a redeploy reaches every
      // phone straight away instead of waiting out a cache timer.
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// ── Auth Middleware ───────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    next();
  });
}

function requireBursar(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin' && req.user.role !== 'bursar')
      return res.status(403).json({ error: 'Admin or Bursar only' });
    next();
  });
}

// ── SCHOOLS ───────────────────────────────────────────────────
// Two schools share this system: 'primary' (Creche 1 – Primary 5) and
// 'college' (J.S.S 1 – S.S 3). A student's school is decided by their class.
// A token issued through a school portal carries { school }, and every
// student/result endpoint below only returns / accepts that school's data.
// Tokens from the Admin portal carry no school and see everything.
const SCHOOL_KEYS = ['primary', 'college'];
function schoolKeyOfClass(classId) {
  return /^(J\.S\.S|S\.S)/i.test(String(classId || '').trim()) ? 'college' : 'primary';
}
function inScope(user, classId) {
  return !user.school || schoolKeyOfClass(classId) === user.school;
}
async function assertStudentInScope(user, studentId) {
  if (!user.school) return;
  const list = await Students.list();
  const s = list.find(x => x.id === studentId) || await Students.get(studentId);
  if (!s) { const e = new Error('Student not found'); e.status = 404; throw e; }
  if (!inScope(user, s.classId)) {
    const e = new Error("That student belongs to the other school's portal."); e.status = 403; throw e;
  }
}

// ── LOGIN ─────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { username, password, portal } = req.body;
    const user = await Users.findByUsername(username);
    if (!user || !Users.verifyPassword(user, password))
      return res.status(401).json({ error: 'Invalid username or password' });

    // Which door they came through: 'primary' | 'college' | 'admin'.
    // (No portal = older client; behaves exactly as before, unscoped.)
    let school = '';
    if (SCHOOL_KEYS.includes(portal)) {
      if (user.role === 'bursar')
        return res.status(403).json({ error: 'Bursar accounts sign in from the Admin / Bursar login on the home page.' });
      school = portal;
    } else if (portal === 'admin' && user.role === 'teacher') {
      return res.status(403).json({ error: "Teacher accounts sign in from their school's portal — go back to the home page and choose your school." });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name, school },
      SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, role: user.role, name: user.name, username: user.username, school });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── STUDENTS ──────────────────────────────────────────────────
app.get('/api/students', requireAuth, async (req, res) => {
  try {
    const all = await Students.list();
    res.json(req.user.school ? all.filter(s => inScope(req.user, s.classId)) : all);
  }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Always the true current roster, regardless of what session Settings is
// displaying — used by correction tools (e.g. moving a J.S.S 1 student back
// to Primary 5) that must act on live data even while browsing history.
app.get('/api/students/live', requireAdmin, async (req, res) => {
  try { res.json(await Students.listLive()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Moves a student's live class, bypassing the "read-only while viewing an
// archived session" guard — deliberately, since this is a live correction.
app.post('/api/students/:id/move-class-live', requireAdmin, async (req, res) => {
  try {
    const { classId } = req.body;
    if (!classId) return res.status(400).json({ error: 'classId is required' });
    await Students.moveClassLive(req.params.id, classId);
    res.json({ ok: true });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.get('/api/students/by-class/:classId', requireAdmin, async (req, res) => {
  try {
    const classId = decodeURIComponent(req.params.classId);
    const all = await Students.list();
    const filtered = all
      .filter(s => s.classId === classId)
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/students', requireAdmin, async (req, res) => {
  try { await Students.save(req.body); res.json({ ok: true }); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.delete('/api/students/:id', requireAdmin, async (req, res) => {
  try {
    await Students.delete(req.params.id);
    await Results.delete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PROMOTION (admin only) ───────────────────────────────────
// Advances every student one class up for the new session, except:
//   - students marked 'repeat' stay in their class (and go back to 'active')
//   - students already 'graduated' are left untouched
//   - students in the top class (e.g. S.S 3) become 'graduated'
app.post('/api/students/promote', requireAdmin, async (req, res) => {
  try {
    const summary = await Students.promoteAll((req.body?.newSession || '').trim());
    res.json({ ok: true, ...summary });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// One-time reconstruction of a session that was already promoted away from
// before this history feature existed (so nothing was ever snapshotted for
// it). See Students.backfillPreviousSession for exactly what it computes.
app.post('/api/students/backfill-previous-session', requireAdmin, async (req, res) => {
  try {
    const summary = await Students.backfillPreviousSession((req.body?.session || '').trim());
    res.json({ ok: true, ...summary });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── STUDENT MILESTONES (admin only) ──────────────────────────
// Section-completion / graduation history — Primary→Junior Secondary,
// Junior→Senior Secondary, and final graduation from Senior Secondary.
app.get('/api/milestones', requireAdmin, async (req, res) => {
  try {
    const rows = await Milestones.listAll();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── RESULTS ───────────────────────────────────────────────────
app.get('/api/results', requireAuth, async (req, res) => {
  try {
    let results = await Results.list();
    if (req.user.school) {
      const students = await Students.list();
      const ids = new Set(students.filter(s => inScope(req.user, s.classId)).map(s => s.id));
      results = results.filter(r => ids.has(r.studentId));
    }
    res.json(results);
  }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/results/:studentId/:session/:term', requireAuth, async (req, res) => {
  try {
    const { studentId, session, term } = req.params;
    await assertStudentInScope(req.user, studentId);
    const result = await Results.get(studentId, decodeURIComponent(session), decodeURIComponent(term));
    res.json(result || null);
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.post('/api/results', requireAuth, async (req, res) => {
  try {
    await assertStudentInScope(req.user, req.body && req.body.studentId);
    await Results.save(req.body);
    res.json({ ok: true });
  }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── SETTINGS ──────────────────────────────────────────────────
app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const s = await Settings.get();
    const { adminPassword, ...safe } = s;
    safe.isHistoricalSession = await sessionIsHistorical(s.session);
    res.json(safe);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/settings', requireAdmin, async (req, res) => {
  try { await Settings.save(req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CLASS SUBJECTS ───────────────────────────────────────────
// Read is available to any signed-in user (result entry, printing, etc.).
// All mutations are admin-only. Subject names travel in the request body
// (not the URL path) because names can contain '/', '&', apostrophes, etc.
// session/term are required on every route below — subjects are scoped per
// term, so callers must say which term's list they mean. Falls back to the
// global settings row only if a caller omits them (keeps old clients working).
async function resolveTermParams(req) {
  let { session, term } = req.method === 'GET' ? req.query : req.body;
  if (!session || !term) {
    const settings = await Settings.get();
    session = session || settings.session;
    term    = term    || settings.term;
  }
  return { session, term };
}

app.get('/api/class-subjects', requireAuth, async (req, res) => {
  try {
    const { session, term } = await resolveTermParams(req);
    res.json(await ClassSubjects.getAll(session, term));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/class-subjects/:classId/subjects', requireAdmin, async (req, res) => {
  try {
    const classId  = decodeURIComponent(req.params.classId);
    const { session, term } = await resolveTermParams(req);
    const subjects = await ClassSubjects.add(classId, session, term, req.body.name);
    res.json({ ok: true, subjects });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.put('/api/class-subjects/:classId/subjects', requireAdmin, async (req, res) => {
  try {
    const classId  = decodeURIComponent(req.params.classId);
    const { session, term } = await resolveTermParams(req);
    const subjects = await ClassSubjects.rename(classId, session, term, req.body.oldName, req.body.newName);
    res.json({ ok: true, subjects });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.delete('/api/class-subjects/:classId/subjects', requireAdmin, async (req, res) => {
  try {
    const classId  = decodeURIComponent(req.params.classId);
    const { session, term } = await resolveTermParams(req);
    const subjects = await ClassSubjects.remove(classId, session, term, req.body.name);
    res.json({ ok: true, subjects });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.get('/api/class-subjects/:classId/usage', requireAdmin, async (req, res) => {
  try {
    const classId = decodeURIComponent(req.params.classId);
    const { session, term } = await resolveTermParams(req);
    const count   = await ClassSubjects.usageCount(classId, session, term, req.query.subject || '');
    res.json({ count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TEACHER MANAGEMENT (admin only) ──────────────────────────
app.get('/api/teachers', requireAdmin, async (req, res) => {
  try { res.json(await Users.list()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/teachers', requireAdmin, async (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const user = await Users.create({ username, password, name });
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.put('/api/teachers/:id', requireAdmin, async (req, res) => {
  try { await Users.update(req.params.id, req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/teachers/:id', requireAdmin, async (req, res) => {
  try { await Users.delete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── BURSAR MANAGEMENT (admin only) ───────────────────────────
app.get('/api/bursars', requireAdmin, async (req, res) => {
  try { res.json(await Users.listBursars()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/bursars', requireAdmin, async (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const existing = await Users.findByUsername(username);
    if (existing) return res.status(409).json({ error: 'Username already exists' });
    const user = await Users.createBursar({ username, password, name });
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Could not create bursar' });
  }
});

app.put('/api/bursars/:id', requireAdmin, async (req, res) => {
  try { await Users.updateBursar(req.params.id, req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/bursars/:id', requireAdmin, async (req, res) => {
  try { await Users.deleteBursar(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SHARE TOKENS ──────────────────────────────────────────────
app.post('/api/share', requireAuth, async (req, res) => {
  try {
    const { studentId, session, term } = req.body;
    await assertStudentInScope(req.user, studentId);
    const token = await ShareTokens.create(studentId, session, term);
    res.json({ token });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.get('/api/share/:token', async (req, res) => {
  try {
    const share = await ShareTokens.get(req.params.token);
    if (!share) return res.status(404).json({ error: 'Invalid or expired link' });
    const student  = await Students.get(share.studentId);
    const result   = await Results.get(share.studentId, share.session, share.term);
    const settings = await Settings.get();
    res.json({ student, result, settings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// RECEIPTS
// ══════════════════════════════════════════════════════════════

app.post('/api/receipts', requireBursar, async (req, res) => {
  try {
    const { studentId, session, term, date, items, payment_method, to_balance, bursar_name } = req.body;
    if (!studentId || !session || !term || !date || !items)
      return res.status(400).json({ error: 'Missing required fields' });
    const receipt = await Receipts.create({
      studentId, session, term, date, items,
      payment_method: payment_method || '',
      to_balance:     to_balance || '',
      bursar_name:    bursar_name || req.user.name || '',
      createdBy:      req.user.id
    });
    res.json(receipt);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/receipts', requireBursar, async (req, res) => {
  try { res.json(await Receipts.list()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/receipts/:id', requireBursar, async (req, res) => {
  try {
    const r = await Receipts.get(req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/receipts/:id/share', requireBursar, async (req, res) => {
  try {
    const r = await Receipts.get(req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    const token = r.share_token || await Receipts.generateToken(req.params.id);
    const url   = `${req.protocol}://${req.get('host')}/receipt-view.html?token=${token}`;
    res.json({ token, url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/receipts/:id', requireAdmin, async (req, res) => {
  try { await Receipts.delete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/receipt-public/:token', async (req, res) => {
  try {
    const r = await Receipts.getByToken(req.params.token);
    if (!r) return res.status(404).json({ error: 'Receipt not found or link expired' });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DATA MIGRATION (admin only, one-time) ────────────────────
app.post('/api/migrate', requireAdmin, async (req, res) => {
  const { students, results, settings } = req.body;
  try {
    if (students && students.length) await Students.bulkInsert(students);
    if (results  && results.length)  await Results.bulkInsert(results);
    if (settings) await Settings.save(settings);
    res.json({ ok: true, students: students?.length || 0, results: results?.length || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── HEALTH CHECK ──────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ── EXCEL SCORE SHEETS ────────────────────────────────────────
// Teachers download a class sheet (Admission No + CA/Exam columns per subject),
// fill it in, and upload it. Students are matched by Admission No only.
// Both routes respect the school portal the user signed in through.
const ScoreSheets = require('./scoreSheets');
const SCHOOL_NAMES = {
  primary: 'Criterion Amazing Nursery and Primary School',
  college: 'Criterion Amazing College Osogbo',
};
const httpErr = (status, message) => Object.assign(new Error(message), { status });

async function sheetContext(user, classId, session, term) {
  if (!classId) throw httpErr(400, 'Please choose a class first.');
  if (!inScope(user, classId)) throw httpErr(403, "That class belongs to the other school's portal.");
  const subjectsMap = await ClassSubjects.getAll(session, term);
  if (!Object.prototype.hasOwnProperty.call(subjectsMap, classId)) throw httpErr(404, `Unknown class: ${classId}`);
  const subjects = ScoreSheets.subjectsForClass(classId, subjectsMap[classId]);
  const roster = (await Students.list()).filter(s => s.classId === classId && (s.status || 'active') !== 'graduated');
  return { subjects, roster };
}
async function resultsFor(session, term) {
  return (await Results.list()).filter(r => r.session === session && r.term === term);
}

app.get('/api/scores/template', requireAuth, async (req, res) => {
  try {
    const classId = req.query.classId;
    const { session, term } = await resolveTermParams(req);
    const { subjects, roster } = await sheetContext(req.user, classId, session, term);
    if (!roster.length) throw httpErr(404, `There are no students in ${classId} yet.`);
    if (!subjects.length) throw httpErr(400, `${classId} has no subjects yet. Add them under Subjects first.`);
    const buf = await ScoreSheets.buildTemplate({
      schoolName: SCHOOL_NAMES[schoolKeyOfClass(classId)],
      classId, session, term, students: roster, subjects,
      results: await resultsFor(session, term),
    });
    const safe = s => String(s).replace(/[^A-Za-z0-9.]+/g, '-').replace(/^-|-$/g, '');
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Scores_${safe(classId)}_${safe(session)}_${safe(term)}.xlsx"`,
      'Cache-Control': 'no-store',
    });
    res.send(buf);
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// dryRun:true  → check the file and report what WOULD change (nothing is saved)
// dryRun:false → same checks, then save every valid row
app.post('/api/scores/import', requireAuth, async (req, res) => {
  try {
    const { classId, file, dryRun } = req.body || {};
    if (!file || typeof file !== 'string') throw httpErr(400, 'No file received.');
    if (file.length > 12 * 1024 * 1024) throw httpErr(413, 'That file is too large for a score sheet.');
    const buffer = Buffer.from(file.replace(/^data:.*?;base64,/, ''), 'base64');

    let parsed;
    try { parsed = await ScoreSheets.parseWorkbook(buffer); }
    catch (e) { throw httpErr(400, e.message); }
    const { meta, rows } = parsed;

    if (classId && meta.classId !== classId)
      throw httpErr(400, `This sheet is for ${meta.classId}, but you are importing into ${classId}. Choose ${meta.classId} on the Results page, or download the ${classId} sheet.`);
    if (!meta.session || !ScoreSheets.TERMS.includes(meta.term))
      throw httpErr(400, 'This score sheet has an invalid session or term. Please download a fresh one.');
    if (rows.length > 600) throw httpErr(400, 'This sheet has too many rows for one class.');

    const { subjects, roster } = await sheetContext(req.user, meta.classId, meta.session, meta.term);
    const existing = new Map((await resultsFor(meta.session, meta.term)).map(r => [r.studentId, r]));
    const { updates, report } = ScoreSheets.planImport({ meta, rows, students: roster, subjects, existing });

    const settings = await Settings.get();
    if (settings.session !== meta.session || settings.term !== meta.term) {
      report.warnings.unshift(`This sheet is for ${meta.term} ${meta.session}, but the portal is currently set to ${settings.term} ${settings.session}.`);
    }

    if (!dryRun) {
      for (const u of updates) await Results.save(u.result);
      report.applied = updates.length;
    }
    res.json({ ok: true, dryRun: !!dryRun, report });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Boot: init schema then start ─────────────────────────────
initSchema()
  .then(() => Students.assignMissing().then(n => { if (n) console.log(`🔢 Assigned admission numbers to ${n} existing student(s)`); }))
  .then(() => {
    
// ============================================================
// ADMISSION ROUTES
// ============================================================

// ── PUBLIC: Submit application (no auth required) ─────────────
app.post('/api/admission/apply', async (req, res) => {
  try {
    const required = ['surname', 'firstName', 'phone'];
    for (const f of required) {
      if (!req.body[f]) return res.status(400).json({ error: `${f} is required` });
    }
    const result = await Applicants.apply(req.body);
    res.json({ success: true, refNumber: result.ref_number, id: result.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUBLIC: Check application status by reference number ──────
app.get('/api/admission/status/:ref', async (req, res) => {
  try {
    const app = await Applicants.getByRef(req.params.ref.toUpperCase());
    if (!app) return res.status(404).json({ error: 'Application not found' });
    res.json({
      refNumber:     app.ref_number,
      surname:       app.surname,
      firstName:     app.first_name,
      status:        app.status,
      classAdmitted: app.class_admitted,
      remark:        app.remark,
      appliedAt:     app.createdAt,
      admittedAt:    app.admittedAt,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ADMIN: List all applicants ────────────────────────────────
app.get('/api/admission/applicants', requireAdmin, async (req, res) => {
  try {
    res.json(await Applicants.list());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ADMIN: Get single applicant ───────────────────────────────
app.get('/api/admission/applicants/:id', requireAdmin, async (req, res) => {
  try {
    const app = await Applicants.get(req.params.id);
    if (!app) return res.status(404).json({ error: 'Not found' });
    res.json(app);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ADMIN: Update status (admit / reject) ─────────────────────
app.put('/api/admission/applicants/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status, classAdmitted, remark } = req.body;
    if (!['pending', 'admitted', 'rejected'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });
    if (status === 'admitted' && !classAdmitted)
      return res.status(400).json({ error: 'classAdmitted is required when admitting' });
    const updated = await Applicants.updateStatus(req.params.id, { status, classAdmitted, remark });
    if (status === 'admitted') {
      try { await Applicants.promoteToStudent(req.params.id); } catch (_) {}
    }
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ADMIN: Manually promote applicant to student ──────────────
app.post('/api/admission/applicants/:id/promote', requireAdmin, async (req, res) => {
  try {
    const result = await Applicants.promoteToStudent(req.params.id);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── ADMIN: Delete applicant ───────────────────────────────────
app.delete('/api/admission/applicants/:id', requireAdmin, async (req, res) => {
  try {
    await Applicants.delete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Serve admission form page ─────────────────────────────────
app.get('/admission', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admission', 'index.html'));
});
app.get('/admission/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admission', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Criterion College server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });

