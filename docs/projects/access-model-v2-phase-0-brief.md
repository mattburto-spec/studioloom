# Access Model v2 — Phase 0 Brief

**Created:** 28 April 2026 PM
**Status:** READY TO START — Phase 0.1 instruction block at end of doc; subsequent sub-task briefs written incrementally as each ships
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**Branch:** `access-model-v2`
**Forked from:** `main @ 774f371` (clean — `docs(audit): commit IT audit + parallel-session remediation drafts (ON HOLD)`)
**Test baseline:** **2433 passed + 9 skipped (152 files, 1 skipped)**, 5.91s — captured 28 Apr 2026 12:34 UTC
**Estimated effort:** ~3–4 days across 9 sub-phases
**Master spec:** [`docs/projects/access-model-v2.md`](access-model-v2.md) §4 Phase 0
**Path:** B (chosen 28 Apr PM — ship full v2 before any pilot)
**Supabase boundary (clarified 28 Apr PM):** every Supabase action — applying migrations, dashboard config (MFA toggle, regional settings), prod data queries (multi-Matt audit, RLS test harness fixtures) — **goes through Matt manually, not autonomously**. Code/Cowork writes the migration files + scripts + test runners; Matt applies to prod as part of each sub-task sign-off and the final Checkpoint A1.

---

## Goal

Lay every schema seam Phases 1–6 will use. Phase 0 is **pure schema + scaffolding** — no app-code changes, no UX, no route migrations. Backfill existing rows where required. Land the audit-derived non-schema items (MFA, RLS test harness, encryption key rotation, multi-Matt audit, unknown-auth triage). Exit with every Phase 1+ work ready to consume the new shape.

The discipline: many small migrations, each one concern, each one paired with a `.down.sql`. Lesson #38 (`ADD COLUMN DEFAULT` silently overrides conditional UPDATE) is the constant background music. Lesson #29 (RLS + junction tables silently filter rows) governs every RLS policy added.

---

## Sub-tasks

| # | Sub-task | Effort | Deliverable |
|---|---|---|---|
| **0.1** | ✅ DONE — Schools column expansion (status / region / bootstrap_expires_at / subscription_tier / timezone / default_locale). Mig `20260428125547`. Tests +13. | ~1 hr | 1 migration pair |
| **0.2** | ✅ DONE — Locale columns on user tables (`teachers.locale`, `students.locale`). Mig `20260428132944`. Tests +7. **SIS columns originally planned here — narrowed to Option A (locale only) after pre-flight audit caught mig 005_lms_integration.sql already had `external_id` / `external_provider` / `external_class_id` / `last_synced_at` under different names than the v2 plan called for. Canonicalisation deferred to Phase 6 cutover.** See plan §3 item #26 + §8.6 item 3. | ~30 min actual | 1 migration pair |
| **0.3** | School-id gap fill (`students.school_id`, `units.school_id`) + backfill from class chain | ~2 hr | 1 migration pair |
| **0.4** | Soft-delete columns (`deleted_at`) on user-touched tables + `unit_version_id` on submission-shaped tables | ~2 hr | 1 migration pair (after schema-audit of which tables qualify) |
| **0.5** | `auth.users.user_type` extensible enum (`student`/`teacher`/`fabricator`/`platform_admin`; designed to absorb `community_member` and `guardian` later without migration) + `auth.users.is_platform_admin` boolean | ~1 hr | 1 migration pair |
| **0.6** | Forward-compat tables — `school_resources` + `school_resource_relations`, `guardians` + `student_guardians`, `consents` (schema only, no UX wiring) | ~3 hr | 2 migration pairs (collections / consents) |
| **0.7** | Core access tables — `class_members`, `audit_events`, `ai_budgets`, `ai_budget_state` | ~3 hr | 2 migration pairs (members+audit / budgets) |
| **0.8** | Backfill — orphan teachers → personal schools; `class_members.lead_teacher` from `classes.teacher_id`; `students.school_id` / `units.school_id` finalisation | ~2 hr | 1 backfill migration with row-count assertions |
| **0.9** | Audit-derived non-schema items: 🛡️ MFA enable on Supabase + procedure docs · 🛡️ Live RLS test harness · 🛡️ ENCRYPTION_KEY rotation script + fire drill · 🛡️ 7 unknown-auth routes triage (likely all `auth: public` annotation per pre-flight finding) · 🛡️ Multi-Matt prod data audit query | ~1.5 days | Multiple — script files in `scripts/ops/`, integration test harness, doc files in `docs/security/`, api-registry annotations |

