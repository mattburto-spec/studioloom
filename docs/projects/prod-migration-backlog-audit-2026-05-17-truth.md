# Prod Migration Backlog Audit — Round 2 Truth Document

**Date:** 17 May 2026
**Owner:** Matt + Claude
**Sister doc:** [prod-migration-backlog-audit-2026-05-11-truth.md](prod-migration-backlog-audit-2026-05-11-truth.md) (Round 1 — timestamp-prefix migrations)
**Status:** ✅ CLOSED — all 4 confirmed drifts applied to prod + logged in `applied_migrations`

## Why this round was needed

The Round 1 audit (11 May 2026) backfilled 81 rows into `public.applied_migrations` covering every timestamp-prefix migration (>= 20260401). Its scope decision explicitly excluded the 122 three-digit migrations (`001`–`123`) on the *assumed*-applied premise.

On **17 May 2026** that assumption was disproven. A teacher-side smoke surfaced a 500 with `column units_1.unit_type does not exist` at `/teacher/units/[unitId]/class/[classId]` (ChangeUnitModal) and `/teacher/classes/[classId]/units` (Past units sub-route). Root cause: migration `051_unit_type.sql` was in the repo + schema-registry but **not on prod**. Hotfix shipped as PR [#340](https://github.com/mattburto-spec/studioloom/pull/340) (commit `56b18204`) — narrowed both `units(...)` selects + added a paired anti-regression `describe` block at [src/app/teacher/units/\_\_tests\_\_/dt-canvas-shape.test.ts:437](src/app/teacher/units/__tests__/dt-canvas-shape.test.ts:437).

Round 2's job: find every other drifted 3-digit migration before the next 500.

## Scope

| Bucket | Count | Result |
|---|---|---|
| Timestamp migrations (>= 20260401), tracker drift query | 107 | **0 missing from `applied_migrations`** (all logged; Lesson #83 discipline held without exception since 11 May) |
| 11 May truth-doc spot-check (Section G of Round 2 audit) | 11 high-distinctive probes | **11 / 11 confirmed applied** (trust score 100% for what Round 1 scoped) |
| 3-digit migrations probed, Round 1 (`045–123`) | 25 schema probes | **2 new drifts found** (080, 082) + the known control (051) + 1 deliberate skip (121) |
| 3-digit migrations probed, Round 2 (expanded) | 30 schema probes | **2 new drifts found** (081, 119) + 2 probe-bugs corrected (062 + 119 actual probe required column-name correction) |
| 3-digit migrations probed, Round 3 (corrective re-probe) | 3 probes | **0 new drifts** — 062 + 119 both applied (probe bugs in Round 2 confirmed via correctly-named re-probe) |
| 3-digit migrations NOT probed (`001`–`044`) | 44 | Out of scope — pre-Dimensions3 foundational schema. Drift here would already have caused 500s. |

## Probe method

Each probe was a single-line existence check: `EXISTS(SELECT 1 FROM information_schema.columns ...)` for column probes, `to_regclass('public.X') IS NOT NULL` for table probes, `EXISTS(SELECT 1 FROM pg_proc WHERE proname=...)` for function probes. Combined via `UNION ALL` so a single paste returned one row per migration with `applied: true|false`.

Probe pack files preserved at:
- `/tmp/audit-drift-query.sql` — Round 1 timestamp tracker drift query (returned `missing_count = 0`)
- `/tmp/audit-3digit-probe-pack.sql` — Round 1, 25 probes for 3-digit migrations (found drift on `080`, `082`)
- `/tmp/audit-3digit-expand-probe-pack.sql` — Round 2, 30 probes (found drift on `081`; surfaced probe bugs on `062` + `119`)
- `/tmp/audit-3digit-reprobe.sql` — Round 3, 3 corrective probes (confirmed `062` + `119` both applied)

## Findings — 4 confirmed drift hazards

| # | Migration | Artifact missing | Risk before fix | Mitigation |
|---|---|---|---|---|
| 1 | `051_unit_type` | `units.unit_type` + `units.curriculum_context` columns, CHECK constraint, index | **P1** — teacher-facing 500 on canvas | Code-side: PR #340 narrowed selects + anti-regression test (applied 17 May 08:31 UTC). Schema: applied to prod 17 May during this audit. |
| 2 | `080_block_versioning` | `activity_block_versions` table + RLS policies + `snapshot_block_version()` function + `trg_activity_blocks_version` trigger | **P3** — registry-only (0 code references; trigger doesn't exist so no silent block-history loss) | Applied to prod 17 May during this audit. Behavior change: future `activity_blocks` UPDATEs auto-snapshot to version table. Historic edits stay unversioned. |
| 3 | `081_unit_version_trigger` | `snapshot_unit_version()` function + `trg_units_version` trigger (target `unit_versions` table existed from mig 040) | **P2** — silent degrade. Unit edits didn't auto-create version rows; existing version reads (promote-fork, versions API, resolve-content) returned sparse data. | Applied to prod 17 May during this audit. Behavior change: future `units` UPDATEs that change `content_data` auto-snapshot. Metadata-only edits skipped via `IS DISTINCT FROM`. |
| 4 | `082_data_removal_log` | `data_removal_log` table + index + service_role RLS policy | **P2** — GDPR audit-trail gap. The 2 INSERT writers ([remove-student-data.ts:99,185](src/lib/integrity/remove-student-data.ts)) swallowed errors gracefully (`errors.push(...)` line 192), so deletes succeeded without 500 but compliance log never landed. | Applied to prod 17 May during this audit. |

### Deliberate skip (1 — not drift)

- **`121_student_progress_autonomy_level`** — local-dev only per the migration file's own comment ("Migration 121 was applied to local dev only — no prod data exists for"). The AutonomyPicker feature was killed (replaced by Tap-a-word + Response Starters). Correct state on prod; no apply needed.

## Apply log (this session)

All four migrations applied to prod via Supabase SQL Editor on 17 May 2026 (single session, paste-and-verify pattern per Lesson #83 discipline). Each apply: (a) migration body, (b) `INSERT INTO public.applied_migrations` tracker row, (c) post-apply verification probe — all three steps confirmed clean before moving to the next migration.

| Order | Migration | Verify result |
|---|---|---|
| 1 | `082_data_removal_log` | ✅ table_exists, policy_exists, index_exists, tracker_row_exists — all true |
| 2 | `051_unit_type` | ✅ unit_type_col_exists, curriculum_context_col_exists, check_constraint_exists, index_exists, tracker_row_exists — all true; `non_default_rows = 0` (every existing unit defaulted to `'design'`, confirming the column was genuinely absent before) |
| 3 | `080_block_versioning` | ✅ table_exists, teacher_policy_exists, service_policy_exists, function_exists, trigger_exists, index_exists, tracker_row_exists — all 7 true |
| 4 | `081_unit_version_trigger` | ✅ function_exists, trigger_exists, tracker_row_exists, unit_versions_target_table_exists — all 4 true |

## Trust score on Round 1 (11 May 2026 truth doc)

**100% for what it scoped.** The Round 2 spot-check (11 high-distinctive probes from the Round 1 backfilled set) returned 11/11 present on prod. The Round 1 backfilled rows correctly reflect prod state.

The blind spot in Round 1 was **scope, not method**. Excluding the 3-digit migrations on the assumed-applied premise was the structural gap. Round 2 closes it.

## Open follow-ups

- **`FU-CHECK-APPLIED-3DIGIT-SCOPE`** (P2) — Extend `bash scripts/migrations/check-applied.sh` to cover 3-digit migrations (currently filtered out by `awk '$0 >= "20260401"'`). After today's 4 applies, that's the same shape of `INSERT INTO applied_migrations` already done; the script just needs the filter loosened. Filed in [`docs/projects/platform-followups.md`](platform-followups.md).
- **`FU-AUDIT-3DIGIT-001-044-SWEEP`** (P3) — Probe the 44 foundational 3-digit migrations (`001`–`044`) not covered in this round. Low priority — drift on foundational tables (users, teachers, units, classes, knowledge_*) would already have surfaced via 500s. Doable in one more 30-probe paste cycle. Filed in [`platform-followups.md`](platform-followups.md).
- **`FU-PR340-CLEANUP-WIDEN-SELECTS`** (P3) — Now that `051_unit_type` is on prod, the PR #340 hotfix's narrowed selects in `ChangeUnitModal` + `Past units` page can be widened back to include `unit_type`. The anti-regression describe block at [src/app/teacher/units/\_\_tests\_\_/dt-canvas-shape.test.ts:437](src/app/teacher/units/__tests__/dt-canvas-shape.test.ts:437) gets dropped in the same PR. Small, isolated, ~30 min. Filed in [`platform-followups.md`](platform-followups.md).

## Lessons banked

- **Lesson #93** — *"When generating probe SQL for a migration, READ the migration body for the exact artifact name. Filename hints are unreliable."* — banked in [`docs/lessons-learned.md`](../lessons-learned.md). Drawn from this round's two probe bugs: `062_teacher_tier` adds to `teacher_profiles` (not `teachers`); `119_machine_profiles_brand_column` adds `machine_brand` (not `brand`). Both surfaced as FALSE in Round 2 expand, corrected as TRUE in Round 3 re-probe.

## Cross-cutting observation

Both newly-found 3-digit drifts (`080`, `082`) plus the function-only drift (`081`) cluster in the **Dimensions3 Phase 7A "Integrity & Versioning"** range (`080`–`082`). Working theory: this phase was authored locally late in the no-tracker era, the apply step was deferred (or attempted but failed silently), and no one noticed because the affected tables/triggers had no code-call sites at the time (they were forward-looking infra). The audit didn't catch them in May because the May audit's scope was the post-cutover era only.

The `051_unit_type` drift is structurally different — it had heavy code references but the migration was paired with code that defensively retried (`delete insertPayload.unit_type` on PGRST204), so the column being missing was tolerated for weeks before a NEW surface (the canvas migration arc) introduced direct selects that didn't have the fallback.

## Sister docs / change history

- Round 1 truth doc: [prod-migration-backlog-audit-2026-05-11-truth.md](prod-migration-backlog-audit-2026-05-11-truth.md) (the May audit; closed 11 May 2026)
- Round 1 brief: [prod-migration-backlog-audit-brief.md](prod-migration-backlog-audit-brief.md) (May audit context + Phase A–G plan)
- Hotfix that triggered Round 2: PR [#340](https://github.com/mattburto-spec/studioloom/pull/340), commit `56b18204`
- Anti-regression test: [src/app/teacher/units/\_\_tests\_\_/dt-canvas-shape.test.ts:437](../../src/app/teacher/units/__tests__/dt-canvas-shape.test.ts) — `describe("DT canvas — prod migration drift anti-regression (FU-PROD-MIGRATION-BACKLOG-AUDIT)", ...)`
- Discipline references: Lesson #83 (`applied_migrations` tracker mandate), Lesson #38 (verify expected values not just non-null — also the source of this round's probe-bug correction)
