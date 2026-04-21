#!/usr/bin/env python3
"""
Phase 2-0b step 4 — write a .meta.yaml sidecar for every bucketed fixture.

Format matches fixtures/README.md sidecar spec. Fields filled per the
locked decisions from BUCKET-PROPOSAL.md + Matt's Q1-Q8 answers.

Idempotent — overwrites existing sidecars (single source of truth is this
script, not manually-edited YAML). Re-run whenever decisions change.
"""

from __future__ import annotations

import sys
import textwrap
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
FIX = REPO_ROOT / "docs" / "projects" / "fabrication" / "fixtures"
DATE = "2026-04-21"

# Machine profile IDs referenced in sidecars. These match the 12 system
# templates seeded in migration 093. The machine id itself is stable even if
# the profile's row UUID changes per-environment.
BAMBU = "bambu_x1c"           # FDM, 256x256x256 bed, 0.4mm nozzle
PRUSA = "prusa_mk4s"          # FDM, 250x210x220 bed, 0.4mm nozzle
ENDER = "ender_3_v3"          # FDM, 220x220x250 bed, 0.4mm nozzle
GLOWFORGE = "glowforge_plus"  # laser, 495x279mm, kerf 0.2mm, red=cut/blue=score/black=engrave
XTOOL = "xtool_p2"            # laser, 600x308mm, kerf 0.1mm, similar color map
GWEIKE = "gweike_g2"          # laser, 500x300mm, kerf 0.15mm


