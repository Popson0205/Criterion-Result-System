// ============================================================
// scripts/backup-db.js
//
// Pure-Node.js database backup — no pg_dump binary required (unlike
// scripts/backup-db.sh). Reads every application table and writes it all
// into one timestamped JSON file. Use this if you can't install the
// PostgreSQL command-line tools (e.g. a restricted hosting shell);
// otherwise prefer backup-db.sh, since a real pg_dump is the more
// standard, more easily-restored format.
//
// USAGE
//   DATABASE_URL="postgres://user:pass@host/dbname" node scripts/backup-db.js
//
// OUTPUT
//   Creates ./backups/criterion-backup-<timestamp>.json containing every
//   row of every table listed below, plus a manifest of row counts.
//
// RESTORE (if you ever need to)
//   node scripts/restore-db.js backups/criterion-backup-....json
//   (companion script — restores each table from the JSON, matching rows
//   by primary key with upsert-style INSERT ... ON CONFLICT DO UPDATE, so
//   it's safe to run against a database that already has some data in it.)
// ============================================================

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Every table the app creates (see db.js). Keep this list in sync if you
// add new tables — restore-db.js reads whatever is in the JSON, but a
// table left out here just won't be backed up.
const TABLES = [
  'users',
  'students',
  'results',
  'settings',
  'share_tokens',
  'receipts',
  'applicants',
  'class_subjects',
  'student_milestones',
  'student_class_history',
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set.');
    console.error('Usage: DATABASE_URL="postgres://user:pass@host/dbname" node scripts/backup-db.js');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const backup = { createdAt: new Date().toISOString(), tables: {} };

  try {
    for (const table of TABLES) {
      process.stdout.write(`Backing up "${table}"... `);
      const { rows } = await pool.query(`SELECT * FROM ${quoteIdent(table)}`);
      backup.tables[table] = rows;
      console.log(`${rows.length} row(s)`);
    }
  } finally {
    await pool.end();
  }

  const dir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(dir, `criterion-backup-${stamp}.json`);

  fs.writeFileSync(outPath, JSON.stringify(backup, null, 2));

  const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`\nDone: ${outPath} (${sizeKb} KB)`);
  console.log('Keep this file somewhere safe before running any repair script.');
}

// Table names above are all trusted, hardcoded constants (never user
// input), but quote them anyway since it costs nothing and avoids any
// reliance on them happening to be safe identifiers forever.
function quoteIdent(name) {
  return '"' + name.replace(/"/g, '""') + '"';
}

main().catch(e => {
  console.error('\n❌ Backup failed:', e.message);
  process.exit(1);
});
