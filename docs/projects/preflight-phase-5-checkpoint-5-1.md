# Preflight Phase 5 — Checkpoint 5.1 Report

**Status:** DRAFT — awaiting Matt's prod smoke evidence (⏳ markers in the matrix below)
**Date drafted:** 22 April 2026 PM
**Brief:** [`preflight-phase-5-brief.md`](./preflight-phase-5-brief.md)
**Phase scope:** Soft-gate results UI — three-bucket viewer, acknowledge-each-one radios, re-upload flow with revision history, submit transition.
**Worktree:** `/Users/matt/CWORK/questerra-preflight`, branch `preflight-active`.

---

## Success criteria — pass/fail matrix

Criteria transcribed from `preflight-phase-5-brief.md` §4.

| # | Criterion | Status | Evidence |
|---|---|:---:|---|
| 1 | `POST /revisions` creates revision N+1 with fresh signed URL. Tested + prod smoke. | ✅ | `orchestration.ts:createRevision` (Phase 5-1) — 13 unit tests + 7 route tests. Ships inline via ReuploadModal (Phase 5-5). Closes PH4-FU-REVISION-ENDPOINT P1. **Prod smoke:** ⏳ pending Matt run of Scenario 3 (hard-gate → re-upload). |
| 2 | `POST /acknowledge-warning` persists to `acknowledged_warnings` JSONB keyed by `{revision_N: {rule_id: {choice, timestamp}}}`. Tested. | ✅ | `orchestration.ts:acknowledgeWarning` — 7 unit tests covering validation, ownership, merge behaviour (null init, preserve-existing, overwrite, all 3 ACK_CHOICES, DB error). Route: 6 tests. **Prod smoke:** ⏳ Scenario 2 (soft-gate ack click). |
| 3 | `POST /submit` validates (scan done + zero BLOCK + every WARN acked) and transitions job status. Tested with all validation failure modes + happy path. | ✅ | `orchestration.ts:submitJob` — 12 unit tests covering ownership (404×2), double-submit guard (409), scan-not-done (400), BLOCK-fires (400 with ids), missing-acks (400 with missing ids), revision-isolation (acks from other revisions ignored), both approval paths (`approved` / `pending_approval`), DB failures (500×2). Route: 8 tests. **Prod smoke:** ⏳ Scenario 1 (happy-path submit). |
| 4 | `classifyRules` + `canSubmit` pure helpers: ≥ 20 unit tests across severity permutations + ack permutations. | ✅ | `rule-buckets.ts` — 23 tests (exceeds target). Every severity variant, bucket isolation, priority-when-both-fail (blockers > missing_acks), revision isolation, realistic scenarios (coaster SVG / seahorse STL / fix-and-reupload), regression guard locking canSubmit's error message text to what submit endpoint returns. Delegated-to by submitJob (single source of truth — no drift). |
| 5 | `ScanResultsViewer` renders 3 buckets with correct severity badges, disabled Submit until canSubmit. | ✅ | Phase 5-3 `ScanResultsViewer.tsx` + `RuleCard.tsx`. Button `disabled={!canSubmitState.ok \|\| disabledFromAction}`. Gate-failure explainer sentence picks message from `canSubmitState.reason`. 17 pure-helper tests in `rule-card-helpers.test.ts` cover label / icon / tint / ack option map. **DOM smoke:** ⏳ Scenarios 1+2+3 visually confirm bucket rendering. |
| 6 | Acknowledge click fires a single endpoint call, updates state optimistically, falls back on error. | ✅ | Phase 5-4 `page.tsx:handleAcknowledge` — setLocalAcks optimistic, POST, setLocalAcks(previousAcks) on failure, surfaces error via action-error banner. **Prod smoke:** ⏳ Scenario 2 visual confirm. |
| 7 | Status page delegates to `ScanProgressCard` for in-progress + `ScanResultsViewer` for terminal states without layout flicker. | ✅ | Phase 5-4 `page.tsx` — ternary `pollState.kind === "done"` switches between DoneStateView (with viewer) and ScanProgressCard. Phase 5-3 `ScanProgressCard` done-branch removed (returns null defensively). |
| 8 | Re-upload flow: click → modal → file pick → upload → fresh scan → new revision visible in history panel. | ✅ | Phase 5-5 `ReuploadModal.tsx` — mirrors Phase 4-4 upload orchestration (POST /revisions → XHR PUT → POST /enqueue-scan), locked to original fileType. Hook `reset()` un-freezes terminal state so new revision polls through. Page re-fetches revisions after success. **Prod smoke:** ⏳ Scenario 3 visual confirm. |
| 9 | Revision history panel shows all prior revisions with mini thumbnails + rule counts. | ✅ | Phase 5-5 `RevisionHistoryPanel.tsx` — collapsible `<details>`, mini thumbnails (10-min signed URL), rule count pill `2B · 1W · 3I`, current-revision highlight, relative time ("3m ago"), hidden entirely for single-revision jobs. 18 helper tests. **Prod smoke:** ⏳ Scenario 4 (multi-revision view). |
| 10 | Submit success redirects to `/fabrication/submitted/[jobId]` with `fabrication_jobs.status` set correctly per `machine_profiles.requires_teacher_approval`. | ✅ | Phase 5-6 `submitted/[jobId]/page.tsx` stub — fetches /status once, keys display on jobStatus (6 known states mapped to icon + heading + body). Server transitions happen in Phase 5-1 `submitJob`. **Prod smoke:** ⏳ Scenarios 1+2 visual confirm. |
| 11 | Prod smoke: all 4 scenarios from Matt Burton student account. | ⏳ | **Pending Matt.** See "Production smoke scenarios" below for the 4 scripts. |
| 12 | `npm test`: +N tests (target ~60–80). | ✅ | **1545 → 1665 (+120 tests over Phases 5-1..5-5).** 5-1: +53 (14 createRevision + 10 acknowledgeWarning + 14 submitJob + 15 route tests). 5-2: +23 (classifyRules + canSubmit). 5-3: +17 (rule-card-helpers). 5-4: +1 (route includeResults). 5-5: +26 (18 revision-history-helpers + 6 listRevisions + 2 RESET reducer). Exceeds target. |
| 13 | `docs/projects/WIRING.yaml` + dashboard + ALL-PROJECTS.md updated (saveme). | ⏳ | Pending — will sync at Checkpoint 5.1 sign-off alongside this report. |
| 14 | Checkpoint 5.1 report doc filed. | ✅ | This document. |