# One entry per bucketed fixture. (relpath, dict of fields)
# "triggers" for known-good should be [], for known-broken the expected rules,
# for borderline the rules whose thresholds this file is near.
FIXTURES: dict[str, dict] = {
    # ========== known-good / stl (9) ==========
    "known-good/stl/small-cube-25mm.stl": {
        "source": "Matt (archive)",
        "source_filename": "15mm thing 3.stl",
        "intended_machine": BAMBU,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "Clean small test cube, 22×19×25 mm, 1208 faces, watertight. Good baseline for asserting the scanner passes a trivially-correct mesh.",
        "anonymised": False,
    },
    "known-good/stl/wheel-back-toy-vehicle.stl": {
        "source": "Matt (archive)",
        "source_filename": "Back Wheel.stl",
        "intended_machine": BAMBU,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "Watertight toy-vehicle wheel with 6 connected components (hub + spokes). Good multi-component-but-valid test — R-STL-04 threshold should NOT fire on intentional mechanical parts.",
        "anonymised": False,
    },
    "known-good/stl/wheel-front-toy-vehicle.stl": {
        "source": "Matt (archive)",
        "source_filename": "Front Wheel.stl",
        "intended_machine": BAMBU,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "Front wheel partner to back-wheel. 12 components — used to document upper bound of acceptable component count on a single print.",
        "anonymised": False,
    },
    "known-good/stl/pin-cylindrical-15mm.stl": {
        "source": "Matt (archive)",
        "source_filename": "inside bit.stl",
        "intended_machine": BAMBU,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "Small cylindrical pin, 15×15×20 mm, watertight. Tests small-but-valid feature handling.",
        "anonymised": False,
    },
    "known-good/stl/pin-cylindrical-15mm-shortvariant.stl": {
        "source": "Matt (archive)",
        "source_filename": "inside bit 3.stl",
        "intended_machine": BAMBU,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "Shorter variant of pin-cylindrical-15mm (Z=18.3 instead of 20). Same structural properties.",
        "anonymised": False,
    },
    "known-good/stl/mount-bracket-130mm.stl": {
        "source": "Matt (archive)",
        "source_filename": "mount.stl",
        "intended_machine": BAMBU,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "Utility mount bracket, 130×60×35 mm, 23k faces, watertight single component. Largest clean fixture — good for asserting scan time on a realistic part.",
        "anonymised": False,
    },
    "known-good/stl/anon-chess-piece-repaired.stl": {
        "source": "Year X student D (anonymised)",
        "source_filename": "quwei white_fixed_fixed.stl",
        "intended_machine": BAMBU,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "Endpoint of a repair chain: raw → _fixed → _fixed_fixed. Watertight, clean. Paired with known-broken/stl/anon-chess-piece-raw-broken.stl to demonstrate before/after on R-STL-01.",
        "anonymised": True,
    },
    "known-good/stl/chess-bishop-60mm.stl": {
        "source": "Year X student D (anonymised)",
        "source_filename": "qw white Bishop.stl",
        "intended_machine": BAMBU,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "Low-poly chess bishop, 30×30×60 mm, 96 faces, watertight. Useful as a small-but-valid piece.",
        "anonymised": True,
    },
    "known-good/stl/chess-pawn-40mm.stl": {
        "source": "Year X student D (anonymised)",
        "source_filename": "qw white Pawn.stl",
        "intended_machine": BAMBU,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "Low-poly chess pawn, 30×30×40 mm, 96 faces, watertight. BASIS FIXTURE for authored R-STL-02 + R-STL-07 broken variants.",
        "anonymised": True,
    },

    # ========== known-broken / stl (15 from originals + 3 authored = 18) ==========
    "known-broken/stl/degenerate-zero-volume-pawn.stl": {
        "source": "Year X student B (anonymised)",
        "source_filename": "Kohta Pawn.stl",
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-05"],
        "notes": "Bounding box is 0×0×0 mm despite having 1658 faces. Volume = 0. Mesh is structurally degenerate — vertices collapsed or coordinates NaN'd out by the exporter. Textbook R-STL-05 case.",
        "anonymised": True,
    },
    "known-broken/stl/seahorse-not-watertight.stl": {
        "source": "Matt (Tinkercad export)",
        "source_filename": "Seahorse Tinker.stl",
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-01"],
        "notes": "Tinkercad seahorse, 29k faces, not watertight, 14 disconnected components. Classic Tinkercad-exports-a-mesh-with-holes failure.",
        "anonymised": False,
    },
    "known-broken/stl/whale-not-watertight.stl": {
        "source": "Matt (Tinkercad export)",
        "source_filename": "Whale Tinker.stl",
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-01", "R-STL-04"],
        "notes": "Tinkercad whale, 2k faces, not watertight + 6 floating islands. Tests R-STL-01 and R-STL-04 together.",
        "anonymised": False,
    },
    "known-broken/stl/anon-chess-board-174-components.stl": {
        "source": "Year X student C (anonymised)",
        "source_filename": "Yueun Park - White.stl",
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-01", "R-STL-04"],
        "notes": "Student chess board with 174 disconnected components (board + every piece as separate mesh). Violates single-print assumption. 175k faces.",
        "anonymised": True,
    },
    "known-broken/stl/anon-figurine-not-watertight.stl": {
        "source": "Year X student E (anonymised)",
        "source_filename": "devin1 blue1 white.stl",
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-01"],
        "notes": "Complex figurine with interior holes. 9k faces, 38×47×97 mm.",
        "anonymised": True,
    },
    "known-broken/stl/anon-small-holes-10mm.stl": {
        "source": "Year X student F (anonymised)",
        "source_filename": "enhao31.stl",
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-01", "R-STL-04"],
        "notes": "Small 10×10×8 mm mesh, not watertight, 2 components.",
        "anonymised": True,
    },
    "known-broken/stl/anon-chess-set-assembly.stl": {
        "source": "Year X student A (anonymised)",
        "source_filename": "jisoo gold.stl",
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-01", "R-STL-04"],
        "notes": "Combined chess set export: 92k faces, 16 disconnected components, 110×29×66 mm bbox. Not watertight. Student intended single print but geometry has holes between pieces.",
        "anonymised": True,
    },
    "known-broken/stl/anon-chess-piece-raw-broken.stl": {
        "source": "Year X student D (anonymised)",
        "source_filename": "quwei white.stl",
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-01"],
        "notes": "Raw student export, not watertight (418 faces only — low-poly). Start of the quwei repair chain. PAIRS with known-good/stl/anon-chess-piece-repaired.stl for teaching-moment before/after.",
        "anonymised": True,
    },
    "known-broken/stl/anon-chess-queen-broken.stl": {
        "source": "Year X student D (anonymised)",
        "source_filename": "qw blue queen2.stl",
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-01"],
        "notes": "Low-poly chess queen, 418 faces, not watertight. Same student / iteration as quwei repair chain.",
        "anonymised": True,
    },
    "known-broken/stl/chess-king-broken-holes.stl": {
        "source": "Year X student D (anonymised)",
        "source_filename": "qw white King.stl",
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-01"],
        "notes": "Chess king, 300 faces, not watertight. Geometry has holes.",
        "anonymised": True,
    },
    "known-broken/stl/chess-rook-broken-holes.stl": {
        "source": "Year X student D (anonymised)",
        "source_filename": "qw white Rook.stl",
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-01"],
        "notes": "Chess rook, 288 faces, not watertight.",
        "anonymised": True,
    },
    "known-broken/stl/chess-queen-broken-holes.stl": {
        "source": "Year X student D (anonymised)",
        "source_filename": "qw white new.stl",
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-01"],
        "notes": "Chess queen variant, 5424 faces, not watertight. Slightly higher poly count than other broken pieces.",
        "anonymised": True,
    },
    "known-broken/stl/chess-knight-broken-holes.stl": {
        "source": "Year X student D (anonymised)",
        "source_filename": "qw whte Knight.stl",
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-01"],
        "notes": "Chess knight, 36 faces only — extremely low-poly. Not watertight. Original filename had typo ('whte').",
        "anonymised": True,
    },
    "known-broken/stl/anon-figurine-medium-broken.stl": {
        "source": "Year X student G (anonymised)",
        "source_filename": "yuna.stl",
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-01"],
        "notes": "Medium-complexity figurine, 34k faces, 75×15×61 mm. Not watertight.",
        "anonymised": True,
    },
    "known-broken/stl/anon-flat-design-tinker-broken.stl": {
        "source": "Year X student H (anonymised, Tinkercad)",
        "source_filename": "yunji anycolout design tinker.stl",
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-01"],
        "notes": "Tinkercad flat design, 132×108×34 mm, 153k faces. Not watertight. Tests R-STL-01 on a large flat geometry rather than a figurine.",
        "anonymised": True,
    },
    # Authored fixtures (R-STL-02, R-STL-06, R-STL-07)
    "known-broken/stl/chess-pawn-inverted-winding.stl": {
        "source": "Authored from chess-pawn-40mm.stl (21 Apr 2026)",
        "source_filename": None,
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-02"],
        "notes": "SYNTHETIC FIXTURE. Derived from chess-pawn-40mm.stl by reversing vertex winding on every other face. Result: is_winding_consistent=False. Authored because the natural corpus had zero R-STL-02 coverage (all 31 original STLs were winding-consistent).",
        "anonymised": False,
    },
    "known-broken/stl/mount-bracket-oversized.stl": {
        "source": "Authored from mount-bracket-130mm.stl (21 Apr 2026)",
        "source_filename": None,
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-06"],
        "notes": "SYNTHETIC FIXTURE. Derived from mount-bracket-130mm.stl scaled 5×. Bbox 650×300×175 mm — exceeds Bambu X1C (256mm bed) on all axes. Exists because the natural corpus had no oversize file.",
        "anonymised": False,
    },
    "known-broken/stl/chess-pawn-inch-mistake.stl": {
        "source": "Authored from chess-pawn-40mm.stl (21 Apr 2026)",
        "source_filename": None,
        "intended_machine": BAMBU,
        "expected_result": "block",
        "triggers_rules": ["R-STL-07", "R-STL-06"],
        "notes": "SYNTHETIC FIXTURE. Derived from chess-pawn-40mm.stl scaled by 25.4 — the classic mm→inch confusion factor. Bbox diagonal ~1500 mm. Triggers both R-STL-07 (unit mismatch) and R-STL-06 (exceeds bed).",
        "anonymised": False,
    },

    # ========== borderline / stl (3) ==========
    "borderline/stl/small-flat-sheet-1mm-thick.stl": {
        "source": "Matt (archive)",
        "source_filename": "15mm thing.stl",
        "intended_machine": BAMBU,
        "expected_result": "warn",
        "triggers_rules": ["R-STL-09", "R-STL-13"],
        "notes": "Z=1.2 mm — right at the edge of R-STL-09 (wall < nozzle×1.5 = 0.6 mm, so 1.2 mm is twice nozzle and PASSES at default threshold). Also tests R-STL-13 flat-base rule since the whole part IS a flat base. Useful for threshold-tuning discussions.",
        "anonymised": False,
    },
    "borderline/stl/anon-chess-board-repaired-4-components.stl": {
        "source": "Year X student C (anonymised)",
        "source_filename": "Yueun Park - White_fixed (1).stl",
        "intended_machine": BAMBU,
        "expected_result": "warn",
        "triggers_rules": ["R-STL-04"],
        "notes": "Repaired version of anon-chess-board-174-components.stl — now only 4 components. Is R-STL-04 'floating islands' threshold exceeded at 4? Depends on rule config. Used to document threshold rationale.",
        "anonymised": True,
    },
    "borderline/stl/anon-chess-piece-partially-fixed.stl": {
        "source": "Year X student D (anonymised)",
        "source_filename": "quwei white_fixed.stl",
        "intended_machine": BAMBU,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "Intermediate step in the quwei repair chain — after one fix pass. Watertight. Used to document that R-STL-01 can be satisfied without a full '_fixed_fixed' re-run.",
        "anonymised": True,
    },

    # ========== known-good / svg (10) ==========
    "known-good/svg/makercase-box-back-panel.svg": {
        "source": "Matt (Makercase export)",
        "source_filename": "new svgs/back.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "2 red-stroke paths, 297×420 mm. Clean Makercase laser-cut box back panel.",
        "anonymised": False,
    },
    "known-good/svg/makercase-box-bottom-panel.svg": {
        "source": "Matt (Makercase export)",
        "source_filename": "new svgs/bottom.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "2 red-stroke paths, 210×297 mm. Bottom panel.",
        "anonymised": False,
    },
    "known-good/svg/makercase-box-front-panel.svg": {
        "source": "Matt (Makercase export)",
        "source_filename": "new svgs/front.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "2 red-stroke paths, 297×420 mm. Front panel.",
        "anonymised": False,
    },
    "known-good/svg/makercase-box-right-panel.svg": {
        "source": "Matt (Makercase export)",
        "source_filename": "new svgs/right.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "2 red-stroke paths, 297×420 mm. Right panel.",
        "anonymised": False,
    },
    "known-good/svg/makercase-box-topbottom-panel.svg": {
        "source": "Matt (Makercase export)",
        "source_filename": "new svgs/topbottom.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "4 red-stroke paths, 297×420 mm. Combined top + bottom panels.",
        "anonymised": False,
    },
    "known-good/svg/makercase-box-all-panels.svg": {
        "source": "Matt (Makercase export)",
        "source_filename": "new svgs/box-all.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "All 12 paths of an assembled box, 466×383 mm. Bigger composition, all valid red-stroke cut lines.",
        "anonymised": False,
    },
    "known-good/svg/inkscape-single-path-a4.svg": {
        "source": "Matt (Inkscape)",
        "source_filename": "new svgs/Zeichnung.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "Single red-stroke path on A4 (210×297 mm). Textbook minimal happy-path SVG.",
        "anonymised": False,
    },
    "known-good/svg/coaster-clove-no-stroke-attr.svg": {
        "source": "Matt (Inkscape)",
        "source_filename": "new svgs/clove coaster.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "6 paths with no explicit stroke color (stroke=none). Tests the 'default stroke' path through R-SVG-04 — if machine profile has a default operation, this passes; if not, flips to R-SVG-04 BLOCK.",
        "anonymised": False,
    },
    "known-good/svg/anon-student-i-box-297x420.svg": {
        "source": "Year X student I (anonymised)",
        "source_filename": "yubo1.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "6 red-stroke paths, 297×420 mm. Student box design.",
        "anonymised": True,
    },
    "known-good/svg/anon-student-i-box-420x297.svg": {
        "source": "Year X student I (anonymised)",
        "source_filename": "yubo2.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "6 red-stroke paths, 420×297 mm. Landscape variant of yubo1.",
        "anonymised": True,
    },

    # ========== known-broken / svg (9 originals + 1 authored = 10) ==========
    "known-broken/svg/korean-draw-unit-mismatch.svg": {
        "source": "Year X student J (anonymised)",
        "source_filename": "new svgs/그리기-1.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "block",
        "triggers_rules": ["R-SVG-02", "R-SVG-12"],
        "notes": "CLASSIC R-SVG-02 case: width='297mm' but viewBox width=742.5 (ratio ≠ 1). Result: drawing is scaled wrong at output. Also has embedded raster → R-SVG-12 WARN possibility.",
        "anonymised": True,
    },
    "known-broken/svg/coaster-flower-percent-width.svg": {
        "source": "Matt (Inkscape)",
        "source_filename": "new svgs/Flower coaster.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "warn",
        "triggers_rules": ["R-SVG-03"],
        "notes": "width='100%' with no explicit mm or in — Inkscape quirk. Machine guesses units, usually wrong. R-SVG-03 WARN target.",
        "anonymised": False,
    },
    "known-broken/svg/hingebox-mixed-colors-text-raster.svg": {
        "source": "Matt (Inkscape / mixed)",
        "source_filename": "new svgs/HingeBox (done).svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "block",
        "triggers_rules": ["R-SVG-04", "R-SVG-10", "R-SVG-12"],
        "notes": "Multi-violation fixture: 4 stroke colors (#000000 black OK, #0000ff blue OK, #ff0000 red OK, rgb(0,0,0) ALSO black but different syntax may confuse strict mappers) + un-outlined <text> + embedded raster. Rich test case.",
        "anonymised": False,
    },
    "known-broken/svg/box-makercase-odd-colors.svg": {
        "source": "Matt (Makercase variant)",
        "source_filename": "new svgs/box-allcc.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "block",
        "triggers_rules": ["R-SVG-04", "R-SVG-10"],
        "notes": "Uses non-standard stroke colors #304fbf (navy-ish) and #da0000 (dark red) — neither maps to Glowforge convention cleanly. Also has un-outlined text.",
        "anonymised": False,
    },
    "known-broken/svg/drawing-mixed-colors-with-text.svg": {
        "source": "Matt (Inkscape)",
        "source_filename": "new svgs/drawing.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "block",
        "triggers_rules": ["R-SVG-04", "R-SVG-10"],
        "notes": "Mixed black/cyan/red strokes (cyan #00ffff unmapped) + un-outlined text. Two BLOCK violations.",
        "anonymised": False,
    },
    "known-broken/svg/coaster-orange-unmapped.svg": {
        "source": "Matt (Inkscape)",
        "source_filename": "new svgs/coaster new.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "block",
        "triggers_rules": ["R-SVG-04"],
        "notes": "Single path with stroke='#ff6600' (orange). Matt's default machine color map is red/blue/black only — orange is unmapped. R-SVG-04 BLOCK.",
        "anonymised": False,
    },
    "known-broken/svg/legacy-box-with-text.svg": {
        "source": "Matt (archive)",
        "source_filename": "box.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "block",
        "triggers_rules": ["R-SVG-10"],
        "notes": "Legacy root-level box.svg with un-outlined <text>. 4 red paths at 297×420 mm. Distinct from new svgs/box.svg (which has EMPTY <text> — see borderline).",
        "anonymised": False,
    },
    "known-broken/svg/korean-draw-text-with-strokes.svg": {
        "source": "Year X student (anonymised)",
        "source_filename": "그리기.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "block",
        "triggers_rules": ["R-SVG-10"],
        "notes": "Student drawing with un-outlined <text>. 2 red paths at 420×297 mm.",
        "anonymised": True,
    },
    "known-broken/svg/korean-draw-text-variant.svg": {
        "source": "Year X student (anonymised)",
        "source_filename": "그리기2.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "block",
        "triggers_rules": ["R-SVG-10"],
        "notes": "Variant of korean-draw-text-with-strokes.svg. Same size + issue.",
        "anonymised": True,
    },
    # Authored SVG fixture (R-SVG-01)
    "known-broken/svg/box-oversized-10m.svg": {
        "source": "Authored from makercase-box-back-panel.svg (21 Apr 2026)",
        "source_filename": None,
        "intended_machine": GLOWFORGE,
        "expected_result": "block",
        "triggers_rules": ["R-SVG-01"],
        "notes": "SYNTHETIC FIXTURE. Derived from makercase-box-back-panel.svg with width/height/viewBox rewritten to 10000mm × 10000mm. Exceeds every machine in the seeded profile set (largest bed is ~600 mm). Authored to cover R-SVG-01.",
        "anonymised": False,
    },

    # ========== borderline / svg (3) ==========
    "borderline/svg/makercase-box-empty-text.svg": {
        "source": "Matt (Makercase export)",
        "source_filename": "new svgs/box.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "pass",
        "triggers_rules": ["R-SVG-10"],
        "notes": "Contains 3 EMPTY <text> elements at root (Makercase placeholder fields the user never filled). Strict R-SVG-10 implementation fires on any <text>; lenient implementation filters empty. Documents the 'ignore empty text' threshold decision — Matt's call: lenient, because students shouldn't be blocked by metadata they never saw.",
        "anonymised": False,
    },
    "borderline/svg/anon-large-file-perf-fixture.svg": {
        "source": "Year X student J (anonymised)",
        "source_filename": "new svgs/jordan2.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "pass",
        "triggers_rules": [],
        "notes": "2.3 MB SVG with embedded raster. PRIMARILY a perf stress-test fixture — Phase 2A/2B tests should assert scan completes in < N seconds against this file. Not a rule-coverage fixture. May also test R-SVG-13 raster-transparency if the raster has alpha.",
        "anonymised": True,
    },
    "borderline/svg/korean-draw-raster-with-vectors.svg": {
        "source": "Year X student (anonymised)",
        "source_filename": "new svgs/그리기.svg",
        "intended_machine": GLOWFORGE,
        "expected_result": "warn",
        "triggers_rules": ["R-SVG-12"],
        "notes": "Mix of vector paths + 1 embedded raster. R-SVG-12 threshold (< 150 DPI) is image-dependent — borderline case for documenting how to resolve DPI on arbitrary rasters.",
        "anonymised": True,
    },
}


