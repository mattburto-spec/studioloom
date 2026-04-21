# Preflight Fixture Bucket Proposal — Phase 2-0a

> Auto-drafted from `INSPECTION.json` on 21 Apr 2026. Review and mark overrides
> inline as **MATT:** comments before 2-0b applies the plan.

---

## Executive summary

- **53 fixtures** inspected (31 STL + 22 SVG). No inspection errors.
- **15 of 31 STLs are watertight** — the other 16 are natural known-broken candidates for R-STL-01.
- **1 STL is literally zero-volume** (`Kohta Pawn.stl`, bbox 0×0×0) → perfect R-STL-05 fixture.
- **Multiple `_fixed` / `_fixed_fixed` pairs** — gold for before/after R-STL-01 comparisons.
- **7 SVGs contain un-outlined `<text>`** → R-SVG-10 BLOCK coverage is saturated.
- **1 SVG shows classic unit mismatch** (`그리기-1.svg` — width 297mm vs viewBox 742.5) → R-SVG-02 BLOCK.
- **1 SVG uses `100%` width** (`Flower coaster.svg`) → R-SVG-03 WARN.

**Proposed bucket counts:**

| Bucket | STL | SVG | Total |
|---|---:|---:|---:|
| `known-good/` | 9 | 11 | 20 |
| `known-broken/` | 14 | 8 | 22 |
| `borderline/` | 4 | 3 | 7 |
| `drop` (duplicates / useless) | 4 | 0 | 4 |
| **Total** | **31** | **22** | **53** |

Both formats clear the README target (≥20 fixtures each). Phase 2A can begin on the STL corpus as soon as 2-0b lands.

---

## Dedup decisions

### STL dedups (4 drops)

| Group | Keep | Drop | Reasoning |
|---|---|---|---|
| `qw white Bishop.stl` + `qw white Fabulous Duup1.stl` | `qw white Bishop.stl` | `qw white Fabulous Duup1.stl` | Identical face count (96), identical volume (14097). "Duup1" in the name gave it away. |
| `inside bit.stl`, `inside bit 2.stl`, `inside bit 3.stl` | `inside bit.stl` (keep as single-wall thin test), `inside bit 3.stl` (different bbox Z=18.3 — variant, keep) | `inside bit 2.stl` (identical to `inside bit.stl` — face count 1176, bbox match) | Two are identical, third is a shorter variant. |
| `15mm thing.stl`, `15mm thing 2.stl`, `15mm thing 3.stl` | `15mm thing.stl` (Z=1.2, flat-sheet variant — useful for R-STL-13 "no flat base" edge case), `15mm thing 3.stl` (Z=25, normal) | `15mm thing 2.stl` (close copy of `15mm thing 3.stl`, both ~1200 faces, near-identical bbox) | 3 variants, 2 unique. |
| `Jisoo_Gold_Chess pieces.stl` + `jisoo gold.stl` | `jisoo gold.stl` (cleaner filename, fewer components) | `Jisoo_Gold_Chess pieces.stl` (54 components, 129k faces — likely the combined unfinished version) | Same student, same design iteration; keep the cleaner one. |

**MATT:** confirm the keeps above, especially `inside bit` trio — if they're actually three distinct pieces of an assembly (not copies) this dedup is wrong.

### SVG dedups (0 drops)

The two `box.svg` files are **different** designs (root 297×420 with 4 paths; `new svgs/` 500×353 with 12 paths). Both keep. Similarly `그리기.svg` and `new svgs/그리기.svg` are different (different path counts). Both keep. New anonymised names disambiguate.

---

## Proposed STL bucketing

Legend: **Bucket** · **Expected rules** · **Expected result** · **Confidence**

### `known-good/stl/` (9 files — watertight, sane, useful diversity)