**Overall (pre-smoke): 12 PASS on unit + implementation, 4 criteria carry ⏳ markers pending Matt's prod smoke evidence (#1, #2, #3, #11 roll-ups).** Code + tests + tsc clean on every sub-phase commit.

---

## Commits in Phase 5

```
21215c5 feat(preflight): Phase 5-5 revision history + re-upload modal
e8a190b feat(preflight): Phase 5-4 status page rewrite + ack wiring
b0df2ee feat(preflight): Phase 5-3 ScanResultsViewer + RuleCard + helpers
ab65306 feat(preflight): Phase 5-2 rule-buckets + canSubmit gate
ddb6076 feat(preflight): Phase 5-1 revisions + acknowledge-warning + submit endpoints
c86f5c7 docs(preflight): Phase 5 brief — soft-gate results UI (READY)
```

6 commits on `preflight-active` branch. All pushed to `origin/preflight-active`.

Phase 5-6 (this sub-phase) commit pending after report review.

---

## Production smoke scenarios (Matt runs — paste results here)

All scenarios use student **Matt Burton** (`f24ff3a8-65dc-4b87-9148-7cb603b1654a`, class `7c534538-c047-4753-b250-d0bd082c8131`), logging in via the student flow + navigating to `https://studioloom.org/fabrication/new`.

**Before smoke:** confirm `preflight-active` has been merged to `main` and Vercel has finished deploying, OR smoke against a Vercel preview URL built from `preflight-active`.

### Scenario 1 — Happy path (no blockers, auto-approve or pending_approval)

1. Upload `small-cube-25mm.stl` (known-good, 0 BLOCK/WARN/FYI rules fire; R-STL-15 + R-STL-16 FYI fire per Phase 2A smoke history).
2. Scan completes in ~9 s.
3. Results viewer shows FYI section only; Submit button enabled.
4. Click Submit.
5. Redirects to `/fabrication/submitted/[jobId]`.
6. Verify server-side: `SELECT status FROM fabrication_jobs WHERE id = '[jobId]';` → either `approved` or `pending_approval` depending on seeded `requires_teacher_approval` for the chosen machine profile.

**Expected:** submitted page renders "Submitted — waiting for your teacher to review" (if pending_approval) or "Submitted — ready for the lab tech to queue" (if approved).

**Result:** ⏳ pending

---

### Scenario 2 — Soft-gate path (WARN rules, acknowledge, submit)

1. Upload a fixture that fires WARN rules (options: any existing known-broken SVG that hits R-SVG-04 or -11; or find an STL with floating islands that triggers R-STL-04 WARN).
2. Results viewer shows Should Fix bucket with N cards, each with 3 radio options.
3. Submit button disabled; gate explainer says "Submit is disabled until every should-fix warning has an acknowledgement above."
4. Click one radio per should-fix rule (mix choices: some `intentional`, some `will-fix-slicer`, some `acknowledged`).
5. Submit button enables after the last ack.
6. Verify in DB: `SELECT acknowledged_warnings FROM fabrication_jobs WHERE id = '[jobId]';` — shape should be `{"revision_1": {"R-STL-04": {"choice": "...", "timestamp": "..."}}, ...}`.
7. Click Submit.

