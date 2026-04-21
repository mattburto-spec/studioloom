# Preflight — Fixture Corpus

> **Purpose:** Real-world STL and SVG files used to validate every Preflight scanner rule fires correctly on known inputs. These are load-bearing — Phase 2/3 rule implementations are tested against these exact files.
> **Status:** **Gate B MET** (21 Apr 2026, Phase 2-0b). 53 files bucketed + sidecarred. Scanner phases may now proceed.
> **Spec source:** `docs/projects/fabrication-pipeline.md` §5 (STL rules) + §6 (SVG rules).

## Current inventory (21 Apr 2026)

| Bucket | STL | SVG | Total |
|---|---:|---:|---:|
| `known-good/` — should pass | 9 | 10 | **19** |
| `known-broken/` — should trigger specific rule(s) | 18 | 10 | **28** |
| `borderline/` — threshold-tuning cases | 3 | 3 | **6** |
| **Total** | **30** | **23** | **53** |

Every file has a `.meta.yaml` sidecar (enforced by `scripts/fab-fixtures/write_sidecars.py`).

## Structure

```
fixtures/
  README.md              ← this file
  INSPECTION.json        ← raw structural data per fixture (auto-generated)
  INSPECTION.md          ← human-readable inspection table
  BUCKET-PROPOSAL.md     ← original bucketing decisions (Phase 2-0a audit trail)
  .gitignore             ← blocks raw files at this root — bucketed files ARE tracked
  known-good/
    stl/  (9 files + 9 .meta.yaml)
    svg/  (10 files + 10 .meta.yaml)
  known-broken/
    stl/  (18 files + 18 .meta.yaml)
    svg/  (10 files + 10 .meta.yaml)
  borderline/
    stl/  (3 files + 3 .meta.yaml)
    svg/  (3 files + 3 .meta.yaml)
```

## Sidecar format

Every fixture has a same-stem `.meta.yaml` sidecar:

```yaml
source: "Year 10 student A (anonymised)"     # who contributed
source_filename: "original_filename.stl"      # audit trail; null for synthetic fixtures
intended_machine: "bambu_x1c"                 # must match a machine_profiles seed id
expected_result: "block"                      # pass | warn | block (highest severity)
triggers_rules:                               # empty [] for known-good
  - R-STL-09
notes: |
  Free-text context — useful for threshold-tuning discussions.
date_added: 2026-04-21
anonymised: true                              # true if student identifiers were stripped
```

### Field reference

- `source` — who contributed. Anonymise student names (`Year X student A`).
- `source_filename` — original filename before bucketing/rename. `null` for synthetic authored fixtures (track their provenance in `notes` instead).
- `intended_machine` — a `machine_profiles.id` the scanner should test against. See the 12 system templates seeded in migration 093.
- `expected_result` — exactly one of `pass` | `warn` | `block`. If multiple rules fire, use the highest severity.
- `triggers_rules` — every rule ID the scanner is expected to flag. Empty array for known-good (asserts NO rules fire).
- `notes` — free text explaining context.
- `date_added` — ISO date.
- `anonymised` — `true` if any student-identifying info was stripped (from the filename OR from file metadata).

## Rule-coverage status (21 Apr 2026)

### STL — every BLOCK-severity rule covered

| Rule | Severity | Fixtures | Primary file |
|---|:---:|---:|---|
| R-STL-01 Non-watertight | **BLOCK** | 14 | `known-broken/stl/seahorse-not-watertight.stl` |
| R-STL-02 Inconsistent winding | **BLOCK** | 1 | `known-broken/stl/chess-pawn-inverted-winding.stl` (authored) |
| R-STL-03 Self-intersecting | WARN | — | awaiting real fixture (Phase 2A) |
| R-STL-04 Floating islands | WARN | 4 | `known-broken/stl/whale-not-watertight.stl` |
| R-STL-05 Zero-volume / degenerate | **BLOCK** | 1 | `known-broken/stl/degenerate-zero-volume-pawn.stl` |
| R-STL-06 Exceeds bed size | **BLOCK** | 2 | `known-broken/stl/mount-bracket-oversized.stl` (authored) |
| R-STL-07 Unit mismatch (mm vs inch) | WARN | 1 | `known-broken/stl/chess-pawn-inch-mistake.stl` (authored) |
| R-STL-08 Print time exceeds max | WARN | — | depends on machine profile — Phase 2A |
| R-STL-09 Wall < nozzle×1.5 | **BLOCK** | 1 (borderline) | `borderline/stl/small-flat-sheet-1mm-thick.stl` |
| R-STL-10 Wall < nozzle×3 | WARN | — | Phase 2A |
| R-STL-11 Overhang > 45° | WARN | — | needs face-normal scan at Phase 2A |
| R-STL-12 Feature < 1mm | WARN | — | Phase 2A |
| R-STL-13 No flat base | WARN | 1 (borderline) | `borderline/stl/small-flat-sheet-1mm-thick.stl` |
| R-STL-14 Tall + thin instability | WARN | — | needs dedicated fixture — nice-to-have for Phase 2A |

**All 5 BLOCK-severity rules have fixture coverage.** Phase 2A may ship all BLOCK rules at full severity.

### SVG — every BLOCK-severity rule covered

