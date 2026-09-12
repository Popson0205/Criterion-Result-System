#!/usr/bin/env bash
# ============================================================
# scripts/backup-db.sh
#
# Full database backup via pg_dump — schema + data, in Postgres's own
# custom format so it can be restored with pg_restore (or converted to
# plain SQL). Use this before running any repair/migration script.
#
# REQUIREMENTS
#   - The `pg_dump` command-line tool must be installed and on PATH.
#     It ships with PostgreSQL. If you don't have it:
#       macOS:          brew install libpq && brew link --force libpq
#       Ubuntu/Debian:  sudo apt-get install postgresql-client
#       Windows:        install PostgreSQL from postgresql.org (includes pg_dump)
#     If you can't install it (e.g. a restricted hosting shell), use
#     scripts/backup-db.js instead — a pure-Node.js fallback.
#
# USAGE
#   DATABASE_URL="postgres://user:pass@host/dbname" ./scripts/backup-db.sh
#
#   Or export it once for the session:
#     export DATABASE_URL="postgres://user:pass@host/dbname"
#     ./scripts/backup-db.sh
#
# OUTPUT
#   Creates ./backups/criterion-backup-YYYY-MM-DDTHH-MM-SS.dump
#
# RESTORE (if you ever need to)
#   pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" backups/criterion-backup-....dump
#   (--clean --if-exists drops and recreates existing objects first; leave
#    them off if you're restoring into a brand-new, empty database.)
# ============================================================

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  echo 'Usage: DATABASE_URL="postgres://user:pass@host/dbname" ./scripts/backup-db.sh' >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump is not installed or not on PATH." >&2
  echo "Install the PostgreSQL client tools, or use scripts/backup-db.js instead." >&2
  exit 1
fi

mkdir -p backups
STAMP="$(date +%Y-%m-%dT%H-%M-%S)"
OUT="backups/criterion-backup-${STAMP}.dump"

echo "Backing up database to ${OUT} ..."

# --format=custom: compressed, restorable selectively with pg_restore.
# --no-owner / --no-privileges: skip role/permission commands, which often
# don't match between your local machine and the hosted DB anyway.
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$OUT"

echo "Done: ${OUT} ($(du -h "$OUT" | cut -f1))"
echo "Keep this file somewhere safe before running any repair script."