**Total:** ~3–4 working days. Each sub-task ships as a separate commit on `access-model-v2`. Merge to main only after **Checkpoint A1** signs off.

---

## Pre-Flight Discovery (28 April 2026 PM — already done)

✅ **Test baseline:** 2433 passed + 9 skipped, 5.91s. Clean.
✅ **Phase 0 schema surface clean:** none of `class_members`, `audit_events`, `ai_budgets`, `ai_budget_state`, `school_resources`, `school_resource_relations`, `guardians`, `student_guardians`, `consents`, `school_domains`, `school_setting_changes` exist. Verified via `grep CREATE TABLE supabase/migrations/`.
✅ **Migration discipline v2 in use** — latest migration on prod path: `20260428081225_archive_class_auto_unenroll.sql`. New migrations mint via `bash scripts/migrations/new-migration.sh <descriptor>`.
✅ **Worktree created** + claimed in `.active-sessions.txt`. Branch: `access-model-v2` rooted at main HEAD `774f371`.
✅ **Phase 8 helpers ready to integrate** (read end-to-end in earlier discovery): `src/lib/auth/verify-teacher-unit.ts` (`requireTeacherAuth`, `verifyTeacherCanManageStudent`, `verifyTeacherHasUnit`, `verifyTeacherOwnsClass`), `src/lib/student-support/resolve-class-id.ts` (`resolveStudentClassId`, `filterOutArchivedClasses`), `src/lib/fabrication/lab-orchestration.ts` (`loadTeacherSchoolId`, `loadSchoolOwnedLab`), `current_teacher_school_id()` SECURITY DEFINER helper. **Compose, do not re-implement.**
✅ **Audit F10 (8 unknown-auth routes) triaged:** 7 routes (audit said 8 — discrepancy noted), all under `/api/tools/*` (`empathy-map`, `marking-comments`, `report-writer`, `report-writer/bulk`, `safety/badges`, `safety/badges/[slug]`, `user-persona`). Verified one (`empathy-map/route.ts`) — no `getUser` or `requireAuth` calls; intentional public free-tool endpoints. **Sub-task 0.9 reduces to a 5-min `auth: public` annotation pass in `api-registry.yaml`** plus a scanner heuristic update so future routes are classified correctly. NOT a real security gap.
⚠️ **fu-p-access-model-v2-plan.md superseded** — banner committed 28 Apr PM; do not pick up as build spec. v2 is canonical.
⚠️ **it-audit-remediation-plan.md ON HOLD** — Option A chosen (v2 owns F6/F9/F10/F12/F14/F19/F24/F25/F32-manual). Remediation plan re-bucketing waits for v2 ship + Matt's re-audit.

---

## Lessons to Re-Read Before Code

Read the **full text**, not just the title. Line numbers point into `docs/lessons-learned.md`.

| Lesson | Line | Why it applies to Phase 0 |
|---|---|---|
| **#29 — RLS + junction tables silently filter rows** | 101 | Phase 0 adds 4+ junction-shaped tables (`class_members`, `student_guardians`, `school_resource_relations`, `consents` cross-subjects). Every RLS policy must be tested against a real student-A vs student-B scenario, not just compile-checked. Sub-task 0.9 (RLS test harness) is the structural answer. |
| **#38 — `ADD COLUMN DEFAULT` silently overrides subsequent conditional `UPDATE` in the same migration** | 141 | Sub-tasks 0.1, 0.3, 0.5 all add columns with conditional backfills. Every migration must `ADD COLUMN` without `DEFAULT`, run the conditional UPDATE, *then* apply the default for new rows (or skip the default entirely if the backfill is total). Verify queries assert expected values, not just non-null. |
| **#43 — Think before coding: surface assumptions** | 241 | The pre-flight ritual produces an ASSUMPTIONS block at every sub-task. Don't paper over surprises (Phase 8 finding flow). |
| **#44 — Simplicity first** | 256 | Phase 0 is pure schema + scaffolding. No speculative helpers, no abstract base classes, no `BaseSchoolEntity` parent class. Each migration does one concern. |
| **#45 — Surgical changes** | 273 | Touch only what each sub-task names. Don't refactor adjacent code "while you're there." Side-findings file as new follow-ups OR roll into the same commit per Lesson #60 — but never silently expand scope. |
| **#46 — Goal-driven execution** | 294 | Each sub-task has explicit pass criteria. Loop until verified. |
| **#47 — Adding schema to an existing yaml = audit every writer first** | 315 | Sub-task 0.4 (soft-delete on user-touched tables) requires auditing every writer to those tables. Don't list which tables get `deleted_at` from memory; grep the actual writers. |
| **#51 — Supabase dashboard parser quirk** | 383 | If a migration declares a PL/pgSQL variable name that happens to match a table name, the dashboard's "Run with RLS" prompt mis-parses. Use distinct variable names. |
| **#54 — WIRING.yaml entries can claim "complete" features that don't exist** | 481 | When updating WIRING.yaml at saveme, audit by grep before trusting any system summary you might recall from memory. |
| **#60 — Side-findings inside touched code belong in the same commit** | 606 | Phase 0 will surface untracked schema drift, undocumented RLS patterns, and stale comments. Default to fixing inline; only defer when a finding is genuinely outside the diff's blast radius. |