def emit_yaml(entry: dict) -> str:
    """Simple YAML emitter — we control the schema tightly so no need for
    PyYAML. Multiline notes use block-scalar style."""
    lines = [f'source: "{entry["source"]}"']
    if entry.get("source_filename") is not None:
        lines.append(f'source_filename: "{entry["source_filename"]}"')
    else:
        lines.append('source_filename: null')
    lines.append(f'intended_machine: "{entry["intended_machine"]}"')
    lines.append(f'expected_result: "{entry["expected_result"]}"')
    if entry["triggers_rules"]:
        lines.append("triggers_rules:")
        for r in entry["triggers_rules"]:
            lines.append(f"  - {r}")
    else:
        lines.append("triggers_rules: []")
    lines.append("notes: |")
    for wrapped in textwrap.wrap(entry["notes"], width=90):
        lines.append(f"  {wrapped}")
    lines.append(f"date_added: {DATE}")
    lines.append(f'anonymised: {"true" if entry["anonymised"] else "false"}')
    return "\n".join(lines) + "\n"


def main() -> int:
    written = 0
    for rel, entry in FIXTURES.items():
        target = FIX / rel
        if not target.exists():
            print(f"  MISSING FIXTURE: {rel}", file=sys.stderr)
            continue
        sidecar = target.with_suffix(target.suffix + ".meta.yaml")
        # Replace e.g. "...stl.meta.yaml" pattern — we want "<stem>.meta.yaml"
        sidecar = target.parent / f"{target.stem}.meta.yaml"
        sidecar.write_text(emit_yaml(entry))
        written += 1
        print(f"  WRITE  {sidecar.relative_to(FIX)}")

    # Sanity: list every fixture without a sidecar.
    missing_sidecar = []
    for f in FIX.rglob("*"):
        if f.suffix.lower() in {".stl", ".svg"}:
            sc = f.parent / f"{f.stem}.meta.yaml"
            if not sc.exists():
                missing_sidecar.append(str(f.relative_to(FIX)))

    print(f"\nSidecars written: {written}")
    if missing_sidecar:
        print(f"Fixtures WITHOUT sidecar ({len(missing_sidecar)}):")
        for m in missing_sidecar:
            print(f"  {m}")
        return 1
    print("Every fixture has a sidecar. ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
