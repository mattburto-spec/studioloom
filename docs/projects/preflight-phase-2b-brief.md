# Preflight Phase 2B — SVG Rule Catalogue + Scanner Worker Extension

**Status:** ✅ SIGNED OFF — 21 April 2026 (Matt, this session)
**Date drafted:** 21 April 2026
**Spec source:** `docs/projects/fabrication-pipeline.md` §6 (SVG rules R-SVG-01..15), §13 Phase 3
**Predecessor:** Phase 2A complete + Checkpoint 2.1 signed off 21 Apr. Commit `72a7484` is HEAD.
**Blocks:** Phase 2C (student upload UI — upload route accepts both STL and SVG), Phase 2D (soft-gate results screen), full pilot with Cynthia's laser cutter.
**Estimated duration:** ~2 days (7 sub-phases, each gated, separate commits).

---

## 1. What this phase ships

Extension of the existing `fab-scanner/` worker to scan SVG files end-to-end. Same deploy target (Fly.io `preflight-scanner` SYD 512MB), same poll loop (`claim_next_scan_job` RPC), same writeback path.

The worker already has a stub branch at `scan_runner.py:129` that returns `rules = []` for `file_type == "svg"`. Phase 2B populates it.

**Ships:**

1. **SVG loader** (`fab-scanner/src/worker/svg_loader.py`) — lxml parse → typed DOM wrapper that exposes viewBox, width/height, stated units, all paths, all strokes, all text elements, all embedded rasters.
2. **15 SVG rules** across 5 modules:
   - `machine_fit.py` — R-SVG-01 (bed size), R-SVG-02 (viewBox unit mismatch), R-SVG-03 (no explicit units)
   - `operation_mapping.py` — R-SVG-04 (stroke not in map), R-SVG-05 (cut-layer non-hairline), R-SVG-06 (fill on cut layer)
   - `geometry_integrity.py` — R-SVG-07 (open paths on cut), R-SVG-08 (duplicate cut lines), R-SVG-09 (features < kerf), R-SVG-10 (un-outlined text), R-SVG-11 (orphan/zero-length paths)
   - `raster.py` — R-SVG-12 (raster < 150 DPI), R-SVG-13 (raster with transparency)
   - `informational.py` — R-SVG-14 (estimated cut time), R-SVG-15 (layer summary)
3. **Cairo-based thumbnail renderer** (`thumbnail_svg.py`) — layered preview, strokes coloured per `operation_color_map` from the machine profile.
4. **Ruleset version bump** — `SVG_RULESET_VERSION = "svg-v1.0.0"`; combined `SCAN_RULESET_VERSION = "stl-v1.0.0+svg-v1.0.0"`.
5. **Python dependencies** — `svgpathtools` + `cairocffi` added to `requirements.txt` + `pyproject.toml`; `libcairo2-dev` in `Dockerfile`.
6. **pytest coverage** — one test module per rule group + one end-to-end SVG scan runner test. Fixture-driven where coverage exists; negative-only (rule runs cleanly on known-good) where fixtures are outstanding.
7. **GitHub Action** (`.github/workflows/deploy-preflight-scanner.yml`) — auto-deploy on push to `fab-scanner/**`. Deferred from 2A §7.
8. **Deploy to Fly + prod smoke test** — same pattern as Phase 2A checkpoint; verify SVG scans land with correct rule firings.

**Does NOT ship in Phase 2B:**

