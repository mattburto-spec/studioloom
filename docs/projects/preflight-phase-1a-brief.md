# Preflight — Phase 1A Brief: Schema Migrations + RLS + Machine Profile Seed

> **Goal:** Land the 7 new tables + RLS policies + 12-machine seed data needed for every downstream Phase. After this, Storage buckets (Phase 1B) and the scanner worker (Phase 2) can start in parallel.
> **Spec source:** `docs/projects/fabrication-pipeline.md` §7 (Machine Profiles), §11 (Data Model), §13 Phase 1.
> **Decisions source:** `docs/projects/fabrication/phase-0-decisions.md` (D-04 retention, D-05 Fabricator auth, D-07 rule overrides in Phase 1, D-10 WIRING drafts).
> **Estimated effort:** 1–2 days.
> **Checkpoint:** **Checkpoint 1.1A** — all 5 migrations applied to prod, RLS behaviour verified with real token queries, 12 seed machine profiles visible, no test regression.
> **Push discipline:** Stay on `main`. Commit per-sub-task. **DO NOT push to `origin/main` until Checkpoint 1.1A is signed off AND all migrations are applied to prod Supabase.** Use `phase-1a-wip` branch for backup (`git push origin main:phase-1a-wip`).

---

## Decisions already locked (from Phase 0)

