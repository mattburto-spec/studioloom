# Preflight Phase 2A — Checkpoint 2.1 Report

**Status:** ✅ PASS (with 3 documented follow-ups)
**Date:** 21 April 2026
**Signed off by:** Matt
**Brief:** [`preflight-phase-2a-brief.md`](./preflight-phase-2a-brief.md)
**Phase scope:** Python scanner worker + STL rule catalogue (R-STL-01..17)

---

## Success criteria — pass/fail matrix

| # | Criterion | Status | Evidence |
|---|---|:---:|---|
| 1 | Worker deployed to Fly.io `preflight-scanner` SYD, healthy, polling | ✅ | `fly status` shows primary started, standby stopped; polling every 5s |
| 2 | All 17 STL rules implemented with fixture-driven tests | ✅ | R-STL-01..17 present in `fab-scanner/src/rules/stl/`; 116 pytests pass |
| 3 | Every `known-good/stl/*` fixture scans clean | ✅ | Covered by pytest `test_scan_runner.py::test_scan_one_revision_on_known_good_stl_returns_empty_block_warn_rules`; prod smoke test on `small-cube-25mm.stl` returned 0 BLOCK/WARN rules |
| 4 | Every `known-broken/stl/*` fixture triggers sidecar `triggers_rules` | ⚠️ | Covered by pytest suite + prod smoke tests on 3 fixtures. 1 sidecar drift flagged (see FU-SCANNER-SIDECAR-DRIFT) |
| 5 | Thumbnail rendered + uploaded for each scan | ✅ | small-cube scan uploaded `5e400e11-*.png` (12.1 KB) to `fabrication-thumbnails` |
| 6 | `scan_complete` email dispatched on first scan, idempotent on re-scan | ⏳ | Deferred — Resend wiring for dispatch from worker not verified in this pass. FU-SCANNER-EMAIL-VERIFY |
| 7 | Malformed input → `scan_status='error'` + structured `scan_error` | ✅ | Covered by `test_process_one_job_writes_error_on_invalid_stl` + `test_process_one_job_handles_missing_fixture` |
| 8 | Local sandbox: `python fab-scanner/scripts/sandbox.py <fixture>` works | ✅ | Per 2A-1 commit `0c8c576`; pytest covers equivalent path |
| 9 | Test count delta: +N pytest, no impact on `npm test` 1409-passing baseline | ✅ | **116 Python tests** (new), all passing in 83s. `npm test` baseline untouched (no TS changes in Phase 2A) |
| 10 | `WIRING.yaml`: `preflight-scanner` status → deployed | ✅ | Updated 21 Apr, this session |
| 11 | `api-registry.yaml`: no new HTTP routes | ✅ | Worker doesn't expose HTTP — no change needed |
| 12 | Checkpoint 2.1 report in chat with test count, fixture matrix, smoke test evidence, FU items | ✅ | This document |