- Student upload UI (Phase 2C).
- Soft-gate results screen (Phase 2D).
- Teacher approval queue (Phase 2E).
- R-SVG-07 fixture authoring (Matt's separate TODO — R-SVG-07 ships at WARN severity until authored; see §7).
- Missing fixtures for R-SVG-05, R-SVG-06, R-SVG-08, R-SVG-09, R-SVG-13 — tracked as FU-SVG-FIXTURE-GAPS.

---

## 2. Infrastructure

**No changes from Phase 2A:**

- Deploy target: Fly.io `preflight-scanner`, region SYD.
- Runtime: `shared-cpu-1x@512MB` (as bumped during Checkpoint 2.1).
- Auth: same service-role key.
- Poll cadence: 5s via `claim_next_scan_job` RPC.

**New in Phase 2B:**

- **`svgpathtools`** — path geometry + length calculations. No known OOM risk (svgpathtools is pure Python, lightweight).
- **`cairocffi`** — Python binding to libcairo. Chosen over `pycairo` because it's pure-Python + ctypes (simpler Docker image, no compile step).
- **Docker layer** — `apt-get install -y libcairo2-dev libpango1.0-dev pkg-config` for the build context. Adds ~40 MB to the image but standard Debian packages.

**Fly deploy cadence during 2B:**

- 2B-1 through 2B-6: manual `fly deploy` at end of each sub-phase IF the sub-phase changed worker runtime behaviour. Rule modules alone don't need a deploy — the worker loads them at next restart. Deploy at sub-phase boundaries only when the thumbnail renderer or loader changes.
- 2B-7: ships the GitHub Action that auto-deploys on push to `fab-scanner/**` going forward.

---

## 3. Sub-phase split (7 instruction blocks)

Each sub-phase: pre-flight → assumptions block → audit → write → test → NC → commit → report cycle. Separate commits. Per Karpathy discipline (Lessons #43-46) + Phase 2A pattern.

### 2B-1 — SVG scaffold + dispatch wiring

**Goal:** Populate `scan_runner.py`'s `file_type == "svg"` branch so a known-good SVG flows through the worker end-to-end, returning empty `rules=[]` + no thumbnail. Proves lxml parse, svgpathtools import, cairo install, and writeback all work before we add a single rule.

**Files created:**
- `fab-scanner/src/worker/svg_loader.py` — `load_svg_document(data: bytes) -> SvgDocument` returning a typed wrapper.
- `fab-scanner/src/rules/svg/machine_fit.py` — empty `run_machine_fit_rules(doc, profile) -> list[RuleResult]: return []`
- `fab-scanner/src/rules/svg/operation_mapping.py` — empty stub
- `fab-scanner/src/rules/svg/geometry_integrity.py` — empty stub
- `fab-scanner/src/rules/svg/raster.py` — empty stub
- `fab-scanner/src/rules/svg/informational.py` — empty stub
- `fab-scanner/tests/test_scan_runner_svg.py` — one parametrised test over every `known-good/svg/` fixture, asserts `rules=[]`.

**Files modified:**
- `fab-scanner/src/worker/scan_runner.py` — add `_load_svg_document` helper, `_run_all_svg_rules` dispatcher, populate the SVG branch.
- `fab-scanner/src/schemas/ruleset_version.py` — add `SVG_RULESET_VERSION = "svg-v1.0.0"`, update `SCAN_RULESET_VERSION` to the combined tag.
- `fab-scanner/requirements.txt` — add `svgpathtools==1.7.1`, `cairocffi==1.7.1`.
- `fab-scanner/pyproject.toml` — mirror.
- `fab-scanner/Dockerfile` — add `libcairo2-dev libpango1.0-dev pkg-config` to the apt-get line.

**Stop trigger:** cairo install fails in Docker. Halt, report, discuss pycairo alternative or base image bump.

**Commit:** `feat(preflight): Phase 2B-1 SVG scaffold + dispatch wiring`

**Est:** ~0.6 day

### 2B-2 — SVG machine fit rules (R-SVG-01..03)

**Goal:** First 3 real rules. Bed-size check, viewBox unit mismatch, no-explicit-units warning.

**Tests:** Against `known-broken/svg/box-oversized-10m.svg` (R-SVG-01), `known-broken/svg/korean-draw-unit-mismatch.svg` (R-SVG-02), `known-broken/svg/coaster-flower-percent-width.svg` (R-SVG-03). All known-good fixtures assert NO machine-fit rules fire.

**Commit:** `feat(preflight): Phase 2B-2 SVG machine fit rules (R-SVG-01..03)`

**Est:** ~0.3 day

### 2B-3 — SVG operation mapping rules (R-SVG-04..06)

**Goal:** Stroke colour mapping (R-SVG-04 — BLOCK) + hairline stroke width check (R-SVG-05 — WARN) + fill-on-cut-layer (R-SVG-06 — WARN).

**Critical:** R-SVG-04 must normalise hex comparison — `#FF0000`, `#ff0000`, `red`, `rgb(255,0,0)` should all match the same map entry. Matt's seed map uses `#FF0000 #0000FF #000000` (uppercase).

**Tests:** R-SVG-04 → 4 fixtures (coaster-orange-unmapped, drawing-mixed-colors-with-text, hingebox-mixed-colors-text-raster, box-makercase-odd-colors). R-SVG-05 + R-SVG-06 → negative-only against known-good (no fixtures authored).

**Commit:** `feat(preflight): Phase 2B-3 SVG operation mapping rules (R-SVG-04..06)`

**Est:** ~0.4 day

### 2B-4 — SVG geometry integrity rules (R-SVG-07..11)

**Goal:** 5 rules.
- R-SVG-07 open paths on cut layer — **ship at WARN until fixture authored.** Severity override via constant at top of file with `FIXME(matt): promote to BLOCK after fixture authored, see FU-SVG-FIXTURE-GAPS` comment.
- R-SVG-08 duplicate cut lines — geometry-hash dedup.
- R-SVG-09 features below kerf — path-length threshold check.
- R-SVG-10 un-outlined `<text>` — 6 fixtures available.
- R-SVG-11 orphan/zero-length paths — FYI.

**Tests:** R-SVG-10 → 6 fixtures. Others negative-only.

**Commit:** `feat(preflight): Phase 2B-4 SVG geometry integrity rules (R-SVG-07..11)`

**Est:** ~0.5 day

### 2B-5 — SVG raster rules (R-SVG-12..13)

**Goal:** 2 raster rules. R-SVG-12 DPI check against embedded images. R-SVG-13 RGB-with-transparency.

**Tests:** R-SVG-12 → 3 fixtures (hingebox, korean-draw-raster-with-vectors). R-SVG-13 negative-only.

**Commit:** `feat(preflight): Phase 2B-5 SVG raster rules (R-SVG-12..13)`

**Est:** ~0.3 day

### 2B-6 — SVG informational rules + cairo thumbnail

**Goal:** R-SVG-14 (estimated cut time) + R-SVG-15 (layer summary) as FYI-always-fire, plus cairo-based layered thumbnail. Thumbnail uses `operation_color_map` to render strokes in their operation colours (red=cut, blue=score, black=engrave).

**Performance:** cairo renders SVG natively — much faster than the matplotlib Poly3DCollection path. Expect sub-second thumbnails for typical student files. jordan2.svg (2.3 MB borderline fixture) is the perf stress test — target <3s.

**Commit:** `feat(preflight): Phase 2B-6 SVG informational + cairo thumbnail rendering`

**Est:** ~0.5 day

### 2B-7 — GitHub Action auto-deploy + Fly deploy + Checkpoint 3.1

**Goal:** Deploy to Fly, run prod smoke tests, wire GitHub Action for future push-triggered deploys.

**GitHub Action:**
```yaml
# .github/workflows/deploy-preflight-scanner.yml
name: Deploy preflight-scanner
on:
  push:
    branches: [main]
    paths: ['fab-scanner/**']
```

Requires `FLY_API_TOKEN` added to GitHub repo secrets (Matt's action, can't automate).

**Prod smoke tests:** Same pattern as Checkpoint 2.1. Upload 3 SVG fixtures (one known-good, two known-broken), insert scan jobs, verify results land correctly.

**Checkpoint 3.1 report:** `docs/projects/preflight-phase-2b-checkpoint-3-1.md` — 12-criterion pass/fail matrix, prod evidence, follow-ups.

**Commit:** `feat(preflight): Phase 2B-7 auto-deploy + Checkpoint 3.1`

**Est:** ~0.4 day

---

## 4. Success criteria (Checkpoint 3.1)

- [ ] All 15 SVG rules implemented with fixture-driven tests where coverage exists, negative-only tests otherwise.
- [ ] Every `known-good/svg/*` fixture scans clean (0 BLOCK/WARN rules fire — FYI rules R-SVG-14/15 always fire, that's expected).
- [ ] Every `known-broken/svg/*` fixture with a populated `triggers_rules:` sidecar triggers EXACTLY those rules.
- [ ] R-SVG-07 ships at WARN severity with an inline FIXME + FU reference (NOT BLOCK until fixture authored).
- [ ] Cairo thumbnail rendered + uploaded for each SVG scan.
- [ ] Ruleset version recorded as `stl-v1.0.0+svg-v1.0.0` on every scan result.
- [ ] Worker deploys cleanly with new cairo system deps — no libcairo2-dev missing errors.
- [ ] GitHub Action merged + `FLY_API_TOKEN` secret set + one test push verifies auto-deploy works.
- [ ] Local pytest: +N Python tests (target: ~60 new tests — roughly one per rule plus dispatch tests).
- [ ] `npm test` baseline 1409 untouched (zero TS/JS changes in Phase 2B).
- [ ] `docs/projects/WIRING.yaml`: `preflight-scanner.summary` updated to mention SVG support + combined ruleset.
- [ ] Checkpoint 3.1 report doc filed.

---

## 5. Stop triggers (halt, report, wait for Matt)

- Pre-flight finds `fab-scanner/src/rules/svg/` already contains code beyond `__init__.py` — halt, investigate greenfield violation.
- cairocffi install fails in Docker — halt, discuss fallback (pycairo, pyvips, or native svg-via-matplotlib).
- svgpathtools can't parse a fixture in the known-good bucket — halt, audit the fixture.
- Any `known-good/svg/*` fixture fires a BLOCK or WARN rule — halt, either rule is over-strict or fixture belongs in borderline.
- R-SVG-04 fires on a stroke colour that SHOULD be in the map — halt, investigate hex-normalisation bug.
- Worker deploys but first SVG scan OOMs at 512MB — halt, check Fly logs, consider next tier up.
- cairo thumbnail produces empty PNG or throws on a valid SVG — halt, debug.
- GitHub Action runs but Fly deploy fails — halt, inspect secrets + token scopes.

---

## 6. Don't stop for

- `lxml` DeprecationWarning on parsing — mature library, warnings are noise.
- `svgpathtools` warnings on unusual path commands — expected on hand-edited student files.
- cairocffi font-substitution warnings inside Docker (missing fonts for rasterised `<text>`) — text handling is lossy on purpose.
- jordan2.svg (2.3 MB perf fixture) scanning slowly — it's there to stress the perf; document the time in the checkpoint report.
- Pre-existing 2 unrelated uncommitted files (Systems/Ingestion, dimensions3.md).
- WIRING `preflight-scanner` already showing `status: deployed` from Phase 2A — that's correct; we update `summary`, not status.

---

## 7. Out of scope (deferred)

| Deferred to | Item |
|---|---|
| Phase 2C | Student upload UI. |
| Phase 2D | Soft-gate results screen, ack-each-rule flow. |
| Phase 2E | Teacher approval queue. |
| Phase 2F | Fabricator pickup flow. |
| Matt (direct) | **R-SVG-07 fixture authoring** — rectangle with one side removed (M…L…L…L no Z). Ship at WARN until authored. Promote to BLOCK in a ruleset minor bump (`svg-v1.1.0`) after fixture lands. |
| FU-SVG-FIXTURE-GAPS (P2) | Missing fixtures for R-SVG-05 (hairline stroke), R-SVG-06 (fill on cut layer), R-SVG-08 (duplicate cut lines), R-SVG-09 (features below kerf), R-SVG-13 (raster transparency). Rules still implemented in 2B; tested negative-only against known-good until fixtures authored. |
| FU-SCANNER-LEASE-REAPER | Stale-lease reaper (opened in 2A). Still outstanding; not a Phase 2B dependency since 512MB tier + SVG workload shouldn't OOM. |
| FU-SVG-THUMBNAIL-V2 | If cairo thumbnail quality is poor, investigate resvg or pyvips as alternatives. |
| Phase 9 | Retention cron (D-04) — file deletion at day 30. |

---

## 8. Ruleset versioning

Initial: `svg-v1.0.0`. Combined tag stored on every scan: `stl-v1.0.0+svg-v1.0.0`.

Version bump policy (same as §8 of 2A brief):
- **PATCH** — rule explanation text tweak, no behaviour change.
- **MINOR** — threshold loosened OR new rule added.
- **MAJOR** — threshold tightened OR rule removed.

**First planned MINOR bump:** `svg-v1.1.0` when R-SVG-07 fixture is authored and severity promoted from WARN to BLOCK.

---

## 9. Lessons to re-read (every sub-phase)

- **Lesson #24** (line 86) — never assume column names exist; relevant if we touch scan_results JSONB.
- **Lesson #38** (line 141) — verify = assert expected values. Tests must assert which rule IDs + severities fire, not just `len(results) > 0`.
- **Lesson #41** (line 205) — NC revert: Edit tool for uncommitted files, git checkout for committed.
- **Lesson #43** (line 241) — Karpathy: assumptions block before coding.
- **Lesson #44** (line 256) — no speculative abstractions. If a rule is a single `len(paths) == 0` check, inline it — don't pre-extract a `PathAnalyzer` class.
- **Lesson #45** (line 273) — surgical changes. Sub-phase 2B-N touches only its listed files.
- **Lesson #52** (line 422) — `REVOKE EXECUTE FROM PUBLIC` doesn't cover anon/authenticated. Relevant only if we introduce new SQL in 2B (we don't plan to).

Phase 2A–specific lessons that carry forward:
- **OOM → bump tier.** 29k-face STL OOM'd 256MB during 2A. SVG workload is lighter (vector, not geometry-processing), but if any fixture hangs the worker, check Fly logs immediately.
- **Stuck lease.** If a worker crashes mid-scan, `fabrication_scan_jobs.locked_by` never releases. Manual clear UPDATE required. FU-SCANNER-LEASE-REAPER tracks the fix.
- **Supabase dashboard "Run and enable RLS" false positive** on CTE INSERTs — click "Run without RLS" to preserve deny-all patterns.

---

## 10. Execution note

Per recent workflow:
- Matt reviews + signs off this brief (DONE 21 Apr).
- Per sub-task: Cowork session writes the instruction block, Matt executes in Claude Code terminal, Claude Code pauses at stop triggers, reports at checkpoints.
- Commits land on `main` with optional `phase-2b-wip` backup branch for safety.
- Push to origin after each clean sub-phase. 2B-7 push is the Checkpoint 3.1 commit.
- Build methodology applies: pre-flight ritual, assumptions block, stop-and-report gate, separate commits, no squashing.