| Ref | Decision |
|---|---|
| D-01 | Product name: Preflight. Tables stay `fabrication_*` (domain-descriptive); user-facing surfaces say Preflight (brand). |
| D-02 | Lab tech role: Fabricator |
| D-04 | 30-day retention post-terminal-state. Column: `retention_clock_started_at` on `fabrication_jobs`. Cron deferred to Phase 9 (no files until Phase 2 ships). |
| D-05 | Fabricator auth: own `fabricators` + `fabricator_sessions` + `fabricator_machines` tables, NOT Supabase Auth. Same pattern as student token sessions (Lesson #4). |
| D-06 | No FK to `work_items` (Pipeline 2) in v1. |
| D-07 | `rule_overrides` JSONB column on `machine_profiles` — in Phase 1 (moved from Phase 8). UI deferred to Phase 1B/2. |
| D-08 | High-uncertainty rules → WARN not BLOCK. Encoded via `rule_overrides` JSONB per profile. |
| D-10 | 3 new WIRING systems: `preflight-pipeline`, `preflight-scanner`, `machine-profiles`. |

---

## Pre-work ritual (Code: complete BEFORE any SQL)

1. `cd ~/cwork/questerra && pwd` — must print `.../cwork/questerra`.
2. `git status` — clean tree, on `main`, HEAD at `<capture actual commit>`.
3. `git branch --show-current` — must print `main`.
4. `npm test` — capture baseline. Expected: **1254 passing, 8 skipped** (per CLAUDE.md 14 Apr 2026). If drifted, note new baseline — that becomes the Phase 1A reference.
5. Confirm migration numbering: latest is `092_gallery_v2_spatial_canvas.sql`. Phase 1A migrations start at **093**.
6. **Audit existing teacher-owned tables for FK conventions:**
   ```bash
   rg -n "teacher_id UUID" supabase/migrations/ | head -20
   rg -n "REFERENCES auth" supabase/migrations/ | head -10
   rg -n "REFERENCES teachers" supabase/migrations/ | head -10
   ```
   Report: what does `teacher_id` FK to in existing migrations? `auth.users(id)`? A `teachers` table? No FK (just UUID)? **Follow the existing pattern exactly.** Do NOT introduce a new convention.
7. **Audit existing dual-visibility RLS patterns** (Lesson #29):
   ```bash
   rg -n "class_id IS NULL" supabase/migrations/078_moderation_log_dual_visibility.sql
   rg -n "UNION" supabase/migrations/ | head -20
   ```
   Read migration 078 in full — our `fabrication_jobs` RLS uses the same UNION pattern for dual-visibility (class-scoped + legacy NULL-safe).
8. **STOP AND REPORT** all pre-work findings before writing any SQL. Do NOT proceed until Matt confirms findings in chat.

---

## Lessons to re-read (full text, not titles)

- **#4** (`docs/lessons-learned.md:26`) — Student auth uses token sessions, not Supabase Auth. Relevant for `fabricator_sessions` (same pattern).
- **#24** (`docs/lessons-learned.md:86`) — Never assume column names exist; `select("*")` or verified columns only. Relevant for any app code we'd write reading these tables (not in 1A but for Phase 1B).
- **#29** (`docs/lessons-learned.md:101`) — RLS UNION for dual-visibility (junction + legacy). **Must be applied to `fabrication_jobs` — `class_id` is nullable, legacy-scope fallback via `teacher_id`.**
- **#36** (`docs/lessons-learned.md:122`) — Data-backfill migrations need edge-case SQL with deterministic tiebreakers. Relevant for seed data.
- **#37** (`docs/lessons-learned.md:138`) — Verify data migrations with an ambiguity query, not just non-null.
- **#38** (`docs/lessons-learned.md:141`) — **`ADD COLUMN ... DEFAULT` silently overrides subsequent UPDATEs.** Every new column here is at-CREATE time (fresh tables), so this doesn't directly bite, but the seed migration's `INSERT ... ON CONFLICT DO NOTHING` must verify row count = 12 after apply, not just "inserts didn't error."
- **#45** (`docs/lessons-learned.md:273`) — Surgical changes. V1 ships STL + SVG only — DO NOT sneak in `.3mf`, `.dxf`, CNC, vinyl hooks "for future flexibility."
- **#47** (`docs/lessons-learned.md:315`) — Adding to shared yaml requires auditing writers. Not directly in 1A (no yaml add yet), but WIRING.yaml update in 1A-7 touches 3 new system entries.

---

## Sub-tasks (all feed Checkpoint 1.1A)

### 1A-1 — Migration 093: `machine_profiles` table + RLS

**Details in the instruction block below.** Creates the table with all Phase 1 columns including `rule_overrides` JSONB (D-07), `is_system_template` flag for the seeded 12, and RLS that lets teachers see their own profiles + system templates.

### 1A-2 — Migration 094: Seed 12 default machine profiles

Insert the 12 machine profiles from `docs/projects/fabrication/machine-profile-defaults-v0.md` as system-owned templates (`teacher_id = NULL`, `is_system_template = true`). Idempotent via `ON CONFLICT (name) DO NOTHING`. Verify count = 12 after apply.

### 1A-3 — Migration 095: `fabrication_jobs` + `fabrication_job_revisions` + RLS

The main submission tables. Use the Lesson #29 UNION pattern for teacher RLS (class-scoped + legacy teacher-scoped via `teacher_id` for NULL `class_id`). Include `retention_clock_started_at` column per D-04.

### 1A-4 — Migration 096: `fabrication_scan_jobs` queue table + RLS

Minimal queue table. Service-role writes + worker reads; no teacher/student access. Columns: `id`, `job_revision_id` FK, `status` (pending/running/done/error), `attempt_count`, `locked_by` (worker ID), `locked_at`, `error_detail`, `created_at`.

### 1A-5 — Migration 097: `fabricators` + `fabricator_sessions` + `fabricator_machines` + RLS

Own auth tables per D-05. `fabricators.password_hash` bcrypt. `fabricator_sessions` mirrors the existing `student_sessions` pattern (Lesson #4). `fabricator_machines` is the junction defining machine scope.

### 1A-6 — Prod apply + RLS verification (read-only queries)

On prod Supabase, run:

- `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('machine_profiles','fabrication_jobs','fabrication_job_revisions','fabrication_scan_jobs','fabricators','fabricator_sessions','fabricator_machines')` — assert **all 7 return `t`**.
- Teacher-token query on `machine_profiles` — assert returns 12 system templates + any teacher-owned rows (should be 0 unless teacher pre-populated).
- Teacher-token query on `fabrication_jobs` — assert 0 rows (empty table).
- Service-role query on `machine_profiles WHERE is_system_template = true` — assert count = 12.
- Anonymous (no token) query on any table — assert 0 rows / permission denied.
- Capture all 7 query outputs verbatim into the checkpoint report.

### 1A-7 — Schema-registry + WIRING.yaml + api-registry sync

- Add 7 table entries to `docs/schema-registry.yaml` (columns, RLS read/write paths, applied_date).
- Add 3 system entries to `docs/projects/WIRING.yaml` (`preflight-pipeline`, `preflight-scanner`, `machine-profiles`) using the drafts in `phase-0-decisions.md` D-10. Bump affected systems (teacher-dashboard, student-dashboard, auth-system) to mention Preflight in `affects`/`depends_on`.
- Run `python3 scripts/registry/scan-api-routes.py --apply` — no routes added this phase, but verify scanner doesn't strip our WIRING additions (FU-DD guard per Lesson #47).
- **Do NOT run saveme.** That's a session-level action, not per-sub-task.

### 1A-8 — Commit trail + Checkpoint 1.1A

Separate commits per Lesson's "no squashing" rule. Target structure:

```
feat(preflight): migration 093 - machine_profiles table + RLS (Phase 1A-1)
feat(preflight): migration 094 - seed 12 machine profiles (Phase 1A-2)
feat(preflight): migration 095 - fabrication_jobs + revisions + RLS (Phase 1A-3)
feat(preflight): migration 096 - fabrication_scan_jobs queue + RLS (Phase 1A-4)
feat(preflight): migration 097 - fabricators auth tables + RLS (Phase 1A-5)
docs(preflight): schema-registry + WIRING + api-registry sync (Phase 1A-7)
```

Backup: `git push origin main:phase-1a-wip` after each commit. No push to `origin/main` until Matt signs off Checkpoint 1.1A.

---

## Success criteria (Checkpoint 1.1A)

- [ ] `npm test` — still 1254 passing (or updated baseline from pre-work capture) — **no regression**.
- [ ] All 5 migrations applied successfully on prod (verify: `supabase db execute` or psql connection).
- [ ] 7 new tables have `relrowsecurity = t` on prod.
- [ ] Teacher-token query on `machine_profiles` returns exactly 12 system templates + any teacher-owned rows.
- [ ] Teacher-token query on `fabrication_jobs` returns 0 rows (empty table, correct).
- [ ] Service-role count on `machine_profiles WHERE is_system_template=true` = 12.
- [ ] Anonymous query on any Preflight table returns 0 rows / permission denied.
- [ ] `docs/schema-registry.yaml` has 7 new entries with `applied_date` set.
- [ ] `docs/projects/WIRING.yaml` has 3 new system entries; affected systems updated.
- [ ] `git log --oneline` shows 6 separate commits (5 migrations + 1 docs).
- [ ] `phase-1a-wip` branch pushed to origin (but `main` NOT pushed).
- [ ] Checkpoint report in chat with: pre-work findings verbatim, per-sub-task SQL diff summary, prod verify output verbatim, test count delta, commit hashes, any FU items filed.

---

## Stop triggers (halt, report, wait for Matt)

- Pre-work audit finds `teacher_id` FK pattern differs from what spec assumes (e.g., no FK anywhere — just naked UUIDs). **Halt — architecture decision needed** before any migration.
- Migration 093 apply fails on prod for ANY reason → halt, don't apply subsequent migrations.
- RLS verification returns unexpected rows (teacher sees another teacher's profiles, anonymous sees system templates) → halt, audit policy.
- Seed migration inserts != 12 rows → halt; likely `ON CONFLICT` colliding with an existing name or JSONB parse error.
- Test count drops from 1254 → halt; a migration broke a type assumption.
- Any scanner (api-registry, ai-calls) strips WIRING additions → halt, fix FU-DD before committing registry sync.
- Existing RLS on `auth.users` or a FK-target table blocks SELECT needed for RLS SELECT on `machine_profiles` → halt, investigate.

## Don't stop for

- `applied_date: null` on unrelated pre-existing tables (FU-AA scope).
- Minor schema-registry field drift on non-Preflight tables.
- Warnings about unused indexes (we'll tune in Phase 2 when real queries exist).
- Comments about column naming style (stay consistent with spec §11, don't re-debate).

---

## Instruction block — Sub-task 1A-1 ONLY

**Copy the block below into Claude Code. After it completes and reports, Matt signs off or requests changes BEFORE proceeding to 1A-2.**

```
# Preflight Phase 1A-1 — Migration 093: machine_profiles table + RLS
# Repo: /Users/matt/CWORK/questerra (must cd here first)
# Spec: docs/projects/fabrication-pipeline.md §7, §11
# Brief: docs/projects/preflight-phase-1a-brief.md

## Pre-work (do ALL before writing SQL)

1. cd ~/cwork/questerra
   pwd  # must print .../cwork/questerra
   git status  # must be clean
   git branch --show-current  # must be 'main'

2. npm test 2>&1 | tail -20
   # Capture: expected 1254 passing, 8 skipped. If different, note and report.

3. Verify migration 092 is the latest:
   ls supabase/migrations/ | tail -3
   # Expected: ...091..., 092_gallery_v2_spatial_canvas.sql

4. Audit teacher_id FK convention:
   rg -n "teacher_id UUID" supabase/migrations/ | head -20
   rg -n "REFERENCES auth\.users" supabase/migrations/ | head -10
   rg -n "teacher_id.*REFERENCES" supabase/migrations/ | head -10
   # Report: What does teacher_id FK to in existing migrations?
   # Follow the existing pattern exactly for the new migration.

5. Read migration 078 in full to understand the dual-visibility UNION pattern:
   cat supabase/migrations/078_moderation_log_dual_visibility.sql

6. Re-read Lessons: #4 (line 26), #24 (line 86), #29 (line 101), #38 (line 141), #45 (line 273)
   from docs/lessons-learned.md

7. STOP AND REPORT findings to Matt. Wait for explicit sign-off before writing SQL.

## Action: write migration 093_machine_profiles.sql

Create supabase/migrations/093_machine_profiles.sql with:

- Table: machine_profiles with all columns from spec §7 + rule_overrides JSONB (D-07) + is_system_template BOOLEAN DEFAULT false
- teacher_id UUID — NULLABLE, FK pattern matching whatever pre-work found (use exact same target)
- CHECK constraints on machine_category ('3d_printer' | 'laser_cutter')
- CHECK constraint: if is_system_template=true then teacher_id IS NULL; else teacher_id IS NOT NULL
- Indexes: (teacher_id), (is_system_template), (machine_category)
- ENABLE ROW LEVEL SECURITY
- RLS SELECT policy: is_system_template=true OR teacher_id = auth.uid()
- RLS INSERT policy: teacher_id = auth.uid() AND is_system_template = false
- RLS UPDATE policy: teacher_id = auth.uid() (can't escalate is_system_template)
- RLS DELETE policy: teacher_id = auth.uid()
- Trigger: updated_at = now() on UPDATE (follow existing trigger helper if one exists in migrations — grep for 'updated_at' trigger functions first)
- Migration is idempotent: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, DROP POLICY IF EXISTS before CREATE POLICY
- Ends with verify block:
  DO $$
  DECLARE
    rls_enabled boolean;
  BEGIN
    SELECT relrowsecurity INTO rls_enabled FROM pg_class WHERE relname = 'machine_profiles';
    IF NOT rls_enabled THEN
      RAISE EXCEPTION 'RLS not enabled on machine_profiles';
    END IF;
  END $$;

Do NOT include seed data in this migration — seed is 094.
Do NOT include any fabrication_jobs references — this is standalone 1A-1.

## Verify

1. Apply migration locally first:
   supabase db reset
   # Expected: all existing migrations apply + 093 applies cleanly

2. Verify structure:
   supabase db execute "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'machine_profiles' ORDER BY ordinal_position;"
   # Compare output against spec §7 column list + D-07 rule_overrides + is_system_template

3. Verify RLS:
   supabase db execute "SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'machine_profiles';"
   # Expected: machine_profiles | t

4. Verify policies exist:
   supabase db execute "SELECT policyname, cmd FROM pg_policies WHERE tablename = 'machine_profiles';"
   # Expected: 4 policies (SELECT, INSERT, UPDATE, DELETE)

5. TypeScript compile check:
   npx tsc --noEmit 2>&1 | tail -5
   # Expected: 0 errors (this migration doesn't change TS, but confirms no collateral)

6. npm test 2>&1 | tail -5
   # Expected: same count as baseline — no regressions

## Negative control (Lesson #38 discipline — optional for pure DDL but include)

7. NC: Temporarily break the RLS SELECT policy (comment out the is_system_template branch):
   # Edit 093 to comment out the is_system_template=true clause in SELECT policy
   supabase db reset
   # Verify: anonymous query returns 0 rows on system templates (proves RLS was load-bearing)
   # Then: revert the edit via Edit tool (file is uncommitted; git checkout won't work — per Lesson #41)
   supabase db reset
   # Verify: system templates accessible again

## Commit

8. git add supabase/migrations/093_machine_profiles.sql
   git commit -m "feat(preflight): migration 093 - machine_profiles table + RLS (Phase 1A-1)

   - Adds machine_profiles with rule_overrides JSONB (D-07) and is_system_template flag
   - RLS: teacher sees own + system templates; only non-templates can be created by teachers
   - 4 policies: SELECT, INSERT, UPDATE, DELETE
   - Idempotent guards on all DDL

   Ref: docs/projects/fabrication-pipeline.md §7
   Ref: docs/projects/preflight-phase-1a-brief.md (1A-1)"

9. git log --oneline -5
   # Expected: HEAD = the new commit; previous commits untouched

10. Do NOT push to origin/main.
    git push origin main:phase-1a-wip
    # Backup only.

## STOP AND REPORT

- Pre-work findings (teacher_id FK convention, any surprises)
- SQL file diff summary (line count, key design choices made)
- Migration apply output (local reset)
- Structure verify output (columns list)
- RLS verify output (relrowsecurity, policies list)
- TypeScript + test counts (before vs after)
- NC results (if run)
- Commit hash + git log tail
- phase-1a-wip push status
- Any FU items filed (if surprises surfaced)

Do NOT proceed to 1A-2 until Matt signs off.
```

---

## What happens after 1A-1 signs off

I'll write the 1A-2 instruction block (seed the 12 machines from `machine-profile-defaults-v0.md`) — shorter brief, one INSERT with `ON CONFLICT DO NOTHING`, verify count = 12.

Then 1A-3 (`fabrication_jobs` + revisions) — the biggest one; includes the Lesson #29 UNION RLS.

Then 1A-4, 1A-5, 1A-6 (verify), 1A-7 (registry sync), 1A-8 (Checkpoint 1.1A report).

Each gets its own pre-work → write → verify → commit → report cycle. No shortcuts.