| Current filename | Proposed filename | Watertight | Faces | BBox (mm) | Confidence | Notes |
|---|---|:---:|---:|---|:---:|---|
| `15mm thing 3.stl` | `small-cube-25mm.stl` | ✅ | 1208 | 22×19×25 | high | Clean small test cube. |
| `Back Wheel.stl` | `wheel-back-toy-vehicle.stl` | ✅ | 2800 | 40×25×40 | high | 6 components — hub + spokes. Fine, prints in place. |
| `Front Wheel.stl` | `wheel-front-toy-vehicle.stl` | ✅ | 3160 | 35×15×35 | high | 12 components but watertight. Good multi-component baseline. |
| `Kohta Pawn.stl` | ⚠️ **MOVE to known-broken** (zero volume) | ✅ | 1658 | 0×0×0 | high | bbox reports 0×0×0 — **this is R-STL-05 degenerate, not known-good.** Reclassifying. |
| `inside bit.stl` | `pin-cylindrical-15mm.stl` | ✅ | 1176 | 15×15×20 | high | Small cylindrical pin. Clean. |
| `inside bit 3.stl` | `pin-cylindrical-15mm-shortvariant.stl` | ✅ | 1176 | 15×15×18 | high | Same design, 2mm shorter. |
| `mount.stl` | `mount-bracket-130mm.stl` | ✅ | 23562 | 130×60×35 | high | Utility mount bracket. Largest clean file. |
| `quwei white_fixed_fixed.stl` | `anon-chess-piece-repaired.stl` | ✅ | 1186 | 22×30×75 | high | End of the `_fixed_fixed` chain — THE happy path for a repair case study. |
| `qw white Bishop.stl` | `chess-bishop-60mm.stl` | ✅ | 96 | 30×30×60 | high | Very low-poly chess piece. Watertight. |
| `qw white Pawn.stl` | `chess-pawn-40mm.stl` | ✅ | 96 | 30×30×40 | high | Low-poly pawn. |

Correcting myself: `Kohta Pawn` is moving to known-broken. That leaves **9 known-good STLs** as stated in the exec summary (recount below includes the move).

### `known-broken/stl/` (14 files)

| Current filename | Proposed filename | Watertight | Components | Expected result | Triggers rules | Confidence | Reasoning |
|---|---|:---:|---:|:---:|---|:---:|---|
| `Kohta Pawn.stl` | `degenerate-zero-volume-pawn.stl` | ✅ (misleading) | 1 | BLOCK | R-STL-05 | high | bbox 0×0×0 — mesh is degenerate. |
| `Jisoo_Gold_Chess pieces.stl` | DROP (dedup) | — | — | — | — | — | See dedup table. |
| `Seahorse Tinker.stl` | `seahorse-not-watertight.stl` | ❌ | 14 | BLOCK | R-STL-01 | high | Classic Tinkercad output with holes. |
| `Whale Tinker.stl` | `whale-not-watertight.stl` | ❌ | 6 | BLOCK | R-STL-01, R-STL-04 (islands) | high | Tinkercad whale; not watertight + multiple disconnected components. |
| `Yueun Park - White.stl` | `anon-chess-board-174-components.stl` | ❌ | 174 | BLOCK | R-STL-01, R-STL-04 | medium | 174 disconnected components — may be intentional (board + all pieces) but violates single-print assumption. |
| `devin1 blue1 white.stl` | `anon-figurine-not-watertight.stl` | ❌ | 9418 faces | BLOCK | R-STL-01 | high | Complex figurine, has holes. |
| `enhao31.stl` | `anon-small-holes-10mm.stl` | ❌ | 2 | BLOCK | R-STL-01, R-STL-04 | medium | Small 10×10×8 mesh, not watertight, 2 components. |
| `jisoo gold.stl` | `anon-chess-set-assembly.stl` | ❌ | 16 | BLOCK | R-STL-01, R-STL-04 | medium | 16 components; 92k faces; combined chess set export. |
| `quwei white.stl` | `anon-chess-piece-raw-broken.stl` | ❌ | — | BLOCK | R-STL-01 | high | Raw student export, not watertight. PAIRED WITH `quwei white_fixed_fixed` (known-good) for teaching-moment demo. |
| `qw blue queen2.stl` | `anon-chess-queen-broken.stl` | ❌ | — | BLOCK | R-STL-01 | high | Low face count (418), not watertight. |
| `qw white King.stl` | `chess-king-broken-holes.stl` | ❌ | — | BLOCK | R-STL-01 | high | King piece with geometry holes. |
| `qw white Rook.stl` | `chess-rook-broken-holes.stl` | ❌ | — | BLOCK | R-STL-01 | high | Rook piece with holes. |
| `qw white new.stl` | `chess-queen-broken-holes.stl` | ❌ | — | BLOCK | R-STL-01 | high | Queen piece with holes. |
| `qw whte Knight.stl` | `chess-knight-broken-holes.stl` | ❌ | — | BLOCK | R-STL-01 | high | Knight piece, typo in original filename. |
| `yuna.stl` | `anon-figurine-medium-broken.stl` | ❌ | — | BLOCK | R-STL-01 | medium | 34k faces, not watertight. |
| `yunji anycolout design tinker.stl` | `anon-flat-design-tinker-broken.stl` | ❌ | — | BLOCK | R-STL-01 | medium | 132×108×34 flat design, 153k faces, Tinkercad-sourced (typo "anycolout" = "any colour"). |

