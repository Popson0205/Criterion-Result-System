// ============================================================
// db.js — PostgreSQL database layer (Neon / any Postgres)
// ============================================================
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Build an Error carrying an HTTP status so routes can map it directly.
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Seed defaults for the per-class subject lists. This is the ONE-TIME seed used
// to populate the class_subjects table on a fresh database. After seeding, the
// table (managed via the admin Subjects page) is the single source of truth.
// The client keeps an identical copy in public/data.js purely as an offline
// fallback; both must stay in sync when changed by hand.
const DEFAULT_CLASS_SUBJECTS = {
  "Creche 1":    ["Reading","Qur'an","Speaking","Writing Skill","Arts","Arabic","Numeracy"],
  "Creche 2":    ["Reading","Qur'an","Speaking","Writing Skill","Arts","Arabic","Numeracy"],
  "Pre-Nursery": ["Mathematics Skill","Writing Skill","English Skill","CCA","Science","Arabic Studies","Qur'an","Social Habits","Rhymes/Poems","Health Habits"],
  "Nursery 1":   ["Mathematics Skill","Writing Skill","English Skill","CCA","Science","Arabic Studies","Qur'an","Social Habits","Rhymes/Poems","Health Habits"],
  "Nursery 2":   ["Mathematics Skill","Writing Skill","English Skill","CCA","Science","Arabic Studies","Qur'an","Social Habits","Rhymes/Poems","Health Habits"],
  "Primary 1":   ["English Studies","Basic Science and Technology","Writing Skills","Mathematics","Qur'an","Yoruba","Nigeria History","Physical & Health Education","Social and Citizenship Studies","Islamic Studies","Quantitative Reasoning","CCA","Verbal Reasoning","Arabic Studies"],
  "Primary 2":   ["English Studies","Basic Science and Technology","Writing Skills","Mathematics","Qur'an","Yoruba","Nigeria History","Physical & Health Education","Social and Citizenship Studies","Islamic Studies","Quantitative Reasoning","CCA","Verbal Reasoning","Arabic Studies"],
  "Primary 3":   ["English Studies","Basic Science and Technology","Writing Skills","Mathematics","Qur'an","Yoruba","Nigeria History","Physical & Health Education","Social and Citizenship Studies","Islamic Studies","Quantitative Reasoning","CCA","Verbal Reasoning","Arabic Studies","Basic Digital Literacy","PVS"],
  "Primary 4":   ["English Studies","Basic Science and Technology","Writing Skills","Mathematics","Qur'an","Yoruba","Nigeria History","Physical & Health Education","Social and Citizenship Studies","Islamic Studies","Quantitative Reasoning","CCA","Verbal Reasoning","Arabic Studies","Basic Digital Literacy","PVS"],
  "Primary 5":   ["English Studies","Basic Science and Technology","Writing Skills","Mathematics","Qur'an","Yoruba","Nigeria History","Physical & Health Education","Social and Citizenship Studies","Islamic Studies","Quantitative Reasoning","CCA","Verbal Reasoning","Arabic Studies","Basic Digital Literacy","PVS"],
  "J.S.S 1":     ["Mathematics","English Studies","Business Studies","Nigeria History","CCA","Intermediate Science","Literature in English","Islamic Studies","Arabic Studies","Agricultural Science","Social and Citizenship Studies","Qur'an","Yoruba","Digital Technology"],
  "J.S.S 2":     ["Mathematics","English Studies","Business Studies","Nigeria History","CCA","Intermediate Science","Literature in English","Islamic Studies","Arabic Studies","Agricultural Science","Social and Citizenship Studies","Qur'an","Yoruba","Digital Technology"],
  "J.S.S 3":     ["Mathematics","English Studies","Business Studies","Nigeria History","CCA","Intermediate Science","Literature in English","Islamic Studies","Arabic Studies","Agricultural Science","Social and Citizenship Studies","Qur'an","Yoruba","Digital Technology"],
  "S.S 1":       ["Mathematics","English Language","Physics","Biology","Chemistry","Geography","Citizenship and Heritage Education","Agricultural Science","Qur'an","Arabic Studies","Digital Technology"],
  "S.S 2":       ["Mathematics","English Language","Physics","Biology","Chemistry","Geography","Citizenship and Heritage Education","Agricultural Science","Qur'an","Arabic Studies","Digital Technology"],
  "S.S 3":       ["Mathematics","English Language","Physics","Biology","Chemistry","Geography","Citizenship and Heritage Education","Agricultural Science","Qur'an","Arabic Studies","Digital Technology"],
};