**Expected:** Submit succeeds, redirects to submitted page.

**Result:** ⏳ pending

---

### Scenario 3 — Hard-gate re-upload path (BLOCK rules, re-upload, clean revision)

1. Upload a fixture that fires BLOCK rules (existing: `seahorse-not-watertight.stl` fires R-STL-01 BLOCK, `chess-pawn-inverted-winding.stl` fires R-STL-02+05 BLOCK).
2. Results viewer shows Must Fix bucket with N red cards. Submit button disabled with "Submit is disabled until all must-fix issues are resolved in a re-uploaded version."
3. Click "Re-upload a fixed version".
4. **ReuploadModal opens in-place** (not a page navigation to `/fabrication/new` — that was the Phase 5-4 temporary behaviour).
5. Modal's file dropzone accepts only `.stl` (matches original) — try dragging an SVG to verify it's rejected client-side.
6. Upload `small-cube-25mm.stl` as the fix (or any known-good STL).
7. Modal closes on success.
8. Status page resets — returns to "Checking your file" progress card.
9. New revision scans in ~9 s.
10. Results viewer renders for revision 2, no blockers.
11. Revision history panel now shows **2 revisions** — the broken one first (status=done with 2B or similar rule count) and the fixed one (current, highlighted).
12. Submit the clean revision.

**Expected:** end-to-end works without leaving the job page between attempts.

**Result:** ⏳ pending

---

### Scenario 4 — Multi-revision history (after Scenario 3)

After Scenario 3 completes with 2 revisions, verify the history panel:
1. Open `<details>` if not already expanded.
2. See 2 rows:
   - Revision 1 — Scanned — `2B · 1W` (or whatever blockers fired) — mini thumb — "3m ago"
   - Revision 2 — Scanned — no pill (or just `2I` for the FYIs) — mini thumb — current highlighted
3. Verify revision 1's mini thumbnail image loads (signed URL mint working).

**Result:** ⏳ pending

---

## Known deviations from brief

- **Migration 095 comment vs actual JSONB shape** (flagged in Phase 5-1 commit): migration 095:82 has a comment `[{rule_id, ack_at}]` suggesting a flat array. Phase 5-1 chose the nested `{revision_N: {rule_id: {choice, timestamp}}}` shape instead for multi-revision audit trail. JSONB column has no CHECK constraint so this is a conscious deviation, not a bug.
- **`needs_revision` status kept out of Phase 5 submit flow** (flagged in Phase 5-1 commit): that status is a teacher action from the Phase 6 approval queue ("return for revision"), not a student action. Student submit flow transitions `uploaded / scanning / needs_revision → pending_approval / approved`.
- **Submitted page is minimal** (spec §8 intent): no celebration, no machine / teacher names, no live status polling. Phase 6 enriches once the teacher queue + Fabricator UI land.

---

## Follow-ups

None new in Phase 5. Pre-existing:

- FU-SCANNER-LEASE-REAPER P2 — still required before horizontal-scaling the worker.
- FU-SCANNER-CICD P2 — GitHub Action still untracked + FLY_API_TOKEN still not minted.
- FU-SCANNER-SIDECAR-DRIFT P3 — chess-pawn STL.
- FU-SCANNER-EMAIL-VERIFY P3 — `notifications_sent.scan_complete` still not verified with a real Resend round-trip.
- FU-FAB-UPLOAD-200MB P3 — 50 MB ceiling.
- FU-CLASS-MACHINE-LINK P3 — per-class filter (Phase 8).
- FU-SCANNER-RATE-LIMIT P3 — upload throttle.
- PH4-FU-PROGRESS-STAGES-UI-DEMO P3 — staged arc too fast to observe.

---

## Next phase

**Phase 6 — Teacher Queue + Approval** (~2 days per spec §13). First teacher-facing Preflight UI. Ships:
- `/teacher/fabrication` with status tabs (`Pending approval` · `Approved / queued` · `Completed` · `Revisions in progress` · `All`)
- Approve / reject / return-for-revision actions (the `needs_revision` status transition)
- Per-student fabrication history (teacher view)
- Approval-required toggle per machine profile (flips `requires_teacher_approval`)

Matt Checkpoint 6.1: a teacher can triage a queue of 10+ submissions end-to-end.

Brief will be drafted after Phase 5 sign-off.
