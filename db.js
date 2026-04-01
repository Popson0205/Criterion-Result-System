// ============================================================
// db.js — SQLite database layer
// ============================================================
const Database = require('better-sqlite3');
const path     = require('path');
const bcrypt   = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'criterion.db');

// Ensure data directory exists
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id        TEXT PRIMARY KEY,
    username  TEXT UNIQUE NOT NULL,
    password  TEXT NOT NULL,
    role      TEXT NOT NULL CHECK(role IN ('admin','teacher')),
    name      TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS students (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    classId      TEXT NOT NULL,
    daysAttended TEXT,
    passport     TEXT,
    createdAt    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS results (
    id               TEXT PRIMARY KEY,
    studentId        TEXT NOT NULL,
    session          TEXT NOT NULL,
    term             TEXT NOT NULL,
    scores           TEXT NOT NULL DEFAULT '{}',
    teacherComment   TEXT DEFAULT '',
    principalComment TEXT DEFAULT '',
    isCreche         INTEGER DEFAULT 0,
    createdAt        TEXT DEFAULT (datetime('now')),
    updatedAt        TEXT DEFAULT (datetime('now')),
    UNIQUE(studentId, session, term)
  );

  CREATE TABLE IF NOT EXISTS settings (
    id             INTEGER PRIMARY KEY DEFAULT 1,
    session        TEXT DEFAULT '2024/2025',
    term           TEXT DEFAULT '1ST TERM',
    daysInSchool   TEXT DEFAULT '',
    resumptionDate TEXT DEFAULT '',
    stampImage     TEXT DEFAULT '',
    adminPassword  TEXT DEFAULT 'admin123'
  );

  CREATE TABLE IF NOT EXISTS share_tokens (
    token     TEXT PRIMARY KEY,
    studentId TEXT NOT NULL,
    session   TEXT NOT NULL,
    term      TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

// ── Seed default admin + settings ────────────────────────────
const adminExists = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare("INSERT INTO users (id, username, password, role, name) VALUES (?,?,?,?,?)")
    .run('admin_1', 'admin', hash, 'admin', 'Administrator');
}
const settingsExist = db.prepare("SELECT id FROM settings LIMIT 1").get();
if (!settingsExist) {
  db.prepare("INSERT INTO settings (id) VALUES (1)").run();
}

// ── Helpers ───────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Users ─────────────────────────────────────────────────────
const Users = {
  findByUsername: (username) =>
    db.prepare("SELECT * FROM users WHERE username=?").get(username),
  findById: (id) =>
    db.prepare("SELECT id,username,role,name FROM users WHERE id=?").get(id),
  list: () =>
    db.prepare("SELECT id,username,role,name,createdAt FROM users WHERE role='teacher' ORDER BY name").all(),
  create: ({ username, password, name }) => {
    const hash = bcrypt.hashSync(password, 10);
    const id   = 'usr_' + uid();
    db.prepare("INSERT INTO users (id,username,password,role,name) VALUES (?,?,?,'teacher',?)")
      .run(id, username, hash, name || username);
    return { id, username, role: 'teacher', name: name || username };
  },
  update: (id, { username, password, name }) => {
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      db.prepare("UPDATE users SET username=?,password=?,name=? WHERE id=? AND role='teacher'")
        .run(username, hash, name, id);
    } else {
      db.prepare("UPDATE users SET username=?,name=? WHERE id=? AND role='teacher'")
        .run(username, name, id);
    }
  },
  delete: (id) =>
    db.prepare("DELETE FROM users WHERE id=? AND role='teacher'").run(id),
  verifyPassword: (user, password) =>
    bcrypt.compareSync(password, user.password),
};

