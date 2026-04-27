# Preflight Phase 8-1 — `fabrication_labs` migration + backfill

**Status:** READY (revised) — first drafted 24 April 2026 PM under teacher-scoped assumption; **substantially rewritten 27 April 2026 PM** to match the parent brief's Q3 flip (school-scoped lab ownership) + system-account exclusion learning + timestamp-prefix migration discipline.
**Parent brief:** [`preflight-phase-8-brief.md`](./preflight-phase-8-brief.md) — see §1 ships #1–#9 + §5 resolved decisions (revised 27 Apr) + §5b revision rationale.
**Spec anchors:** `docs/projects/fabrication-pipeline.md` §13 Phase 8 + §14; parent brief §1 + §3 sub-phase 8-1 + §5b.
**Scope:** **DB schema + backfill + tests only.** No API routes, no UI, no student-facing behaviour change. That's 8-2 onwards.
**Estimated duration:** ~0.75 day (migration ~1-2h + backfill ~2-3h + tests ~2-3h — slightly bigger than the original 0.5d estimate due to school-scoped RLS + 4-pass backfill + cross-school regression tests).
**Worktree:** `/Users/matt/CWORK/questerra-preflight`, branch `preflight-active`.
**Migration filenames:** TWO timestamp-prefixed pairs (UTC seconds, per `scripts/migrations/new-migration.sh`):
  - `<TS1>_fabrication_labs.sql` + `.down.sql` — schema
  - `<TS2>_backfill_fabrication_labs.sql` (no .down — backfill is data-only and idempotent)
  Numbers minted at the moment of build-open + claimed via stub commit + push BEFORE the SQL body is written (per CLAUDE.md migration v2 discipline). The stale "113/114" numbering from the 24 Apr draft is **superseded** — the timestamp scheme avoids the parallel-branch collisions that hit Skills Library 112 mid-build.

---

## 0. Why this is Phase 8-1

Phase 8's whole admin surface hinges on a `fabrication_labs` entity existing. Rather than ship schema + UI together (merge-conflict nightmare, hard to roll back), we land the data model first on its own, verify backfill works end-to-end, then layer on 8-2/8-3/8-4/8-5 atop a known-good foundation.

**This phase MUST be invisible to students + fabricators.** After the migration applies, every existing flow (student upload, teacher approval, fabricator pickup, student status page) keeps working identically. The only observable change is internal: every `machine_profiles` row now has a `lab_id` pointing at the school's Default lab, every `classes` row has `default_lab_id` populated, and every real teacher (excluding the system sentinel) has `default_lab_id` populated.

**Ownership model (revised 27 Apr):** labs are **school-owned**, not teacher-owned. Every `fabrication_labs.school_id` references the existing `schools` table (migration 085, already shipped). Visibility is school-scoped via `teachers.school_id` — every teacher at the same school sees the same labs/machines without setup. `created_by_teacher_id` is **audit only**, not an access predicate. This unwinds the 24 Apr draft's `teacher_id NOT NULL` ownership column.

---

## 1. Pre-flight ritual (before touching code)

Per `docs/build-methodology.md`:

