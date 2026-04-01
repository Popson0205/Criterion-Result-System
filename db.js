// ============================================================
// db.js — PostgreSQL database layer (Neon / any Postgres)
// ============================================================
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Schema ────────────────────────────────────────────────────
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id        TEXT PRIMARY KEY,
      username  TEXT UNIQUE NOT NULL,
      password  TEXT NOT NULL,
      role      TEXT NOT NULL CHECK(role IN ('admin','teacher')),
      name      TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS students (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      "classId"    TEXT NOT NULL,
      "daysAttended" TEXT DEFAULT '',
      passport     TEXT DEFAULT '',
      "createdAt"  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS results (
      id                TEXT PRIMARY KEY,
      "studentId"       TEXT NOT NULL,
      session           TEXT NOT NULL,
      term              TEXT NOT NULL,
      scores            TEXT NOT NULL DEFAULT '{}',
      "teacherComment"  TEXT DEFAULT '',
      "principalComment" TEXT DEFAULT '',
      "isCreche"        BOOLEAN DEFAULT FALSE,
      "createdAt"       TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt"       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE("studentId", session, term)
    );

    CREATE TABLE IF NOT EXISTS settings (
      id              INTEGER PRIMARY KEY DEFAULT 1,
      session         TEXT DEFAULT '2024/2025',
      term            TEXT DEFAULT '1ST TERM',
      "daysInSchool"  TEXT DEFAULT '',
      "resumptionDate" TEXT DEFAULT '',
      "stampImage"    TEXT DEFAULT '',
      "adminPassword" TEXT DEFAULT 'admin123'
    );

    CREATE TABLE IF NOT EXISTS share_tokens (
      token       TEXT PRIMARY KEY,
      "studentId" TEXT NOT NULL,
      session     TEXT NOT NULL,
      term        TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Seed default admin
  const { rows } = await pool.query("SELECT id FROM users WHERE role='admin' LIMIT 1");
  if (rows.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await pool.query(
      "INSERT INTO users (id, username, password, role, name) VALUES ($1,$2,$3,$4,$5)",
      ['admin_1', 'admin', hash, 'admin', 'Administrator']
    );
  }

  // Seed default settings
  const { rows: sRows } = await pool.query("SELECT id FROM settings LIMIT 1");
  if (sRows.length === 0) {
    await pool.query("INSERT INTO settings (id) VALUES (1)");
  }
}

// ── Helpers ───────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Users ─────────────────────────────────────────────────────
const Users = {
  findByUsername: async (username) => {
    const { rows } = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
    return rows[0] || null;
  },
  findById: async (id) => {
    const { rows } = await pool.query('SELECT id,username,role,name FROM users WHERE id=$1', [id]);
    return rows[0] || null;
  },
  list: async () => {
    const { rows } = await pool.query(
      "SELECT id,username,role,name,\"createdAt\" FROM users WHERE role='teacher' ORDER BY name"
    );
    return rows;
  },
  create: async ({ username, password, name }) => {
    const hash = bcrypt.hashSync(password, 10);
    const id   = 'usr_' + uid();
    await pool.query(
      "INSERT INTO users (id,username,password,role,name) VALUES ($1,$2,$3,'teacher',$4)",
      [id, username, hash, name || username]
    );
    return { id, username, role: 'teacher', name: name || username };
  },
  update: async (id, { username, password, name }) => {
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      await pool.query(
        "UPDATE users SET username=$1,password=$2,name=$3 WHERE id=$4 AND role='teacher'",
        [username, hash, name, id]
      );
    } else {
      await pool.query(
        "UPDATE users SET username=$1,name=$2 WHERE id=$3 AND role='teacher'",
        [username, name, id]
      );
    }
  },
  delete: async (id) => {
    await pool.query("DELETE FROM users WHERE id=$1 AND role='teacher'", [id]);
  },
  verifyPassword: (user, password) => bcrypt.compareSync(password, user.password),
};

