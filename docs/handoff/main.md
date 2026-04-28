# Handoff — main

**Last session ended:** 2026-04-28T10:15Z
**Worktree:** `/Users/matt/CWORK/questerra`
**HEAD:** `3b4df2b` "fix(preflight): Phase 8.1d-36 — scanner worker survives transient Supabase API errors"
**(Today's saveme commit is appended on top — pull before continuing.)**

## What just happened

- **Multi-class context fix series shipped (Bugs 1, 1.5, 2, 3, 4)** — five commits (`79df0aa..a1dc37e` + `11c2df0` lesson). Phase 2.5's prod smoke surfaced four root-cause bugs around how a student with multiple class enrollments resolves "their" class. Fixed tactically (~2hrs total) instead of waiting for Option B URL-scoped classId (~10-11d). New helpers: `resolveStudentClassId(studentId, classId|unitId)` derives verified classId via `class_units × class_students`; `mergeSupportSettingsForWrite(existing, incoming)` treats `null` as a key-delete signal; `filterOutArchivedClasses(classIds)` filters via `classes.is_archived`. Bug 4 (archived-class filter) was a side-finding I noted in the smoke-test prep but deferred — Matt hit it 30 min later. Lesson #60 captures the methodology fix.
- **Option A — unified per-student Support tab shipped (`e52105a` + `1406e6c`)** — Matt's response to the Phase 2.5 UX confusion ("teachers will find this confusing if settings are in different places"). Built `/teacher/students/[id]?tab=support` with three sections: cascade explainer, per-student global form, collapsed per-class accordion. Per-class teacher page now cross-links each student name into the new tab. ELL editing also consolidated into the Support tab; inline ELL pills removed from `/teacher/classes/[id]` (they were silently writing global while displaying per-class — broken by coincidence). New per-student API at `/api/teacher/students/[studentId]/support-settings` (GET + PATCH); per-class single-student PATCH extended to also accept `ell_level_override`. New auth helper `verifyTeacherCanManageStudent` — teacher must own ≥1 active non-archived class the student is enrolled in.
- **Class architecture cleanup project filed** (`docs/projects/class-architecture-cleanup.md`) — Matt asked whether both cohort-model and per-year-class workflows still work. Both do, but four gaps surfaced: archived classes don't auto-unenroll students; `student_progress` is per-(student,unit) not per-(student,class,unit); multiple "10 Design" classes have no human-distinguishable cohort marker; Option B URL-scoped classId still ~10-11d. Filed as deferred behind Access Model v2. Trigger phrase: **"continue class architecture"**.
- **Saveme this session:** 6 decisions added, 1 lesson added (#60), 1 new project doc, ALL-PROJECTS.md Language Scaffolding entry refreshed with 28 Apr work, changelog session entry, api-registry +3 routes (auto-scanned), feature-flags drift unchanged (pre-existing SENTRY/RUN_E2E noise), vendors drift 0, RLS coverage 0 problems.
- **Tests baseline this session:** 2259 → 2279 (+20). 0 failures, 9 skipped, 146 files. tsc clean.

## State of working tree

- **Clean** after this saveme commit lands.
- 5 untracked files in main (none mine, none touched today): `docs/landing-copy-story-b.md`, `docs/landing-redesign-prompt.md`, `docs/specs/brief-generator.md`, `scripts/check-test-student.mjs` (today's read-only DB inspector — leave or delete), `scripts/list-class-units.mjs` (same — leave or delete).
- **Parallel session active in another worktree on Access Model v2** — `docs/projects/access-model-v2.md` is currently being edited by that session. Do NOT edit it from this worktree without coordinating.
- Migration sequence: latest timestamp prefix = `20260427115409_student_support_settings.sql` (applied to prod 27 Apr). No new migrations this session — all changes pure app code.
- Drift status: api-registry +3 (per-student support-settings GET/PATCH, unit-context GET) — synced this saveme. ai-call-sites no new sites. RLS coverage 0 problems. feature-flags + vendors clean.
- Tests: **2279 passed | 9 skipped | 146 files**. tsc 0 errors.

## Next steps

- [ ] **Smoke-test Bug 3 + ELL flow + Support tab in prod** — partial today (A/B/C of multi-class scenarios passed). Still pending:
  - Bug 3 SQL verification (Way 1: set + reset on 10 Design → JSONB `{}`; Way 2: reset on Service LEEDers → self-heals the stale null row)
  - ELL pills gone from class page; per-student global ELL works in Support tab; per-class ELL override works in accordion
  - Cross-link from per-class teacher page → student profile lands in Support tab via `?tab=support`
- [ ] **Access Model v2 (parallel session)** — running in a different Claude session. Was given a manual briefing covering: today's 5 commits + helpers; the Option A surface that Access v2's RBAC must preserve; the multi-Matt-teacher situation in prod; the folding of Option B into class-architecture-cleanup §4; lesson #60. If you start an Access v2 session and the briefing wasn't transferred, ping the user — chat history has the full text.
- [ ] **Optional cleanup if you have an hour:**
  - Tests for `/api/teacher/students/[studentId]/support-settings` GET + PATCH shape (~30 min) — endpoint shipped without dedicated tests
  - Visual check on `/teacher/classes/[id]` student rows after ELL pill removal — layout might have an awkward gap
  - Manual cleanup of the Service LEEDers `{l1_target_override: null}` row OR just trust the merge helper to self-heal on next teacher edit
- [ ] **Class architecture cleanup** — start when Access Model v2 Phase 0 ships AND tomorrow's class has had a real lesson. §1 (archived auto-unenroll trigger, ~2hr) is the cheapest. Trigger phrase: "continue class architecture".
- [ ] **Phase 3 Response Starters** — original next phase of language-scaffolding-redesign. ~3-4 days. Magic-wand-pen affordance, sentence starters side panel, AI-generated per-activity, class-shared cache. Mirrors tap-a-word architecture.
- [ ] **Phase 4 signal infrastructure** — narrower than originally scoped (the "unified settings page" half was absorbed by Option A today). Now just `taps_per_100_words` rolling avg + scaffold-fading tier signal + teacher preview-as-student route.

## Open questions / blockers

- **None blocking.** Tomorrow's class is the natural smoke test for the multi-class fix series + Option A unified Support tab.
- **Multi-Matt-teacher situation in prod** — three teacher accounts (`mattburto@gmail.com`, `hello@loominary.org`, `mattburton@nanjing-school.com`). Not a blocker today; it's exactly what Access Model v2 will unify.
- **Stale Service LEEDers null row** — cosmetic only. Resolver treats `null` and missing-key identically. Will self-heal on next teacher edit via `mergeSupportSettingsForWrite`.
- **`docs/projects/access-model-v2.md` is being edited in another session** — coordinate before touching from this worktree.