### `borderline/stl/` (4 files)

| Current filename | Proposed filename | Why borderline | Expected result | Rules |
|---|---|---|:---:|---|
| `15mm thing.stl` | `small-flat-sheet-1mm-thick.stl` | Z=1.2mm — borderline R-STL-13 "no flat base" depending on threshold. Also tests R-STL-09 thin-wall at exactly 1.2mm. | warn | R-STL-13 (maybe), R-STL-09 (threshold-dependent) |
| `Yueun Park - White_fixed (1).stl` | `anon-chess-board-repaired-4-components.stl` | Repaired version of `White.stl` — now only 4 components. Is this "fixed enough"? Depends on whether intentional multi-part. | warn | R-STL-04 |
| `quwei white_fixed.stl` | `anon-chess-piece-partially-fixed.stl` | Intermediate repair state — is it fully fixed or still has micro-holes? Good threshold test. | pass? warn? | R-STL-01 (depends on threshold) |
| `Front Wheel.stl` | (already known-good, consider moving here) | 12 components on a "wheel" feels high. If R-STL-04 fires strict, this flips. | — | — |

**MATT:** decide on `Front Wheel.stl` — keep in known-good or move to borderline?

---

## Proposed SVG bucketing

### `known-good/svg/` (11 files)

| Current filename | Proposed filename | Confidence | Notes |
|---|---|:---:|---|
| `new svgs/back.svg` | `makercase-box-back-panel.svg` | high | 2 red-stroke paths, 297×420mm. Clean. |
| `new svgs/bottom.svg` | `makercase-box-bottom-panel.svg` | high | 2 red-stroke paths. |
| `new svgs/front.svg` | `makercase-box-front-panel.svg` | high | 2 red-stroke paths. |
| `new svgs/right.svg` | `makercase-box-right-panel.svg` | high | 2 red-stroke paths. |
| `new svgs/topbottom.svg` | `makercase-box-topbottom-panel.svg` | high | 4 red-stroke paths. |
| `new svgs/box-all.svg` | `makercase-box-all-panels.svg` | high | 12 paths, all red. 466×383mm. |
| `new svgs/box.svg` | `makercase-box-assembled.svg` | medium | Has `<text>` (probably a Makercase label). **MATT:** is the text inside `<defs>` and therefore harmless, or actually on the cutting layer? If visible on layer → move to known-broken R-SVG-10. |
| `new svgs/Zeichnung.svg` | `inkscape-single-path-a4.svg` | high | 1 red path on A4. Textbook happy-path. |
| `new svgs/coaster new.svg` | `coaster-simple-orange.svg` | high | 1 path using `#ff6600`. **MATT:** is orange in your machine's color map? If no → known-broken R-SVG-04. |
| `new svgs/clove coaster.svg` | `coaster-clove-no-stroke-attr.svg` | medium | No explicit stroke color (shows `none`). Might fail R-SVG-04 "color not in map" or be fine if machine has a default. |
| `yubo1.svg` | `anon-student-a-box-297x420.svg` | high | 6 red paths. |
| `yubo2.svg` | `anon-student-a-box-420x297.svg` | high | 6 red paths. Rotated variant of above. |

