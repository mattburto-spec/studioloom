# Handoff — preflight-active

**Last session ended:** 2026-04-28T08:30:00Z
**Worktree:** `/Users/matt/CWORK/questerra-preflight`
**HEAD:** `bff9724` "Merge remote-tracking branch 'origin/main' into preflight-active"
**Top of main (post Phase 8-3 merge):** `5a75ec8`

## What just happened

- **Phase 8-3 SHIPPED + multi-teacher validated in prod.**
  Migration `20260428074205_machine_profiles_school_scoped`
  applied step-by-step (4 verification queries passed). 5 commits
  through orchestration rewrite + MED-3 default-lab fold-in + tests.
  All 4 audit-doc-driven Phase 8-3 findings closed:
  MED-2, MED-3, MED-5, plus 36 new orchestration tests.
- **Multi-teacher smoke PASSED** across 3 NIS personas
  (`mattburto@gmail.com`, `hello@loominary.org`,
  `mattburton@nanjing-school.com`) all at same school_id
  `636ff4fc-4413-4a8e-a3cd-c6f1e17bd5a1`. Visibility +
  edit + soft-delete + bulk-approval all confirmed cross-teacher.
  This is the strongest possible proof of flat school membership
  for machines. Phase 8-3 is the most thoroughly validated Preflight
  phase shipped to date.
- **Full audit-doc resolution:** 10 of 12 findings ✅ FIXED. Only
  MED-4 (UI rebuild → Phase 8-4) and LOW-2 (comment drift) remain,
  both PARTIAL and non-blocking.
- **Saveme done earlier this session** (commit `62ec699`); Phase
  8-3 work happened after, audit doc updated post-validation.
  Changelog already has the 28 Apr entry covering Phase 8-1 through
  Phase 8-2; Phase 8-3 is captured in commit messages but doesn't
  yet have its own changelog entry — consider folding into next
  saveme.

## State of working tree

- Branch `preflight-active` clean + in sync with origin
  (after the merge of origin/main resolving the parallel
  grading-session conflicts in `docs/changelog.md` +
  `docs/scanner-reports/*.json`).
- Top-of-main `5a75ec8` (Phase 8-3 merge).
- Tests: **2421 pass / 9 skipped** (was 2210 pre-merge; +211 from
  the parallel grading session's tests landing on main). tsc strict
  clean. CI green on Phase 8-3 merge commit.
- Untracked: `Systems/Ingestion/ingestion-pipeline-summary.md`
  has uncommitted modifications from a prior session (a doc note
  about Pipeline 1 role change). Out of scope; leave alone.
- Untracked: `.github/workflows/deploy-preflight-scanner.yml` from
  FU-SCANNER-CICD work. Out of scope.

## Next steps

- [ ] **Phase 8-4 — full LabSetupClient + components visual rebuild**
      (audit MED-4 PARTIAL → CLOSED). The page works after Phase 8-2
      hotfix but is patchwork: the bulk-approval card is a one-off,
      the lab list is a long stack of expandable cards, no clear
      hierarchy for "default lab per class" management. Phase 8 brief
      describes the visual unified admin: option B click-based over
      drag-drop, ~half a day. Lower priority — page works.

- [ ] **LOW-2 sweep — fab-orchestration + machine-orchestration
      header comment drift** from teacher_id-era. Pure cosmetic, no
      runtime impact. ~30 min cleanup pass while in the
      orchestration files for Phase 8-4.

- [ ] **Optional: drop legacy `machine_profiles.teacher_id` column**
      in a follow-up migration. Phase 8-3 left it as legacy (still
      NOT NULL via mig 093 ownership_check). Future cleanup —
      verify no downstream consumers (RLS on other tables, FK
      references) before dropping.

- [ ] **Pre-pilot housekeeping:**
  - `RUN_E2E` env var flagged missing from `docs/feature-flags.yaml`
    (drift from tap-a-word work). Register or document as test-only.
  - PH9-FU-SCANNER-OOM-T1..T5 longevity plan (T1-T3 pre-pilot).
  - FU-SCANNER-LEASE-REAPER P2 (blocks horizontal scaling).
  - FU-SCANNER-CICD P2 (FLY_API_TOKEN minting + workflow file
    pending in untracked).

- [ ] **Access Model v2** can begin once Phase 8-4 lands +
      dashboard-v2 polish quiescent. Worktree: `questerra-access-v2`
      on branch `access-model-v2`. Spec at
      `docs/projects/access-model-v2.md`.

## Open questions / blockers

- **None blocking.** Phase 8-3 closed every audit finding it scoped.
  The remaining audit items are PARTIAL UI work (Phase 8-4) and
  cosmetic comment drift (LOW-2), neither of which blocks any
  Preflight surface.

- **Legacy column drop deferred:** the audit doc + commit messages
  flag that `machine_profiles.teacher_id` stays as a legacy column
  after Phase 8-3 (orchestration writes both, reads only
  `created_by_teacher_id`). A future cleanup migration drops the
  column, but only after auditing downstream consumers (RLS on
  other tables, FK references). Not urgent — stale columns don't
  hurt runtime.

- **3 personas, 1 school:** the side-finding from the parallel
  grading session noted Matt has 3 teacher accounts all named
  "Matt". Access Model v2 unification will need to handle this
  (already in the v2 spec). Not a Phase 8 concern.
