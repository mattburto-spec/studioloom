# Preflight Phase 8-1 — `fabrication_labs` migration + backfill

**Status:** READY — drafted 24 April 2026 PM, post Checkpoint 7.1 sign-off.
**Parent brief:** [`preflight-phase-8-brief.md`](./preflight-phase-8-brief.md) (all 6 open questions resolved).
**Spec anchors:** `docs/projects/fabrication-pipeline.md` §13 Phase 8 + §14; parent brief §3.1 + §5.
**Scope:** **DB schema + backfill + tests only.** No API routes, no UI, no student-facing behaviour change. That's 8-2 onwards.
**Estimated duration:** ~0.5 day (migration ~1-2h + backfill ~1-2h + tests ~1-2h).
**Worktree:** `/Users/matt/CWORK/questerra-preflight`, branch `preflight-active`.
**Migration numbers:** 113 (table + columns) + 114 (backfill) — originally planned as 112 + 113, bumped after origin/main landed Skills Library's 112_skill_card_quiz.sql mid-Phase-8 (25 Apr). 110–112 all claimed.

---

## 0. Why this is Phase 8-1

Phase 8's whole admin surface hinges on a `fabrication_labs` entity existing. Rather than ship schema + UI together (merge-conflict nightmare, hard to roll back), we land the data model first on its own, verify backfill works end-to-end, then layer on 8-2/8-3/8-4/8-5 atop a known-good foundation.

**This phase MUST be invisible to students + fabricators.** After the migration applies, every existing flow (student upload, teacher approval, fabricator pickup, student status page) keeps working identically. The only observable change is internal: every `machine_profiles` row now has a `lab_id` pointing at a Default lab, and every `classes` row has `default_lab_id` doing the same.

---

## 1. Pre-flight ritual (before touching code)

Per `docs/build-methodology.md`:

1. **`git status` clean** on `preflight-active` + up-to-date with `origin/preflight-active`
2. **Baseline test run** — `npm test -- --run` → should be **1950 passing, 8 skipped** (Phase 7 closure baseline)
3. **Review prior migration patterns** — read migrations `093_machine_profiles.sql` + `095_fabrication_jobs.sql` + `098_fabrication_jobs_extensions.sql` to match style + RLS pattern + Lesson #51 caveat (no `DO $$ ... DECLARE` verify blocks — Supabase dashboard "Run and enable RLS" popup mis-parses them)
4. **Re-read Lessons** — #29 (dual-visibility RLS), #42 (JSONB merge-preserve), #51 (migration apply gotcha), #53 (column writeback)
5. **Verify parallel branch state** — Skills Library claimed 110 + 111; our first migration is **112**. Confirm no other pending merges land before 112 via `git log origin/main --since="24 Apr 2026" -- supabase/migrations/`
6. **STOP + report findings** before writing migration SQL

## 2. Don't stop for (keep going)

- Linter warnings on unrelated files
- Pre-existing TS errors (tracked in Phase 7 saveme, unrelated to 8-1)
- Scanner-reports timestamp-only drift
- Unrelated uncommitted files in working tree (`Systems/Ingestion/ingestion-pipeline-summary.md`, untracked CICD workflow)

## 3. Stop triggers (pause + report)

- Any migration SQL error when run locally against a fresh Supabase instance
- Any existing fabrication-pipeline test fails after migration applied
- Backfill script touches > 0 rows but test assertion expects N rows and gets N±k (count mismatch)
- Any RLS policy error from the existing teacher or student routes after migration
- Discovery that an assumption in the parent brief is wrong (e.g. `classes.teacher_id` is not the right FK to use for per-teacher lab scoping — spec says otherwise, verify)

---

## 4. What ships in 8-1

### 4.1 Schema: migration `113_fabrication_labs.sql`