| Rule | Severity | Fixtures | Primary file |
|---|:---:|---:|---|
| R-SVG-01 Exceeds bed size | **BLOCK** | 1 | `known-broken/svg/box-oversized-10m.svg` (authored) |
| R-SVG-02 ViewBox unit mismatch | **BLOCK** | 1 | `known-broken/svg/korean-draw-unit-mismatch.svg` |
| R-SVG-03 No explicit units | WARN | 1 | `known-broken/svg/coaster-flower-percent-width.svg` |
| R-SVG-04 Stroke color not in map | **BLOCK** | 4 | `known-broken/svg/coaster-orange-unmapped.svg` |
| R-SVG-05 Cut-layer non-hairline | WARN | — | needs stroke-width inspection — Phase 2B |
| R-SVG-06 Fill set on cut layer | WARN | — | Phase 2B |
| R-SVG-07 Open paths on cut | **BLOCK** | 0 | **STILL OUTSTANDING — Matt's Phase 2B TODO list** |
| R-SVG-08 Duplicate cut lines | WARN | — | Phase 2B |
| R-SVG-09 Features below kerf | WARN | — | Phase 2B |
| R-SVG-10 Un-outlined text | **BLOCK** | 6 | `known-broken/svg/legacy-box-with-text.svg` |
| R-SVG-11 Orphan / zero-length paths | FYI | — | Phase 2B |
| R-SVG-12 Raster < 150 DPI | WARN | 3 | `known-broken/svg/hingebox-mixed-colors-text-raster.svg` |
| R-SVG-13 Raster with transparency | WARN | — | depends on scan; may be observed on jordan2 |

**4 of 5 SVG BLOCK rules have fixture coverage.** R-SVG-07 (open path on cut layer) still outstanding — tracked in `docs/projects/ALL-PROJECTS.md` under Preflight Phase 2 TODOs. Phase 2B can start; R-SVG-07 lands at WARN until Matt authors the fixture.

**Machine-color-map note:** Matt's convention is red/blue/black only — no orange. This is hardcoded into the sidecar `notes:` fields where relevant (see `coaster-orange-unmapped.svg`).

## Anonymization policy

Student files are scrubbed before committing:

- **Filenames** renamed to descriptive labels — never student names.
- **STL metadata** — re-exported via trimesh to reset the 80-byte header (wipes exporter-set author/path bytes).
- **SVG metadata** — `<title>`, `<desc>`, `<metadata>` elements stripped; Inkscape + sodipodi namespace attributes/elements removed.
- **Original filename** preserved in sidecar `source_filename:` for audit trail.
- **Sidecar `source:`** says e.g. `"Year X student A (anonymised)"`. Per-student tags are stable across sibling fixtures (all `chess-*-broken-*.stl` from Student D share the same tag).

Student tag registry (internal audit — not committed publicly):
- Student A: chess set exports (`anon-chess-set-assembly.stl`)
- Student B: degenerate zero-volume pawn
- Student C: 174-component chess board + its 4-component repair
- Student D: quwei/qw chess piece series (9 files)
- Student E: not-watertight figurine
- Student F: small-holes 10mm
- Student G: medium figurine
- Student H: Tinkercad flat design
- Student I: yubo1/yubo2 box SVGs
- Student J: jordan + korean-draw-unit-mismatch

## Utility scripts

Three throwaway scripts support this corpus, all under `scripts/fab-fixtures/`:

- `inspect_fixtures.py` — walks the corpus, extracts structural properties, writes `INSPECTION.{json,md}`.
- `apply_bucketing.py` — one-time migration from the flat-directory corpus to bucketed layout (Phase 2-0b step 1). Kept for audit; re-running is a no-op.
- `strip_metadata.py` — re-exports STLs + strips SVG identifying elements. Idempotent.
- `author_missing_fixtures.py` — synthesises 4 rule-targeted fixtures from known-good bases (R-STL-02, R-STL-06, R-STL-07, R-SVG-01).
- `write_sidecars.py` — regenerates all 53 sidecar YAMLs from the canonical decisions dict. This is the source of truth — if a sidecar field needs to change, edit this script and re-run.

Python dependencies: `trimesh`, `lxml`, `svgpathtools`, `numpy`. Installed in a local `scripts/fab-fixtures/.venv` (gitignored).

## Committing fixtures

```bash
# One commit per bucket keeps diffs readable
git add docs/projects/fabrication/fixtures/known-good/
git commit -m "chore(preflight): add known-good fixtures + sidecars (Phase 2-0b)"

git add docs/projects/fabrication/fixtures/known-broken/
git commit -m "chore(preflight): add known-broken fixtures + sidecars (Phase 2-0b)"

git add docs/projects/fabrication/fixtures/borderline/
git commit -m "chore(preflight): add borderline fixtures + sidecars (Phase 2-0b)"

git add docs/projects/fabrication/fixtures/{README.md,INSPECTION.json,INSPECTION.md,BUCKET-PROPOSAL.md}
git add scripts/fab-fixtures/
git commit -m "chore(preflight): fixture inspection scripts + audit docs (Phase 2-0b)"
```

## Ownership

Matt owns gathering + sidecar judgment. When a new scanner rule is added (v2, v3), a fixture demonstrating it is added in the same commit as the rule.
