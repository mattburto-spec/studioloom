# Class Architecture Cleanup

**Status:** 🟢 READY (deferred — pick up after Access Model v2)
**Filed:** 28 Apr 2026
**Estimated:** ~3-5 days (3 small fixes + 1 medium architectural decision)
**Depends on:** Nothing blocking. Mostly orthogonal to Access Model v2 — can run in parallel or after.
**Related:** `docs/projects/option-b-classid-refactor.md` (planned but not authored — see §4 below)

---

## Why this exists

Surfaced 28 Apr 2026 during the multi-class smoke test of Phase 2.5
(language-scaffolding-redesign). Matt asked: "the original idea was for a
teacher to have the same classes and then move cohorts of students through
them, given units to access. that still works right? but what if you want
to use a more traditional approach of each year you create a class, add
students, add units and then at end of year you deactivate the class.
that works too?"

Both models work mechanically. But there are real gaps that bite teachers
in either model — they're papered over by the recent Bug 1 / 1.5 / 2 / 4
multi-class context fixes (resolver ignores archived classes etc.) but
the underlying data and UX are still confusing.

---

## The four gaps (priority order)

### 1. Archived classes don't auto-unenroll their students (P1, ~2hr)

**Symptom:** A teacher archives a class via `is_archived = true`. The
`class_students.is_active` flag for every student in that class stays
`true`. Recent fixes route around this at resolution time, but anyone
reading raw DB data sees "active enrollment in archived class" — confusing
in support panels, in CSV exports, in any future analytics, and in
admin UIs.

**Concrete consequence today:** Student `test` has 2 active enrollments
in archived classes (IGCSE TEST, 6 Design code LTHB6N). Today's resolver
ignores them. But anyone querying `class_students WHERE student_id = X
AND is_active = true` to get "current classes" still sees 5 enrollments
not 3.

**Fix options:**
- **A)** Postgres trigger: `BEFORE UPDATE ON classes` — when `is_archived`
  flips false→true, set `is_active = false` and `unenrolled_at = NOW()`
  on all `class_students` for that class.
- **B)** Migration backfill script that does the cleanup once for existing
  archived classes, no trigger.
- **C)** Both (recommended) — backfill existing rows, trigger handles
  future archives.

**Recommended:** C. Trigger is ~10 lines. Backfill is a one-shot UPDATE.

### 2. Unit progress is global to (student, unit), not (student, class, unit) (P2, architectural decision)

**Symptom:** `student_progress` schema is `(student_id, unit_id, page_number)`
— no `class_id`. If the same unit appears in two classes a student is in,
their progress is shared. Cohort model: the SAME student doing CO2 Racer
twice would see Year 9 progress when re-encountering it in Year 10.
Per-year model: same problem with the year-over-year reused unit case.

**Whether this is a feature or a bug depends on intent:**
- "Once you've done a unit, you've done it" → feature, as-is.
- "Each year-cohort instance is its own attempt" → bug, needs `class_id`
  on `student_progress` and a forking strategy when copying units across
  classes.

**Decision required:** Matt to call which way. Likely answer is "feature"
for the cohort model and "bug" for per-year, which is why §4 (Option B
URL-scoped class context) is the structural prerequisite — once classId
is in every URL, adding it to student_progress becomes mechanical.

**Estimate:** 0 hours if "feature" (just document). 1-2 days if "bug"
(migration + content_resolution + per-class progress reset UI).

### 3. Three "10 Design" classes with no cohort marker (P2, ~½ day)

**Symptom:** Per-year model naturally creates `classes` rows with the
same `name` (Matt's prod has three "10 Design" classes already). UI
disambiguates only by class code (`10DHVO`, `7DEIUY`, `7DE6RK`) which
isn't human-readable.

**Fix options:**
- **A)** Add `cohort_label` column on `classes` (e.g. "2024-25",
  "2025-26 S1") + show in the class card, dropdowns, breadcrumbs.
- **B)** Use the existing `term`/`semester` system (`cohort_term_tracking`
  migration 042) more aggressively — surface the term label everywhere
  the class name shows.

**Recommended:** B if the term system has the right shape; A as a
lightweight addition if not. Audit the term system shape before deciding.

### 4. Option B — URL-scoped classId everywhere (P2, ~10-11 days, structural)

**Same project that was deferred from the Phase 2.5 smoke test.** Every
student-facing URL gets a `[classId]` segment so context is in the URL,
not derived from session-default or unit lookups. Bug 1 / 1.5 / 2 /
`resolveStudentClassId` all become removable cleanup once this lands.

**Was queued behind the multi-class context fix series.** Now queued
behind Access Model v2 because:
- Access v2 changes the auth model in ways that touch every URL anyway
- Doing Option B first means redoing it after Access v2 lands
- Matt's tomorrow's-class deadline is real; Access v2 has
  student-facing impact (proper login), Option B is invisible
  infrastructure

**Estimate:** ~10-11 days, 8-phase plan still to be authored
(`docs/projects/option-b-classid-refactor.md` — was planned but never
written; the Explore audit from 27 Apr in the prior session captured
the scope).

---

## Todo list

Order is "do these in this sequence." Each is independently shippable.

- [ ] **§1 — Archived class auto-unenrollment.** Author migration with:
  (a) trigger on `classes.is_archived`,
  (b) one-shot backfill `UPDATE class_students SET is_active=false,
      unenrolled_at=NOW() WHERE class_id IN (SELECT id FROM classes
      WHERE is_archived=true)`,
  (c) verify queries.
  ~2hr including push + apply to prod. Can ship before Access v2
  starts.
- [ ] **§3 — Cohort label / term-system audit.** Read migration 042
  (`cohort_term_tracking`) + the "Semester 2 2025-2026" UI on the class
  page. Decide: surface existing term label everywhere class name shows,
  OR add `cohort_label` column. ~½ day after decision.
- [ ] **§2 — student_progress class scope decision.** Matt decides
  feature vs bug. If feature, document in `docs/decisions-log.md`. If
  bug, file as P1 in this doc + draft migration. Decision: ~30 min.
  Implementation if needed: 1-2 days.
- [ ] **§4 — Option B URL-scoped classId.** Author the 8-phase plan
  doc (`docs/projects/option-b-classid-refactor.md`) using the 27 Apr
  Explore audit as input. Resolve the 5 open decisions noted in the
  audit. Then execute. Total ~10-11 days for plan + execution. Run
  after Access v2 ships.

---

## Out of scope

- Touching Phase 2.5 / language-scaffolding-redesign — that work is done.
- The unified per-student Support tab (`/teacher/students/[id]?tab=support`)
  — already shipped (commits `e52105a` + `1406e6c`). It's the UX surface
  this project would feed updates into.

---

## Trigger to start

After Access Model v2 Phase 0 ships AND tomorrow's class has had
at least one full lesson with the recent Bug 1/1.5/2/3/4 fixes in
production. Real classroom data tells us whether §2 (progress scope)
matters in practice or is theoretical.

When ready, say **"continue class architecture"** and Claude will
re-read this file and start with §1.