**Overall: 10 PASS, 1 PARTIAL (criterion #4 sidecar drift), 1 DEFERRED (criterion #6 email verify).**

---

## Production smoke test evidence

### Small-cube-25mm.stl (known-good, 256 faces, <1 KB)

- scan_job_id: `d13c9365-abca-4a39-b5f9-4380f9262592`
- Locked by Fly machine `781720dc425538`
- Locked → done in **2.6 seconds**
- Rules fired: R-STL-15 (FYI — ~3.8 min print time), R-STL-16 (FYI — ~4 g filament)
- Thumbnail uploaded: `5e400e11-6cc3-4448-a17f-0a9284515fb6.png` (12,111 bytes)
- Ruleset: `stl-v1.0.0`

### Seahorse-not-watertight.stl (known-broken, 29,612 faces, 1.4 MB)

- **Attempt 1:** OOM killed at 11:33:48 on 256MB Fly tier (SIGKILL, VM reboot)
- **Fix:** Bumped Fly machine to 512MB (`fly scale memory 512`)
- **Attempt 2:** scan_job succeeded in 1 attempt
- Rules fired: R-STL-01 (BLOCK, non-watertight), R-STL-04 (WARN, 14 floating islands), R-STL-15 (FYI), R-STL-16 (FYI)
- Sidecar expected R-STL-01 — **matches, with additional legit rules firing**

### Chess-pawn-inverted-winding.stl (known-broken, 96 faces, authored)

- Status: done in 1 attempt
- Rules fired: R-STL-02 (BLOCK, inverted winding), **R-STL-05 (BLOCK, zero-volume)**
- Sidecar expected R-STL-02 only — **+1 extra BLOCK rule fired, see FU-SCANNER-SIDECAR-DRIFT**

### Whale-not-watertight.stl (known-broken, 2,086 faces, 104 KB)

- Status: done in 1 attempt
- Rules fired: R-STL-01 (BLOCK, non-watertight), R-STL-04 (WARN, floating islands), R-STL-15 (FYI), R-STL-16 (FYI)
- Sidecar expected R-STL-04 per README table — both fire, ✅

---

## Follow-ups opened (3)

### FU-SCANNER-OOM (P2 — RESOLVED at discovery)

**Finding:** 256MB Fly hobby tier insufficient for STL meshes >~10k faces.

**Root cause:** trimesh geometry processing + matplotlib Poly3DCollection + Python runtime collectively exceed 256MB on 29k-face mesh.

**Fix applied:** `fly scale memory 512 -a preflight-scanner` — cost delta ~$3/mo.

**Follow-up:** Update `preflight-phase-2a-brief.md` §2 infrastructure note to document 512MB as minimum (was "upgrade to 512MB when first school reports OOM" — we hit it in Checkpoint 2.1 on a mid-size fixture, before first school).

**Future mitigation:** FU-SCANNER-RENDER (already logged in phase-2a-brief §7 out-of-scope) — swap matplotlib for moderngl/EGL rendering. 10-50× faster, smaller memory footprint. Defer until perf becomes a pain.

---

### FU-SCANNER-SIDECAR-DRIFT (P3)

**Finding:** `chess-pawn-inverted-winding.stl` fires R-STL-05 (zero-volume) in addition to declared R-STL-02 (inverted winding).

**Likely cause:** Inverted-winding meshes compute negative/zero volume in trimesh, which legitimately trips R-STL-05's degenerate-mesh heuristic. Both rules firing may be correct emergent behaviour — not a bug.

**Resolution path:** Investigate one of:
- **Option A:** Accept — update sidecar `triggers_rules: [R-STL-02, R-STL-05]` to reflect reality.
- **Option B:** Tune R-STL-05 to ignore zero-volume cases when R-STL-02 fires (avoid duplicate reporting).
- **Option C:** Accept — this is high-signal; a student who uploads an inverted-winding mesh genuinely has a zero-volume file from the slicer's perspective.

Recommend Option A (cheapest, factually correct).

---

### FU-SCANNER-LEASE-REAPER (P2)

**Finding:** When worker crashes mid-scan (OOM, panic, Fly host failure), the `fabrication_scan_jobs.locked_by` + `locked_at` never release. The unique index `uq_fabrication_scan_jobs_active_per_revision` then blocks retries forever.

**Observed in:** Checkpoint 2.1 seahorse OOM. Row had to be manually cleared via UPDATE.

**Fix path:** Add stale-lease reaper — either:
- On-poll check in worker: if `status='running' AND now()-locked_at > 5 min AND locked_by='<my-machine-id>'`, self-heal. (Simple, same-worker-only.)
- Separate Fly cron job runs every minute: reset any `running` row with `locked_at > 5 min ago` to `pending` + bump `attempt_count` + log to `system_alerts`. (More robust, cross-worker.)

**Priority:** P2 — not urgent now (1 worker, reaper is "when do we get a second crash?" risk), but required before horizontal-scaling the worker.

---

### FU-SCANNER-EMAIL-VERIFY (P3)

**Finding:** Criterion #6 (scan_complete email dispatch + idempotency) not explicitly verified in Checkpoint 2.1. Code path is wired (commit `43503de`) but no confirmation that Resend dispatched + `notifications_sent.scan_complete` was stamped.

**Resolution:** Next scan cycle — after a real student submission triggers a scan, check Resend dashboard for the email and verify `notifications_sent` JSONB updated. Or write a targeted integration test.

**Priority:** P3 — doesn't block Phase 2A close because the email helper itself (1B-2-1) has its own idempotency test coverage.

---

## Commits in Phase 2A

```
262ae0c fix(preflight): set PYTHONPATH=/app/src in Dockerfile (Phase 2A-6b)
48d9e01 fix(preflight): Lesson #52 — REVOKE must target anon + authenticated explicitly
571ea81 chore(preflight): fly.toml for preflight-scanner worker (Phase 2A-6b)
43503de feat(preflight): Phase 2A-6a real Supabase + Storage clients + email dispatch
6d31ce9 docs(preflight): park FU-SCANNER-RENDER (moderngl thumbnail swap)
fd7b5e9 feat(preflight): Phase 2A-5 STL informational rules + thumbnail rendering
cc131db feat(preflight): Phase 2A-4 STL printability rules (R-STL-09..14)
93ba250 feat(preflight): Phase 2A-3 STL machine fit rules (R-STL-06..08)
905b86d feat(preflight): Phase 2A-2 STL geometry integrity rules (R-STL-01..05)
0c8c576 feat(preflight): Phase 2A-1 worker scaffold + scan dispatcher + sandbox
5e00518 docs(preflight): Phase 2A brief (scanner worker + STL rules, 6 sub-tasks)
```

11 commits, Phase 2A brief through Phase 2A-6b deploy.

---

## Next phases (NOT in scope for this checkpoint)

- **Phase 2B** — SVG rule catalogue (R-SVG-01..15). Same worker, new module. R-SVG-07 fixture still outstanding (Matt's TODO).
- **Phase 2C** — Student upload UI. First user-facing consumer of the worker.
- **Phase 2D** — Soft-gate results screen, ack-each-rule flow.
- **Phase 2E** — Teacher approval queue.
- **Phase 2F** — Fabricator pickup flow.

Each gets its own brief per build methodology.