1. **`git status` clean** on `preflight-active` + up-to-date with `origin/preflight-active`. Pre-existing dirty files (`Systems/Ingestion/ingestion-pipeline-summary.md`, untracked CICD workflow) carry over — see §2 "Don't stop for".
2. **Baseline test run** — `npm test -- --run` → record current pass count. Phase 8.1d closeout was at **1939 passing + 8 skipped** (per 27 Apr saveme). Confirm current matches before opening 8-1.
3. **Review prior migration patterns** — read migrations `085_schools.sql` (school RLS pattern), `093_machine_profiles.sql` + `095_fabrication_jobs.sql` (preflight FK + RLS shape), `098_fabrication_jobs_extensions.sql` (`ALTER TABLE … ADD COLUMN` examples) to match style + Lesson #51 caveat (no `DO $$ … DECLARE` verify blocks — Supabase dashboard "Run and enable RLS" popup mis-parses them).
4. **Re-read Lessons** — #29 (dual-visibility RLS — relevant for the cross-school predicate), #42 (JSONB merge-preserve — not directly relevant here but reinforces the additive-only mindset), #51 (migration apply gotcha), #53 (column writeback — relevant to the backfill).
5. **Verify schools table state** — confirm `migration 085` is applied to prod by querying `SELECT COUNT(*) FROM schools` via Supabase. The labs FK depends on it.
6. **Verify pre-flight queries from 27 Apr** — orphan-teacher cohort = 1 (system sentinel), 3 schooled teachers all at Nanjing (all Matt's personas), 1 distinct school in prod. Confirm before migration; if numbers shifted (e.g. another teacher onboarded between 27 Apr and build-open), re-run the trio of pre-flight queries from the parent brief §6.
7. **Mint migration filenames** — `bash scripts/migrations/new-migration.sh fabrication_labs` + `bash scripts/migrations/new-migration.sh backfill_fabrication_labs`. **Commit + push the empty stubs to `preflight-active` immediately** to claim the timestamps on origin (per CLAUDE.md migration v2 claim discipline).
8. **STOP + report findings** before writing migration SQL bodies.

## 2. Don't stop for (keep going)

- Linter warnings on unrelated files
- Pre-existing TS errors (tracked in Phase 7 saveme, unrelated to 8-1)
- Scanner-reports timestamp-only drift
- Unrelated uncommitted files in working tree (`Systems/Ingestion/ingestion-pipeline-summary.md`, untracked CICD workflow)

## 3. Stop triggers (pause + report)

- Any migration SQL error when run locally against a fresh Supabase instance.
- Any existing fabrication-pipeline test fails after migration applied.
- Backfill script touches > 0 rows but test assertion expects N rows and gets N±k (count mismatch).
- Any RLS policy error from the existing teacher or student routes after migration.
- **Cross-school RLS leak** — a teacher at one school can SELECT/UPDATE/DELETE another school's labs. This is the primary security-equivalent regression risk for the school-scoping flip. Multi-tenancy bug = stop and report.
- **System-account exclusion fails** — backfill creates a row owned by the system sentinel, OR fails because the system sentinel's `school_id IS NULL` causes a NOT NULL constraint violation in the wrong place. Either is a correctness bug.
- Discovery that an assumption in the parent brief is wrong (e.g. `teachers.school_id` is missing on more rows than we expected, or `schools` table layout has shifted since migration 085 — verify before depending on it).

---

## 4. What ships in 8-1

### 4.1 Schema: migration `<TS1>_fabrication_labs.sql`

```sql
-- ============================================================
-- Migration <TS1> — fabrication_labs entity (school-owned)
--                 + machine_profiles.lab_id
--                 + classes.default_lab_id
--                 + teachers.default_lab_id
-- Phase 8-1. Depends on: 085 (schools + teachers.school_id),
-- 093 (machine_profiles), existing classes from 001.
-- ============================================================

-- ============================================================
-- 1. fabrication_labs — owned by SCHOOL, not by individual teacher
-- ============================================================
CREATE TABLE fabrication_labs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Ownership / visibility scope. Every teacher with the same
  -- school_id sees + edits the same labs. NOT NULL — orphan
  -- system accounts (school_id IS NULL) MUST NOT have lab rows
  -- (backfill explicitly excludes them).
  school_id                UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  -- Audit only — who created the row. Does NOT gate access. Used
  -- by the lab-setup page to show "added by Cynthia" in the UI.
  created_by_teacher_id    UUID NULL REFERENCES teachers(id) ON DELETE SET NULL,
  name                     TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description              TEXT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fabrication_labs_school ON fabrication_labs(school_id);
CREATE INDEX idx_fabrication_labs_created_by ON fabrication_labs(created_by_teacher_id);

-- Lab names unique within a school (case-insensitive, whitespace-collapsed).
-- Two schools can both have a "Design Centre"; one school can't have two.
CREATE UNIQUE INDEX idx_fabrication_labs_unique_name_per_school
  ON fabrication_labs(school_id, lower(regexp_replace(trim(name), '\s+', ' ', 'g')));

-- Updated-at trigger — matches pattern from machine_profiles (mig 093).
-- trigger_set_updated_at function is created in earlier migration; reused.
CREATE TRIGGER trg_fabrication_labs_updated_at
  BEFORE UPDATE ON fabrication_labs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- 2. machine_profiles.lab_id — nullable initially for backfill safety;
--    backfill populates it; tightening to NOT NULL is a follow-up
--    migration (post-Checkpoint 8.1) once we're sure no orphans remain.
-- ============================================================
ALTER TABLE machine_profiles
  ADD COLUMN lab_id UUID NULL REFERENCES fabrication_labs(id) ON DELETE SET NULL;

CREATE INDEX idx_machine_profiles_lab ON machine_profiles(lab_id);

-- ============================================================
-- 3. classes.default_lab_id — nullable; backfill populates.
--    Null-lab fallback: student picker shows all school-owned
--    machines (legacy behaviour matches parent brief §3.5).
-- ============================================================
ALTER TABLE classes
  ADD COLUMN default_lab_id UUID NULL REFERENCES fabrication_labs(id) ON DELETE SET NULL;

CREATE INDEX idx_classes_default_lab ON classes(default_lab_id);

-- ============================================================
-- 4. teachers.default_lab_id — nullable; backfill populates.
--    Per-teacher preference; seeds the dropdown when creating a
--    new class. Per-class default_lab_id is the binding ground
--    truth (parent brief §1 ship #3 + #4).
-- ============================================================
ALTER TABLE teachers
  ADD COLUMN default_lab_id UUID NULL REFERENCES fabrication_labs(id) ON DELETE SET NULL;

CREATE INDEX idx_teachers_default_lab ON teachers(default_lab_id);

-- ============================================================
-- 5. Row-level security — school-scoped (REVISED 27 Apr from
--    teacher-scoped; see parent brief §5b).
--
--    A teacher sees + manages a lab if-and-only-if the lab's
--    school_id matches the teacher's school_id. SECURITY DEFINER
--    helper avoids per-row teachers→schools recursion.
-- ============================================================
ALTER TABLE fabrication_labs ENABLE ROW LEVEL SECURITY;

-- Helper: returns the calling teacher's school_id, NULL if not a
-- teacher. SECURITY DEFINER so the function reads teachers.school_id
-- without invoking RLS on teachers itself (which would otherwise
-- recurse). Read-only by design.
CREATE OR REPLACE FUNCTION current_teacher_school_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT school_id FROM teachers WHERE id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION current_teacher_school_id() TO authenticated;

CREATE POLICY "Teachers read same-school labs"
  ON fabrication_labs FOR SELECT
  USING (school_id = current_teacher_school_id());

CREATE POLICY "Teachers insert labs into their school"
  ON fabrication_labs FOR INSERT
  WITH CHECK (school_id = current_teacher_school_id());

CREATE POLICY "Teachers update same-school labs"
  ON fabrication_labs FOR UPDATE
  USING (school_id = current_teacher_school_id())
  WITH CHECK (school_id = current_teacher_school_id());

CREATE POLICY "Teachers delete same-school labs"
  ON fabrication_labs FOR DELETE
  USING (school_id = current_teacher_school_id());

-- Service role bypasses RLS implicitly — that's how student/fab
-- routes read labs transitively via machine_profiles joins. No
-- explicit service-role policy needed (matches machine_profiles
-- pattern from mig 093).
```

**Lesson #51 compliance:** no `DO $$ DECLARE ... END $$` verify blocks. Rely on post-apply SELECTs from the orchestration test + backfill script to confirm state.

**Why `ON DELETE RESTRICT` on `school_id`:** schools should never be soft-deleted while labs reference them. If a school row needs to go away, all its labs need explicit cleanup first. CASCADE would silently nuke real lab records if a school was accidentally dropped.

**Why `created_by_teacher_id` is `ON DELETE SET NULL`:** if Matt's teacher row is ever deleted, the lab he created stays — it belongs to the school, not him. The audit trail loses his name (becomes NULL = "unknown teacher"), which is the desired behaviour.

### 4.2 Schema: migration `<TS2>_backfill_fabrication_labs.sql`

Idempotent 4-pass backfill — safe to re-run. Per parent brief §3 sub-phase 8-1 + §5 Q2 (revised) + §5b system-account exclusion.

```sql
-- ============================================================
-- Migration <TS2> — Backfill fabrication_labs (school-scoped)
-- Phase 8-1. Idempotent — re-running produces no extra rows.
--
-- Excludes system sentinel accounts (email @studioloom.internal)
-- per parent brief §5b — they legitimately have school_id IS NULL
-- and never need a lab.
-- ============================================================

-- ============================================================
-- PASS 1: One "Default lab" per school that has at least one
--         non-template machine_profile owned by a real teacher.
--         Schools with zero fabrication footprint don't get a lab
--         yet — they'll get one on first invite via 8-2.
-- ============================================================
INSERT INTO fabrication_labs (school_id, created_by_teacher_id, name, description)
SELECT DISTINCT
  t.school_id                                    AS school_id,
  -- Pick the earliest-created teacher at the school as the audit
  -- "creator" for the auto-row. Stable across re-runs.
  (SELECT id FROM teachers
     WHERE school_id = t.school_id
       AND email NOT LIKE '%@studioloom.internal'
     ORDER BY created_at ASC LIMIT 1)            AS created_by_teacher_id,
  'Default lab'                                  AS name,
  'Auto-created during Phase 8 rollout. Rename or add more labs from /teacher/preflight/lab-setup.' AS description
FROM teachers t
WHERE t.school_id IS NOT NULL
  AND t.email NOT LIKE '%@studioloom.internal'
  AND EXISTS (
    SELECT 1 FROM machine_profiles mp
    WHERE mp.teacher_id = t.id
      AND mp.is_system_template = false
  )
  -- Idempotency guard: skip schools that already have ANY lab
  -- (after first run, this clause filters them all out).
  AND NOT EXISTS (
    SELECT 1 FROM fabrication_labs fl
    WHERE fl.school_id = t.school_id
  );

-- ============================================================
-- PASS 2: Assign every teacher-owned non-template machine to its
--         school's default lab. System templates stay NULL —
--         they're cross-tenant seed rows.
-- ============================================================
UPDATE machine_profiles mp
SET lab_id = (
  SELECT fl.id
  FROM fabrication_labs fl
  JOIN teachers t ON t.school_id = fl.school_id
  WHERE t.id = mp.teacher_id
    -- Pick the school's first lab as the default. Future migrations
    -- can split out per-grade labs; for now, all machines land in
    -- whichever lab existed first (idempotent — same lab on re-run).
  ORDER BY fl.created_at ASC
  LIMIT 1
)
WHERE mp.is_system_template = false
  AND mp.teacher_id IS NOT NULL
  AND mp.lab_id IS NULL
  AND EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.id = mp.teacher_id
      AND t.school_id IS NOT NULL
      AND t.email NOT LIKE '%@studioloom.internal'
  );

-- ============================================================
-- PASS 3: Set teachers.default_lab_id to their school's default
--         lab. Only real teachers (excludes system sentinel +
--         orphan-teachers without a school).
-- ============================================================
UPDATE teachers t
SET default_lab_id = (
  SELECT fl.id
  FROM fabrication_labs fl
  WHERE fl.school_id = t.school_id
  ORDER BY fl.created_at ASC
  LIMIT 1
)
WHERE t.default_lab_id IS NULL
  AND t.school_id IS NOT NULL
  AND t.email NOT LIKE '%@studioloom.internal'
  AND EXISTS (
    SELECT 1 FROM fabrication_labs fl
    WHERE fl.school_id = t.school_id
  );

-- ============================================================
-- PASS 4: Set classes.default_lab_id to the owning teacher's
--         default_lab_id (cascades from PASS 3).
-- ============================================================
UPDATE classes c
SET default_lab_id = (
  SELECT t.default_lab_id
  FROM teachers t
  WHERE t.id = c.teacher_id
)
WHERE c.default_lab_id IS NULL
  AND c.teacher_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.id = c.teacher_id
      AND t.default_lab_id IS NOT NULL
  );

-- ============================================================
-- VERIFICATION (read-only, returned to migration log for audit)
-- ============================================================
DO $$
DECLARE
  orphan_machines INT;
  orphan_classes INT;
  excluded_system_teachers INT;
BEGIN
  SELECT COUNT(*) INTO orphan_machines
    FROM machine_profiles mp
    JOIN teachers t ON t.id = mp.teacher_id
    WHERE mp.is_system_template = false
      AND mp.lab_id IS NULL
      AND t.school_id IS NOT NULL
      AND t.email NOT LIKE '%@studioloom.internal';

  SELECT COUNT(*) INTO orphan_classes
    FROM classes c
    JOIN teachers t ON t.id = c.teacher_id
    WHERE c.default_lab_id IS NULL
      AND t.school_id IS NOT NULL
      AND t.email NOT LIKE '%@studioloom.internal';

  SELECT COUNT(*) INTO excluded_system_teachers
    FROM teachers
    WHERE email LIKE '%@studioloom.internal';

  RAISE NOTICE 'Backfill verification: % real-teacher machines still NULL (expected 0), % real-teacher classes still NULL (expected 0), % system sentinel accounts intentionally excluded',
    orphan_machines, orphan_classes, excluded_system_teachers;
END $$;
```

**Lesson #51 caveat:** the verification block uses `DO $$ … END $$` purely with `RAISE NOTICE` (no `DECLARE … table-name-like` variables) — this should not trip the Supabase dashboard's mis-parser. If it does, swap to a `SELECT … INTO` query that the migration runner just discards. Test against a fresh local Supabase before pushing.

**Why two migrations (schema + backfill) instead of one:** if backfill partially runs and fails, the schema migration stays applied and we can fix backfill SQL + re-run without rollback. Backfill is fully idempotent.

### 4.3 Down migration: `<TS1>_fabrication_labs.down.sql`

Per `docs/build-methodology.md` non-negotiable #7 on rollback:

```sql
-- Drop the helper function (must DROP POLICY first because
-- policies reference it).
DROP POLICY IF EXISTS "Teachers read same-school labs"   ON fabrication_labs;
DROP POLICY IF EXISTS "Teachers insert labs into their school" ON fabrication_labs;
DROP POLICY IF EXISTS "Teachers update same-school labs" ON fabrication_labs;
DROP POLICY IF EXISTS "Teachers delete same-school labs" ON fabrication_labs;

DROP FUNCTION IF EXISTS current_teacher_school_id();

ALTER TABLE teachers          DROP COLUMN IF EXISTS default_lab_id;
ALTER TABLE classes           DROP COLUMN IF EXISTS default_lab_id;
ALTER TABLE machine_profiles  DROP COLUMN IF EXISTS lab_id;

DROP TABLE IF EXISTS fabrication_labs CASCADE;
```

No `.down.sql` for the backfill migration — backfill undo is implicit in the schema drop (columns go away, indexes drop, table cascade). If Matt ever needs to re-run the backfill after a partial failure, it's already idempotent.

---

## 5. Tests

### 5.1 Migration / schema tests

- `fabrication_labs` table exists with correct columns + types — `school_id NOT NULL`, `created_by_teacher_id NULL`, `name NOT NULL CHECK length(trim) > 0`.
- Unique-name-per-school index enforces case-insensitive, whitespace-collapsed uniqueness within a single school. Two schools each having a "Design Centre" succeeds; one school inserting two of them fails on the unique index.
- `machine_profiles.lab_id`, `classes.default_lab_id`, `teachers.default_lab_id` FK constraints all present + `ON DELETE SET NULL` behaviour verified.
- `school_id` FK behaviour: `ON DELETE RESTRICT` — attempting to delete a school with active labs returns 23503 foreign-key violation.
- `current_teacher_school_id()` function exists, has `SECURITY DEFINER + STABLE`, GRANT on `authenticated` role.

### 5.2 RLS tests (the critical school-scoping security gate)

Authoritative — these are the tests that catch a cross-school leak.

- **Same-school teacher CAN SELECT** another teacher's lab in the same school.
- **Cross-school teacher CANNOT SELECT** another school's labs (returns empty result, not 403 — RLS filters silently).
- **Same-school teacher CAN INSERT** a lab into their school.
- **Cross-school teacher CANNOT INSERT** a lab specifying another school's `school_id` (RLS WITH CHECK rejects).
- **Same-school teacher CAN UPDATE/DELETE** another teacher's lab in the same school (flat membership).
- **Cross-school teacher CANNOT UPDATE/DELETE** another school's lab.
- **Orphan teacher** (school_id IS NULL) — `current_teacher_school_id()` returns NULL — cannot SELECT/INSERT/UPDATE/DELETE any lab. Matches the parent brief's blocking-modal design intent.
- **System sentinel** (`@studioloom.internal`) — same as orphan; sees nothing, cannot write. Belt-and-suspenders against the backfill exclusion logic.

### 5.3 Backfill tests

- **Before backfill:** count of fabrication_labs rows = 0.
- **After backfill, Pass 1:** count of fabrication_labs = number of distinct `school_id`s where ≥1 real (non-system) teacher owns ≥1 non-template machine. (For Matt's prod = 1.)
- **After backfill, Pass 2:** zero `machine_profiles` rows with `is_system_template=false AND lab_id IS NULL` whose owning teacher has `school_id IS NOT NULL` and is non-system.
- **After backfill, Pass 3:** zero real-teacher rows (excluding `@studioloom.internal`) with `school_id IS NOT NULL AND default_lab_id IS NULL`.
- **After backfill, Pass 4:** zero `classes` rows with `default_lab_id IS NULL` whose owning teacher has `default_lab_id IS NOT NULL`.
- **System sentinel preserved:** `system@studioloom.internal` row's `school_id` and `default_lab_id` both stay NULL after backfill. Confirms exclusion logic.
- **Re-run backfill:** 0 rows touched on second run. Counts unchanged. Idempotent.

### 5.4 Regression tests (Phase 7 still works post-migration)

- Existing Phase 7 orchestration tests still pass — `fab-orchestration.ts` queries don't yet touch `lab_id` or `default_lab_id`, so behaviour is unchanged.
- Existing `picker-data` endpoint returns the same set of machines (lab filter doesn't land until 8-5).
- `requireFabricatorAuth` cookie sessions still work — no auth pattern change.
- Student upload flow + status polling end-to-end: upload an STL → scan → approve → fabricator picks up → marks complete. Identical behaviour to pre-migration.
- `npm test -- --run` total → **1939 + (new tests)** passing. Estimated +25–35 new tests across schema + RLS + backfill + regression.

### 5.5 New file locations

- `supabase/migrations/<TS1>_fabrication_labs.sql` (up — schema + RLS)
- `supabase/migrations/<TS1>_fabrication_labs.down.sql` (down)
- `supabase/migrations/<TS2>_backfill_fabrication_labs.sql` (up — idempotent, no .down.sql)
- New test file: `tests/migrations/fabrication-labs-rls.test.ts` (or matching scheme — match existing patterns under `src/lib/fabrication/__tests__/`)
- Schema-registry yaml: new `fabrication_labs` entry; updates to `machine_profiles`, `classes`, `teachers` entries (1 new column each).
- WIRING.yaml: new `fabrication-labs` system; `schools` system gains `affects: [fabrication-labs]`; `preflight-pipeline.deps` gains `fabrication-labs`.

---

## 6. Success criteria — Checkpoint 8.1-migration (mini-checkpoint before 8-2 opens)

| # | Criterion | Why |
|---|---|---|
| 1 | Schema migration applies cleanly on a fresh local Supabase instance. | Smoke-safe for new deploys. |
| 2 | Backfill migration applies cleanly on the same local instance. Verification block reports 0 orphan machines + 0 orphan classes (real teachers) + 1 system sentinel excluded. | Correctness. |
| 3 | Both migrations apply cleanly on Matt's prod Supabase. | Actual rollout gate. |
| 4 | **Pass 1 (school default lab):** after backfill, count of `fabrication_labs` rows = number of distinct `school_id`s with ≥1 real-teacher non-template machine. For Matt's prod this = **1** (Nanjing). | School-scoped correctness. |
| 5 | **Pass 2 (machine assignment):** after backfill, every non-template `machine_profiles` row owned by a real teacher with non-null school has `lab_id IS NOT NULL`. | No orphan machines. |
| 6 | **Pass 3 (teacher default):** after backfill, every real teacher (`email NOT LIKE '%@studioloom.internal'`) with `school_id IS NOT NULL` has `default_lab_id IS NOT NULL`. | Per-teacher preference seeded. |
| 7 | **Pass 4 (class default):** after backfill, every `classes` row owned by a real teacher with `default_lab_id` set has `classes.default_lab_id IS NOT NULL`. | Cascades correctly. |
| 8 | **System-sentinel exclusion:** `system@studioloom.internal` row has `school_id IS NULL AND default_lab_id IS NULL` post-backfill. No lab row created with `created_by_teacher_id` pointing at it. | Correctness gate for the exclusion clause. |
| 9 | **Re-run backfill:** 0 rows touched on second run. Idempotent. | Safe in incident response. |
| 10 | **Cross-school RLS isolation:** Test Teacher B (different school) cannot SELECT/UPDATE/DELETE Test Teacher A's labs. RLS filters silently (empty result, not 403). | **Primary security gate.** |
| 11 | **Same-school flat sharing:** Test Teacher A1 and A2 (same school) both see + can edit each other's labs. | Validates the Q3 flip. |
| 12 | **Orphan-teacher denial:** a teacher with `school_id IS NULL` gets empty result on SELECT and rejected on INSERT (RLS WITH CHECK fails). | Bracketing test. |
| 13 | Existing Phase 7 smoke flows still work end-to-end post-migration (student upload → teacher approve → fabricator pickup → complete). | No behaviour regression. |
| 14 | `npm test` passes (1939 + new tests). `tsc --noEmit` clean. | Standard gate. |
| 15 | Schema registry + WIRING updated (1 new table, 3 new columns: `machine_profiles.lab_id`, `classes.default_lab_id`, `teachers.default_lab_id`). | Registry freshness. |

**Overall gate to proceed to 8-2:** criteria 1–15 green + Matt's explicit "8-1 done, open 8-2" signal.

**Critical-path criteria** (any failure = stop and report, not workaround): 2, 8, 10, 13. These cover correctness, exclusion, security, and regression — none of them have a "we'll fix in 8-2" path.

---

## 7. Commit plan

One commit per logical unit — no squashing (`build-methodology.md` non-negotiable #7).

1. `chore(preflight): Phase 8-1 — claim migration timestamps (empty stubs)` — pushed FIRST per CLAUDE.md migration v2 claim discipline.
2. `feat(preflight): Phase 8-1 schema migration — fabrication_labs (school-owned) + lab_id columns + school-scoped RLS`
3. `feat(preflight): Phase 8-1 backfill migration — 4-pass populate (school default lab → machines → teachers → classes), system-sentinel excluded`
4. `test(preflight): Phase 8-1 schema + RLS + backfill verification tests`
5. `docs(preflight): Phase 8-1 schema-registry + WIRING sync`

Five commits, pushed to `preflight-active`. **Not merged to origin/main until Matt applies the migrations to prod Supabase and verifies prod backfill state.** Per push discipline (CLAUDE.md): no origin/main push until this mini-checkpoint signs off.

A `phase-8-1-wip` backup branch is recommended at the start so partial work is recoverable if anything goes sideways during the migration apply.

---

## 8. Post-8-1 handoff to 8-2

8-2 opens with:
- `fabrication_labs` table populated — one "Default lab" per school with active fabrication footprint (Matt's prod = 1 row, Nanjing).
- `machine_profiles.lab_id` populated for all real-teacher non-template rows.
- `classes.default_lab_id` populated.
- `teachers.default_lab_id` populated for all real teachers with non-null `school_id`.
- School-scoped RLS in place + `current_teacher_school_id()` helper function exposed to authenticated role.
- No API routes, no UI, no behaviour change yet — students + fabricators see identical behaviour.

8-2 builds:
- `POST /api/teacher/labs` — create lab in **my school** (RLS enforces school_id match).
- `GET /api/teacher/labs` — list **my school's** labs (cross-teacher visible).
- `PATCH /api/teacher/labs/[id]` — rename, edit description (any teacher at school can edit).
- `DELETE /api/teacher/labs/[id]` — delete with reassign-or-block (409 if lab has machines + no target `lab_id` provided + 409 if any classes still reference it as `default_lab_id`).
- `PATCH /api/teacher/labs/[id]/machines` — reassign a machine from lab A to lab B (both must be in same school).
- Orchestration library `src/lib/fabrication/lab-orchestration.ts` with all 5 functions + school-scope guards + cross-school 404 protection (no existence leak).
- 30+ new tests (was 25+; bump for school-scoped multi-teacher visibility coverage).

---

**Ready to build when Matt says "open 8-1" or just "go".**
