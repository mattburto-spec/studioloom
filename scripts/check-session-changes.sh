#!/bin/bash
# Session Change Detector
#
# Reports what's changed since last commit (or saveme).
# Helps Claude and Matt decide whether saveme is needed.
#
# Run: bash scripts/check-session-changes.sh

echo ""
echo "📊 Session Change Summary"
echo "========================="
echo ""

# Count modified files
MODIFIED=$(git diff --name-only 2>/dev/null | wc -l)
STAGED=$(git diff --cached --name-only 2>/dev/null | wc -l)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l)
TOTAL=$((MODIFIED + STAGED + UNTRACKED))

echo "Modified files:  $MODIFIED"
echo "Staged files:    $STAGED"
echo "New files:       $UNTRACKED"
echo "─────────────────"
echo "Total changes:   $TOTAL"
echo ""

# Check for saveme-worthy changes
SAVEME_NEEDED=false

if [ "$TOTAL" -ge 3 ]; then
  SAVEME_NEEDED=true
fi

# Check for new docs
NEW_DOCS=$(git ls-files --others --exclude-standard 2>/dev/null | grep -E "^docs/" | wc -l)
if [ "$NEW_DOCS" -gt 0 ]; then
  echo "📝 New docs created: $NEW_DOCS"
  git ls-files --others --exclude-standard 2>/dev/null | grep -E "^docs/" | head -5
  echo ""
  SAVEME_NEEDED=true
fi

# Check for spec/architecture changes
ARCH_CHANGES=$(git diff --name-only 2>/dev/null | grep -E "(WIRING|dimensions3|CLAUDE|ALL-PROJECTS|architecture)" | wc -l)
if [ "$ARCH_CHANGES" -gt 0 ]; then
  echo "🏗️  Architecture files changed: $ARCH_CHANGES"
  git diff --name-only 2>/dev/null | grep -E "(WIRING|dimensions3|CLAUDE|ALL-PROJECTS|architecture)"
  echo ""
  SAVEME_NEEDED=true
fi

# Check for new source files
NEW_SRC=$(git ls-files --others --exclude-standard 2>/dev/null | grep -E "^src/" | wc -l)
if [ "$NEW_SRC" -gt 0 ]; then
  echo "⚡ New source files: $NEW_SRC"
  git ls-files --others --exclude-standard 2>/dev/null | grep -E "^src/" | head -5
  echo ""
  SAVEME_NEEDED=true
fi

# Verdict
if [ "$SAVEME_NEEDED" = true ]; then
  echo "⚠️  SAVEME RECOMMENDED — significant changes detected"
  echo "   Run 'saveme' to sync ALL-PROJECTS.md, dashboard, WIRING, changelog, and doc-manifest."
else
  echo "✅ No saveme needed — minor or no changes"
fi
echo ""
