# Class Architecture Cleanup

**Status:** 🟡 IN PROGRESS — §1 + §2 + §3 RESOLVED 28 Apr 2026; §4 (Option B URL-scoped classId) deferred behind Access Model v2
**Filed:** 28 Apr 2026
**Estimated:** ~3-5 days originally; §4 alone is ~10-11 days
**Depends on:** §4 gated behind Access Model v2; §1-§3 were independent and shipped same-day as filing.
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

### 1. Archived classes don't auto-unenroll their students (P1, ~2hr) ✅ RESOLVED 28 Apr 2026

**Resolution:** Shipped via migration `20260428081225_archive_class_auto_unenroll.sql`
(commit `d3d97bf`, applied to prod by Matt). Trigger fires on
`classes.is_archived` false→true and sets `class_students.is_active=false`
+ `unenrolled_at=NOW()` for all enrollments. One-time backfill cleared
existing drift (`test`'s 2 active-in-archived enrollments). Verified
post-apply: zero active-in-archived rows remain.

**Original symptom (kept for context):** A teacher archives a class via `is_archived = true`. The
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

### 2. Unit progress is global to (student, unit), not (student, class, unit) ✅ RESOLVED 28 Apr 2026 — current behavior is correct

**Resolution:** Cohort Model wins. Keep `student_progress` keyed on
`(student_id, unit_id, page_number)`. **NO migration, NO `class_id`
column added.** Full reasoning in `docs/decisions-log.md` entry dated
28 Apr 2026 PM ("`student_progress` scoped on (student, unit) by design");
five-question summary:

1. **Cohort reuse is mythical** — same student re-doing same unit in a
   later year doesn't actually happen (students age up).
2. **Mid-year transfer continuity** — shared progress means student work
   follows them across class moves; per-class scoping would force
   destructive reset or complex copy logic.
3. **Forking is the fresh-start escape hatch** — when a teacher genuinely
   wants separate progress, the existing per-class unit forking gives a
   new `unit_id` so the key is naturally fresh. No schema change buys
   anything fork doesn't already.
4. **Re-assessment workflows go through fork** — the design pattern is
   already "fork the unit if you want a clean slate."
5. **Analytics scoping is a query-layer concern** — "average progress on
   CO2 Racer in 10 Design this year" solvable by joining
   `student_progress.created_at` against `class_students.enrolled_at` /
   `unenrolled_at` ranges. No need to denormalize `class_id` onto
   progress rows.

**Edge case that almost flipped it:** concurrent dual enrollment
(same student in two classes simultaneously, both teaching the same
unit). Initially felt like shared progress would confuse "which class
grade book?" — but: (a) rare in practice; (b) it's a UI/reporting
question (which class to display the row under), not a schema question
(the row exists once and is correctly attributed to student × unit);
(c) per-year aesthetic is a UX framing the UI can apply when needed
without schema changes.

**Follow-up filed:** `FU-PROGRESS-COHORT-YEAR` P3 — if reporting ever
needs cohort attribution, derive at query time via the enrollments JOIN.

**Original framing (kept for context):** `student_progress` schema is `(student_id, unit_id, page_number)`
— no `class_id`. If the same unit appears in two classes a student is in,
their progress is shared. Whether this was a feature or a bug depended on
which mental model (cohort vs per-year) the platform should optimize for.

### 3. Three "10 Design" classes with no cohort marker ✅ RESOLVED 28 Apr 2026

**Resolution:** Shipped via commit `8dd0f45` — class list page (`/teacher/classes`)
now derives a cohort label per class from the existing term system
(migration 042's `class_students.term_id` × `school_calendar_terms`).
Picks the most-recent active enrollment's term, displays as a purple chip
next to the framework chip on each card. Archived classes get a muted
gray version. Picked Option B (surface existing system, no new schema)
over Option A (new `cohort_label` column) — term system already had the
data, just wasn't displayed on the list page.

**Original symptom (kept for context):** Per-year model naturally creates `classes` rows with the
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

- [x] **§1 — Archived class auto-unenrollment.** ✅ SHIPPED 28 Apr (commit `d3d97bf`).
  Trigger + backfill applied to prod by Matt.
- [x] **§3 — Cohort label / term-system audit.** ✅ SHIPPED 28 Apr (commit `8dd0f45`).
  Surfaced the existing term system on the class list — no new schema.
- [x] **§2 — student_progress class scope decision.** ✅ RESOLVED 28 Apr (decisions-log entry).
  Cohort Model wins; current schema is correct; no migration needed.
  `FU-PROGRESS-COHORT-YEAR` P3 filed for query-layer cohort attribution if
  ever needed.
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

## Trigger to start §4 (only remaining section)

After Access Model v2 Phase 0 ships. Option B URL-scoped classId is the
only outstanding section — its blast radius (every student-facing URL +
session resolver + per-class teacher routes) overlaps heavily with
Access v2's auth-model rewrite, so doing Option B first means redoing
it after v2 lands.

When ready, say **"continue class architecture"** and Claude will
re-read this file and start with §4 (the only un-ticked item).