// ── Students ──────────────────────────────────────────────────
const Students = {
  list: async () => {
    const { rows } = await pool.query('SELECT * FROM students ORDER BY "classId", name');
    return rows;
  },
  get: async (id) => {
    const { rows } = await pool.query('SELECT * FROM students WHERE id=$1', [id]);
    return rows[0] || null;
  },
  save: async (student) => {
    await pool.query(`
      INSERT INTO students (id, name, "classId", "daysAttended", passport)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (id) DO UPDATE
        SET name=$2, "classId"=$3, "daysAttended"=$4, passport=$5
    `, [
      student.id || 'stu_' + uid(),
      student.name,
      student.classId,
      student.daysAttended || '',
      student.passport || '',
    ]);
  },
  delete: async (id) => {
    await pool.query('DELETE FROM students WHERE id=$1', [id]);
  },
  bulkInsert: async (students) => {
    for (const s of students) {
      await pool.query(`
        INSERT INTO students (id, name, "classId", "daysAttended", passport)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id) DO UPDATE
          SET name=$2, "classId"=$3, "daysAttended"=$4, passport=$5
      `, [s.id || 'stu_' + uid(), s.name, s.classId, s.daysAttended || '', s.passport || '']);
    }
  },
};

// ── Results ───────────────────────────────────────────────────
const Results = {
  list: async () => {
    const { rows } = await pool.query('SELECT * FROM results');
    return rows.map(r => ({ ...r, scores: JSON.parse(r.scores), isCreche: !!r.isCreche }));
  },
  get: async (studentId, session, term) => {
    const { rows } = await pool.query(
      'SELECT * FROM results WHERE "studentId"=$1 AND session=$2 AND term=$3',
      [studentId, session, term]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return { ...r, scores: JSON.parse(r.scores), isCreche: !!r.isCreche };
  },
  save: async (result) => {
    const scores = JSON.stringify(result.scores || {});
    await pool.query(`
      INSERT INTO results (id, "studentId", session, term, scores, "teacherComment", "principalComment", "isCreche")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT ("studentId", session, term) DO UPDATE
        SET scores=$5, "teacherComment"=$6, "principalComment"=$7, "isCreche"=$8, "updatedAt"=NOW()
    `, [
      'res_' + uid(),
      result.studentId,
      result.session,
      result.term,
      scores,
      result.teacherComment || '',
      result.principalComment || '',
      result.isCreche || false,
    ]);
  },
  delete: async (studentId) => {
    await pool.query('DELETE FROM results WHERE "studentId"=$1', [studentId]);
  },
  bulkInsert: async (results) => {
    for (const r of results) {
      await pool.query(`
        INSERT INTO results (id, "studentId", session, term, scores, "teacherComment", "principalComment", "isCreche")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT ("studentId", session, term) DO UPDATE
          SET scores=$5, "teacherComment"=$6, "principalComment"=$7, "isCreche"=$8, "updatedAt"=NOW()
      `, [
        'res_' + uid(),
        r.studentId,
        r.session,
        r.term,
        JSON.stringify(r.scores || {}),
        r.teacherComment || '',
        r.principalComment || '',
        r.isCreche || false,
      ]);
    }
  },
};

// ── Settings ──────────────────────────────────────────────────
const Settings = {
  get: async () => {
    const { rows } = await pool.query('SELECT * FROM settings WHERE id=1');
    return rows[0] || {};
  },
  save: async (s) => {
    await pool.query(`
      UPDATE settings
      SET session=$1, term=$2, "daysInSchool"=$3, "resumptionDate"=$4, "stampImage"=$5, "adminPassword"=$6
      WHERE id=1
    `, [s.session, s.term, s.daysInSchool || '', s.resumptionDate || '', s.stampImage || '', s.adminPassword || 'admin123']);

    if (s.adminPassword) {
      const hash = bcrypt.hashSync(s.adminPassword, 10);
      await pool.query("UPDATE users SET password=$1 WHERE role='admin'", [hash]);
    }
  },
};

// ── Share Tokens ──────────────────────────────────────────────
const ShareTokens = {
  create: async (studentId, session, term) => {
    const token = uid() + uid();
    await pool.query(`
      INSERT INTO share_tokens (token, "studentId", session, term)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (token) DO NOTHING
    `, [token, studentId, session, term]);
    return token;
  },
  get: async (token) => {
    const { rows } = await pool.query('SELECT * FROM share_tokens WHERE token=$1', [token]);
    return rows[0] || null;
  },
};

module.exports = { pool, initSchema, Users, Students, Results, Settings, ShareTokens, uid };
