#!/bin/bash
# check-applied.sh — Diff repo migrations against the public.applied_migrations
# tracker table in prod. The drift-detection safety net.
#
# WHEN TO RUN:
#   - Every saveme (step 11(h) per CLAUDE.md migration discipline).
#   - Before merging any feature branch that adds migrations.
#   - When investigating "did this migration land?" questions.
#
# WHAT IT CHECKS:
#   For every file in supabase/migrations/*.sql (excl. .down.sql), confirm a
#   row exists in public.applied_migrations with matching name. Migrations
#   intentionally RETIRED (see RETIRED_MIGRATIONS list below) are excluded
#   from the check — they SHOULDN'T be in the tracker.
#
# MODES:
#   - With DATABASE_URL set: runs the check via psql automatically. Exit 0
#     on clean, 1 on drift, 2 on script error.
#   - Without DATABASE_URL: prints the SQL for the user to paste into
#     Supabase SQL Editor. Exit 0 always (visual check).
#
# OUTPUT ON DRIFT:
#   Lists the missing migration names. User must either:
#     (a) Apply them to prod, then INSERT into applied_migrations, OR
#     (b) Confirm they were already applied pre-tracker and INSERT a
#         backfill row, OR
#     (c) Add to RETIRED_MIGRATIONS list if intentional skip.
#
# HISTORY:
#   Created 11 May 2026 by prod-migration-backlog-audit Phase F.
#   See docs/projects/prod-migration-backlog-audit-brief.md.

set -euo pipefail

# Migrations intentionally retired (in supabase/migrations/ for historical
# record but should NEVER be in public.applied_migrations — their effect is
# moot, never landed, or was deliberately rolled back).
RETIRED_MIGRATIONS=(
  # Added 11 May 2026 (Round 1 audit):
  "20260429133402_phase_1_5b_student_sessions_deny_all"
  "20260501142442_phase_3_4f_is_teacher_of_student_includes_class_members_and_mentors"
  # Added 17 May 2026 (Round 2 audit — FU-CHECK-APPLIED-3DIGIT-SCOPE close-out):
  "121_student_progress_autonomy_level"            # local-dev only per migration file comment; never applied to prod
  "122_drop_student_progress_autonomy_level"       # paired rollback of 121; no prod effect (column never existed on prod)
)

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [[ -z "$REPO_ROOT" ]]; then
  echo "❌ Not in a git repo." >&2
  exit 2
fi

MIG_DIR="$REPO_ROOT/supabase/migrations"
if [[ ! -d "$MIG_DIR" ]]; then
  echo "❌ Migration dir not found: $MIG_DIR" >&2
  exit 2
fi

# List every migration in the repo (both 3-digit and timestamp prefixes).
# Scope was widened on 17 May 2026 after FU-PROD-MIGRATION-BACKLOG-AUDIT
# Round 2 backfilled applied_migrations rows for all 3-digit migrations.
# See docs/projects/prod-migration-backlog-audit-2026-05-17-truth.md.
REPO_MIGRATIONS=$(
  ls "$MIG_DIR"/*.sql 2>/dev/null \
  | grep -v '\.down\.sql$' \
  | xargs -n1 basename \
  | sed 's/\.sql$//' \
  | sort
)

# Build a VALUES clause for the SQL. Each row: ('migration_name')
VALUES_CLAUSE=$(echo "$REPO_MIGRATIONS" | awk 'BEGIN{ORS=""} {if (NR>1) print ","; printf "(\047%s\047)", $0}')

# Build the RETIRED filter clause.
RETIRED_FILTER=$(printf "'%s'," "${RETIRED_MIGRATIONS[@]}" | sed 's/,$//')

SQL=$(cat <<EOF
WITH repo_migrations AS (
  SELECT name FROM (VALUES ${VALUES_CLAUSE}) AS t(name)
),
applied AS (
  SELECT name FROM public.applied_migrations
)
SELECT r.name AS missing_from_tracker
FROM repo_migrations r
LEFT JOIN applied a ON a.name = r.name
WHERE a.name IS NULL
  AND r.name NOT IN (${RETIRED_FILTER})
ORDER BY r.name;
EOF
)

# Branch on whether DATABASE_URL is set.
if [[ -n "${DATABASE_URL:-}" ]]; then
  # Automated mode — psql + exit code.
  if ! command -v psql &>/dev/null; then
    echo "❌ DATABASE_URL is set but psql is not installed. Install psql or unset DATABASE_URL to fall back to manual mode." >&2
    exit 2
  fi

  RESULT=$(echo "$SQL" | psql "$DATABASE_URL" -t -A 2>&1)
  if [[ $? -ne 0 ]]; then
    echo "❌ psql query failed:" >&2
    echo "$RESULT" >&2
    exit 2
  fi

  # Trim whitespace
  RESULT=$(echo "$RESULT" | sed '/^$/d')

  if [[ -z "$RESULT" ]]; then
    echo "✅ Clean — every repo migration (since 1 Apr 2026) has a row in public.applied_migrations."
    exit 0
  else
    echo "⚠️  DRIFT DETECTED — the following repo migrations are missing from public.applied_migrations:"
    echo ""
    echo "$RESULT"
    echo ""
    echo "Action: for each migration listed, either"
    echo "  (a) apply it to prod (paste body into Supabase SQL Editor), then"
    echo "      INSERT INTO public.applied_migrations (name, applied_by, source, notes)"
    echo "      VALUES ('<name>', 'matt+claude', 'manual', '<context>');"
    echo "  (b) backfill if already applied pre-tracker:"
    echo "      INSERT INTO public.applied_migrations (name, applied_by, source, notes)"
    echo "      VALUES ('<name>', 'manual-backfill', 'backfill', '<verification note>');"
    echo "  (c) add to RETIRED_MIGRATIONS list in this script if intentional skip."
    exit 1
  fi
else
  # Manual mode — print the SQL for the user to paste.
  echo "ℹ️  DATABASE_URL not set — falling back to manual mode."
  echo ""
  echo "Paste this query into Supabase SQL Editor (no RLS):"
  echo ""
  echo "----------------------------------------"
  echo "$SQL"
  echo "----------------------------------------"
  echo ""
  echo "If the result is EMPTY → no drift, audit clean."
  echo "If the result has rows → those migrations are not yet in the tracker."
  echo "  See action options in the script source for each drift case."
  exit 0
fi
