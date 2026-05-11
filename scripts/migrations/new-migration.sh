#!/bin/bash
# new-migration.sh — Mint a new Supabase migration with a timestamp prefix.
#
# WHY: Position-based 3-digit prefixes (000–122 in this repo) collide when
# multiple branches author migrations in parallel. We had two collisions in
# 24 hours during the Preflight Phase 8 / Lesson Bold overlap. Timestamp
# prefixes (YYYYMMDDHHMMSS, UTC) are what Supabase CLI uses by default and
# are mathematically immune to the collision class — two sessions cannot
# pick the same UTC second.
#
# Lexicographic order is preserved across the cutover: '0'..'1' < '2', so
# legacy 000_..122_ files sort BEFORE timestamp-prefixed files. Supabase
# applies migrations in filename order. No legacy migration moves.
#
# USAGE:
#   bash scripts/migrations/new-migration.sh <short_descriptor>
#
# EXAMPLE:
#   bash scripts/migrations/new-migration.sh word_definitions_cache
#
# OUTPUT:
#   supabase/migrations/20260426143015_word_definitions_cache.sql       (UP)
#   supabase/migrations/20260426143015_word_definitions_cache.down.sql  (DOWN)
#
# AFTER MINTING (claim discipline — read this):
#   The instant a migration filename exists on origin, no other branch can
#   pick it. So: commit + push the migration STUB to your feature branch
#   immediately, BEFORE writing the SQL body. That reserves the timestamp
#   on origin in seconds, not days.
#
#     git add supabase/migrations/<NEW>.sql supabase/migrations/<NEW>.down.sql
#     git commit -m "claim(migrations): reserve <descriptor> timestamp"
#     git push
#
#   Then write the body and push again.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <short_descriptor>" >&2
  echo "Example: $0 word_definitions_cache" >&2
  exit 1
fi

DESCRIPTOR="$1"

# Validate descriptor: lowercase, digits, underscores only.
if ! [[ "$DESCRIPTOR" =~ ^[a-z0-9_]+$ ]]; then
  echo "Error: descriptor must be [a-z0-9_]+ (got: $DESCRIPTOR)" >&2
  echo "Bad chars often come from copy-paste — strip them and retry." >&2
  exit 1
fi

# UTC timestamp. Supabase CLI default format.
TS=$(date -u +%Y%m%d%H%M%S)

REPO_ROOT=$(git rev-parse --show-toplevel)
MIG_DIR="$REPO_ROOT/supabase/migrations"

if [[ ! -d "$MIG_DIR" ]]; then
  echo "Error: $MIG_DIR doesn't exist" >&2
  exit 1
fi

UP="$MIG_DIR/${TS}_${DESCRIPTOR}.sql"
DOWN="$MIG_DIR/${TS}_${DESCRIPTOR}.down.sql"

if [[ -e "$UP" || -e "$DOWN" ]]; then
  # 1-second timestamp granularity. Should never collide locally; if it does,
  # the user is running this script in a tight loop. Sleep + retry once.
  echo "Timestamp $TS already exists — sleeping 1s and retrying..." >&2
  sleep 1
  TS=$(date -u +%Y%m%d%H%M%S)
  UP="$MIG_DIR/${TS}_${DESCRIPTOR}.sql"
  DOWN="$MIG_DIR/${TS}_${DESCRIPTOR}.down.sql"
  if [[ -e "$UP" || -e "$DOWN" ]]; then
    echo "Error: still colliding after retry. Investigate." >&2
    exit 1
  fi
fi

# Author UP stub.
cat > "$UP" <<EOF
-- Migration: ${DESCRIPTOR}
-- Created: ${TS} UTC
--
-- WHY: <one paragraph — what problem does this migration solve?>
-- IMPACT: <which tables/columns/indexes/RLS policies change?>
-- ROLLBACK: paired .down.sql undoes this migration.
--
-- Claim discipline: commit + push this stub IMMEDIATELY (before writing
-- the SQL body) so the timestamp is reserved on origin. See
-- scripts/migrations/new-migration.sh for the full ritual.

-- TODO: write SQL here
EOF

# Author DOWN stub.
cat > "$DOWN" <<EOF
-- Rollback for: ${DESCRIPTOR}
-- Pairs with: ${TS}_${DESCRIPTOR}.sql

-- TODO: write rollback SQL here
EOF

echo "✅ Minted migration pair:"
echo "   $UP"
echo "   $DOWN"
echo ""
echo "Next steps (claim discipline):"
echo "  1. git add supabase/migrations/${TS}_${DESCRIPTOR}.sql \\"
echo "             supabase/migrations/${TS}_${DESCRIPTOR}.down.sql"
echo "  2. git commit -m \"claim(migrations): reserve ${DESCRIPTOR}\""
echo "  3. git push                         # claims the timestamp on origin"
echo "  4. write the SQL body, commit + push again"
echo ""
echo "Pre-merge check (run before merging your feature into main):"
echo "  bash scripts/migrations/verify-no-collision.sh"
echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "AFTER APPLYING THIS MIGRATION TO PROD — DO NOT FORGET THE TRACKER LOG"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""
echo "Once you've pasted the migration body into Supabase SQL Editor + verified"
echo "the effect lands, ALSO run this INSERT in the same session:"
echo ""
echo "  INSERT INTO public.applied_migrations (name, applied_by, source, notes)"
echo "  VALUES ("
echo "    '${TS}_${DESCRIPTOR}',"
echo "    'matt+claude',           -- or 'matt' / 'cli'"
echo "    'manual',                -- or 'cli' / 'hand-patch'"
echo "    '<one-line context — what this migration unblocked>'"
echo "  );"
echo ""
echo "Why: prod has NO Supabase-CLI migration tracking. public.applied_migrations"
echo "is the canonical record. See Lesson #83 + CLAUDE.md Migration discipline."
echo "Saveme catches missed logs via scripts/migrations/check-applied.sh."
