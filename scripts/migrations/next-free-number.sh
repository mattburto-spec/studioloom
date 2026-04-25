#!/bin/bash
# Migration Number Reserver
#
# Finds the next safe migration number across ALL active branches on
# origin, not just your current worktree. Prevents the collision
# story from Phase 8-1 (see docs/projects/preflight-phase-8-1-brief.md).
#
# Why local `ls supabase/migrations/` lies:
#   - Other feature branches may have claimed numbers your branch
#     doesn't see yet (they haven't merged to main).
#   - main may have advanced via parallel branches since last fetch.
#   - You may have pulled main but not noticed which migrations came
#     in.
#
# This script consults origin, asserts the truth across every remote
# branch, and prints both:
#   1. A summary table — which branch's highest migration is what
#   2. The next safe number to use
#
# Usage:
#   bash scripts/migrations/next-free-number.sh
#   bash scripts/migrations/next-free-number.sh --no-fetch
#
# Run before every new migration. Then:
#   supabase/migrations/<NEXT>_<short_description>.sql       (UP)
#   supabase/migrations/<NEXT>_<short_description>.down.sql  (DOWN — paired)

set -euo pipefail

NO_FETCH=0
for arg in "$@"; do
  case "$arg" in
    --no-fetch)
      NO_FETCH=1
      ;;
    -h|--help)
      sed -n '2,/^set/p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

if [[ "$NO_FETCH" -eq 0 ]]; then
  echo "Fetching origin (use --no-fetch to skip)..."
  git fetch origin --quiet
fi

# Branches to consult — every remote tracking ref under origin/.
BRANCHES=$(git for-each-ref --format='%(refname:short)' refs/remotes/origin \
  | grep -v "/HEAD$" \
  | sort)

if [[ -z "$BRANCHES" ]]; then
  echo "Error: no remote branches found. Are you in a git checkout with origin?" >&2
  exit 1
fi

# Helper: extract numeric prefixes from supabase/migrations/ on a branch.
# Filters to .sql files (skips .down.sql to avoid double-counting).
extract_nums() {
  local branch="$1"
  git ls-tree -r --name-only "$branch" supabase/migrations/ 2>/dev/null \
    | grep -E '^supabase/migrations/[0-9]+_[^.]+\.sql$' \
    | sed -E 's|^supabase/migrations/([0-9]+)_.*$|\1|' \
    | sort -un
}

# Build summary table.
echo ""
echo "═══ Migration claimspace across all branches ═══"
echo ""
printf "  %-38s %s\n" "Branch" "Highest migration"
printf "  %-38s %s\n" "----------------------------------" "----------------"

# Track the global max.
GLOBAL_MAX=0

for branch in $BRANCHES; do
  NUMS=$(extract_nums "$branch")
  if [[ -z "$NUMS" ]]; then
    continue
  fi
  HIGH=$(echo "$NUMS" | tail -n 1)
  printf "  %-38s %s\n" "$branch" "$HIGH"

  # Strip leading zeros for arithmetic, in case any migration uses
  # them (e.g. 099). Bash interprets leading-zero numbers as octal.
  HIGH_INT=$((10#$HIGH))
  if (( HIGH_INT > GLOBAL_MAX )); then
    GLOBAL_MAX=$HIGH_INT
  fi
done

echo ""

if (( GLOBAL_MAX == 0 )); then
  echo "No migrations found anywhere. Start at 001."
  NEXT=1
else
  NEXT=$((GLOBAL_MAX + 1))
fi

# Pad to 3 digits to match the existing convention.
NEXT_PADDED=$(printf "%03d" "$NEXT")

echo "✅ Next safe migration number: $NEXT_PADDED"
echo ""
echo "Use it as:"
echo "  supabase/migrations/${NEXT_PADDED}_<short_description>.sql       (UP)"
echo "  supabase/migrations/${NEXT_PADDED}_<short_description>.down.sql  (DOWN — paired)"
echo ""

# Caveat — local unpushed branches don't show up.
LOCAL_BRANCHES=$(git for-each-ref --format='%(refname:short)' refs/heads | sort)
LOCAL_ONLY=$(comm -23 \
  <(echo "$LOCAL_BRANCHES") \
  <(echo "$BRANCHES" | sed 's|^origin/||' | sort) || true)

if [[ -n "$LOCAL_ONLY" ]]; then
  echo "⚠️  These local branches have no remote tracking — their migrations"
  echo "    are NOT included in the check above:"
  echo "$LOCAL_ONLY" | sed 's|^|      |'
  echo ""
  echo "    If they have unpushed migrations, run \`git push\` first or"
  echo "    check them manually."
  echo ""
fi
