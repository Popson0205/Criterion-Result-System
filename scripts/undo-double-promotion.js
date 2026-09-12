// ============================================================
// scripts/undo-double-promotion.js
//
// One-off repair tool for the "clicked Promote twice in a row" incident.
//
// WHAT HAPPENED
// -------------
// Promotion used to be two separate steps: (1) advance every student one
// class, then (2) a follow-up call that pointed Settings at the new
// session. If Promote was run a second time before anything else changed
// Settings, the app had no way to tell "a brand-new session that
// genuinely needs promoting a year from now" apart from "the same new
// session I was JUST promoted into five minutes ago" — so it promoted
// everybody a second time, straight past their correct class (e.g. some
// S.S 3 students landed on 'graduated' a class early).
//
// WHY THIS SCRIPT CAN FIX IT
// --------------------------
// Every promotion run snapshots the *live* roster into
// student_class_history, keyed by whatever session was current at the
// moment it started — BEFORE it moves anyone. On the second, erroneous
// run, "current session" was already the new session (e.g. "2026/2027"),
// so that snapshot captured the *correct*, once-promoted roster, an
// instant before the second run advanced everyone again. That snapshot
// is still sitting in student_class_history and is what this script
// restores from.
//
// It also finds the student_milestones rows the erroneous run logged
// (e.g. duplicate "Completed Senior Secondary School" entries) so you can
// review and remove them, and clears the now-incorrect history snapshot
// for the target session so it goes back to being treated as the live,
// editable session instead of a closed-out archive.
//
// USAGE
// -----
//   1. BACK UP YOUR DATABASE FIRST. This writes directly to production
//      data. (On Neon/Render/Railway, take a snapshot or run
//      `pg_dump "$DATABASE_URL" > backup.sql` before doing anything else.)
//
//   2. Dry run (default) — shows exactly what would change, changes nothing:
//        DATABASE_URL="postgres://..." node scripts/undo-double-promotion.js --session "2026/2027"
//
//   3. Read the printed diff carefully. If it looks right, apply it:
//        DATABASE_URL="postgres://..." node scripts/undo-double-promotion.js --session "2026/2027" --apply
//
// --session must be the session that Settings is CURRENTLY sitting on
// (the one that was accidentally promoted a second time).
// ============================================================

const { Pool } = require('pg');

function parseArgs(argv) {
  const out = { apply: false, session: null, keepMilestones: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--keep-milestones') out.keepMilestones = true;
    else if (a === '--session') out.session = argv[++i];
    else if (a.startsWith('--session=')) out.session = a.slice('--session='.length);
  }
  return out;
}

async function main() {
  const { apply, session, keepMilestones } = parseArgs(process.argv);

  if (!session) {
    console.error('Usage: node scripts/undo-double-promotion.js --session "2026/2027" [--apply] [--keep-milestones]');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Pass it inline, e.g.:\n  DATABASE_URL="postgres://..." node scripts/undo-double-promotion.js --session "' + session + '"');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log(`\n${apply ? '⚠️  APPLY MODE — this will write to the database.' : '🔍 DRY RUN — no changes will be made.'}`);
  console.log(`Target session: "${session}"\n`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // The settings row must currently be pointed at `session` — otherwise
    // this isn't the situation this script is built for.
    const { rows: settingsRows } = await client.query('SELECT session FROM settings WHERE id=1 FOR UPDATE');
    const liveSession = settingsRows[0]?.session;
    if (liveSession !== session) {
      console.error(`Settings' current session is "${liveSession}", not "${session}". `
        + `This script expects --session to match the session Settings is currently on ` 
        + `(the one that got promoted twice). Stopping without making changes.`);
      await client.query('ROLLBACK');
      process.exit(1);
    }

    // The snapshot taken by the (erroneous) second promotion run — this is
    // the correct, once-promoted class/status for every student.
    const { rows: history } = await client.query(
      'SELECT "studentId", "classId", status FROM student_class_history WHERE session=$1',
      [session]
    );
    if (history.length === 0) {
      console.error(`No student_class_history rows found for session "${session}". `
        + `There's nothing to restore from — either this session was never snapshotted, `
        + `or it's already been cleaned up.`);
      await client.query('ROLLBACK');
      process.exit(1);
    }

    const { rows: liveStudents } = await client.query('SELECT id, name, "classId", status FROM students');
    const liveById = new Map(liveStudents.map(s => [s.id, s]));

    const changes = [];
    for (const h of history) {
      const live = liveById.get(h.studentId);
      if (!live) continue; // student since deleted — nothing to restore
      if (live.classId !== h.classId || live.status !== h.status) {
        changes.push({
          id: h.studentId, name: live.name,
          from: `${live.classId} (${live.status})`,
          to: `${h.classId} (${h.status})`,
        });
      }
    }

    console.log(`Students whose class/status will be restored: ${changes.length} of ${history.length} snapshotted\n`);
    for (const c of changes) {
      console.log(`  ${c.name.padEnd(28)} ${c.from}  →  ${c.to}`);
    }

    // Milestones logged by the erroneous run share the same session label
    // and were all written within the same transaction, so their
    // createdAt timestamps cluster tightly together — print them for
    // review rather than guessing which to delete.
    const { rows: suspectMilestones } = await client.query(
      `SELECT id, "studentId", label, "fromClass", "toClass", final, "createdAt"
       FROM student_milestones WHERE session=$1 ORDER BY "createdAt"`,
      [session]
    );
    console.log(`\nMilestones logged under session "${session}" (review before trusting these are all duplicates): ${suspectMilestones.length}`);
    for (const m of suspectMilestones) {
      console.log(`  ${m.createdAt.toISOString()}  ${m.studentId}  ${m.label}  (${m.fromClass} → ${m.toClass || '—'})${m.final ? '  [final]' : ''}`);
    }

    console.log(`\nThe history snapshot for "${session}" (${history.length} rows) will be deleted afterwards, `
      + `so this session goes back to being live/editable instead of a closed-out archive.`);

    if (!apply) {
      console.log('\nNothing written — re-run with --apply once this all looks correct.');
      await client.query('ROLLBACK');
      return;
    }

    for (const c of changes) {
      const h = history.find(x => x.studentId === c.id);
      await client.query('UPDATE students SET "classId"=$1, status=$2 WHERE id=$3', [h.classId, h.status, c.id]);
    }

    if (!keepMilestones && suspectMilestones.length > 0) {
      await client.query('DELETE FROM student_milestones WHERE session=$1', [session]);
      console.log(`Deleted ${suspectMilestones.length} milestone row(s) for session "${session}".`);
    }

    await client.query('DELETE FROM student_class_history WHERE session=$1', [session]);

    await client.query('COMMIT');
    console.log(`\n✅ Restored ${changes.length} student(s) and cleared the "${session}" snapshot. `
      + `That session is live/editable again.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('\n❌ Failed, nothing was changed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