```sql
-- ============================================================
-- Migration 113 — fabrication_labs entity + machine_profiles.lab_id
--                + classes.default_lab_id
-- Phase 8-1. Depends on: 093 (machine_profiles), 095 (fabrication_jobs
-- references classes(id)), existing classes table from migration 001.
-- ============================================================

-- 1. fabrication_labs table
CREATE TABLE fabrication_labs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  -- NB: `school_id` reserved for FU-P (access-model-v2). v1 scopes labs
  -- strictly by teacher_id; cross-teacher sharing is explicitly OUT of
  -- scope per §5 Q3 "all recommended" decision. Adding school_id column
  -- now (nullable) so FU-P migration is purely ADD POLICY, not ALTER TABLE.
  school_id    UUID NULL,                    -- reserved for FU-P
  name         TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description  TEXT NULL,
  is_default   BOOLEAN NOT NULL DEFAULT false,  -- true on the auto-created
                                                -- default lab per teacher;
                                                -- UI can distinguish "Default
                                                -- lab" from teacher-named ones
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fabrication_labs_teacher ON fabrication_labs(teacher_id);

-- One default lab per teacher — enforced at the DB level so the backfill
-- can be re-run safely, and so 8-2's createLab path can't accidentally
-- mark multiple labs as default.
CREATE UNIQUE INDEX idx_fabrication_labs_one_default_per_teacher
  ON fabrication_labs(teacher_id)
  WHERE is_default = true;

-- Updated-at trigger — matches pattern used by machine_profiles in mig 093.
CREATE TRIGGER trg_fabrication_labs_updated_at
  BEFORE UPDATE ON fabrication_labs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 2. machine_profiles.lab_id — nullable for migration safety; backfilled
--    in migration 114, then teachers can reassign via 8-2 UI.
ALTER TABLE machine_profiles
  ADD COLUMN lab_id UUID NULL REFERENCES fabrication_labs(id) ON DELETE SET NULL;

CREATE INDEX idx_machine_profiles_lab ON machine_profiles(lab_id);

-- 3. classes.default_lab_id — also nullable; backfilled next migration.
--    Null-lab fallback: student picker shows all teacher-owned machines
--    (legacy behaviour matches parent brief §3.5 "if class has no
--    default_lab_id, show all").
ALTER TABLE classes
  ADD COLUMN default_lab_id UUID NULL REFERENCES fabrication_labs(id) ON DELETE SET NULL;

CREATE INDEX idx_classes_default_lab ON classes(default_lab_id);

-- 4. Row-level security — v1 scope: teachers see + manage ONLY their own
--    labs. No student or fabricator visibility (they see machines, which
--    are joined to labs at query time — the lab concept itself stays
--    teacher-side).
ALTER TABLE fabrication_labs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers read their own labs"
  ON fabrication_labs FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers insert their own labs"
  ON fabrication_labs FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers update their own labs"
  ON fabrication_labs FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers delete their own labs"
  ON fabrication_labs FOR DELETE
  USING (teacher_id = auth.uid());

-- Service role bypasses RLS implicitly — that's how student routes
-- read labs transitively via machine_profiles joins. No explicit
-- policy needed (matches machine_profiles pattern).
```

**Lesson #51 compliance:** no `DO $$ DECLARE ... END $$` verify blocks. Rely on post-apply SELECTs from the orchestration test + backfill script to confirm state.

### 4.2 Schema: migration `114_backfill_fabrication_labs.sql`

Idempotent backfill — safe to re-run. Per §3.1 parent brief + §5 Q2 "all recommended":

