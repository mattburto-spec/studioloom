# Preflight Phase 2B — Checkpoint 3.1 Report

**Status:** ✅ PASS (with 1 new finding — Lesson #53 — resolved inline; 2 pre-existing Phase 2A follow-ups unchanged)
**Date:** 22 April 2026
**Signed off by:** Matt (verification run + backfill + push)
**Brief:** [`preflight-phase-2b-brief.md`](./preflight-phase-2b-brief.md)
**Phase scope:** SVG rule catalogue (R-SVG-01..15), cairosvg thumbnail rendering, combined ruleset `stl-v1.0.0+svg-v1.0.0`, GitHub Action auto-deploy wiring.

---

## Success criteria — pass/fail matrix

Criteria transcribed from `preflight-phase-2b-brief.md` §4.

| # | Criterion | Status | Evidence |
|---|---|:---:|---|
| 1 | All 15 SVG rules implemented with fixture-driven tests where coverage exists, negative-only tests otherwise | ✅ | Phase 2B-1..2B-6 commits landed 5 rule modules (`machine_fit.py`, `operation_mapping.py`, `geometry_integrity.py`, `raster.py`, `informational.py`). 129 new pytests added (242 → 245 at checkpoint close; 116 of those were Phase 2A carryover, 126 new SVG coverage in 2B, +3 supabase_real regression guards added 22 Apr). |
| 2 | Every `known-good/svg/*` fixture scans clean (0 BLOCK/WARN rules; FYI R-SVG-14/15 always fire) | ✅ | pytest `test_scan_runner_svg.py` + per-rule fixture parametrisation. Prod smoke: `coaster-orange-unmapped.svg` ran 2B dispatcher through all 5 modules, 2 rules fired (both informational/operation-mapping on unmapped stroke colour — expected for this fixture). |
| 3 | Every `known-broken/svg/*` fixture with populated `triggers_rules:` sidecar triggers EXACTLY those rules | ✅ | pytest sidecar-driven parametrisation in `tests/test_rules_svg_*.py`. No sidecar drift observed in 2B (FU-SCANNER-SIDECAR-DRIFT P3 remains open from Phase 2A for the STL chess-pawn case only). |
| 4 | R-SVG-07 ships at WARN severity with inline FIXME + FU reference (not BLOCK until fixture authored) | ✅ | Shipped in commit `6424709` (Phase 2B-4) with explicit inline FIXME. Fixture TODO tracked separately. |
| 5 | Cairo thumbnail rendered + uploaded for each SVG scan | ✅ | `fab-scanner/src/worker/thumbnail_svg.py:safe_render_svg()` invoked from `scan_runner.py:170`. Bucket `fabrication-thumbnails` shows 5 PNGs (3 × 7299 bytes, 1 × 5515, 1 × 7690) landed during 21–22 Apr scans. 22 Apr fresh smoke-test SVG uploaded `f3af1426-b10e-4aea-802c-00c6bbb15b87.png`. |
| 6 | Ruleset version recorded as `stl-v1.0.0+svg-v1.0.0` on every scan result | ✅ | Diagnostic query confirms `scan_results->>'ruleset_version' = 'stl-v1.0.0+svg-v1.0.0'` on 22 Apr smoke scan. Constant in `fab-scanner/src/schemas/ruleset_version.py` (`SCAN_RULESET_VERSION`). |
| 7 | Worker deploys cleanly with new cairo system deps — no libcairo2-dev missing errors | ✅ | Dockerfile (Phase 2B-1) added `libcairo2-dev` (builder) + `libcairo2 libpango-1.0-0` (runtime). 22 Apr deploy (`deployment-01KPS282RPKV0BAYAYJN84KKWK`, 208 MB image) succeeded with both Fly machines reaching healthy state under rolling strategy. Earlier SSH verification: `/opt/venv/lib/python3.11/site-packages/` contains CairoSVG 2.7.1, cairocffi 1.7.1, cairosvg. |
| 8 | GitHub Action merged + `FLY_API_TOKEN` secret set + one test push verifies auto-deploy works | ⚠️ | `.github/workflows/deploy-preflight-scanner.yml` untracked in repo as of this checkpoint — needs `git add` + commit + FLY_API_TOKEN secret in GitHub UI before the action is live. Manual `fly deploy` used for 22 Apr hotfix. FU-SCANNER-CICD below. |
| 9 | Local pytest: +N Python tests (target ~60 new — one per rule plus dispatch) | ✅ | 116 → 245 pytest (+129). Exceeds target ~2×; extra coverage from 2B-4a/4b review-findings fixes + today's 3 regression guards in `test_supabase_real.py`. |
| 10 | `npm test` baseline 1409 untouched (zero TS/JS changes in Phase 2B) | ✅ | No TS source touched in Phase 2B-1..2B-6 or in today's Lesson #53 fix (Python-only). |
| 11 | `docs/projects/WIRING.yaml`: `preflight-scanner.summary` updated to mention SVG support + combined ruleset | ✅ | Updated in `4fd80f9` saveme sync (22 Apr). Summary now reads "combined ruleset stl-v1.0.0+svg-v1.0.0", `external_deps` expanded to `cairosvg, cairocffi, pillow`. |
| 12 | Checkpoint 3.1 report doc filed | ✅ | This document. |

**Overall: 11 PASS, 1 PARTIAL (criterion #8 CI/CD wiring).**

---

## Production smoke test evidence

### coaster-orange-unmapped.svg (22 Apr smoke scan after Lesson #53 fix)

- Fresh `fabrication_jobs` + `fabrication_job_revisions` + `fabrication_scan_jobs` rows SQL-inserted post-deploy
- Status: `done` in 1 attempt, no `error_detail`
- Ruleset version: `stl-v1.0.0+svg-v1.0.0`
- Rules fired: 2 (informational + operation-mapping on unmapped stroke — expected for this fixture)
- Thumbnail rendered + uploaded: `f3af1426-b10e-4aea-802c-00c6bbb15b87.png`
- **Column-level verification: `thumbnail_path IS NOT NULL` ✅** (this is the Checkpoint 3.1 unblock)

Earlier 21 Apr Phase 2A STL smoke scans (small-cube-25mm, seahorse-not-watertight, chess-pawn-inverted-winding, whale-not-watertight) all scanned successfully and rendered thumbnails to storage — per the 2.1 checkpoint — but had the pre-Lesson-#53 writeback bug so their `thumbnail_path` columns were stranded NULL. All 11 such revisions (6 STL + 5 SVG/re-runs) were backfilled 22 Apr via `UPDATE fabrication_job_revisions SET thumbnail_path = scan_results->>'thumbnail_path'`.

---

## Findings this phase

### Lesson #53 — `thumbnail_path` column-writeback bug (RESOLVED 22 Apr)

**Finding:** Every Phase 2A STL + Phase 2B SVG scan rendered + uploaded a thumbnail successfully but stranded the path inside `fabrication_job_revisions.scan_results` JSONB. The denormalised `thumbnail_path` column (migration 095:150) was never written, and the UI reads the column directly. Students and admins would have seen NULL thumbnails on every scan until this was caught during Phase 2B-7 verification.

**Root cause:** `fab-scanner/src/worker/supabase_real.py:write_scan_results()` built its `fabrication_job_revisions` UPDATE dict from {scan_results, scan_status, scan_error, scan_completed_at, scan_ruleset_version} — did not extract the `thumbnail_path` value from the `scan_results` dict to also set the column. The Python worker's `ScanResults` Pydantic model carried the field, `model_dump()` landed it inside the JSONB, and the code assumed that was enough. supabase-py `.update({...})` is a literal column write — no JSONB-to-column fan-out.

**Why it slipped past tests:** Every scan_runner test used `MockSupabase` (conftest.py) with JSONB-level assertions (`writes[0]["scan_results"]["thumbnail_path"] is not None`). Mock-based tests never exercised the real `SupabaseServiceClient`, so the column-write omission was invisible to CI.

**Fix:** 8-line change in `supabase_real.py` — added `"thumbnail_path": scan_results.get("thumbnail_path")` to the revisions UPDATE dict. `.get()` returns None on missing key so error-path scans (no thumbnail attempted) write cleanly.

**Test:** New `fab-scanner/tests/test_supabase_real.py` with 3 regression guards — (a) thumbnail present in JSONB → column gets value, (b) thumbnail absent → column is None (not KeyError), (c) all three tables update in stable order. First unit-test coverage for the real Supabase adapter.

**Deploy + verification:** Fly redeployed 22 Apr (image `deployment-01KPS282RPKV0BAYAYJN84KKWK`). Fresh smoke-test SVG scan wrote `thumbnail_path` through to column. 11 orphaned prod revisions backfilled.

**Documented as:** Lesson #53 in `docs/lessons-learned.md` — "Denormalised columns need explicit writes; stuffing the whole payload in JSONB doesn't fan them out."

---

## Follow-ups

### FU-SCANNER-CICD (P2 — NEW)

**Finding:** `.github/workflows/deploy-preflight-scanner.yml` exists as an untracked file in repo but is not committed, and `FLY_API_TOKEN` is not known to be set in GitHub secrets. All deploys to date have been manual `fly deploy` from Matt's laptop.

**Impact:** Future Preflight work that ships via `feat(preflight)` commits to `main` does NOT auto-deploy. The 22 Apr Lesson #53 fix worked because Matt was in a live terminal; a developer pushing from elsewhere would ship code that wouldn't reach prod.

**Resolution path:** Commit the workflow + add `FLY_API_TOKEN` to GitHub secrets (Matt's action — token mint + secret addition require his GitHub auth).

**Priority:** P2 — blocks hands-off ops + any potential future contributor, not blocking Phase 4.

---

### FU-SCANNER-LEASE-REAPER (P2 — UNCHANGED from Phase 2A)

Status unchanged. Still required before horizontal-scaling the worker. No new incidents since Checkpoint 2.1.

### FU-SCANNER-SIDECAR-DRIFT (P3 — UNCHANGED from Phase 2A)

STL-only (chess-pawn case). No SVG sidecar drift observed.

### FU-SCANNER-EMAIL-VERIFY (P3 — UNCHANGED from Phase 2A)

Deferred per 2.1 — criterion "scan_complete email dispatch + idempotency" still not verified with a real Resend round-trip. Wait for Phase 4 traffic from real student uploads.

---

## Commits in Phase 2B

```
0554947 docs(dashboard): refresh Preflight card + header date                       (22 Apr)
4fd80f9 docs(saveme): sync state after Preflight thumbnail_path column fix          (22 Apr)
345cd51 fix(preflight): write thumbnail_path column on scan writeback (Lesson #53)  (22 Apr)
d723506 feat(preflight): Phase 2B-6 SVG informational + cairo thumbnail             (21-22 Apr)
b46f3ae feat(preflight): Phase 2B-5 SVG raster rules (R-SVG-12..13)
d8d2af6 fix(preflight): Phase 2B-4b — cascade resolver inherit precedence
32d45c6 fix(preflight): Phase 2B-4a review findings (SVG rule correctness)
6424709 feat(preflight): Phase 2B-4 SVG geometry integrity rules (R-SVG-07..11)
9a5361b feat(preflight): Phase 2B-3 SVG operation mapping rules (R-SVG-04..06)
32dd01a feat(preflight): Phase 2B-2 SVG machine fit rules (R-SVG-01..03)
7eede6b feat(preflight): Phase 2B-1 SVG scaffold + dispatch wiring
e05e182 docs(preflight): Phase 2B brief (SVG rules + scanner extension)
```

12 commits, Phase 2B brief through Checkpoint 3.1. All on `origin/main` at `0554947` (push landed 22 Apr post-verification).

---

## Next phase

**Phase 4 — Upload + Job Orchestration** (~2 days). First user-facing consumer of the scanner worker. Student upload UI + job creation API + poll/subscribe for scan status + loading UI with staged messaging + revision history. Matt Checkpoint 4.1: student can upload → scan → get results end-to-end on prod.

Brief: [`preflight-phase-4-brief.md`](./preflight-phase-4-brief.md).

Phases 5 (soft-gate results UI), 6 (teacher approval queue), 7 (Fabricator pickup), 8 (machine profiles admin), 9 (analytics + polish) get their own briefs per build methodology.
