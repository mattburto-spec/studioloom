# Handoff — preflight-active

**Last session ended:** 2026-04-28T06:58:00Z
**Worktree:** `/Users/matt/CWORK/questerra-preflight`
**HEAD:** `62ec699` "docs(preflight): saveme — Phase 8-1 + audit Round 1 + Phase 8-2 + smoke PASS"

## What just happened

- Full day of Preflight work driven by Matt's smoke of yesterday's
  school-scoped lab ownership migration. Hit 3 prod bugs in sequence
  (Path B `teacher_id`, PostgREST FK, fileType/category gate) before
  pivoting into a comprehensive 12-finding audit
  (`docs/projects/preflight-audit-28-apr.md`).
- **Round 1 audit fixes shipped** — HIGH-1 (student picker
  server-side school filter, two-query split), HIGH-2/3/4
  (`fabricatorSchoolContext` helper sweep across 6 fab-orchestration
  callsites), MED-6 (migration 120 fresh-install ordering guards).
- **Phase 8-2 lab orchestration + API rebuild SHIPPED** — 3
  commits: `lab-orchestration.ts` full rewrite under school-scoped
  contract (new `LabRow` shape, `loadTeacherSchoolId` +
  `loadSchoolOwnedLab` helpers, `fromLabId/toLabId` rename,
  cross-school → 404, no `is_default`); 4 route sweeps; 26-test
  rewrite + route test updates.
- **Two post-merge hotfixes** — UI tsc errors (CI strict typecheck
  caught 6 stale `isDefault` references in `LabSetupClient.tsx` +
  `MachineEditModal.tsx` + `lab-setup-helpers.ts` + 1 test fixture);
  picker-data PostgREST embed alias collision (duplicate
  `fabrication_labs` embed via same `lab_id` FK, fixed by giving
  each query exactly one embed).
- **Full Preflight E2E smoke PASS in prod** (Matt): student upload
  → scanner → teacher queue → fab pickup → complete.
- **saveme done** — audit doc status table updated, ALL-PROJECTS,
  CLAUDE.md, dashboard, changelog, doc-manifest, master CLAUDE.md
  all in sync. Registry scans rerun. RLS coverage 89→94 tables
  (tracks Phase 8-1).

## State of working tree

- Branch `preflight-active` clean + in sync with origin
  (`@{u}..HEAD` = 0).
- Top-of-main `dafa25d` (= preflight-active hotfix merge from
  earlier; saveme commit `62ec699` lives on preflight-active and
  will fold into main on the next merge).
- Untracked: `Systems/Ingestion/ingestion-pipeline-summary.md`
  has uncommitted modifications from a prior session (a doc note
  about Pipeline 1 role change). Out of scope for Preflight; leave
  alone.
- Untracked: `.github/workflows/deploy-preflight-scanner.yml` from
  FU-SCANNER-CICD work, not yet committed. Out of scope.
- Tests: 2208 pass / 9 skipped. tsc strict clean. CI green.

## Next steps

- [ ] **Phase 8-3 — machine-orchestration rebuild** (pre-audited,
      ~2-3h). Same playbook as 8-2.
  - Audited surface (from audit doc MED-2):
    `src/lib/fabrication/machine-orchestration.ts` has ~8 stale
    `teacher_id` sites including a `select("id, teacher_id")` from
    `fabrication_labs` at line 374-387 (the `teacher_id` column
    no longer exists on labs) — that path 500s if reached.
  - Routes to sweep:
    `src/app/api/teacher/machine-profiles/route.ts`,
    `src/app/api/teacher/machine-profiles/[id]/route.ts`.
  - **MED-3 fold-in:**
    `src/app/api/teacher/fabrication/classes/[classId]/default-lab/route.ts`
    still queries `fabrication_labs.teacher_id` (lines 79, 88, 96,
    105, 115). UI trigger was removed in Phase 8.1d-5 so it's
    dormant, but the route is still wired in
    `AssignClassesToLabModal.tsx:133`. Either delete the route +
    modal entirely, or rewrite under school-scoped contract.
    Recommend rewrite — keep as a forward-compat seam for the
    eventual "set default lab per class" UI on the class settings
    page.
  - **MED-5 design call:** machine_profiles.teacher_id is still
    NOT NULL. Three options in audit doc; recommend **Option 2**
    — keep `teacher_id` as audit-only (don't rename), stop using
    it for access control, scope via `lab_id → fabrication_labs.school_id`.
    Mirror the lab pattern (`createdByTeacherId` audit-only).
    No migration needed; pure code change.
  - Tests: extend the same mock query-builder pattern from
    `lab-orchestration.test.ts` (`.eq()` vs `.in()` distinguishing,
    teachers/labs `maybeSingle()`, thenable list queries).
  - Sweep LOW-2 comment drift in `machine-orchestration.ts` +
    `fab-orchestration.ts` headers + design notes while in there.

- [ ] **Phase 8-4 — full LabSetupClient + components rebuild**
      (~half-day, can wait for fresh session). The page works now
      after the Phase 8-2 hotfix but is patchwork — bulk approval
      card, descriptions, all the UX from 8.1d still in there.
      Phase 8-4 is the visual rebuild planned in Phase 8 brief.

- [ ] **MED-3 follow-through** — once Phase 8-3 ships and `classes.default_lab_id`
      management UI lands somewhere (probably class settings page,
      not the lab admin), revisit whether to ship a small picker
      surface or kill the route+modal entirely.

- [ ] **Optional pre-pilot housekeeping:**
  - `RUN_E2E` env var flagged missing from `docs/feature-flags.yaml`
    (`docs/scanner-reports/feature-flags.json` drift). Pre-existing
    tap-a-word work — register or document as test-only.
  - PH9-FU-SCANNER-OOM-T1..T5 longevity plan (T1-T3 pre-pilot).

## Open questions / blockers

- **MED-5 design call** — should be made at Phase 8-3 kickoff.
  Recommend Option 2 (audit-only teacher_id, scope via lab.school_id),
  but Matt should sign off before the rewrite starts. The other
  options are: Option 1 (migrate machines fully school-scoped,
  invasive) and Option 3 (status quo — only works for single-teacher
  schools, breaks under flat membership).

- **Phase 8 brief 6 open questions** — still pending. The 8-2 +
  8-3 path is implicitly answering Q1 (entity naming — labs are
  school-scoped) and Q3 (cross-teacher visibility — flat). Q4 (who
  creates labs — any teacher), Q5 (student-side impact — already
  filtered via class.default_lab_id), and Q6 (click vs drag — Phase
  8-4 decision) remain. Q2 (default-location strategy) is partly
  resolved by `classes.default_lab_id` + `teachers.default_lab_id`.

- **Smoke coverage gap** — Matt's E2E smoke today validated upload
  → scan → queue → pickup → complete, but didn't exercise the lab
  admin page CRUD operations under multi-teacher conditions
  (because NIS is single-teacher). Phase 8-3 + 8-4 should add
  fixture data with multiple teachers in the same school to test
  flat-membership semantics (any teacher can edit any lab/machine
  at the school).
