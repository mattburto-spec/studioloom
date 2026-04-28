# Handoff — preflight-active

**Last session ended:** 2026-04-28T11:00:00Z
**Worktree:** `/Users/matt/CWORK/questerra-preflight`
**HEAD:** `9824900` "feat(preflight): Phase 8-4 path 2 — class-chip teacher disambiguation on fab queue"
**Top of main (post Phase 8-4 merge):** `740b892`

## What just happened

- **Preflight Phase 8 is fully done.** Phase 8-1 schema flip + Round
  1 audit + Phase 8-2 lab orchestration + Phase 8-3 machine
  orchestration + Phase 8-4 paths 1+2 all SHIPPED in a single
  full-day session driven by Matt's smoke of yesterday's
  school-scoped lab ownership migration.
- **Audit doc CLOSED — 12 of 12 findings ✅ FIXED.** See
  `docs/projects/preflight-audit-28-apr.md`. HIGH-1/2/3/4,
  MED-1/2/3/4/5/6, LOW-1/2.
- **Phase 8-4 path 2** shipped class-chip teacher disambiguation on
  fab queue: `<ClassChip>` now renders `Grade 10 · M.B.` and uses
  teacher initials as a color hash key so two NIS teachers' "Grade
  10" classes get distinct colors. `formatTeacherInitials` helper.
  PostgREST embed extended.
- **Multi-teacher prod smoke validated** flat school membership
  across 3 NIS personas at school_id `636ff4fc-...`. Strongest
  possible proof that the school-scoped contract works
  cross-teacher.
- **saveme done at session end** (commit pending push). Changelog,
  ALL-PROJECTS, dashboard, master CLAUDE.md, audit doc, doc-manifest
  all in sync. 5 registry scans rerun (api/ai/feature-flags/vendors/
  rls). API registry picked up 3 new grading routes from the
  parallel session that merged to main.

## State of working tree

- Branch `preflight-active` clean + in sync with origin.
- Top-of-main `740b892` (Phase 8-4 merge).
- Tests: **2433 pass / 9 skipped** (was 2208 at session start;
  +225 net). tsc strict (`tsc --noEmit --project tsconfig.check.json`)
  clean. CI green throughout the day's 4 merge commits.
- Untracked: `Systems/Ingestion/ingestion-pipeline-summary.md`
  (uncommitted modifications from a prior session, doc note about
  Pipeline 1 role change). Out of scope; leave alone.
- Untracked: `.github/workflows/deploy-preflight-scanner.yml` from
  FU-SCANNER-CICD work. Out of scope.

## Next steps

- [ ] **Access Model v2 Phase 0** — the canonical next pickup. Worktree
      `/Users/matt/CWORK/questerra-access-v2` on branch
      `access-model-v2`. Spec at `docs/projects/access-model-v2.md`.
      Its scope already addresses the "3 Matts" identity cleanup
      that surfaced today (all 3 NIS personas have `display_name = null`
      and `name = "Matt"`, so Phase 8-4 path 2 disambiguation is
      wired correctly but visually identical until distinct names
      land — Access v2 fixes this properly via auth unification +
      first-class schools entity).

- [ ] **Or: dashboard-v2 polish** — if that's still the higher-priority
      pickup. Worktree `/Users/matt/CWORK/questerra-dashboard` on
      branch `dashboard-v2-build`.

- [ ] **Optional pre-pilot housekeeping** (low priority):
  - Drop legacy `machine_profiles.teacher_id` column in a follow-up
    migration. Phase 8-3 left it as legacy (still NOT NULL via mig
    093 ownership_check). Verify no downstream consumers (RLS on
    other tables, FK references) before dropping.
  - `RUN_E2E` env var still flagged missing from
    `docs/feature-flags.yaml` (drift from tap-a-word work).
    Register or document as test-only.
  - PH9-FU-SCANNER-OOM-T1..T5 longevity plan (T1-T3 pre-pilot).
  - FU-SCANNER-LEASE-REAPER P2 (blocks horizontal scaling).
  - FU-SCANNER-CICD P2 (FLY_API_TOKEN minting + workflow file
    pending in untracked).

## Open questions / blockers

- **None blocking.** Phase 8 is closed. The audit doc is closed.
  Multi-teacher prod-validated. CI green. Tests at all-day high.

- **3 Matts caveat:** All 3 NIS personas have `display_name = null`
  and `name = "Matt"`. Phase 8-4 path 2 disambiguation works
  correctly under the hood (initials populate, color hash takes
  initials as input) but renders identically across personas
  (`Grade 10 · M.` with same chip color) because the inputs
  collide. Not a Phase 8 bug — it's a function of having 3 accounts
  named Matt at one school. Real NIS pilot with 2+ distinct teacher
  names will surface full disambiguation. Access Model v2 spec
  addresses this identity cleanup.

- **Legacy `machine_profiles.teacher_id` column** still present
  after Phase 8-3 (orchestration writes both `teacher_id` AND
  `created_by_teacher_id`, reads only `created_by_teacher_id`).
  Future cleanup migration drops the column. Not urgent.

- **Phase 8 brief 6 open questions** — implicitly answered by the
  shipped 8-1/8-2/8-3/8-4 work. Q1 (entity naming = labs school-scoped),
  Q3 (cross-teacher visibility = flat), Q4 (who creates labs = any
  teacher), Q2 (default-location = per-class via classes.default_lab_id
  + per-teacher via teachers.default_lab_id), Q5 (student-side =
  groupMachinesByLab unfiltered), Q6 (click vs drag = click). Brief
  itself can be marked superseded by the actually-shipped work in
  the next saveme.
