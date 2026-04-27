# Handoff — main

**Last session ended:** 2026-04-27T14:10Z
**Worktree:** `/Users/matt/CWORK/questerra`
**HEAD:** `2f08fb6` "Merge tap-a-word-phase-2-5-build: Phase 2.5 + 2C + 2D-sample (12 commits)"

## What just happened

- **Phase 2 + Phase 2.5 SHIPPED end-to-end.** 12-commit `tap-a-word-phase-2-5-build` branch merged into `main` via `2f08fb6`. Pushed to `origin/main`. Sub-phases delivered in order: 2A (L1 translation slot, server-side l1_target derivation, supports en/zh/ko/ja/es/fr) → 2B (browser SpeechSynthesis audio buttons, two-button layout) → **2.5** (teacher control panel inserted mid-flight after Matt revealed real students about to use a test class — per-student + per-class JSONB overrides, server-side resolveStudentSettings, `/teacher/classes/[classId]/students/support` page with bulk multi-select + confirmation modal, new migration `20260427115409_student_support_settings`) → 2C (curated image dictionary, 6-entry v0 seed, lazy-load + onError graceful hide) → 2D-sample (3 of 27 toolkit tools wrapped — ScamperTool / MindMapTool / BrainstormWebTool; remaining 24 deferred as `FU-TAP-TOOLKIT-FULL-COVERAGE` P3).
- **Saveme done in this session:** ALL-PROJECTS.md flipped to "Phase 2 SHIPPED", decisions-log +8 (authority model A, per-student+per-class scope, Phase 2.5 inserted ahead of 2C/2D, bulk ops with confirmation only, Phase 2D scope deferred to 3-of-27, image dictionary v0, sandbox-pollution defensive fix, migration discipline vindicated again), lessons-learned +1 (#59 — brief estimates can lie when audit hasn't happened yet), FUs +1 (`FU-TAP-TOOLKIT-FULL-COVERAGE`), changelog session entry appended, registries scanned (api-registry +4 routes, ai-call-sites no change), WIRING `tap-a-word` summary refreshed for full Phase 2 + affects:[+toolkit].
- **Tests baseline this session:** 2215 → **2259** (+44 across all sub-phases). tsc clean throughout. Build green with `NODE_OPTIONS=--max-old-space-size=4096` (Phase 1 closeout fix).
- **Migration `20260427115409_student_support_settings.sql` is on `main` but NOT YET APPLIED to prod.** The teacher control panel at `/teacher/classes/[classId]/students/support` will show "Failed to load" until the migration applies. Tap-a-word definitions/popovers/audio/image continue working from existing infrastructure; only L1 translations and teacher overrides fall through to defaults. Apply SQL is at the bottom of the chat that triggered this saveme.
- **2 worktrees pending cleanup:** `/Users/matt/CWORK/questerra-tap-a-word-2` (Phase 2A/2B branch — fully merged via `b9b556a`'s ancestors) + `/Users/matt/CWORK/questerra-tap-a-word-2-5` (Phase 2.5+2C+2D branch — fully merged via `2f08fb6`). Both safe to remove. Branches still exist on origin.

## State of working tree

- **Clean** after this saveme commit lands.
- 2 untracked files in main: `docs/landing-copy-story-b.md` + `docs/landing-redesign-prompt.md` (Matt's landing-copy drafts, predate this work — leave alone).
- Migration sequence: latest 3-digit = 122 (frozen). Latest timestamp prefixes:
  - `20260426140609_word_definitions_cache.sql` (Phase 1A — applied to prod, 588 cached words)
  - `20260427115409_student_support_settings.sql` (Phase 2.5 — **NOT YET applied to prod**)
- Drift status: api-registry +4 new student/teacher routes (synced this saveme). ai-call-sites no new sites (Phase 2 used existing word-lookup site). RLS coverage stable. feature-flags + vendors clean.
- Tests: **2259 passed | 9 skipped | 146 files**. tsc 0 errors.

## Next steps

- [ ] **Apply `20260427115409_student_support_settings.sql` to PROD Supabase.** SQL ready in chat. Two `ALTER TABLE ADD COLUMN ... JSONB DEFAULT '{}'`, idempotent, instant. After applying, run the verify queries in the migration's trailing comments. **Until applied:** teacher UI at `/teacher/classes/[classId]/students/support` shows "Failed to load"; Mandarin/Korean/etc. students see English-only definitions in popovers (resolver SELECT errors → falls to defaults). Tap-a-word otherwise works.
- [ ] **Browser-test the teacher control panel** — open the URL above for a real class, set per-student L1 overrides + per-class kill-switch, verify the student session reflects changes after page refresh.
- [ ] **Worktree cleanup (optional):**
  ```bash
  git worktree remove /Users/matt/CWORK/questerra-tap-a-word-2
  git worktree remove /Users/matt/CWORK/questerra-tap-a-word-2-5
  git branch -d tap-a-word-build tap-a-word-phase-2-build tap-a-word-phase-2-5-build
  git push origin --delete tap-a-word-build tap-a-word-phase-2-build tap-a-word-phase-2-5-build
  ```
- [ ] **Decide next major phase:**
  - **Phase 3 — Response Starters** (~3-4 days): Magic-wand-pen affordance on `ResponseInput`, side panel with Word Bank + Sentence Starters, AI-generated per-activity, class-shared cache. Mirrors the tap-a-word architecture (server-side resolver, sandbox bypass, etc.).
  - **Phase 4 — Signal infrastructure + unified settings** (~5-7 days): `taps_per_100_words` rolling 5-lesson average, scaffold-fading tier signal, `/teacher/students/[studentId]` unified settings page (folds in mentor/theme/etc. from Phase 2.5's narrower scope), teacher preview-as-student route.
  - Recommendation: **Phase 4 first** — gives Matt empirical data on what students actually engage with before building more output scaffolds in Phase 3.
- [ ] **`FU-TAP-TOOLKIT-FULL-COVERAGE` P3** — wait for Phase 4 signal data, then prioritise top-used tools.

## Open questions / blockers

- **None blocking.** Migration apply is the only critical-path Matt-action. Everything else is "test + decide next direction".
- **Test class timeline** — Matt mentioned students "about to come in" — unclear if that's hours, days, or weeks. If hours, prioritise migration apply + visual smoke. If weeks, can do Phase 4 first to give pilot data infrastructure.
- **Multi-class students** — `useStudentSupportSettings` currently passes the FIRST `classInfo.id` from StudentContext. If a student is enrolled in multiple classes simultaneously, the per-class override applies to whichever class their context resolves to. Acceptable for v0 pilot; Phase 4 may need explicit class-context-switching.
