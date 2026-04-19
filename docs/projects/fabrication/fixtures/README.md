# Preflight — Fixture Corpus

> **Purpose:** Real-world STL and SVG files used to validate every Preflight scanner rule fires correctly on known inputs. These are load-bearing — Phase 2/3 rule implementations are tested against these exact files.
> **Owner:** Matt (gathering) · curated in Phase 0 sub-task 0.1.
> **Spec source:** `docs/projects/fabrication-pipeline.md` §5 (STL rules) + §6 (SVG rules).

## Structure

```
fixtures/
  README.md              ← this file
  known-good/            ← files that SHOULD pass on their intended machine
    stl/
    svg/
  known-broken/          ← files that SHOULD be caught by a specific rule
    stl/
    svg/
  borderline/            ← files where reasonable people disagree — threshold-tuning
    stl/
    svg/
```

Each file gets a sidecar YAML with the same stem:

```
known-broken/stl/wall-too-thin-phone-stand.stl
known-broken/stl/wall-too-thin-phone-stand.meta.yaml
```

## Sidecar format

```yaml
source: "Matt / Year 10 student A (anonymised)"
intended_machine: "bambu_x1c"     # must match a machine profile id
expected_result: "block"           # pass | warn | block
triggers_rules:                    # list rule IDs from spec §5/§6
  - R-STL-09                       # wall thickness < nozzle × 1.5
notes: |
  Phone stand with 0.3mm back wall. Classic case — student modelled
  in Tinkercad without thinking about nozzle size. Caught by R-STL-09
  at threshold `wall < nozzle * 1.5`.
date_added: 2026-04-19
anonymised: true
```

### Field reference

- `source` — who contributed the file. Anonymise student names (`Year 10 student A`).
- `intended_machine` — a `machine_profiles.id` the scanner should be tested against.
- `expected_result` — exactly one of `pass` | `warn` | `block`. If multiple rules fire, use the highest severity.
- `triggers_rules` — every rule ID the scanner is expected to flag. Order doesn't matter. Empty array `[]` for known-good files (asserts NO rules fire).
- `notes` — free text explaining context. Helpful for future threshold-tuning discussions.
- `date_added` — ISO date.
- `anonymised` — `true` if student identifiers were stripped.

## Target coverage

### STL — aim for ≥20 files

| Bucket | Count | Coverage requirement |
|---|---|---|
| `known-good/` | ≥8 | Variety of complexity: simple (box), medium (phone stand), complex (multi-part assembly). Multiple machines. |
| `known-broken/` | ≥10 | At least 1 file per BLOCK-severity rule (R-STL-01, R-STL-02, R-STL-05, R-STL-06, R-STL-09). At least 1 file per common WARN rule (R-STL-07, R-STL-11, R-STL-13). |
| `borderline/` | ≥2 | Files where Matt's "block or warn?" instinct is 50/50 — used to document threshold rationale. |

**Critical coverage:**
- **R-STL-07 (unit mismatch mm vs inch)** — this is the #1 real-world student error. Need ≥2 files demonstrating it at different scales.
- **R-STL-09 (wall < nozzle × 1.5)** — the #1 printability error. Need ≥2 files at different thresholds.

### SVG — aim for ≥20 files across ≥2 manufacturer conventions

| Bucket | Count | Coverage requirement |
|---|---|---|
| `known-good/` | ≥8 | Mix of Glowforge convention, xTool convention, Inkscape/Illustrator export. Include files with cut + score + engrave layers. |
| `known-broken/` | ≥10 | At least 1 file per BLOCK rule (R-SVG-01, R-SVG-02, R-SVG-04, R-SVG-07, R-SVG-10). At least 1 file per common WARN (R-SVG-03, R-SVG-05, R-SVG-08). |
| `borderline/` | ≥2 | Edge cases for threshold-tuning. |

**Critical coverage:**
- **R-SVG-10 (un-outlined `<text>`)** — very common classroom error. Include ≥2 files with different fonts.
- **R-SVG-02 (viewBox vs dimension unit mismatch)** — the "came out tiny" error. Include ≥2 variations.
- **R-SVG-03 (no explicit units, px only)** — Inkscape default export. Include ≥2.

## What to do if you can't hit 20

If Matt's archive + student work yields <20 of either format:

- Open a GitHub issue "Preflight fixtures underweighted: STL=N, SVG=N".
- Document in `phase-0-decisions.md` which rules have no fixture coverage.
- **Rules without fixture coverage must ship at WARN, never BLOCK in v1** — they aren't validated against real inputs.
- Phase 1 proceeds with the narrower catalogue; fixtures grow organically as the pilot runs.

## Anonymisation

Student files must be scrubbed before committing:

- Rename files to descriptive labels (`phone-stand-v3-wall-too-thin.stl`, not `ella_phone_stand_final.stl`).
- If STL metadata (header, author field in some exporters) contains names, strip it — trimesh can round-trip via `mesh.export(... include_attributes=False)`.
- SVG files often contain `<desc>`, `<title>`, Adobe exporter metadata — strip before commit.
- Sidecar YAML references students as `Year X student A/B/C` only.

## License / distribution

These fixtures live in the StudioLoom repo. They're used for testing only, never distributed or published. No additional licensing needed — treat them as internal test assets.

## Committing fixtures

```bash
# Batch commit per bucket to keep diffs readable:
git add docs/projects/fabrication/fixtures/known-good/stl/
git commit -m "chore(preflight): add known-good STL fixtures (Phase 0.1)"

git add docs/projects/fabrication/fixtures/known-broken/stl/
git commit -m "chore(preflight): add known-broken STL fixtures (Phase 0.1)"

# etc.
```

Large STLs (>10MB) — check Git LFS is set up before committing. Most student STLs are <5MB so shouldn't be an issue, but watch for exports from Fusion 360 with high triangle counts.

## Ownership

Matt owns gathering. Future maintenance: when a new scanner rule is added (v2, v3), a fixture demonstrating it is added in the same commit as the rule.