// ── Promotion / section-crossing rules ──────────────────────────
// Primary 4 is a deliberate fork: some students continue to Primary 5,
// others move straight to J.S.S 1. The system can't know which, so it's
// never auto-promoted — the admin decides per student (just by editing
// their class), and that edit is what triggers the "Completed Primary
// School" milestone below if they land in J.S.S 1.
const BRANCH_CLASS = 'Primary 4';

// Coarse "school section" a class belongs to, used only to detect when a
// student crosses from one section into the next (Primary → Junior
// Secondary → Senior Secondary), regardless of the exact class involved.
function sectionOf(classId) {
  if (!classId) return 'other';
  if (classId.startsWith('S.S'))   return 'senior';
  if (classId.startsWith('J.S.S')) return 'junior';
  return 'primary';
}

// Milestone label to log when a student crosses from one section to the
// next. These students stay 'active' — they keep showing up in normal
// Students/Results views — but the crossing itself is recorded so the
// Graduated tab can show "completed Primary/Junior Secondary" history.
const SECTION_MILESTONE = {
  'primary->junior': 'Completed Primary School',
  'junior->senior':  'Completed Junior Secondary School',
};

// ── Schema ────────────────────────────────────────────────────
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id        TEXT PRIMARY KEY,
      username  TEXT UNIQUE NOT NULL,
      password  TEXT NOT NULL,
      role      TEXT NOT NULL CHECK(role IN ('admin','teacher','bursar')),
      name      TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS students (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      "classId"    TEXT NOT NULL,
      "daysAttended" TEXT DEFAULT '',
      passport     TEXT DEFAULT '',
      status       TEXT NOT NULL DEFAULT 'active',
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
      "bursarSignature" TEXT DEFAULT '',
      "adminPassword" TEXT DEFAULT 'admin123'
    );

    CREATE TABLE IF NOT EXISTS share_tokens (
      token       TEXT PRIMARY KEY,
      "studentId" TEXT NOT NULL,
      session     TEXT NOT NULL,
      term        TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id             TEXT PRIMARY KEY,
      receipt_number TEXT UNIQUE NOT NULL,
      "studentId"    TEXT NOT NULL,
      session        TEXT NOT NULL,
      term           TEXT NOT NULL,
      date           TEXT NOT NULL,
      items          TEXT NOT NULL DEFAULT '[]',
      payment_method TEXT DEFAULT '',
      to_balance     TEXT DEFAULT '',
      bursar_name    TEXT DEFAULT '',
      share_token    TEXT DEFAULT '',
      "createdBy"    TEXT NOT NULL,
      "createdAt"    TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS applicants (
      id                    TEXT PRIMARY KEY,
      ref_number            TEXT UNIQUE NOT NULL,
      surname               TEXT NOT NULL,
      first_name            TEXT NOT NULL,
      other_name            TEXT DEFAULT '',
      sex                   TEXT DEFAULT '',
      dob                   TEXT DEFAULT '',
      home_address          TEXT DEFAULT '',
      state_of_origin       TEXT DEFAULT '',
      local_govt            TEXT DEFAULT '',
      hometown              TEXT DEFAULT '',
      prev_school_name      TEXT DEFAULT '',
      prev_school_town      TEXT DEFAULT '',
      prev_school_class     TEXT DEFAULT '',
      prev_school_year      TEXT DEFAULT '',
      parent_name           TEXT DEFAULT '',
      parent_relationship   TEXT DEFAULT '',
      parent_office_address TEXT DEFAULT '',
      parent_occupation     TEXT DEFAULT '',
      phone                 TEXT DEFAULT '',
      whatsapp              TEXT DEFAULT '',
      passport              TEXT DEFAULT '',
      status                TEXT DEFAULT 'pending' CHECK(status IN ('pending','admitted','rejected')),
      class_admitted        TEXT DEFAULT '',
      remark                TEXT DEFAULT '',
      "admittedAt"          TIMESTAMPTZ,
      "createdAt"           TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_applicants_status ON applicants(status);
    CREATE INDEX IF NOT EXISTS idx_applicants_ref    ON applicants(ref_number);
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

  // Per-class, per-term subject lists — the persisted, admin-editable source
  // of truth. "position" preserves the display order of classes (Creche → S.S 3).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS class_subjects (
      "classId"   TEXT NOT NULL,
      subjects    TEXT NOT NULL DEFAULT '[]',
      position    INTEGER NOT NULL DEFAULT 0,
      session     TEXT NOT NULL DEFAULT '',
      term        TEXT NOT NULL DEFAULT '',
      "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY ("classId", session, term)
    );
  `);

  // Seed subjects once, on a fresh database, from the bundled defaults —
  // applied to whatever session/term is current in settings.
  const { rows: csRows } = await pool.query('SELECT 1 FROM class_subjects LIMIT 1');
  if (csRows.length === 0) {
    const { rows: setRows } = await pool.query('SELECT session, term FROM settings WHERE id=1');
    const seedSession = setRows[0]?.session || '2024/2025';
    const seedTerm    = setRows[0]?.term    || '1ST TERM';
    let pos = 0;
    for (const [classId, subjects] of Object.entries(DEFAULT_CLASS_SUBJECTS)) {
      await pool.query(
        'INSERT INTO class_subjects ("classId", subjects, position, session, term) VALUES ($1,$2,$3,$4,$5)',
        [classId, JSON.stringify(subjects), pos++, seedSession, seedTerm]
      );
    }
  }

  // CREATE TABLE IF NOT EXISTS above is a no-op for deployments where
  // class_subjects already existed, so add the new columns explicitly.
  await pool.query(`ALTER TABLE class_subjects ADD COLUMN IF NOT EXISTS session TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE class_subjects ADD COLUMN IF NOT EXISTS term    TEXT NOT NULL DEFAULT '';`);

  // Auto-migration: older deployments had ONE subject list shared by every
  // term/session (PRIMARY KEY was "classId" alone). Detect that shape and
  // rekey it into per-(classId, session, term) rows, so editing subjects for
  // the current term never touches other terms' result sheets again.
  const { rows: pkCols } = await pool.query(`
    SELECT a.attname FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = 'class_subjects'::regclass AND i.indisprimary
  `);
  const isOldShape = pkCols.length === 1 && pkCols[0].attname === 'classId';
  if (isOldShape) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('ALTER TABLE class_subjects DROP CONSTRAINT class_subjects_pkey');

      const { rows: oldRows } = await client.query('SELECT "classId", subjects, position FROM class_subjects');
      const { rows: setRows } = await client.query('SELECT session, term FROM settings WHERE id=1');
      const currentSession = setRows[0]?.session || '2024/2025';
      const currentTerm    = setRows[0]?.term    || '1ST TERM';

      for (const row of oldRows) {
        // Every (session, term) that already has saved results for this
        // class must keep seeing this same subject list, so old sheets
        // don't lose columns; the current global term is always included
        // too, even if no results exist for it yet.
        const { rows: pairs } = await client.query(
          `SELECT DISTINCT r.session, r.term FROM results r
           JOIN students s ON s.id = r."studentId"
           WHERE s."classId" = $1`,
          [row.classId]
        );
        const pairSet = new Map();
        for (const p of pairs) pairSet.set(p.session + '|||' + p.term, [p.session, p.term]);
        pairSet.set(currentSession + '|||' + currentTerm, [currentSession, currentTerm]);

        for (const [session, term] of pairSet.values()) {
          await client.query(
            `INSERT INTO class_subjects ("classId", subjects, position, session, term)
             VALUES ($1,$2,$3,$4,$5)`,
            [row.classId, row.subjects, row.position, session, term]
          );
        }
      }
      // The original rows (still session='' term='') are now redundant.
      await client.query(`DELETE FROM class_subjects WHERE session = '' AND term = ''`);
      await client.query('ALTER TABLE class_subjects ADD PRIMARY KEY ("classId", session, term)');
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // Auto-migration: add bursarSignature column if missing
  await pool.query(`
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS "bursarSignature" TEXT DEFAULT '';
  `);

  // Auto-migration: add student promotion status (active / repeat / graduated).
  // Existing rows default to 'active' so nobody is silently marked otherwise.
  await pool.query(`
    ALTER TABLE students ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'students_status_check'
      ) THEN
        ALTER TABLE students ADD CONSTRAINT students_status_check
          CHECK (status IN ('active','repeat','graduated'));
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END$$;
  `).catch(() => {});

  // Auto-migration: update role CHECK for existing deployments
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_role_check'
        AND conrelid = 'users'::regclass
      ) THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
        ALTER TABLE users ADD CONSTRAINT users_role_check
          CHECK (role IN ('admin', 'teacher', 'bursar'));
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END$$;
  `).catch(() => {});

  // Records "section completed" and "left the school" events for students —
  // e.g. Primary 4→J.S.S 1, J.S.S 3→S.S 1, or final graduation from S.S 3.
  // A student can appear here multiple times over their years at the school,
  // and still be an active student even after a non-final milestone.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_milestones (
      id          TEXT PRIMARY KEY,
      "studentId" TEXT NOT NULL,
      label       TEXT NOT NULL,
      "fromClass" TEXT NOT NULL,
      "toClass"   TEXT DEFAULT '',
      session     TEXT NOT NULL,
      final       BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Auto-migration: introduce the new "Primary 5" class, inserted right after
  // "Primary 4" in the class order. Runs once — later boots see the class
  // already present (in any session/term) and skip straight past this.
  const { rows: p5Rows } = await pool.query(`SELECT 1 FROM class_subjects WHERE "classId" = 'Primary 5' LIMIT 1`);
  if (p5Rows.length === 0) {
    const { rows: p4Rows } = await pool.query(
      `SELECT subjects, position FROM class_subjects WHERE "classId" = 'Primary 4' ORDER BY "updatedAt" DESC LIMIT 1`
    );
    if (p4Rows[0]) {
      const insertPos = p4Rows[0].position + 1;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Make room right after Primary 4 for every class that comes next.
        await client.query('UPDATE class_subjects SET position = position + 1 WHERE position >= $1', [insertPos]);
        const { rows: setRows } = await client.query('SELECT session, term FROM settings WHERE id=1');
        const seedSession = setRows[0]?.session || '2024/2025';
        const seedTerm    = setRows[0]?.term    || '1ST TERM';
        await client.query(
          `INSERT INTO class_subjects ("classId", subjects, position, session, term) VALUES ($1,$2,$3,$4,$5)`,
          ['Primary 5', p4Rows[0].subjects, insertPos, seedSession, seedTerm]
        );
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
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
  listBursars: async () => {
    const { rows } = await pool.query(
      "SELECT id,username,role,name,\"createdAt\" FROM users WHERE role='bursar' ORDER BY name"
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
  createBursar: async ({ username, password, name }) => {
    const hash = bcrypt.hashSync(password, 10);
    const id   = 'usr_' + uid();
    await pool.query(
      "INSERT INTO users (id,username,password,role,name) VALUES ($1,$2,$3,'bursar',$4)",
      [id, username, hash, name || username]
    );
    return { id, username, role: 'bursar', name: name || username };
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
  updateBursar: async (id, { username, password, name }) => {
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      await pool.query(
        "UPDATE users SET username=$1,password=$2,name=$3 WHERE id=$4 AND role='bursar'",
        [username, hash, name, id]
      );
    } else {
      await pool.query(
        "UPDATE users SET username=$1,name=$2 WHERE id=$3 AND role='bursar'",
        [username, name, id]
      );
    }
  },
  delete: async (id) => {
    await pool.query("DELETE FROM users WHERE id=$1 AND role='teacher'", [id]);
  },
  deleteBursar: async (id) => {
    await pool.query("DELETE FROM users WHERE id=$1 AND role='bursar'", [id]);
  },
  verifyPassword: (user, password) => bcrypt.compareSync(password, user.password),
};

// ── Students ──────────────────────────────────────────────────
const Milestones = {
  create: async (client, { studentId, label, fromClass, toClass, session, final }) => {
    await client.query(
      `INSERT INTO student_milestones (id, "studentId", label, "fromClass", "toClass", session, final)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['ms_' + uid(), studentId, label, fromClass, toClass || '', session, !!final]
    );
  },
  listAll: async () => {
    const { rows } = await pool.query('SELECT * FROM student_milestones ORDER BY "createdAt" DESC');
    return rows.map(r => ({ ...r, final: !!r.final }));
  },
  listByStudent: async (studentId) => {
    const { rows } = await pool.query(
      'SELECT * FROM student_milestones WHERE "studentId"=$1 ORDER BY "createdAt" DESC', [studentId]
    );
    return rows.map(r => ({ ...r, final: !!r.final }));
  },
  // When an admin reinstates a mistakenly-graduated student, drop the most
  // recent "left the school" record so the Graduated tab stays accurate.
  deleteMostRecentFinal: async (client, studentId) => {
    await client.query(
      `DELETE FROM student_milestones WHERE id = (
         SELECT id FROM student_milestones WHERE "studentId"=$1 AND final=TRUE
         ORDER BY "createdAt" DESC LIMIT 1
       )`,
      [studentId]
    );
  },
};

async function getTopClass(client = pool) {
  const { rows } = await client.query(
    'SELECT "classId", MIN(position) AS position FROM class_subjects GROUP BY "classId" ORDER BY position DESC LIMIT 1'
  );
  return rows[0]?.classId || null;
}

async function getCurrentSession(client = pool) {
  const { rows } = await client.query('SELECT session FROM settings WHERE id=1');
  return rows[0]?.session || '';
}

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
    const id = student.id || 'stu_' + uid();
    const status = ['active','repeat','graduated'].includes(student.status) ? student.status : 'active';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: existingRows } = await client.query('SELECT "classId", status FROM students WHERE id=$1', [id]);
      const prev = existingRows[0] || null;

      await client.query(`
        INSERT INTO students (id, name, "classId", "daysAttended", passport, status)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO UPDATE
          SET name=$2, "classId"=$3, "daysAttended"=$4, passport=$5, status=$6
      `, [id, student.name, student.classId, student.daysAttended || '', student.passport || '', status]);

      if (prev) {
        const currentSession = await getCurrentSession(client);

        // Section-boundary crossing (e.g. Primary 4 → J.S.S 1), even though
        // the student stays active and keeps showing up in normal views.
        if (prev.classId !== student.classId) {
          const key = sectionOf(prev.classId) + '->' + sectionOf(student.classId);
          if (SECTION_MILESTONE[key]) {
            await Milestones.create(client, {
              studentId: id, label: SECTION_MILESTONE[key],
              fromClass: prev.classId, toClass: student.classId,
              session: currentSession, final: false,
            });
          }
        }

        // Status crossing into/out of 'graduated' (final leaving the school).
        if (prev.status !== 'graduated' && status === 'graduated') {
          const topClass = await getTopClass(client);
          await Milestones.create(client, {
            studentId: id,
            label: student.classId === topClass ? 'Completed Senior Secondary School' : 'Left the School',
            fromClass: student.classId, toClass: '',
            session: currentSession, final: true,
          });
        } else if (prev.status === 'graduated' && status !== 'graduated') {
          await Milestones.deleteMostRecentFinal(client, id);
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
  delete: async (id) => {
    await pool.query('DELETE FROM students WHERE id=$1', [id]);
  },
  bulkInsert: async (students) => {
    for (const s of students) {
      const status = ['active','repeat','graduated'].includes(s.status) ? s.status : 'active';
      await pool.query(`
        INSERT INTO students (id, name, "classId", "daysAttended", passport, status)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO UPDATE
          SET name=$2, "classId"=$3, "daysAttended"=$4, passport=$5, status=$6
      `, [s.id || 'stu_' + uid(), s.name, s.classId, s.daysAttended || '', s.passport || '', status]);
    }
  },

  // ── Promotion (admin-triggered, at the start of a new session) ─────────
  // Rules:
  //   • status='repeat'    → classId unchanged, status reset to 'active'
  //                          (they repeat this class as a normal active student).
  //   • status='graduated' → left untouched entirely (already left the school).
  //   • classId=BRANCH_CLASS (Primary 4) → left untouched; the admin must
  //     decide per student between Primary 5 and J.S.S 1 (edit the student).
  //     That later edit is what logs their "Completed Primary School" milestone.
  //   • top class (last in class order) + status='active' → status becomes
  //     'graduated', classId unchanged (kept for historical records); logs a
  //     final "Completed Senior Secondary School" milestone.
  //   • everyone else ('active', not top/branch class) → moved to the next
  //     class in sequence, status stays 'active'; if that move crosses a
  //     school-section boundary (e.g. J.S.S 3 → S.S 1) a non-final milestone
  //     is logged even though they remain a normal active student.
  // Runs as one transaction; returns a summary of what happened.
  promoteAll: async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Same ordering logic as ClassSubjects.getAll: earliest "position" a
      // classId was ever seeded/edited at, across all sessions/terms.
      const { rows: orderRows } = await client.query(
        'SELECT "classId", MIN(position) AS position FROM class_subjects GROUP BY "classId" ORDER BY position, "classId"'
      );
      const classOrder = orderRows.map(r => r.classId);
      if (classOrder.length === 0) throw httpError(400, 'No classes are configured yet.');
      const topClass = classOrder[classOrder.length - 1];
      const nextClass = {};
      classOrder.forEach((c, i) => { if (i < classOrder.length - 1) nextClass[c] = classOrder[i + 1]; });
      delete nextClass[BRANCH_CLASS]; // never auto-promoted — admin decides

      const currentSession = await getCurrentSession(client);
      const { rows: students } = await client.query('SELECT id, "classId", status FROM students');

      let promoted = 0, repeated = 0, graduated = 0, needsDecision = 0, skipped = 0;
      for (const s of students) {
        if (s.status === 'graduated') { skipped++; continue; }

        if (s.status === 'repeat') {
          await client.query('UPDATE students SET status=$1 WHERE id=$2', ['active', s.id]);
          repeated++;
          continue;
        }

        if (s.classId === BRANCH_CLASS) {
          needsDecision++; // admin must move this student to Primary 5 or J.S.S 1 manually
          continue;
        }

        if (s.classId === topClass) {
          await client.query('UPDATE students SET status=$1 WHERE id=$2', ['graduated', s.id]);
          await Milestones.create(client, {
            studentId: s.id, label: 'Completed Senior Secondary School',
            fromClass: topClass, toClass: '', session: currentSession, final: true,
          });
          graduated++;
          continue;
        }

        const next = nextClass[s.classId];
        if (!next) { skipped++; continue; } // classId not in the known order — leave alone

        await client.query('UPDATE students SET "classId"=$1 WHERE id=$2', [next, s.id]);

        const key = sectionOf(s.classId) + '->' + sectionOf(next);
        if (SECTION_MILESTONE[key]) {
          await Milestones.create(client, {
            studentId: s.id, label: SECTION_MILESTONE[key],
            fromClass: s.classId, toClass: next, session: currentSession, final: false,
          });
        }
        promoted++;
      }

      await client.query('COMMIT');
      return { promoted, repeated, graduated, needsDecision, skipped, total: students.length };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
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
      SET session=$1, term=$2, "daysInSchool"=$3, "resumptionDate"=$4, "stampImage"=$5, "adminPassword"=$6, "bursarSignature"=$7
      WHERE id=1
    `, [s.session, s.term, s.daysInSchool || '', s.resumptionDate || '', s.stampImage || '', s.adminPassword || 'admin123', s.bursarSignature || '']);

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

// ── Receipts ──────────────────────────────────────────────────
const Receipts = {

  async getNextNumber(session) {
    const year = session ? session.split('/')[0] : new Date().getFullYear().toString();
    const { rows } = await pool.query(
      `SELECT receipt_number FROM receipts
       WHERE receipt_number LIKE $1
       ORDER BY receipt_number DESC LIMIT 1`,
      [`RCP-${year}-%`]
    );
    if (rows.length === 0) return `RCP-${year}-0001`;
    const last = rows[0].receipt_number;
    const seq  = parseInt(last.split('-')[2], 10) + 1;
    return `RCP-${year}-${String(seq).padStart(4, '0')}`;
  },

  async create({ studentId, session, term, date, items, payment_method, to_balance, bursar_name, createdBy }) {
    const id             = 'rcp_' + uid();
    const receipt_number = await Receipts.getNextNumber(session);
    await pool.query(
      `INSERT INTO receipts
        (id, receipt_number, "studentId", session, term, date, items, payment_method, to_balance, bursar_name, "createdBy")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, receipt_number, studentId, session, term, date,
       JSON.stringify(items), payment_method || '', to_balance || '', bursar_name || '', createdBy]
    );
    return Receipts.get(id);
  },

  async list() {
    const { rows } = await pool.query(
      `SELECT r.*, s.name as "studentName", s."classId", s.passport
       FROM receipts r
       LEFT JOIN students s ON s.id = r."studentId"
       ORDER BY r."createdAt" DESC`
    );
    return rows.map(r => ({ ...r, items: JSON.parse(r.items || '[]') }));
  },

  async get(id) {
    const { rows } = await pool.query(
      `SELECT r.*, s.name as "studentName", s."classId", s.passport,
              (SELECT "stampImage" FROM settings WHERE id=1) as "stampImage",
              (SELECT "bursarSignature" FROM settings WHERE id=1) as "bursarSignature"
       FROM receipts r
       LEFT JOIN students s ON s.id = r."studentId"
       WHERE r.id = $1`,
      [id]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return { ...r, items: JSON.parse(r.items || '[]') };
  },

  async getByToken(token) {
    const { rows } = await pool.query(
      `SELECT r.*, s.name as "studentName", s."classId", s.passport,
              (SELECT "stampImage" FROM settings WHERE id=1) as "stampImage",
              (SELECT "bursarSignature" FROM settings WHERE id=1) as "bursarSignature"
       FROM receipts r
       LEFT JOIN students s ON s.id = r."studentId"
       WHERE r.share_token = $1`,
      [token]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return { ...r, items: JSON.parse(r.items || '[]') };
  },

  async generateToken(id) {
    const token = uid() + uid();
    await pool.query(`UPDATE receipts SET share_token = $1 WHERE id = $2`, [token, id]);
    return token;
  },

  async delete(id) {
    await pool.query(`DELETE FROM receipts WHERE id = $1`, [id]);
  },
};


// ── Applicants ────────────────────────────────────────────────
const Applicants = {

  async _nextRef() {
    const year = new Date().getFullYear();
    const { rows } = await pool.query(
      `SELECT ref_number FROM applicants
       WHERE ref_number LIKE $1
       ORDER BY ref_number DESC LIMIT 1`,
      [`CC-${year}-%`]
    );
    if (rows.length === 0) return `CC-${year}-0001`;
    const last = rows[0].ref_number;
    const seq  = parseInt(last.split('-')[2], 10) + 1;
    return `CC-${year}-${String(seq).padStart(4, '0')}`;
  },

  async apply(data) {
    const id         = 'app_' + uid();
    const ref_number = await Applicants._nextRef();
    await pool.query(`
      INSERT INTO applicants
        (id, ref_number, surname, first_name, other_name, sex, dob,
         home_address, state_of_origin, local_govt, hometown,
         prev_school_name, prev_school_town, prev_school_class, prev_school_year,
         parent_name, parent_relationship, parent_office_address, parent_occupation,
         phone, whatsapp, passport)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
    `, [
      id, ref_number,
      data.surname, data.firstName, data.otherName || '',
      data.sex || '', data.dob || '',
      data.homeAddress || '', data.stateOfOrigin || '',
      data.localGovt || '', data.hometown || '',
      data.prevSchoolName || '', data.prevSchoolTown || '',
      data.prevSchoolClass || '', data.prevSchoolYear || '',
      data.parentName || '', data.parentRelationship || '',
      data.parentOfficeAddress || '', data.parentOccupation || '',
      data.phone || '', data.whatsapp || '',
      data.passport || '',
    ]);
    return { id, ref_number };
  },

  async list() {
    const { rows } = await pool.query(
      `SELECT * FROM applicants ORDER BY "createdAt" DESC`
    );
    return rows;
  },

  async get(id) {
    const { rows } = await pool.query(
      `SELECT * FROM applicants WHERE id=$1`, [id]
    );
    return rows[0] || null;
  },

  async getByRef(ref) {
    const { rows } = await pool.query(
      `SELECT * FROM applicants WHERE ref_number=$1`, [ref]
    );
    return rows[0] || null;
  },

  async updateStatus(id, { status, classAdmitted, remark }) {
    const admittedAt = status === 'admitted' ? new Date().toISOString() : null;
    await pool.query(`
      UPDATE applicants
      SET status=$1, class_admitted=$2, remark=$3, "admittedAt"=$4
      WHERE id=$5
    `, [status, classAdmitted || '', remark || '', admittedAt, id]);
    return Applicants.get(id);
  },

  async promoteToStudent(id) {
    const app = await Applicants.get(id);
    if (!app || app.status !== 'admitted') throw new Error('Applicant not admitted');
    const studentId = 'stu_' + uid();
    const fullName  = [app.surname, app.first_name, app.other_name].filter(Boolean).join(' ');
    await pool.query(`
      INSERT INTO students (id, name, "classId", "daysAttended", passport)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (id) DO NOTHING
    `, [studentId, fullName, app.class_admitted, '', app.passport || '']);
    return { studentId, name: fullName, classId: app.class_admitted };
  },

  async delete(id) {
    await pool.query(`DELETE FROM applicants WHERE id=$1`, [id]);
  },
};

// ── Class Subjects ────────────────────────────────────────────
// The persisted, admin-editable per-class subject lists. All mutations
// validate here (non-empty, no case-insensitive duplicates, class/subject
// must exist) and throw httpError(status, msg) so routes map cleanly.
const ClassSubjects = {
  // Whole map for one (session, term): { "Primary 1": [...subjects], ... }
  // in class display order. Any class with no row yet for this exact term
  // is lazily seeded (see getOne) so every class always resolves.
  getAll: async (session, term) => {
    const { rows } = await pool.query(
      'SELECT "classId", MIN(position) AS position FROM class_subjects GROUP BY "classId" ORDER BY position, "classId"'
    );
    const out = {};
    for (const r of rows) {
      out[r.classId] = await ClassSubjects.getOne(r.classId, session, term);
    }
    return out;
  },

  // Ordered subject array for one class in one (session, term), or null if
  // the class doesn't exist at all. If the class exists but has no list yet
  // for this specific term, it's seeded by copying the most recently edited
  // list for that class (i.e. carried forward from whichever term was
  // worked on last) — a fresh, independently-editable copy from that point on.
  getOne: async (classId, session, term) => {
    const { rows } = await pool.query(
      'SELECT subjects FROM class_subjects WHERE "classId"=$1 AND session=$2 AND term=$3',
      [classId, session, term]
    );
    if (rows[0]) {
      try { return JSON.parse(rows[0].subjects || '[]'); }
      catch { return []; }
    }

    const { rows: prevRows } = await pool.query(
      'SELECT subjects, position FROM class_subjects WHERE "classId"=$1 ORDER BY "updatedAt" DESC LIMIT 1',
      [classId]
    );
    if (!prevRows[0]) return null; // class truly doesn't exist

    const { subjects, position } = prevRows[0];
    await pool.query(
      `INSERT INTO class_subjects ("classId", subjects, position, session, term)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT ("classId", session, term) DO NOTHING`,
      [classId, subjects, position, session, term]
    );
    try { return JSON.parse(subjects || '[]'); }
    catch { return []; }
  },

  _persist: async (classId, session, term, subjects) => {
    await pool.query(
      `UPDATE class_subjects SET subjects=$1, "updatedAt"=NOW()
       WHERE "classId"=$2 AND session=$3 AND term=$4`,
      [JSON.stringify(subjects), classId, session, term]
    );
  },

  add: async (classId, session, term, rawName) => {
    const subjects = await ClassSubjects.getOne(classId, session, term);
    if (subjects === null) throw httpError(404, 'Class not found');
    const name = (rawName || '').trim();
    if (!name) throw httpError(400, 'Subject name cannot be empty');
    if (subjects.some(s => s.toLowerCase() === name.toLowerCase()))
      throw httpError(409, 'That subject already exists in this class');
    subjects.push(name);
    await ClassSubjects._persist(classId, session, term, subjects);
    return subjects;
  },

  remove: async (classId, session, term, name) => {
    const subjects = await ClassSubjects.getOne(classId, session, term);
    if (subjects === null) throw httpError(404, 'Class not found');
    const idx = subjects.indexOf(name);
    if (idx < 0) throw httpError(404, 'Subject not found in this class');
    subjects.splice(idx, 1);
    await ClassSubjects._persist(classId, session, term, subjects);
    return subjects;
  },

  // Rename a subject AND migrate the score keys of existing results for
  // students in this class FOR THIS TERM ONLY, so other terms' historical
  // results are untouched. Runs in a transaction: the subject list and all
  // touched results commit together.
  rename: async (classId, session, term, oldName, rawNewName) => {
    const subjects = await ClassSubjects.getOne(classId, session, term);
    if (subjects === null) throw httpError(404, 'Class not found');
    const idx = subjects.indexOf(oldName);
    if (idx < 0) throw httpError(404, 'Subject not found in this class');
    const newName = (rawNewName || '').trim();
    if (!newName) throw httpError(400, 'Subject name cannot be empty');
    if (subjects.some((s, i) => i !== idx && s.toLowerCase() === newName.toLowerCase()))
      throw httpError(409, 'That subject already exists in this class');
    if (newName === oldName) return subjects;

    subjects[idx] = newName;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE class_subjects SET subjects=$1, "updatedAt"=NOW()
         WHERE "classId"=$2 AND session=$3 AND term=$4`,
        [JSON.stringify(subjects), classId, session, term]
      );
      const { rows } = await client.query(
        `SELECT r.id, r.scores FROM results r JOIN students s ON s.id=r."studentId"
         WHERE s."classId"=$1 AND r.session=$2 AND r.term=$3`,
        [classId, session, term]
      );
      for (const row of rows) {
        let scores;
        try { scores = JSON.parse(row.scores || '{}'); } catch { continue; }
        if (!Object.prototype.hasOwnProperty.call(scores, oldName)) continue;
        if (!Object.prototype.hasOwnProperty.call(scores, newName)) scores[newName] = scores[oldName];
        delete scores[oldName];
        await client.query(
          'UPDATE results SET scores=$1, "updatedAt"=NOW() WHERE id=$2',
          [JSON.stringify(scores), row.id]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return subjects;
  },

  // How many saved results for this class, IN THIS TERM, carry a score under
  // this subject. Used to warn the admin before removing a subject that has
  // recorded data for the term they're currently editing.
  usageCount: async (classId, session, term, subject) => {
    const { rows } = await pool.query(
      `SELECT r.scores FROM results r JOIN students s ON s.id=r."studentId"
       WHERE s."classId"=$1 AND r.session=$2 AND r.term=$3`,
      [classId, session, term]
    );
    let count = 0;
    for (const row of rows) {
      try {
        const scores = JSON.parse(row.scores || '{}');
        if (Object.prototype.hasOwnProperty.call(scores, subject)) count++;
      } catch { /* skip unparseable */ }
    }
    return count;
  },
};

module.exports = { pool, initSchema, Users, Students, Results, Settings, ShareTokens, Receipts, Applicants, ClassSubjects, Milestones, uid };