```sql
-- ============================================================
-- Migration 114 — Backfill fabrication_labs for every existing teacher
-- Phase 8-1. Idempotent — re-running produces no extra rows.
-- ============================================================

-- Create a "Default lab" for each teacher that owns at least one
-- machine_profile or class. Teachers with zero fabrication footprint
-- don't need a lab yet — they'll get one on first invite via 8-2
-- orchestration (createLabIfNeeded).
INSERT INTO fabrication_labs (teacher_id, name, description, is_default)
SELECT DISTINCT
  t.id AS teacher_id,
  'Default lab'              AS name,
  'Auto-created during Phase 8 rollout. Rename or add more labs from /teacher/preflight/lab-setup.' AS description,
  true                       AS is_default
FROM teachers t
WHERE EXISTS (
  SELECT 1 FROM machine_profiles mp
    WHERE mp.teacher_id = t.id
      AND mp.is_system_template = false
)
OR EXISTS (
  SELECT 1 FROM classes c WHERE c.teacher_id = t.id
)
-- Idempotency guard: skip teachers who already have a default lab
-- (re-run safety).
AND NOT EXISTS (
  SELECT 1 FROM fabrication_labs fl
  WHERE fl.teacher_id = t.id AND fl.is_default = true
);

-- Assign every teacher-owned machine_profile to their default lab.
-- System templates (is_system_template=true) stay null — they're
-- cross-tenant seed rows, not owned by any lab.
UPDATE machine_profiles mp
SET lab_id = (
  SELECT fl.id FROM fabrication_labs fl
  WHERE fl.teacher_id = mp.teacher_id AND fl.is_default = true
  LIMIT 1
)
WHERE mp.is_system_template = false
  AND mp.teacher_id IS NOT NULL
  AND mp.lab_id IS NULL;

-- Assign every class's default_lab_id to the teacher's default lab.
UPDATE classes c
SET default_lab_id = (
  SELECT fl.id FROM fabrication_labs fl
  WHERE fl.teacher_id = c.teacher_id AND fl.is_default = true
  LIMIT 1
)
WHERE c.teacher_id IS NOT NULL
  AND c.default_lab_id IS NULL
  AND EXISTS (
    SELECT 1 FROM fabrication_labs fl
    WHERE fl.teacher_id = c.teacher_id AND fl.is_default = true
  );
```

**Why two migrations (112 + 113) instead of one:** if 113 partially runs and fails, Matt can fix the backfill logic + re-run without having to rollback the schema. Also — 113 is idempotent, so a partial re-run is safe.

### 4.3 Down migration: `113_fabrication_labs.down.sql`

Per `docs/build-methodology.md` non-negotiable #7 on rollback:

```sql
DROP TABLE IF EXISTS fabrication_labs CASCADE;
ALTER TABLE machine_profiles DROP COLUMN IF EXISTS lab_id;
ALTER TABLE classes DROP COLUMN IF EXISTS default_lab_id;
```

No `.down.sql` for 113 — backfill undo is implicit in the 112 drop (columns go away, indexes drop, table cascade). If Matt ever needs to re-run 113 after a partial failure, it's already idempotent.

---

## 5. Tests

### 5.1 Migration tests (pytest-style via existing scaffold, if one exists — else SQL assertion queries via script)

- `fabrication_labs` table exists with correct columns + types
- Unique index enforces one-default-per-teacher (insert two default labs for same teacher → second fails)
- `machine_profiles.lab_id` + `classes.default_lab_id` FK constraints + `ON DELETE SET NULL` behaviour verified
- RLS: teacher A cannot select teacher B's labs (auth.uid() spoof test)

### 5.2 Backfill tests

- Before backfill: count of teachers owning ≥1 machine_profile OR ≥1 class = N; count of fabrication_labs rows = 0
- After backfill: count of fabrication_labs = N (one default each)
- After backfill: zero machine_profiles with `teacher_id IS NOT NULL AND is_system_template=false AND lab_id IS NULL`
- After backfill: zero classes with `teacher_id IS NOT NULL AND default_lab_id IS NULL`
- Re-run backfill: counts unchanged (idempotent guard)

### 5.3 Regression tests

- Existing Phase 7 orchestration tests still pass — `fab-orchestration.ts` doesn't query `lab_id` yet, so nothing should change
- Existing `picker-data` endpoint test still passes — still returns all teacher-owned profiles (lab-filter lands in 8-5)
- `npm test -- --run` total → **1950 + (new helper/migration tests)** passing

