# Handoff — main

**Last session ended:** 2026-04-26T13:04Z
**Worktree:** `/Users/matt/CWORK/questerra`
**HEAD:** `0728116` "Merge branch 'dashboard-v2-build' into main — Phase 13a-1..4 + cog follow-up"

## What just happened

- **Lesson Bold Sub-Phases 1–3 + language-scaffolding-redesign Phase 0 MERGED to main** earlier this session (`3c1d626` + fixups at `886c7f7`). Warm-paper Bold restyle live on `/unit/[unitId]/[pageId]`. AutonomyPicker rolled back as part of Phase 0 — ActivityCard hint/example gating restored to ELL-only logic.
- **Migration 122** (DROP `student_progress.autonomy_level`) applied to prod by Matt. Migration 121 was dev-only, so 122 is a no-op on prod schema — apply was symbolic + leaves the migration record clean. Push-discipline obligation cleared.
- **WIRING `student-learning-support` flipped from `status: complete` (drift) → `status: planned`.** Drift caught by grep audit (entry was claiming Tier 2/3 translation + UDL + dyslexia fonts + ADHD focus with zero matching code). Filed as `FU-LS-DRIFT`. Two new lessons: #54 (WIRING grep audit) + #55 (configuration → invocation pivot for student scaffolding).
- **Two migration collisions dodged mid-merge.** Branch had 116/117 for autonomy_level; main had taken those for Phase 8 school_id_reserved + Preflight 8.1d-13/14 added 118+119. Autonomy migrations final-renumbered to **121/122** (120 left as gap).
- **Significant parallel work landed on main since the lesson-bold merge** — main is now 14 commits past `886c7f7` with new Preflight (Phase 8.1d-15..19), dashboard PYPX (Phase 13a-1..4), skills-library Path A, and new build-discipline infrastructure (sessionhandover ritual + migration timestamp v2). All auto-merged cleanly into local main; all pushed to origin.

## State of working tree

- **Clean (0 unpushed commits).** `HEAD == origin/main == 0728116`.
- 2 untracked files:
  - `docs/handoff/main.md` (this file)
  - `docs/landing-copy-story-b.md` (Matt's 25 Apr landing copy draft, recovered earlier from reflog after accidental delete)
- Tests + typecheck were green at `886c7f7`; not re-run after the parallel work landed (assume current main is green based on the merge-only nature of incoming commits, but verify before next phase pre-flight).
- Migration sequence highest: **122**. Highest applied to prod: **122**. Gaps: 115 (intentional from earlier dashboard renumber), 120 (intentional from autonomy collision-dodge gap).
- **Migration discipline v2 rolled out** (commit `3f365ff` + `92e1d91`): new migrations should use timestamp prefixes via `bash scripts/migrations/new-migration.sh <descriptor>`, not 3-digit numbers. Existing 000-122 stay frozen — lex-sort puts them before timestamps.
- **Orphaned worktree** at `/Users/matt/CWORK/questerra-lesson-bold/` (~675MB) — git worktree registration deleted, directory survives. Safe to `rm -rf` whenever.

## Next steps

- [ ] **Phase 1 of language-scaffolding-redesign — Tap-a-word v1.** Trigger phrase: `go phase 1` or `tap-a-word`. Spec: `docs/projects/language-scaffolding-redesign-brief.md` §3 Phase 1.
  - Migrations now use TIMESTAMP prefixes — run `bash scripts/migrations/new-migration.sh word_definitions_cache` at phase pre-flight (not the old "next free 3-digit" script)
  - Re-baseline `npm test` count first (parallel work added unknown delta)
  - 7 new files: `TappableText.tsx`, `WordPopover.tsx`, `useWordLookup.ts`, `tokenize.ts`, `index.ts`, `__tests__/tokenize.test.ts`, `/api/student/word-lookup/route.ts`
  - 1 new sandbox module: `src/lib/ai/sandbox/word-lookup-sandbox.ts`
  - Mount on 8 educational text surfaces (lesson prompt, intro, vocab, hints, sentence starters, AI mentor output, toolkit prompts, source material)
  - Pre-warm seed: top 500 design-vocab words via batched Haiku
  - Stop-trigger: cold-cache rate >20 words per first-time student per lesson
- [ ] **Cleanup (optional):** `rm -rf /Users/matt/CWORK/questerra-lesson-bold` — recovers 675MB.
- [ ] **Decide on `docs/landing-copy-story-b.md`** — untracked landing-page draft from 25 Apr. Leave / commit / delete.
- [ ] **Visual smoke the warm-paper Bold lesson page** on prod (Vercel auto-deployed from main).
- [ ] **Re-pre-flight any phase work** in a feature worktree, NOT the main worktree (per new CLAUDE.md migration discipline: "Don't run merges in the main worktree").

## Open questions / blockers

_None._
