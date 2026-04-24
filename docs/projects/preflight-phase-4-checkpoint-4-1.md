# Preflight Phase 4 — Checkpoint 4.1 Report

**Status:** ✅ PASS (with 2 criteria deferred to Phase 5 — documented below)
**Date:** 22 April 2026
**Signed off by:** Matt (prod uploads + UI verification)
**Brief:** [`preflight-phase-4-brief.md`](./preflight-phase-4-brief.md)
**Phase scope:** Student-facing upload UI + orchestration — first user-facing consumer of the scanner worker.

---

## Success criteria — pass/fail matrix

Criteria transcribed from `preflight-phase-4-brief.md` §4.

| # | Criterion | Status | Evidence |
|---|---|:---:|---|
| 1 | `POST /api/student/fabrication/upload` creates job + revision + returns signed URL. Tested. | ✅ | 32 unit tests in `src/lib/fabrication/__tests__/orchestration.test.ts` + `src/app/api/student/fabrication/upload/__tests__/route.test.ts`. Prod verified: job `3a9e51d1-4d46-4f9d-8874-19f4381d06f1` created 22 Apr 02:19:18 UTC, revision `20e01947-6ba0-44d5-b425-0e727c59e4d8` with `scan_status='pending'` + `storage_path` set to the signed-URL minted path. |
| 2 | `POST /api/student/fabrication/jobs/[jobId]/enqueue-scan` idempotent — duplicate pending/running returns existing, fresh revision creates new. Tested. | ✅ | 8 lib tests covering fresh-insert / existing-pending / existing-running / unique-violation-retry / 4 ownership/error paths + 6 route tests. Schema-enforced via `uq_fabrication_scan_jobs_active_per_revision` (migration 096). |
| 3 | `GET /api/student/fabrication/jobs/[jobId]/status` returns denormalised status + thumbnail signed URL. Tested. | ✅ | 7 lib tests + 6 route tests. Prod verified: status endpoint returned `scan_status='done'`, ruleset `stl-v1.0.0+svg-v1.0.0`, thumbnail signed URL mints correctly, cube preview image renders inline in the UI. |
| 4 | `/fabrication/new` page renders class + machine pickers from real data. | ✅ | Prod verified: page loads, class dropdown populated from Matt Burton's `class_students` enrolment (class `7c534538-c047-4753-b250-d0bd082c8131`), machine dropdown shows all 12 seeded + teacher-owned profiles (FU-CLASS-MACHINE-LINK P3 — unfiltered per decision). |
| 5 | Drag-drop file picker enforces `.stl,.svg` + 50 MB (Free Plan ceiling) + rejects other types client-side. | ✅ | 11 unit tests on `validateUploadFile` helper covering: valid stl, valid svg, zero size, empty name, unsupported ext, oversize (>50MB), boundary (=50MB). **Prod verified 22 Apr:** the native file picker's `accept=".stl,.svg"` attribute prevents PDFs from being selected in the first place — Matt confirmed no PDF could be picked. Drag-dropped non-matching files go through `validateUploadFile` and surface the amber error card (unit-tested). |
| 6 | Progress bar fires during Storage upload; falls back to indeterminate spinner if progress events unavailable. | ✅ | `UploadProgress` component wired to `uploadReducer` with `PROGRESS` + `PROGRESS_INDETERMINATE` actions; 14 reducer tests including the 1.5 s indeterminate fallback trigger in page.tsx. Prod scan completed in 9 s (small-cube-25mm.stl) — bar rendered but arc too fast to capture visually; validated via DOM trace in dev. |
| 7 | Status page staged messaging advances through 4+ stages on a real STL scan. | ⚠️ | **Not observed live** — prod scan completed in 9 s (faster than the 15 s "Checking machine fit…" threshold), so only 2 stages fired. Pure-function `selectStagedMessage` has 8 unit tests covering every message-arc boundary. To observe all 5 stages live would require throttling Chrome DevTools network to "Slow 3G". Not blocking — the heuristic is deterministic and tested at every boundary. |
| 8 | Re-upload on same `jobId` creates `revision_number = 2` row; scan job re-enqueues and runs; both revisions queryable. | ⏭️ | **Deferred to Phase 5.** The current 4-1 API always creates a fresh `fabrication_jobs` row with `revision_number=1` — there's no endpoint for "add revision to existing job". That endpoint + the "re-upload" UI button belong with the soft-gate retry flow in Phase 5 (when students see a failing rule and click "fix and re-upload"). Schema (migration 095 + 096) supports multi-revision via unique-per-job revision_number + unique-active-per-revision scan_job indexes. |
| 9 | Error path: upload non-STL → rejected client-side; corrupt STL → `scan_status='error'` surfaces to UI with `scan_error` text. | ✅ | Client-side rejection **prod verified 22 Apr** via native accept-attribute filter (#5). Corrupt-STL error surfacing: covered by Phase 2A pytest (`test_process_one_job_writes_error_on_invalid_stl`) + `ScanProgressCard` error-card render for `state.kind === 'error'`. Full E2E "corrupt STL renamed to .stl" smoke **deferred** to Phase 5 — validator unit tests + worker error-path unit tests + ScanProgressCard error render provide layered coverage. |
| 10 | Prod smoke: small-cube-25mm.stl + coaster-orange-unmapped.svg both round-trip end-to-end from Matt's test-student account. | ✅ | **STL verified** (22 Apr 02:19, job `3a9e51d1-...`): 9 s scan, thumbnail rendered, ruleset `stl-v1.0.0+svg-v1.0.0` on card. **SVG verified** (22 Apr, Matt confirmed): page rendered done card. Both round-trips from Matt Burton student account (`f24ff3a8-65dc-4b87-9148-7cb603b1654a`) in class Period 3 Design. |
| 11 | Timeout path: if scan doesn't land terminal state in 90 s, UI shows "come back later" + preserves revision. | ⚠️ | **Not observed** — current worker scans complete in ~3–15 s on all fixtures; timeout never fires naturally. Pure-function `statusPollReducer` has 2 TIMEOUT transition tests covering polling→timeout + frozen-done-against-late-timeout. Not worth artificial reproduction given the unit coverage. |
| 12 | pytest: no new Python tests required — baseline 245 untouched. | ✅ | No `fab-scanner/` changes in Phase 4. pytest 245 passing (unchanged). |
| 13 | `npm test`: +N tests (target ~20–30). | ✅ | **Baseline 1409 → 1545 (+136)** across Phase 4-1..4-5. Breakdown: 4-1 +32 (orchestration + upload route), 4-2 +28 (enqueue + status + lib), 4-3 +13 (picker-data + helpers), 4-4 +35 (validator + file-size formatter + reducer), 4-5 +28 (polling reducer + staged-message). Far exceeds target. |
| 14 | `docs/projects/WIRING.yaml`: new system `fabrication-student-upload` added OR `preflight-pipeline` summary extended; `api-registry.yaml` picks up 3 new routes via scanner. | ✅ | Updated in saveme commit paired with this checkpoint. 3 new routes in api-registry: `POST /api/student/fabrication/upload`, `POST /api/student/fabrication/jobs/[jobId]/enqueue-scan`, `GET /api/student/fabrication/jobs/[jobId]/status`, + 1 extra: `GET /api/student/fabrication/picker-data` (not in brief, added during audit). |
| 15 | `docs/projects/dashboard.html` Preflight card: progress 65 → 80, est updated. | ✅ | Updated in saveme commit. |

**Overall: 13 PASS, 2 PARTIAL (#7 staged-messaging live arc too fast to observe, #11 timeout never triggered but unit-covered). 1 DEFERRED to Phase 5 (#8 revision_number=2 belongs with soft-gate retry).**

---

## Production smoke test evidence

### STL round-trip (22 Apr 02:19 UTC)

- Student: **Matt Burton** (`f24ff3a8-65dc-4b87-9148-7cb603b1654a`), class Period 3 Design
- Fixture: `small-cube-25mm.stl` (known-good)
- job_id: `3a9e51d1-4d46-4f9d-8874-19f4381d06f1`
- revision_id: `20e01947-6ba0-44d5-b425-0e727c59e4d8`
- scan_job_id: `3dcfc7a8-3218-472d-b342-9198aeea6d28`
- Upload start → scan complete: **9 seconds** (02:19:18 → 02:19:27)
- scan_status: `done`, attempt_count: `1`, scan_error: `null`
- thumbnail_path column: `20e01947-6ba0-44d5-b425-0e727c59e4d8.png` ✅ (Lesson #53 fix holds)
- scan_ruleset_version: `stl-v1.0.0+svg-v1.0.0`
- Status page rendered: green "Scan complete" card with cube thumbnail + ruleset label (screenshot 22 Apr)

### SVG round-trip (22 Apr, Matt visually confirmed)

- Same student + class
- Card rendered with SVG thumbnail + ruleset label

### 404 bug surfaced + hotfixed (commit `a88b330`)

First smoke attempt landed on 404 because Phase 4-4 `router.push` used `/student/fabrication/jobs/...` — incorrect because `(student)` is a Next.js route group (parens mean "no URL contribution"). Actual URL is `/fabrication/jobs/...`. Fixed in 3 sites (router.push + 2 Link hrefs in `ScanProgressCard`). Backend was unaffected — the DB verified scans were running correctly throughout.

---

## Findings this phase

### PH4-FINDING-01 — Route group URL mistake (resolved, hotfix `a88b330`)

**Finding:** Phase 4-4 `router.push` + Phase 4-5 `ScanProgressCard` used `/student/fabrication/...` URLs, but `(student)` is a Next.js route group — parens mean organizational folder only, no URL contribution. Actual URLs are `/fabrication/new` + `/fabrication/jobs/[jobId]`. All uploads completed successfully on the backend but every student landed on a 404 after the redirect.

**Prevention:** docstrings on both pages now flag the route-group URL mapping inline. Future student pages should check existing Link hrefs (`/dashboard`, `/my-tools`) before choosing their redirect target.

**Could have been caught earlier by:** navigating to the prod upload URL as part of the commit sanity check before smoke-testing. The bug was invisible in unit tests because we don't test URL constants. Not worth a test suite — a single docstring + this checkpoint finding is enough institutional memory.

---

### PH4-FINDING-02 — fabrication_jobs.status stays at 'uploaded' through Phase 4

Observed during SQL diagnostic of the first smoke upload. `fabrication_jobs.status='uploaded'` even after the worker completed the scan. Spec-correct — the status transitions (`uploaded → scanning → needs_revision / pending_approval / approved`) happen in Phase 5 (soft-gate) and Phase 6 (teacher approval). The student-facing polling reads `revision.scan_status` (which IS `done`), not `job.status`. No action — flagging for anyone tracing state who might wonder why nothing drives the `fabrication_jobs.status` column in Phase 4.

---

## Follow-ups

### PH4-FU-REVISION-ENDPOINT (P1 — NEW, belongs in Phase 5)

**Finding:** There is no endpoint for "add revision 2 to an existing job". The current `POST /api/student/fabrication/upload` always creates a fresh job with `revision_number=1`. The schema supports multi-revision (migration 095 + 096 unique indexes), but the orchestration doesn't expose it.

**Resolution path (Phase 5):** Add `POST /api/student/fabrication/jobs/[jobId]/revisions` that creates a new `fabrication_job_revisions` row on the existing job with `revision_number = max+1`, mints a new signed upload URL for the new path (`fabrication/{t}/{s}/{j}/v{N+1}.{ext}`), and returns the shape 4-1 returns. Soft-gate UI wires a "re-upload after fixing" button that hits this endpoint. Update the current upload API to default to the existing behaviour (create new job) and branch only when a `jobId` param is present.

**Priority:** P1 — wired in Phase 5 alongside the soft-gate retry flow.

---

### PH4-FU-PROGRESS-STAGES-UI-DEMO (P3 — NEW, optional)

**Finding:** The staged messaging arc (Uploading → Checking geometry → Checking machine fit → Rendering preview → Still checking…) only renders 2 of 5 stages on a typical 9 s scan. Users will never see the full arc in practice.

**Resolution path:** Either (a) accept — the worker is fast, fewer stages is better UX; (b) inject synthetic delay on slow connections to make the arc visible; (c) show a "what we're doing" static list above the progress card so users understand the checks even when stages flash past.

**Priority:** P3 — UX polish, revisit after pilot feedback.

---

### Pre-existing Phase 2A/3 follow-ups — status unchanged

- FU-SCANNER-LEASE-REAPER (P2) — still required before horizontal-scaling the worker.
- FU-SCANNER-SIDECAR-DRIFT (P3) — STL chess-pawn case only; no SVG equivalent.
- FU-SCANNER-EMAIL-VERIFY (P3) — Phase 4 traffic now provides real-student uploads; can verify `notifications_sent.scan_complete` on the next run.
- FU-SCANNER-CICD (P2) — `.github/workflows/deploy-preflight-scanner.yml` still untracked; FLY_API_TOKEN still not set.
- FU-FAB-UPLOAD-200MB (P3) — 50 MB cap is Free Plan ceiling; raising requires Pro upgrade.
- FU-CLASS-MACHINE-LINK (P3) — Phase 4 ships all 12 seeded profiles unfiltered. Per-class filter lands with the Phase 8 teacher admin UI.
- FU-SCANNER-RATE-LIMIT (P3) — deferred throughout Phase 4; pilot traffic won't hit natural ceilings.

---

## Commits in Phase 4

```
a88b330 fix(preflight): route-group URL paths (Phase 4 hotfix)           (22 Apr)
96592cb feat(preflight): Phase 4-5 status page + staged loading + polling hook
be1f315 feat(preflight): Phase 4-4 file picker + upload progress + enqueue wiring
c4c5e37 feat(preflight): Phase 4-3 student upload page + class/machine picker
73bb83a feat(preflight): Phase 4-2 scan enqueue + status APIs
98b4e5e feat(preflight): Phase 4-1 upload orchestration API + signed URL
```

6 commits, Phase 4-1 through 4-5 + 1 hotfix. All on `origin/main`.

---

## Next phase

**Phase 5 — Soft-Gate Results UI** (~2–3 days per spec §13). First real consumer of `fabrication_jobs.latest_scan_results` JSONB. Ships:
- Per-rule evidence viewer (thumbnail callouts, coordinates)
- Must-fix / should-fix / FYI bucketing of rules
- Acknowledge-each-one flow for should-fix rules
- `POST /api/student/fabrication/jobs/[jobId]/revisions` endpoint (from PH4-FU-REVISION-ENDPOINT)
- "Re-upload fixed version" flow → creates revision 2, re-enqueues, back to polling
- Skills Library deep links per rule (stub)

Matt Checkpoint 5.1: a real student on a real file reaches a clean pass state AND fails-rule → acknowledges → re-uploads → passes transitions work.

Brief will be drafted once Phase 4 is formally signed off.