That's 12 listed — I'll move either `box.svg` or `coaster new.svg` into borderline after you decide below, giving 11.

### `known-broken/svg/` (8 files)

| Current filename | Proposed filename | Expected | Triggers | Confidence | Reasoning |
|---|---|:---:|---|:---:|---|
| `new svgs/그리기-1.svg` | `korean-draw-unit-mismatch.svg` | BLOCK | R-SVG-02, R-SVG-12/13 (raster) | high | width 297mm, viewBox width 742.5 — classic unit mismatch. Also has embedded raster. |
| `new svgs/Flower coaster.svg` | `coaster-flower-percent-width.svg` | WARN | R-SVG-03 | high | `width="100%"`, no explicit mm/in — Inkscape quirk. |
| `new svgs/HingeBox (done).svg` | `hingebox-mixed-colors-text-raster.svg` | BLOCK | R-SVG-04 (4 stroke colors — black, blue, red, rgb), R-SVG-10 (text), R-SVG-12 (raster) | high | Richest multi-violation fixture. |
| `new svgs/box-allcc.svg` | `box-makercase-odd-colors.svg` | BLOCK | R-SVG-04, R-SVG-10 | high | Uses `#304fbf` and `#da0000` — not standard Glowforge/xTool colors. Has text. |
| `new svgs/drawing.svg` | `drawing-mixed-colors-with-text.svg` | BLOCK | R-SVG-04 (cyan `#00ffff`, black + red), R-SVG-10 (text) | high | Multi-color + un-outlined text. |
| `new svgs/jordan2.svg` | `anon-large-file-perf-fixture.svg` | WARN | R-SVG-13 (raster transparency?), R-SVG-14 (cut time estimate goes huge) | medium | 2.3MB with embedded raster. Also a **perf stress-test** fixture — Phase 2A/2B will measure scan latency against this. **MATT:** classify intent — is this primarily a perf fixture? If yes keep in borderline. |
| `box.svg` (root) | `legacy-box-with-text.svg` | BLOCK | R-SVG-10 | medium | Root file, has un-outlined text. 4 red paths. |
| `그리기.svg` (root) | `korean-draw-text-with-strokes.svg` | BLOCK | R-SVG-10 | medium | Has text, 2 paths. |
| `그리기2.svg` (root) | `korean-draw-text-variant.svg` | BLOCK | R-SVG-10 | medium | Has text, 2 paths. 420×297. |

### `borderline/svg/` (3 files)

| Current filename | Proposed filename | Why borderline |
|---|---|---|
| `new svgs/jordan2.svg` | (move here if Matt confirms perf intent) | 2.3MB — perf stress test more than rule-coverage. |
| `new svgs/그리기.svg` | `korean-draw-raster-with-vectors.svg` | Mix of vectors + raster (R-SVG-12/13) but only 1 raster; threshold call. |
| `new svgs/box.svg` (if text harmless) | `makercase-box-assembled.svg` | Depends on whether `<text>` is in `<defs>`. Need visual inspection. |

---

## Rule-coverage matrix

> Count of fixtures expected to trigger each rule based on the proposal. Bold = 0 coverage (needs authoring per existing Phase 2B TODOs in ALL-PROJECTS.md).

### STL rules

