// ============================================================
// server.js — Criterion College Express API
// ============================================================
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const jwt      = require('jsonwebtoken');
const path     = require('path');
const { initSchema, Users, Students, Results, Settings, ShareTokens, uid } = require('./db');

const app    = express();
const PORT   = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'criterion-secret-change-in-production';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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

// ── LOGIN ─────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await Users.findByUsername(username);
    if (!user || !Users.verifyPassword(user, password))
      return res.status(401).json({ error: 'Invalid username or password' });
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, role: user.role, name: user.name, username: user.username });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── STUDENTS ──────────────────────────────────────────────────
app.get('/api/students', requireAuth, async (req, res) => {
  try { res.json(await Students.list()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── STUDENTS BY CLASS (admin only) ───────────────────────────
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
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/students/:id', requireAdmin, async (req, res) => {
  try {
    await Students.delete(req.params.id);
    await Results.delete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── RESULTS ───────────────────────────────────────────────────
app.get('/api/results', requireAuth, async (req, res) => {
  try { res.json(await Results.list()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/results/:studentId/:session/:term', requireAuth, async (req, res) => {
  try {
    const { studentId, session, term } = req.params;
    const result = await Results.get(studentId, decodeURIComponent(session), decodeURIComponent(term));
    res.json(result || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/results', requireAuth, async (req, res) => {
  try { await Results.save(req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SETTINGS ──────────────────────────────────────────────────
app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const s = await Settings.get();
    const { adminPassword, ...safe } = s;
    res.json(safe);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/settings', requireAdmin, async (req, res) => {
  try { await Settings.save(req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
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

// ── SHARE TOKENS ──────────────────────────────────────────────
app.post('/api/share', requireAuth, async (req, res) => {
  try {
    const { studentId, session, term } = req.body;
    const token = await ShareTokens.create(studentId, session, term);
    res.json({ token });
  } catch (e) { res.status(500).json({ error: e.message }); }
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

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Boot: init schema then start ─────────────────────────────
initSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`Criterion College server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });
