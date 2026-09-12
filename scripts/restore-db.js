// ============================================================
// scripts/restore-db.js
//
// Restores a JSON backup produced by scripts/backup-db.js. Upserts row by
// row (INSERT ... ON CONFLICT DO UPDATE) keyed on each table's primary
// key, so it's safe to run against a database that already has rows in
// it — existing rows with matching IDs are overwritten with the backed-up
// values; rows that only exist live (not in the backup) are left alone.
//
// This restores DATA only, not schema — it assumes the tables already
// exist (i.e. the app has been started at least once, which creates
// them). It's the right tool for undoing a bad write, not for standing
// up a brand-new empty database.
//
// USAGE
//   DATABASE_URL="postgres://user:pass@host/dbname" \
//     node scripts/restore-db.js backups/criterion-backup-....json
//
//   Add --dry-run to see row counts per table without writing anything:
//   DATABASE_URL="..." node scripts/restore-db.js backups/....json --dry-run
// ============================================================

const { Pool } = require('pg');
const fs = require('fs');

// Primary key column(s) for each table — must match db.js's schema.
const PRIMARY_KEYS = {
  users: ['id'],
  students: ['id'],
  results: ['id'],
  settings: ['id'],
  share_tokens: ['token'],
  receipts: ['id'],
  applicants: ['id'],
  class_subjects: ['id'],
  student_milestones: ['id'],
  student_class_history: ['id'],
};

function quoteIdent(name) {
  return '"' + name.replace(/"/g, '""') + '"';
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find(a => !a.startsWith('--'));

  if (!file) {
    console.error('Usage: node scripts/restore-db.js <backup-file.json> [--dry-run]');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set.');
    process.exit(1);
  }

  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`Restoring backup created at ${backup.createdAt}${dryRun ? ' (DRY RUN — no writes)' : ''}\n`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    for (const [table, rows] of Object.entries(backup.tables || {})) {
      const pk = PRIMARY_KEYS[table];
      if (!pk) {
        console.log(`Skipping "${table}": unknown table, not in PRIMARY_KEYS map.`);
        continue;
      }
      if (rows.length === 0) {
        console.log(`"${table}": 0 rows in backup, nothing to do.`);
        continue;
      }

      console.log(`"${table}": restoring ${rows.length} row(s)${dryRun ? ' (dry run)' : ''}...`);
      if (dryRun) continue;

      const columns = Object.keys(rows[0]);
      const colList = columns.map(quoteIdent).join(', ');
      const updateSet = columns
        .filter(c => !pk.includes(c))
        .map(c => `${quoteIdent(c)}=EXCLUDED.${quoteIdent(c)}`)
        .join(', ');
      const conflictCols = pk.map(quoteIdent).join(', ');

      for (const row of rows) {
        const values = columns.map(c => row[c]);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const sql = updateSet
          ? `INSERT INTO ${quoteIdent(table)} (${colList}) VALUES (${placeholders})
             ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateSet}`
          : `INSERT INTO ${quoteIdent(table)} (${colList}) VALUES (${placeholders})
             ON CONFLICT (${conflictCols}) DO NOTHING`;
        await pool.query(sql, values);
      }
    }

    console.log(dryRun ? '\nDry run complete — nothing was written.' : '\n✅ Restore complete.');
  } finally {
    await pool.end();
  }
}

main().catch(e => {
  console.error('\n❌ Restore failed:', e.message);
  process.exit(1);
});