| Rule | Severity | Expected fixtures | Count | Gap? |
|---|:---:|---|---:|:---:|
| R-STL-01 Non-watertight | **BLOCK** | 13 | 13 | ✅ saturated |
| R-STL-02 Inconsistent winding | **BLOCK** | (none observed — all 31 are winding-consistent) | 0 | **❌** |
| R-STL-03 Self-intersecting | WARN | (not detected by inspection — needs scanner) | ? | — |
| R-STL-04 Floating islands | WARN | 4 (multi-component broken files) | 4 | ✅ |
| R-STL-05 Zero-volume / degenerate | **BLOCK** | 1 (`Kohta Pawn`) | 1 | ✅ |
| R-STL-06 Exceeds bed size | **BLOCK** | 0 (largest file is 132×108, fits most beds) | 0 | **❌** — need an oversize fixture |
| R-STL-07 Unit mismatch (mm vs inch) | WARN | 0 (all files are sensible mm scale) | 0 | **❌** — README flags this as #1 real-world error; need ≥2 |
| R-STL-08 Print time exceeds max | WARN | (depends on machine profile) | ? | — |
| R-STL-09 Wall < nozzle×1.5 | **BLOCK** | 1 (`15mm thing.stl` at Z=1.2mm) borderline | 1 | needs more |
| R-STL-10 Wall < nozzle×3 | WARN | ? | ? | — |
| R-STL-11 Overhang > 45° | WARN | (needs face-normal scan) | ? | — |
| R-STL-12 Feature < 1mm | WARN | (needs scan) | ? | — |
| R-STL-13 No flat base | WARN | 0 (need an asymmetric shape) | 0 | **❌** |
| R-STL-14 Tall + thin instability | WARN | 0 | 0 | **❌** |

**STL gaps (5 rules with zero coverage): R-STL-02, R-STL-06, R-STL-07, R-STL-13, R-STL-14.**
Per README line 89, rules without fixture coverage must ship at WARN, never BLOCK. That would downgrade R-STL-02 and R-STL-06 from BLOCK to WARN in v1 — **undesirable**. Recommend authoring at least one fixture for each before 2A ships.

### SVG rules

| Rule | Severity | Expected fixtures | Count | Gap? |
|---|:---:|---|---:|:---:|
| R-SVG-01 Exceeds bed size | **BLOCK** | 0 (largest is A3-ish) | 0 | **❌** |
| R-SVG-02 ViewBox unit mismatch | **BLOCK** | 1 (`그리기-1.svg`) | 1 | needs ≥2 per README line 80 |
| R-SVG-03 No explicit units | WARN | 1 (`Flower coaster.svg`) | 1 | needs ≥2 per README line 81 |
| R-SVG-04 Stroke color not in map | **BLOCK** | 3 (HingeBox, box-allcc, drawing) | 3 | ✅ |
| R-SVG-05 Cut layer non-hairline | WARN | ? | ? | — (needs stroke-width inspection) |
| R-SVG-06 Fill on cut layer | WARN | ? | ? | — |
| R-SVG-07 Open paths on cut | **BLOCK** | 0 | 0 | **❌** — in Matt's Phase 2B TODO list |
| R-SVG-08 Duplicate cut lines | WARN | ? | ? | — |
| R-SVG-09 Features below kerf | WARN | ? | ? | — |
| R-SVG-10 Un-outlined text | **BLOCK** | 7 | 7 | ✅ saturated |
| R-SVG-11 Orphan / zero-length paths | FYI | ? | ? | — |
| R-SVG-12 Raster < 150 DPI | WARN | 3 | 3 | ✅ |
| R-SVG-13 Raster with transparency | WARN | ? (needs scan) | ? | — |

**SVG gaps (2 BLOCK rules with zero coverage): R-SVG-01, R-SVG-07.** R-SVG-07 is already in Matt's Phase 2B author-list. R-SVG-01 needs a deliberately oversized SVG (easy: set `width="10000mm"` in any happy-path fixture).

---

## Anonymization rename map

All student-identifying filenames will be renamed. Original filenames are preserved in this proposal's "Current filename" column; 2-0b will persist them in each fixture's sidecar YAML `source_filename` field for audit, and `source:` will say e.g. `"Year 10 student A (anonymised)"` per README convention.

Student-named files found:

