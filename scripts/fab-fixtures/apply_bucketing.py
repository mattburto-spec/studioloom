#!/usr/bin/env python3
"""
Phase 2-0b step 1 — apply the bucket decisions from BUCKET-PROPOSAL.md.

Runs the rename + move pass. Does NOT:
  - strip metadata (step 2)
  - author new rule-targeted fixtures (step 3)
  - write sidecar YAMLs (step 4)
  - commit (step 5)

Idempotent: skips any (src, dst) pair where src is already gone.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
FIX = REPO_ROOT / "docs" / "projects" / "fabrication" / "fixtures"

# Each entry: ("source_relpath", "dest_relpath") — both relative to fixtures/
# Sources include files from the root and from 'new svgs/' subdir.
RENAMES: list[tuple[str, str]] = [
    # === STL known-good (9) ===
    ("15mm thing 3.stl", "known-good/stl/small-cube-25mm.stl"),
    ("Back Wheel.stl", "known-good/stl/wheel-back-toy-vehicle.stl"),
    ("Front Wheel.stl", "known-good/stl/wheel-front-toy-vehicle.stl"),
    ("inside bit.stl", "known-good/stl/pin-cylindrical-15mm.stl"),
    ("inside bit 3.stl", "known-good/stl/pin-cylindrical-15mm-shortvariant.stl"),
    ("mount.stl", "known-good/stl/mount-bracket-130mm.stl"),
    ("quwei white_fixed_fixed.stl", "known-good/stl/anon-chess-piece-repaired.stl"),
    ("qw white Bishop.stl", "known-good/stl/chess-bishop-60mm.stl"),
    ("qw white Pawn.stl", "known-good/stl/chess-pawn-40mm.stl"),

    # === STL known-broken (14) ===
    ("Kohta Pawn.stl", "known-broken/stl/degenerate-zero-volume-pawn.stl"),
    ("Seahorse Tinker.stl", "known-broken/stl/seahorse-not-watertight.stl"),
    ("Whale Tinker.stl", "known-broken/stl/whale-not-watertight.stl"),
    ("Yueun Park - White.stl", "known-broken/stl/anon-chess-board-174-components.stl"),
    ("devin1 blue1 white.stl", "known-broken/stl/anon-figurine-not-watertight.stl"),
    ("enhao31.stl", "known-broken/stl/anon-small-holes-10mm.stl"),
    ("jisoo gold.stl", "known-broken/stl/anon-chess-set-assembly.stl"),
    ("quwei white.stl", "known-broken/stl/anon-chess-piece-raw-broken.stl"),
    ("qw blue queen2.stl", "known-broken/stl/anon-chess-queen-broken.stl"),
    ("qw white King.stl", "known-broken/stl/chess-king-broken-holes.stl"),
    ("qw white Rook.stl", "known-broken/stl/chess-rook-broken-holes.stl"),
    ("qw white new.stl", "known-broken/stl/chess-queen-broken-holes.stl"),
    ("qw whte Knight.stl", "known-broken/stl/chess-knight-broken-holes.stl"),
    ("yuna.stl", "known-broken/stl/anon-figurine-medium-broken.stl"),
    ("yunji anycolout design tinker.stl", "known-broken/stl/anon-flat-design-tinker-broken.stl"),

    # === STL borderline (4) ===
    ("15mm thing.stl", "borderline/stl/small-flat-sheet-1mm-thick.stl"),
    ("Yueun Park - White_fixed (1).stl", "borderline/stl/anon-chess-board-repaired-4-components.stl"),
    ("quwei white_fixed.stl", "borderline/stl/anon-chess-piece-partially-fixed.stl"),

    # === STL drops (4) — just delete from root; gitignore means they were never tracked ===
    # Listed here so apply() can confirm they existed and then remove them.
    # (Handled via DROPS list below rather than RENAMES.)

    # === SVG known-good (10) ===
    ("new svgs/back.svg", "known-good/svg/makercase-box-back-panel.svg"),
    ("new svgs/bottom.svg", "known-good/svg/makercase-box-bottom-panel.svg"),
    ("new svgs/front.svg", "known-good/svg/makercase-box-front-panel.svg"),
    ("new svgs/right.svg", "known-good/svg/makercase-box-right-panel.svg"),
    ("new svgs/topbottom.svg", "known-good/svg/makercase-box-topbottom-panel.svg"),
    ("new svgs/box-all.svg", "known-good/svg/makercase-box-all-panels.svg"),
    ("new svgs/Zeichnung.svg", "known-good/svg/inkscape-single-path-a4.svg"),
    ("new svgs/clove coaster.svg", "known-good/svg/coaster-clove-no-stroke-attr.svg"),
    ("yubo1.svg", "known-good/svg/anon-student-i-box-297x420.svg"),
    ("yubo2.svg", "known-good/svg/anon-student-i-box-420x297.svg"),

    # === SVG known-broken (9) ===
    ("new svgs/그리기-1.svg", "known-broken/svg/korean-draw-unit-mismatch.svg"),
    ("new svgs/Flower coaster.svg", "known-broken/svg/coaster-flower-percent-width.svg"),
    ("new svgs/HingeBox (done).svg", "known-broken/svg/hingebox-mixed-colors-text-raster.svg"),
    ("new svgs/box-allcc.svg", "known-broken/svg/box-makercase-odd-colors.svg"),
    ("new svgs/drawing.svg", "known-broken/svg/drawing-mixed-colors-with-text.svg"),
    ("new svgs/coaster new.svg", "known-broken/svg/coaster-orange-unmapped.svg"),
    ("box.svg", "known-broken/svg/legacy-box-with-text.svg"),
    ("그리기.svg", "known-broken/svg/korean-draw-text-with-strokes.svg"),
    ("그리기2.svg", "known-broken/svg/korean-draw-text-variant.svg"),

    # === SVG borderline (4) ===
    ("new svgs/box.svg", "borderline/svg/makercase-box-empty-text.svg"),
    ("new svgs/jordan2.svg", "borderline/svg/anon-large-file-perf-fixture.svg"),
    ("new svgs/그리기.svg", "borderline/svg/korean-draw-raster-with-vectors.svg"),
]

# Dropped files — gitignored at root, deleted to keep inventory honest.
DROPS: list[str] = [
    "inside bit 2.stl",
    "Jisoo_Gold_Chess pieces.stl",
    "15mm thing 2.stl",
    "qw white Fabulous Duup1.stl",
]


def main() -> int:
    moved = 0
    skipped = 0
    errors: list[str] = []

    for src_rel, dst_rel in RENAMES:
        src = FIX / src_rel
        dst = FIX / dst_rel
        if not src.exists():
            if dst.exists():
                skipped += 1  # already moved
                continue
            errors.append(f"source missing and dest missing: {src_rel}")
            continue
        if dst.exists():
            errors.append(f"dest already occupied: {dst_rel} (source still at {src_rel})")
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))
        moved += 1
        print(f"  MOVE  {src_rel}  ->  {dst_rel}")

    for d_rel in DROPS:
        d = FIX / d_rel
        if d.exists():
            d.unlink()
            print(f"  DROP  {d_rel}")

    print(f"\nMoved: {moved}")
    print(f"Already-moved skips: {skipped}")
    print(f"Dropped: {len(DROPS)}")
    if errors:
        print("\nErrors:")
        for e in errors:
            print(f"  {e}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