---

## Stop Triggers

Pause and report (don't paper over) if any of these surface during a sub-task:

- A migration's pre-flight check finds a table or column already exists when you expected clean ground (means another session shipped something — check `git log` + `.active-sessions.txt`)
- `npm test` baseline drifts during a sub-task (was 2433, now 2429 — something else broke)
- An RLS policy you write returns the wrong number of rows in the test harness (Lesson #29 territory)
- The Supabase MCP dashboard refuses a migration with a parser error you don't recognise (Lesson #51 territory)
- A backfill query reports row-count mismatches between dry-run and apply
- You discover a column or constraint already exists with a different shape than spec'd

## Don't Stop For

- Stale comments in adjacent code that aren't load-bearing
- Linting warnings that pre-date this branch
- Tests that were already failing on `main` (capture the list, don't fix unless they become real blockers)
- Schema-registry.yaml drift that scan-schema-registry.py hasn't applied yet — that's a saveme step at end of phase

---

## Checkpoint A1 Pass Criteria

Phase 0 signs off as a single Checkpoint A1 with these PASS conditions:

1. **Schema verified against schema-registry:** `python3 scripts/registry/sync-schema-registry.py --apply` runs clean. Every new table + column is recorded.
2. **Backfill verified:** every teacher has `school_id` populated; every class has `school_id`; every student has `school_id`; every unit has `school_id`. `class_members` has one `lead_teacher` row per existing class. `auth.users.user_type` populated for every existing row. Multi-Matt 3-rows-with-name="Matt" preserved as 3 separate rows (not silently merged).
3. **RLS coverage scanner clean:** `python3 scripts/registry/scan-rls-coverage.py` reports zero new tables in `rls_enabled_no_policy` state. (Pre-existing 7 entries from FU-FF stay until Phase 6.)
4. **Forward-compat tables exist with empty rows + working FKs:** `school_resources`, `school_resource_relations`, `guardians`, `student_guardians`, `consents` queryable, FK constraints pass on a synthetic insert.
5. **Live RLS test harness green:** the new integration test (sub-task 0.9) passes — student-A in class-A reads zero rows for student-B's data in class-B.
6. **MFA enrolled** on platform-admin (Matt's) account. Documented procedure for MFA reset.
7. **ENCRYPTION_KEY rotation script tested** — fire drill reports atomic re-encrypt of all stored credentials with no data loss.
8. **No app regressions:** `npm test` reports **2433 + N new tests** (where N is the test count added by Phase 0 sub-tasks). Zero previously-passing tests now failing.
9. **Worktree clean:** `git status --short` shows no untracked files; all migrations + tests + docs committed; branch ready to merge to main.
10. **Saveme run** — registries (schema, api, ai-call-sites, feature-flags, vendors, RLS) all synced; `WIRING.yaml` updated for new systems; doc-manifest entries for any new docs; changelog entry appended.

---

## Out of Scope (Phase 0 explicitly does NOT)

- Touch any route handler under `src/app/api/**`. Route migration is Phase 1.
- Modify any existing RLS policy on existing tables. Existing per-teacher RLS keeps working unchanged. RLS rewrites are Phase 1+.
- Build the unified `getStudentSession()` helper. That's Phase 1.
- Build the `can(actor, action, resource)` permission helper. That's Phase 3.
- Wire any UI for school resources, guardians, consents. Those are forward-compat schema only.
- Build retention enforcement cron logic. Cron *scaffold* lands here only if naturally falls out; cron *logic* is Phase 5.
- Touch `monetisation.md` or implement Stripe / billing. v2 ships the seam (`schools.subscription_tier` + `can()` tier hook + AI budget tier default); monetisation owns the rest.
- Rename existing `/api/*` routes to `/api/v1/*`. That's Phase 6 cutover. New routes introduced *during* Phase 1+ go under `/api/v1/` per the convention doc; Phase 0 itself introduces zero routes.

---

## Sub-task 0.1 — Schools Column Expansion (instruction block)

The block below is paste-ready for Claude Code. Pre-flight ritual + implementation + tests + verify + commit, single fenced block.

```
You are working in /Users/matt/CWORK/questerra-access-v2 on branch
access-model-v2. This is sub-task 0.1 of Access Model v2 Phase 0.

Spec: docs/projects/access-model-v2.md §3 items 28+36+37+39 + §4 Phase 0
Brief: docs/projects/access-model-v2-phase-0-brief.md

GOAL — add 6 columns to the existing schools table (mig 085) so that
later phases have somewhere to write the lifecycle / region / governance /
monetisation / timezone / locale state. Pure schema. No app code.

LESSONS TO RE-READ — read the full text, not just titles:
- Lesson #38 (line 141 of docs/lessons-learned.md) — ADD COLUMN DEFAULT
  silently overrides conditional UPDATE in the same migration
- Lesson #44 (line 256) — simplicity first; no speculative helpers
- Lesson #45 (line 273) — surgical; touch only the schools table
- Lesson #51 (line 383) — Supabase parser quirk on PL/pgSQL var names
- Lesson #60 (line 606) — side-findings in same commit, not deferred

PRE-FLIGHT CHECKLIST (numbered; STOP AND REPORT before writing code):

1. git status --short
   Expected: clean. If not clean, report and STOP.

2. git symbolic-ref --short HEAD
   Expected: access-model-v2

3. npm test 2>&1 | tail -10
   Expected: "2433 passed | 9 skipped" (152 files, 1 skipped)
   If different from 2433+9, capture the new baseline and STOP — something
   shifted that needs explaining.

4. Verify schools table state:
   grep -A 60 "CREATE TABLE.*schools" supabase/migrations/085_schools.sql
   Expected: status / region / bootstrap_expires_at / subscription_tier /
   timezone / default_locale columns ABSENT. If any already exist, STOP.

5. Mint the migration pair:
   bash scripts/migrations/new-migration.sh schools_v2_columns
   Note the timestamp. Commit + push the empty stubs immediately to claim
   the timestamp on origin (per Migration Discipline v2). Do NOT push yet
   if you're not on origin/access-model-v2 — just commit the empty stubs
   locally so the timestamp is reserved on the branch.

6. STOP AND REPORT — write an ASSUMPTIONS block (Lesson #43) listing:
   - test baseline number captured
   - migration timestamp minted
   - schools table columns confirmed absent
   - any deviations from this brief

   Wait for sign-off before proceeding.

IMPLEMENTATION:

After sign-off, fill the migration body at
supabase/migrations/<timestamp>_schools_v2_columns.sql with this content
(read the comments — Lesson #38 is the constant background music):

  -- Migration: schools_v2_columns
  -- Phase: Access Model v2 Phase 0.1
  -- Adds 6 columns to schools (mig 085) for lifecycle / region /
  -- governance / monetisation / timezone / locale state.
  --
  -- All defaults are total (no conditional backfill needed) so Lesson #38
  -- doesn't bite — defaults apply uniformly to every existing row.
  --
  -- Existing rows: schools mig 085 + 085_schools_seed. NIS school
  -- (school_id 636ff4fc-...) plus seeded IB / CIS / ECIS rows. None
  -- have multi-teacher bootstrap state (mig 085 is pre-Phase-0), so
  -- bootstrap_expires_at stays NULL for all existing rows; new schools
  -- created post-this-migration get NOW() + 7 days set by app code in
  -- Phase 4 (school registration).

  -- Lifecycle status: every existing school is 'active'.
  ALTER TABLE schools
    ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','dormant','archived','merged_into'));

  -- Data residency hint. Default 'default' (means: use platform default,
  -- which is the single Supabase project today). Future regional splits
  -- read this column to know who would move.
  ALTER TABLE schools
    ADD COLUMN region TEXT NOT NULL DEFAULT 'default';

  -- Bootstrap grace window for governance §8.3. NULL on existing rows
  -- (they predate the bootstrap concept). New schools created in Phase 4
  -- get NOW() + 7 days set on insert; the column flips to NULL when the
  -- second teacher joins (handled by Phase 4 trigger or app code).
  ALTER TABLE schools
    ADD COLUMN bootstrap_expires_at TIMESTAMPTZ NULL;

  -- Monetisation seam. Every existing school starts on 'pilot'; NIS gets
  -- bumped manually post-pilot. monetisation.md tier-gates against this.
  ALTER TABLE schools
    ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'pilot'
    CHECK (subscription_tier IN ('pilot','free','starter','pro','school'));

  -- Timezone for AI budget reset, retention cron, audit log day-bucketing.
  -- IANA format. App layer validates new values via PostgreSQL's
  -- "now() AT TIME ZONE timezone" round-trip. Default 'Asia/Shanghai'
  -- because every existing school today is China-based; Phase 4 school
  -- registration flow asks during onboarding.
  ALTER TABLE schools
    ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai';

  -- Locale seam. No translation system in v2 — just the column. Resolution
  -- chain (in Phase 1+ session helpers): user.locale ?? school.default_locale
  -- ?? 'en'. When i18n eventually lands, the columns are populated and
  -- routes already pass locale through.
  ALTER TABLE schools
    ADD COLUMN default_locale TEXT NOT NULL DEFAULT 'en';

  -- Indexes — partial because most queries don't filter on status/tier
  -- but admin queries do.
  CREATE INDEX IF NOT EXISTS idx_schools_status_active
    ON schools(status) WHERE status != 'active';
  CREATE INDEX IF NOT EXISTS idx_schools_subscription_tier
    ON schools(subscription_tier);

  -- Sanity check
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='schools' AND column_name='status'
    ) THEN
      RAISE EXCEPTION 'Migration schools_v2_columns failed: status missing';
    END IF;
    RAISE NOTICE 'Migration schools_v2_columns applied OK: 6 columns added';
  END $$;

The paired .down.sql at <timestamp>_schools_v2_columns.down.sql:

  -- Reverse of schools_v2_columns
  DROP INDEX IF EXISTS idx_schools_subscription_tier;
  DROP INDEX IF EXISTS idx_schools_status_active;
  ALTER TABLE schools
    DROP COLUMN IF EXISTS default_locale,
    DROP COLUMN IF EXISTS timezone,
    DROP COLUMN IF EXISTS subscription_tier,
    DROP COLUMN IF EXISTS bootstrap_expires_at,
    DROP COLUMN IF EXISTS region,
    DROP COLUMN IF EXISTS status;

TESTS:

Add test file at src/lib/access-v2/__tests__/migration-schools-v2-columns.test.ts
with these explicit assertions (Lesson #38 — assert expected values, not
just non-null):

  import { describe, it, expect } from 'vitest';
  import fs from 'node:fs';
  import path from 'node:path';

  const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

  function loadMigration(suffix: string): string {
    const all = fs.readdirSync(MIGRATIONS_DIR);
    const file = all.find(f => f.endsWith(suffix) && !f.endsWith('.down.sql'));
    if (!file) throw new Error(`Migration ${suffix} not found`);
    return fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
  }

  describe('Migration: schools_v2_columns', () => {
    const sql = loadMigration('_schools_v2_columns.sql');

    it('adds status column with active default + 4-state CHECK', () => {
      expect(sql).toContain("ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
      expect(sql).toContain("status IN ('active','dormant','archived','merged_into')");
    });

    it('adds region column defaulting to default', () => {
      expect(sql).toContain("ADD COLUMN region TEXT NOT NULL DEFAULT 'default'");
    });

    it('adds bootstrap_expires_at as nullable timestamptz', () => {
      expect(sql).toContain("ADD COLUMN bootstrap_expires_at TIMESTAMPTZ NULL");
    });

    it('adds subscription_tier with pilot default + 5-tier CHECK', () => {
      expect(sql).toContain("ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'pilot'");
      expect(sql).toContain("subscription_tier IN ('pilot','free','starter','pro','school')");
    });

    it('adds timezone defaulting to Asia/Shanghai', () => {
      expect(sql).toContain("ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai'");
    });

    it('adds default_locale defaulting to en', () => {
      expect(sql).toContain("ADD COLUMN default_locale TEXT NOT NULL DEFAULT 'en'");
    });

    it('creates two new indexes (status partial + subscription_tier)', () => {
      expect(sql).toContain('idx_schools_status_active');
      expect(sql).toContain("WHERE status != 'active'");
      expect(sql).toContain('idx_schools_subscription_tier');
    });

    it('contains no DROP / DELETE / TRUNCATE statements (destructive guard)', () => {
      expect(sql).not.toMatch(/^\s*DROP\s/im);
      expect(sql).not.toMatch(/^\s*DELETE\s/im);
      expect(sql).not.toMatch(/^\s*TRUNCATE\s/im);
    });
  });

  describe('Migration: schools_v2_columns down script', () => {
    const sql = loadMigration('_schools_v2_columns.down.sql');

    it('drops all 6 columns in reverse order', () => {
      const dropIdx = sql.indexOf('DROP COLUMN IF EXISTS default_locale');
      expect(dropIdx).toBeGreaterThan(-1);
      // Reverse order matters because indexes reference status/tier
      expect(sql.indexOf('DROP COLUMN IF EXISTS status'))
        .toBeGreaterThan(sql.indexOf('DROP COLUMN IF EXISTS region'));
    });

    it('drops both indexes', () => {
      expect(sql).toContain('DROP INDEX IF EXISTS idx_schools_status_active');
      expect(sql).toContain('DROP INDEX IF EXISTS idx_schools_subscription_tier');
    });
  });

NEGATIVE CONTROL (Lesson #38 + #41):

After tests pass, mutate one assertion (e.g. change "Asia/Shanghai" to
"Asia/Tokyo" in the timezone test). Run npm test. Confirm the test FAILS.
Revert via the Edit tool (NOT git checkout — Lesson #41, file is uncommitted).
Re-run npm test. Confirm passing again.

VERIFY:

1. npm test 2>&1 | tail -10
   Expected: "2443 passed | 9 skipped" (added 10 new tests in this sub-task)
   If count is wrong, STOP and audit which test was missed.

2. npx tsc --noEmit --project tsconfig.check.json
   Expected: 0 errors.

3. Manual review:
   - Both migration files exist with the correct timestamp
   - Test file exists and runs
   - No other files modified

COMMIT:

Two commits (separate, no squash — Lesson #45 + build-methodology principle 7):

Commit 1 — the migration pair:
  git add supabase/migrations/<timestamp>_schools_v2_columns.sql \
          supabase/migrations/<timestamp>_schools_v2_columns.down.sql
  git commit -m "feat(access-v2): Phase 0.1 — schools v2 columns migration"

Commit 2 — the tests:
  git add src/lib/access-v2/__tests__/migration-schools-v2-columns.test.ts
  git commit -m "test(access-v2): Phase 0.1 — assert schools v2 columns migration shape"

Do NOT push to origin yet. Phase 0 ships as one branch merge after
Checkpoint A1 signs off (per access-model-v2.md §5 migration strategy).

STOP AND REPORT — list:
- migration timestamp claimed
- test count delta (expected: +10)
- typecheck result
- NC results (which assertion was mutated, did test fail, was revert via
  Edit tool successful)
- any side-findings discovered (Lesson #60 — fix inline if in scope, defer
  if outside blast radius)
- next sub-task readiness — Phase 0.2 (locale + SIS columns) once 0.1 signs off
```

---

## After Phase 0.1 ships

Subsequent sub-tasks (0.2–0.9) get their own paste-ready instruction blocks written incrementally — each one after the previous has signed off and merged to the access-v2 branch. The pattern stays the same: pre-flight ritual → STOP and report assumptions → implementation → tests with NC → verify → commit → STOP and report.

After all 9 sub-tasks ship, **Checkpoint A1** runs through the 10 PASS criteria above. On signoff, the `access-model-v2` branch merges to main, migrations apply to prod, and **Phase 1 brief** (auth unification) is drafted.

---

## References

- Master spec: [`docs/projects/access-model-v2.md`](access-model-v2.md)
- Build methodology: [`docs/build-methodology.md`](../build-methodology.md)
- Lessons learned: [`docs/lessons-learned.md`](../lessons-learned.md)
- IT audit: [`studioloom-it-audit-2026-04-28.docx`](../../studioloom-it-audit-2026-04-28.docx)
- Phase 8 patterns to integrate: `src/lib/auth/verify-teacher-unit.ts`, `src/lib/student-support/resolve-class-id.ts`, `src/lib/fabrication/lab-orchestration.ts`, `current_teacher_school_id()` in mig `20260427134953`
- Companion follow-ups: [`docs/projects/class-architecture-cleanup.md`](class-architecture-cleanup.md), [`docs/projects/it-audit-remediation-plan.md`](it-audit-remediation-plan.md) (ON HOLD)
