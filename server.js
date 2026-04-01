// ============================================================
// server.js — Criterion College Express API
// ============================================================
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const jwt      = require('jsonwebtoken');
const path     = require('path');
const { Users, Students, Results, Settings, ShareTokens, uid } = require('./db');

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
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = Users.findByUsername(username);
  if (!user || !Users.verifyPassword(user, password))
    return res.status(401).json({ error: 'Invalid username or password' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, SECRET, { expiresIn: '12h' });
  res.json({ token, role: user.role, name: user.name, username: user.username });
});

// ── STUDENTS ──────────────────────────────────────────────────
app.get('/api/students', requireAuth, (req, res) => {
  res.json(Students.list());
});

app.post('/api/students', requireAdmin, (req, res) => {
  Students.save(req.body);
  res.json({ ok: true });
});

app.delete('/api/students/:id', requireAdmin, (req, res) => {
  Students.delete(req.params.id);
  Results.delete(req.params.id);
  res.json({ ok: true });
});

// ── RESULTS ───────────────────────────────────────────────────
app.get('/api/results', requireAuth, (req, res) => {
  res.json(Results.list());
});

app.get('/api/results/:studentId/:session/:term', requireAuth, (req, res) => {
  const { studentId, session, term } = req.params;
  const result = Results.get(studentId, decodeURIComponent(session), decodeURIComponent(term));
  res.json(result || null);
});

app.post('/api/results', requireAuth, (req, res) => {
  Results.save(req.body);
  res.json({ ok: true });
});

// ── SETTINGS ──────────────────────────────────────────────────
app.get('/api/settings', requireAuth, (req, res) => {
  const s = Settings.get();
  // Never expose password hash
  const { adminPassword, ...safe } = s;
  res.json(safe);
});

app.post('/api/settings', requireAdmin, (req, res) => {
  Settings.save(req.body);
  res.json({ ok: true });
});

// ── TEACHER MANAGEMENT (admin only) ──────────────────────────
app.get('/api/teachers', requireAdmin, (req, res) => {
  res.json(Users.list());
});

app.post('/api/teachers', requireAdmin, (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const user = Users.create({ username, password, name });
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.put('/api/teachers/:id', requireAdmin, (req, res) => {
  Users.update(req.params.id, req.body);
  res.json({ ok: true });
});

app.delete('/api/teachers/:id', requireAdmin, (req, res) => {
  Users.delete(req.params.id);
  res.json({ ok: true });
});

// ── SHARE TOKENS ──────────────────────────────────────────────
app.post('/api/share', requireAuth, (req, res) => {
  const { studentId, session, term } = req.body;
  const token = ShareTokens.create(studentId, session, term);
  res.json({ token });
});

app.get('/api/share/:token', (req, res) => {
  const share = ShareTokens.get(req.params.token);
  if (!share) return res.status(404).json({ error: 'Invalid or expired link' });
  const student = Students.get(share.studentId);
  const result  = Results.get(share.studentId, share.session, share.term);
  res.json({ student, result });
});

// ── DATA MIGRATION (admin only, one-time) ────────────────────
app.post('/api/migrate', requireAdmin, (req, res) => {
  const { students, results, settings } = req.body;
  try {
    if (students && students.length) Students.bulkInsert(students);
    if (results  && results.length)  Results.bulkInsert(results);
    if (settings) Settings.save(settings);
    res.json({ ok: true, students: students?.length || 0, results: results?.length || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── HEALTH CHECK ──────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ── SPA fallback — serve index.html for all non-API routes ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Criterion College server running on port ${PORT}`));