### 5.4 New file locations

- `supabase/migrations/113_fabrication_labs.sql` (up)
- `supabase/migrations/113_fabrication_labs.down.sql` (down)
- `supabase/migrations/114_backfill_fabrication_labs.sql` (up — idempotent, no down needed)
- New orchestration helper test — if we decide to add a tiny `loadDefaultLabId(teacherId)` helper for 8-2, its test goes at `src/lib/fabrication/__tests__/lab-orchestration.test.ts` (file doesn't exist yet — can wait for 8-2)

---

## 6. Success criteria — Checkpoint 8.1-migration (mini-checkpoint before 8-2 opens)

| # | Criterion | Why |
|---|---|---|
| 1 | Migration 113 applies cleanly on a fresh Supabase instance. | Smoke-safe for new deploys. |
| 2 | Migration 113 applies cleanly on Matt's prod Supabase (prod backfill run). | Actual rollout gate. |
| 3 | Backfill 113 creates exactly 1 default lab per teacher with ≥1 machine_profile or class. | Idempotency + correctness. |
| 4 | After 113 runs, every `machine_profiles` row with `teacher_id IS NOT NULL AND is_system_template=false` has `lab_id IS NOT NULL`. | No orphans. |
| 5 | After 113 runs, every `classes` row with `teacher_id IS NOT NULL` has `default_lab_id IS NOT NULL`. | No orphans. |
| 6 | Re-running 113 touches 0 rows (idempotent). | Safe to re-run in incident response. |
| 7 | Existing Phase 7 smoke flows still work end-to-end post-migration (student upload → teacher approve → fabricator pickup → complete). | No behaviour regression. |
| 8 | RLS: a teacher cannot select another teacher's labs via PostgREST. | Tenancy isolation. |
| 9 | `npm test` passes (1950 + any new tests). `tsc --noEmit` clean. | Standard gate. |
| 10 | Schema registry + WIRING updated (1 new table in schema registry, 2 new columns on existing tables). | Registry freshness. |

**Overall gate to proceed to 8-2:** criteria 1-9 green + Matt's explicit "8-1 done, open 8-2" signal.

---

## 7. Commit plan

One commit per logical unit — no squashing (`build-methodology.md` non-negotiable #7).

1. `feat(preflight): Phase 8-1 migration 113 — fabrication_labs schema + RLS`
2. `feat(preflight): Phase 8-1 migration 114 — backfill labs + assign existing machines/classes`
3. `test(preflight): Phase 8-1 migration + backfill verification tests`
4. `docs(preflight): Phase 8-1 schema-registry + WIRING sync`

Four commits, pushed to `preflight-active`, **not merged to main until Matt applies the migrations to prod Supabase and verifies prod backfill state**. Per push discipline: no origin/main push until this mini-checkpoint signs off.

---

## 8. Post-8-1 handoff to 8-2

8-2 opens with:
- `fabrication_labs` table populated (every teacher with fabrication footprint has 1 default lab)
- `machine_profiles.lab_id` populated for all teacher-owned non-template rows
- `classes.default_lab_id` populated
- No API routes, no UI, no behaviour change yet

8-2 builds:
- `POST /api/teacher/labs` — create lab (named beyond "Default lab")
- `GET /api/teacher/labs` — list my labs
- `PATCH /api/teacher/labs/[id]` — rename, edit description
- `DELETE /api/teacher/labs/[id]` — delete with reassign-or-block (409 if lab has machines + no target lab_id provided)
- `PATCH /api/teacher/labs/[id]/machines` — reassign a machine from lab A to lab B
- Orchestration library `src/lib/fabrication/lab-orchestration.ts` with all 5 functions + ownership guards
- 25+ new tests

---

**Ready to build when Matt says "open 8-1" or just "go".**
