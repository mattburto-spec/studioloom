# Prod Migration Backlog Audit — Build Brief

**Surfaced:** 4 May 2026 (Lever 1 seed) — escalated 11 May 2026 (student-creation incident)
**Owner:** Matt
**Status:** NOT STARTED
**Priority:** P1
**Worktree (suggested):** `/Users/matt/CWORK/questerra-migration-audit` (fresh — do NOT execute in the main `questerra/` worktree)
**Branch (suggested):** `prod-migration-audit-2026-05-11`
**Tracker entry:** [`docs/projects/dimensions3-followups.md`](dimensions3-followups.md) → **FU-PROD-MIGRATION-BACKLOG-AUDIT**
**Companion lessons:** [Lesson #65](../lessons-learned.md#lesson-65), [Lesson #66](../lessons-learned.md#lesson-66), [Lesson #68](../lessons-learned.md#lesson-68), [Lesson #83](../lessons-learned.md#lesson-83)

---

## Why this exists

Prod has **no application-level migration tracking table**. Confirmed 11 May 2026 by probing `information_schema.schemata` — only Supabase's internal trackers (`auth.schema_migrations`, `storage.migrations`, `realtime.schema_migrations`) exist. Migrations in `supabase/migrations/*.sql` have been applied by hand all along, with no record of which landed.

Concrete damage already observed:
1. **11 May 2026 student-creation incident** — `handle_new_teacher` trigger was running migration-001's buggy version for ~12 days because the May-1/May-2 fix migrations (`20260501103415`, `20260502102745`, `20260502105711`) never landed. Every auth.users INSERT since 29 April was failing silently. Hand-patched + codified in [migration 20260511085324](../../supabase/migrations/20260511085324_handpatch_handle_new_teacher_skip_students_search_path.sql).
2. **4 May 2026 Lever 1 seed** — prod rejected INSERTs the repo claimed were valid; surfaced as missing `unit_type` column (migration 051) + missing Access Model v2 columns.
3. **5 May 2026 TG.0B migration failure** — pre-flight checks read stale `schema-registry.yaml` instead of probing prod.

Without this audit, every future migration is gambling on prod-state assumptions that can't be verified.

---

## End-state (what "done" looks like)

1. **Truth document filed** — `docs/projects/prod-migration-backlog-audit-2026-05-11-truth.md` listing, for each migration in `supabase/migrations/` ≥ 1 Apr 2026, whether it's **applied / not-applied / partial / superseded**, with the probe SQL that determined it.
2. **Drift resolved** — each NOT-APPLIED migration has a decision logged: `apply` / `skip-already-equivalent` / `rework-into-new-migration`. Apply group runs in dependency order, with smoke per group.
3. **Tracking table created** — `public.applied_migrations` table exists in prod, backfilled from the truth document. From this point forward, every migration in the repo MUST have a row here within 24h of being applied.
4. **Tooling updated** — `scripts/migrations/new-migration.sh` prints reminder to log the apply. New helper `scripts/migrations/check-applied.sh` queries the tracking table and lists unapplied repo migrations. Saveme step 11 (registry sync) runs this helper and warns if drift exists.
5. **Registries reconciled** — `schema-registry.yaml`, `api-registry.yaml`, `feature-flags.yaml`, etc. re-synced post-apply. `spec_drift` entries for resolved cases closed.
6. **Sister FU closed** — [FU-EE](dimensions3-followups.md) (no canonical applied log) gets marked resolved by the tracking table.

---

## Non-goals

- Not building a full migration runner. Continuing to apply by hand is fine; the tracking table is what's missing.
- Not retroactively documenting every migration since 001. Cut-off date: 1 Apr 2026 (start of Dimensions3 + Access v2 era). Pre-cut migrations are assumed applied (the database has been running on them for 18 months).
- Not rebuilding registry sync. Just running the existing scanners post-apply.

---

## Pre-flight checklist (per `docs/build-methodology.md`)

Run **before** writing any code or SQL. Stop if any fail and report.

- [ ] Read [`docs/build-methodology.md`](../build-methodology.md) end to end.
- [ ] Re-read [Lesson #65](../lessons-learned.md#lesson-65), [#66](../lessons-learned.md#lesson-66), [#68](../lessons-learned.md#lesson-68), [#83](../lessons-learned.md#lesson-83).
- [ ] Confirm fresh worktree exists at `/Users/matt/CWORK/questerra-migration-audit` on branch `prod-migration-audit-2026-05-11`. Do NOT execute in `questerra/` main worktree.
- [ ] `git status` clean.
- [ ] `npm test` baseline passing (record exact count for end-of-phase diff).
- [ ] Append a row to `/Users/matt/CWORK/.active-sessions.txt` declaring this worktree + audit work.
- [ ] Confirm Supabase service-role key is available locally (for direct prod queries). Test with `select now()` via SQL Editor — no destructive op.
- [ ] Read this brief end-to-end. STOP and ask Matt if any phase is unclear before starting.

---

## Phases + Matt Checkpoints

Each phase ends with a named Matt Checkpoint. Do not proceed past the checkpoint without explicit sign-off.

### Phase A — Enumerate (1-2 hr) → Checkpoint A.1

**Goal:** List every migration in `supabase/migrations/*.sql` newer than `2026-04-01` and assign each a **probe**: a single read-only SQL query that returns truthy when the migration's effect is in prod.

**Inputs:** `supabase/migrations/*.sql`
**Outputs:** `docs/projects/prod-migration-backlog-audit-2026-05-11-truth.md` (header + skeleton table; one row per migration, probe column populated, result column blank).

**Probe taxonomy:**
- New table → `SELECT to_regclass('public.X')`
- New column → `SELECT column_name FROM information_schema.columns WHERE table_name='X' AND column_name='Y'`
- New function → `SELECT proname FROM pg_proc WHERE proname='X'`
- New function body change → `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='X'` + LIKE patterns
- New policy → `SELECT policyname FROM pg_policies WHERE tablename='X' AND policyname='Y'`
- New index → `SELECT indexname FROM pg_indexes WHERE tablename='X' AND indexname='Y'`
- Data backfill → spot-check a known row touched by the migration
- Pure DROP → check the dropped object is gone

**Don't stop for:** prefer the simplest probe that's correct. If a migration has multiple effects, pick the most prominent one — partial-apply detection lands in Phase C.

**Checkpoint A.1 acceptance:** truth doc skeleton committed; row count matches migration count for the date range; every probe is read-only.

---

### Phase B — Probe (1 hr) → Checkpoint B.1

**Goal:** Run each probe in prod (Supabase SQL Editor or via service-role connection) and fill the result column. NO modifications.

**Outputs:** truth doc fully populated.

**Don't stop for:** probe results showing the schema doesn't match the registry — that's exactly what we're hunting. Note it and continue.

**Stop triggers (call Matt immediately):**
- A probe errors with `permission denied` — service-role key wrong, fix before continuing.
- A probe returns a state that suggests prod has features the repo never authored — likely manual hand-patch (like the 11 May trigger fix). Note it and continue, but flag as needs-codification in Phase D.

**Checkpoint B.1 acceptance:** truth doc 100% filled; every row has a definitive applied/not-applied/partial result; partial-state cases have a sub-note explaining what's missing.

---

### Phase C — Categorise (30 min) → Checkpoint C.1

**Goal:** For each NOT-APPLIED row, assign a category:
- **APPLY** — run the migration as-is; no conflicts.
- **SKIP-EQUIVALENT** — the effect is already in prod via another path (manual SQL, prior migration that did the same thing). Just record in the tracking table; don't re-run.
- **REWORK** — running the migration would conflict with current prod state. Authors a new "reconciliation migration" instead.
- **RETIRE** — the migration was superseded by a later one; drop from the apply set, but record the original as "intentionally skipped" in the tracking table.

**Outputs:** Each truth-doc row has a category cell.

**Checkpoint C.1 acceptance:** Matt reviews categorisation before any apply work begins. Especially flag REWORKs — those need migration author + reviewer.

---

### Phase D — Apply (2-4 hr depending on count) → Checkpoint D.1 per group

**Goal:** Apply all APPLY-category migrations in dependency order, with smoke between groups.

**Group definition:** migrations that touch the same table or function go in the same group. Groups apply atomically (commit per group). Smoke after each group exercises the route(s) most affected.

**For each group:**
1. Read the migration body. Note tables/functions/policies touched.
2. Apply via Supabase SQL Editor (paste body, execute).
3. Run the probe again — confirm now-truthy.
4. Run smoke test specific to the group (e.g., after RLS hardening group: try a denied query as student to confirm policy fires).
5. Commit the truth-doc update marking that row APPLIED + timestamp.
6. **STOP for Matt sign-off before next group.**

**Don't stop for:** registry yaml regenerating — that's a Phase F task.
**Stop triggers:** any smoke failure, any unexpected error from the apply.

---

### Phase E — Create tracking table + backfill (30 min) → Checkpoint E.1

**Goal:** Create the `public.applied_migrations` table and seed it from the truth doc.

```sql
CREATE TABLE IF NOT EXISTS public.applied_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by TEXT,
  source TEXT CHECK (source IN ('manual', 'cli', 'backfill', 'hand-patch')),
  notes TEXT
);
ALTER TABLE public.applied_migrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY applied_migrations_platform_admin_only ON public.applied_migrations
  FOR ALL USING (
    (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
  );
```

Then insert one row per migration the audit determined to be applied (truth doc rows marked APPLIED or SKIP-EQUIVALENT). For each, set `source = 'backfill'`, `applied_by = 'audit-2026-05-11'`, and `notes` to a short marker (e.g. "applied via hand-patched SQL 11 May", "pre-cut assumed applied").

**Checkpoint E.1 acceptance:** Table exists, RLS enabled, row count matches the audit count, sample-spot-check 3 rows confirms shape.

---

### Phase F — Wire tooling + registry sync (1 hr) → Checkpoint F.1

**Goal:**
1. Add `scripts/migrations/check-applied.sh` that connects via service-role and lists repo migrations not in `applied_migrations`. Exit 1 on any drift.
2. Update `scripts/migrations/new-migration.sh` to print a reminder banner with the apply + log INSERT command.
3. Re-run all scanners: `scan-api-routes.py`, `scan-ai-calls.py`, `scan-feature-flags.py`, `scan-vendors.py`, `scan-rls-coverage.py`. Commit any drift the scanners find.
4. Manually update `schema-registry.yaml` for tables touched by applied migrations — close `spec_drift` entries for resolved cases.

**Checkpoint F.1 acceptance:** `bash scripts/migrations/check-applied.sh` exits 0. Registry yaml diff committed. Saveme step 11 references the new check.

---

### Phase G — Close-out (30 min)

1. Mark FU-PROD-MIGRATION-BACKLOG-AUDIT resolved in [`docs/projects/dimensions3-followups.md`](dimensions3-followups.md), with link to truth doc + apply summary.
2. Mark sister FU-EE resolved by Phase E.
3. Update [`CLAUDE.md`](../../CLAUDE.md) — remove the FU mention from "Known follow-ups", elevate the `applied_migrations` table to the migration discipline section.
4. Run `saveme` to capture everything.

---

## Risk register

| Risk | Mitigation |
|---|---|
| A probe accidentally writes data | Phase B is read-only by contract. Every probe in the truth doc must be SELECT or pg_catalog read. Review before running. |
| Apply order is wrong → FK/policy fails | Group definition in Phase D groups by table/function. Smoke between groups catches errors before they cascade. |
| A REWORK migration conflicts with later migrations | Phase C identifies REWORKs; Matt reviews before any apply. REWORKs handled last, with their own brief if scope grows. |
| Hand-patched state in prod (like the 11 May trigger fix) gets clobbered by a later apply | Phase B notes hand-patched state. Phase C SKIP-EQUIVALENT category preserves it. Tracking table records `source = 'hand-patch'` so it's traceable. |
| Service-role key leaks via SQL Editor session | Use Supabase SQL Editor (browser-scoped); never paste service-role key into terminal commands. |

---

## Open questions for Matt

Answer before Phase A starts:

1. **Worktree:** OK to create `questerra-migration-audit` worktree, or use the existing `sleepy-liskov-ee8322` worktree this brief was authored in?
2. **Cut-off date:** Brief proposes 1 Apr 2026. Move it earlier or later?
3. **Smoke depth:** Per-group smoke can be light ("did the route still respond 200") or deep ("did the new policy actually block the wrong-class read"). Default = light unless a group touches RLS or auth.
4. **Tracking-table location:** `public.applied_migrations` proposed. Alternative: `supabase_migrations.schema_migrations` (mimics Supabase CLI). Going with `public.applied_migrations` because it's explicit and easy to query, but happy to change.

---

## Hand-off note

This brief is the entry point. Next session:
1. Read this brief end-to-end.
2. Answer the four open questions.
3. Run the pre-flight checklist.
4. Begin Phase A.

Do NOT start Phase A in the same session as a different active build phase. The audit needs uninterrupted focus and direct prod access.