// ── Students ──────────────────────────────────────────────────
const Students = {
  list: () =>
    db.prepare("SELECT * FROM students ORDER BY classId, name").all(),
  get: (id) =>
    db.prepare("SELECT * FROM students WHERE id=?").get(id),
  save: (student) => {
    const existing = db.prepare("SELECT id FROM students WHERE id=?").get(student.id);
    if (existing) {
      db.prepare("UPDATE students SET name=?,classId=?,daysAttended=?,passport=? WHERE id=?")
        .run(student.name, student.classId, student.daysAttended||'', student.passport||'', student.id);
    } else {
      db.prepare("INSERT INTO students (id,name,classId,daysAttended,passport) VALUES (?,?,?,?,?)")
        .run(student.id || 'stu_'+uid(), student.name, student.classId, student.daysAttended||'', student.passport||'');
    }
  },
  delete: (id) =>
    db.prepare("DELETE FROM students WHERE id=?").run(id),
  bulkInsert: (students) => {
    const stmt = db.prepare("INSERT OR REPLACE INTO students (id,name,classId,daysAttended,passport) VALUES (?,?,?,?,?)");
    const many = db.transaction((rows) => {
      for (const s of rows) stmt.run(s.id||'stu_'+uid(), s.name, s.classId, s.daysAttended||'', s.passport||'');
    });
    many(students);
  },
};

// ── Results ───────────────────────────────────────────────────
const Results = {
  list: () =>
    db.prepare("SELECT * FROM results").all().map(r => ({
      ...r, scores: JSON.parse(r.scores), isCreche: !!r.isCreche
    })),
  get: (studentId, session, term) => {
    const r = db.prepare("SELECT * FROM results WHERE studentId=? AND session=? AND term=?")
      .get(studentId, session, term);
    if (!r) return null;
    return { ...r, scores: JSON.parse(r.scores), isCreche: !!r.isCreche };
  },
  save: (result) => {
    const existing = db.prepare("SELECT id FROM results WHERE studentId=? AND session=? AND term=?")
      .get(result.studentId, result.session, result.term);
    const scores = JSON.stringify(result.scores || {});
    if (existing) {
      db.prepare(`UPDATE results SET scores=?,teacherComment=?,principalComment=?,isCreche=?,updatedAt=datetime('now')
                  WHERE studentId=? AND session=? AND term=?`)
        .run(scores, result.teacherComment||'', result.principalComment||'', result.isCreche?1:0,
             result.studentId, result.session, result.term);
    } else {
      db.prepare("INSERT INTO results (id,studentId,session,term,scores,teacherComment,principalComment,isCreche) VALUES (?,?,?,?,?,?,?,?)")
        .run('res_'+uid(), result.studentId, result.session, result.term,
             scores, result.teacherComment||'', result.principalComment||'', result.isCreche?1:0);
    }
  },
  delete: (studentId) =>
    db.prepare("DELETE FROM results WHERE studentId=?").run(studentId),
  bulkInsert: (results) => {
    const stmt = db.prepare("INSERT OR REPLACE INTO results (id,studentId,session,term,scores,teacherComment,principalComment,isCreche) VALUES (?,?,?,?,?,?,?,?)");
    const many = db.transaction((rows) => {
      for (const r of rows)
        stmt.run('res_'+uid(), r.studentId, r.session, r.term,
                 JSON.stringify(r.scores||{}), r.teacherComment||'', r.principalComment||'', r.isCreche?1:0);
    });
    many(results);
  },
};

// ── Settings ──────────────────────────────────────────────────
const Settings = {
  get: () => db.prepare("SELECT * FROM settings WHERE id=1").get(),
  save: (s) => {
    db.prepare(`UPDATE settings SET session=?,term=?,daysInSchool=?,resumptionDate=?,stampImage=?,adminPassword=? WHERE id=1`)
      .run(s.session, s.term, s.daysInSchool||'', s.resumptionDate||'', s.stampImage||'', s.adminPassword||'admin123');
    // Also update admin password hash if changed
    if (s.adminPassword) {
      const hash = bcrypt.hashSync(s.adminPassword, 10);
      db.prepare("UPDATE users SET password=? WHERE role='admin'").run(hash);
    }
  },
};

// ── Share Tokens ──────────────────────────────────────────────
const ShareTokens = {
  create: (studentId, session, term) => {
    const token = uid() + uid();
    db.prepare("INSERT OR REPLACE INTO share_tokens (token,studentId,session,term) VALUES (?,?,?,?)")
      .run(token, studentId, session, term);
    return token;
  },
  get: (token) =>
    db.prepare("SELECT * FROM share_tokens WHERE token=?").get(token),
};

module.exports = { Users, Students, Results, Settings, ShareTokens, uid };
