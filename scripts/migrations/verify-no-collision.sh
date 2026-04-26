#!/bin/bash
# verify-no-collision.sh — Pre-merge migration-collision gate.
#
# WHEN TO RUN: before merging any feature branch into main, OR before
# pushing a branch that adds migrations. Also runs at every Matt Checkpoint
# (per docs/build-methodology.md).
#
# WHAT IT CHECKS:
#   1. Every migration prefix on the current branch is also free of
#      conflict on origin/main. Same prefix + different filename = HARD
#      COLLISION. Same prefix + same filename = already merged (OK).
#   2. Cross-branch view: warns if any other origin/* branch has the
#      same prefix with a different filename (soft collision in flight).
#
# EXIT CODES:
#   0 — clean, safe to merge
#   1 — collision detected, do NOT merge until resolved
#   2 — script error (not in a repo, no origin, etc.)
#
# USAGE:
#   bash scripts/migrations/verify-no-collision.sh
#   bash scripts/migrations/verify-no-collision.sh --no-fetch
#   bash scripts/migrations/verify-no-collision.sh --base origin/preflight-active

set -euo pipefail

NO_FETCH=0
BASE="origin/main"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-fetch) NO_FETCH=1; shift ;;
    --base) BASE="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,/^set/p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) echo "Unknown arg: $1 (try --help)" >&2; exit 2 ;;
  esac
done

if [[ "$NO_FETCH" -eq 0 ]]; then
  echo "Fetching origin (use --no-fetch to skip)..."
  git fetch origin --quiet
fi

# Helper: list "<prefix> <filename>" for every .sql migration on a ref.
# Prefix = everything before the first underscore. Skips .down.sql so we
# don't double-count up/down pairs (both share the same prefix).
list_migrations() {
  local ref="$1"
  git ls-tree -r --name-only "$ref" supabase/migrations/ 2>/dev/null \
    | grep -E '^supabase/migrations/[^/]+_[^.]+\.sql$' \
    | grep -v '\.down\.sql$' \
    | awk -F/ '{print $NF}' \
    | while IFS= read -r filename; do
        printf '%s %s\n' "${filename%%_*}" "$filename"
      done
}

CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "DETACHED")
echo ""
echo "═══ Pre-merge collision check ═══"
echo "  Current: $CURRENT_BRANCH"
echo "  Base:    $BASE"
echo ""

CURRENT_LIST=$(list_migrations HEAD)
BASE_LIST=$(list_migrations "$BASE")

if [[ -z "$CURRENT_LIST" ]]; then
  echo "✅ No migrations on current branch. Nothing to check."
  exit 0
fi

# A migration on current is "ADDED" if its full filename is not on base.
# A collision happens when an ADDED file's prefix is already used on base
# (under any filename — Supabase's schema_migrations table keys by prefix).
# Pre-existing same-prefix pairs that are on BOTH branches are intentional
# and silent.
HARD_COLLISIONS=""
ADDED=""

BASE_FILENAMES=$(echo "$BASE_LIST" | awk '{print $2}')
BASE_PREFIXES=$(echo "$BASE_LIST" | awk '{print $1}' | sort -u)

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  PREFIX=$(echo "$line" | awk '{print $1}')
  FILENAME=$(echo "$line" | awk '{print $2}')

  # Already on base by exact filename → silent (already merged).
  if echo "$BASE_FILENAMES" | grep -Fxq "$FILENAME"; then
    continue
  fi

  # New on this branch.
  ADDED+="  + $FILENAME"$'\n'

  # Is the prefix already taken on base by some OTHER filename? Collision.
  if echo "$BASE_PREFIXES" | grep -Fxq "$PREFIX"; then
    BASE_OWNERS=$(echo "$BASE_LIST" | awk -v p="$PREFIX" '$1 == p {print $2}' | tr '\n' ' ')
    HARD_COLLISIONS+="  ✗ prefix '$PREFIX' already on $BASE — adding $FILENAME would shadow it"$'\n'
    HARD_COLLISIONS+="      $BASE has: $BASE_OWNERS"$'\n'
    HARD_COLLISIONS+="      adding:    $FILENAME"$'\n'
  fi
done <<< "$CURRENT_LIST"

# Also scan all other origin/* branches for soft collisions on ADDED prefixes.
SOFT_COLLISIONS=""
if [[ -n "$ADDED" ]]; then
  ADDED_PREFIXES=$(echo "$ADDED" | awk '/^  \+ /{print $2}' | awk -F_ '{print $1}' | sort -u)

  OTHER_BRANCHES=$(git for-each-ref --format='%(refname:short)' refs/remotes/origin \
    | grep -v "/HEAD$" \
    | grep -v "^${BASE}\$" \
    | grep -v "^origin/${CURRENT_BRANCH}\$" \
    | sort)

  for branch in $OTHER_BRANCHES; do
    BR_LIST=$(list_migrations "$branch")
    [[ -z "$BR_LIST" ]] && continue

    for prefix in $ADDED_PREFIXES; do
      MATCH=$(echo "$BR_LIST" | awk -v p="$prefix" '$1 == p {print $2; exit}')
      if [[ -n "$MATCH" ]]; then
        OUR=$(echo "$ADDED" | awk -v p="$prefix" '$2 ~ "^"p"_" {print $2; exit}')
        if [[ "$MATCH" != "$OUR" ]]; then
          SOFT_COLLISIONS+="  ⚠ prefix '$prefix' also claimed by $branch:"$'\n'
          SOFT_COLLISIONS+="      ours:   $OUR"$'\n'
          SOFT_COLLISIONS+="      theirs: $MATCH"$'\n'
        fi
      fi
    done
  done
fi

# Report.
if [[ -n "$ADDED" ]]; then
  echo "Migrations new on this branch (not on $BASE):"
  echo -n "$ADDED"
  echo ""
fi

if [[ -n "$HARD_COLLISIONS" ]]; then
  echo "❌ HARD COLLISIONS — do NOT merge:"
  echo -n "$HARD_COLLISIONS"
  echo ""
  echo "Fix: rename your migration to use a fresh prefix. If 3-digit, run"
  echo "  bash scripts/migrations/next-free-number.sh"
  echo "If timestamp, run"
  echo "  bash scripts/migrations/new-migration.sh <descriptor>"
  echo "  (delete the old file, move SQL into the new one)"
  exit 1
fi

if [[ -n "$SOFT_COLLISIONS" ]]; then
  echo "⚠️  SOFT COLLISIONS — another branch has the same prefix in flight:"
  echo -n "$SOFT_COLLISIONS"
  echo ""
  echo "Whichever branch merges to $BASE first wins. Coordinate with the"
  echo "other branch owner, or pre-emptively renumber yours now."
  echo ""
  echo "(Exit 0 — soft collisions are warnings, not blockers. Hard collision"
  echo " only fires when the conflicting filename is already on $BASE.)"
fi

echo "✅ No hard collisions. Safe to merge into $BASE."
exit 0