| Original | Anonymized | Student tag in sidecar |
|---|---|---|
| `Jisoo_Gold_Chess pieces.stl` | DROPPED (dedup) | — |
| `jisoo gold.stl` | `anon-chess-set-assembly.stl` | Year X student A |
| `Kohta Pawn.stl` | `degenerate-zero-volume-pawn.stl` | Year X student B |
| `Yueun Park - White.stl` | `anon-chess-board-174-components.stl` | Year X student C |
| `Yueun Park - White_fixed (1).stl` | `anon-chess-board-repaired-4-components.stl` | Year X student C |
| `quwei white.stl` | `anon-chess-piece-raw-broken.stl` | Year X student D |
| `quwei white_fixed.stl` | `anon-chess-piece-partially-fixed.stl` | Year X student D |
| `quwei white_fixed_fixed.stl` | `anon-chess-piece-repaired.stl` | Year X student D |
| `qw blue queen2.stl` | `anon-chess-queen-broken.stl` | Year X student D (same "qw" initials?) |
| `qw white Bishop/King/Rook/Pawn/Knight/new.stl` | `chess-bishop-60mm.stl` etc. (see tables above) | Year X student D |
| `devin1 blue1 white.stl` | `anon-figurine-not-watertight.stl` | Year X student E |
| `enhao31.stl` | `anon-small-holes-10mm.stl` | Year X student F |
| `yuna.stl` | `anon-figurine-medium-broken.stl` | Year X student G |
| `yunji anycolout design tinker.stl` | `anon-flat-design-tinker-broken.stl` | Year X student H |
| `yubo1.svg`, `yubo2.svg` | `anon-student-a-box-*.svg` | Year X student I |
| `new svgs/jordan2.svg` | `anon-large-file-perf-fixture.svg` | Year X student J |
| `그리기.svg`, `그리기2.svg`, `그리기-1.svg` | (Korean "drawing" — generic, **not student-identifying by itself**) | — |

**MATT:** confirm student-tag assignments (I've guessed `qw*` = same student as `quwei*`). If wrong, I'll resplit.

Also: STL/SVG file metadata (header fields, `<desc>`, `<title>`, Adobe author tags) must be stripped as part of 2-0b's rename step. README line 97-99 covers this.

---

## Outstanding questions for Matt

1. **`inside bit` dedup** — are `inside bit.stl` and `inside bit 2.stl` actually identical (safe to drop `2`), or are they distinct pieces of an assembly?
2. **`Front Wheel.stl`** — 12 components on a wheel feels suspicious. Keep in known-good, or move to borderline pending R-STL-04 threshold decision?
3. **`new svgs/box.svg` `<text>`** — visible on cutting layer (R-SVG-10 BLOCK) or inside `<defs>` (harmless)? Quick look in Inkscape would resolve.
4. **`new svgs/coaster new.svg`** uses `#ff6600` stroke. Is orange in your default machine color map? If not → known-broken R-SVG-04.
5. **`new svgs/jordan2.svg`** — primarily perf-test or rule-coverage? Where should it live?
6. **Student tag mapping** — is `qw*` filename prefix the same student as `quwei*`? (same chess set, both start with "qw"/"quwei".)
7. **Rule-coverage gaps** — 5 STL rules + 2 SVG rules have 0 coverage. Address before 2A (author new fixtures) or ship WARN-only for those rules in v1 per README line 89?
8. **Repeat "Tinker" files** (`Seahorse Tinker.stl`, `Whale Tinker.stl`, `yunji... tinker.stl`) — all three are clearly Tinkercad exports with identical failure modes. Keep all three for R-STL-01 or dedup one?

---

## Files produced by 2-0a

- `docs/projects/fabrication/fixtures/INSPECTION.json` — machine-readable per-file structural report
- `docs/projects/fabrication/fixtures/INSPECTION.md` — human-readable table (same data)
- `docs/projects/fabrication/fixtures/BUCKET-PROPOSAL.md` — this file
- `scripts/fab-fixtures/inspect_fixtures.py` — inspection script (currently untracked; commit decision deferred to 2-0b)

None of the fixture files themselves have been touched.

---

## Next step

Matt reviews this document, marks overrides inline with **MATT:** comments, and answers questions 1–8 above. Then the 2-0b instruction block applies the approved plan: rename, move, anonymize, write sidecars, update README, commit.
