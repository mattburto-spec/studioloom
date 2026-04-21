#!/usr/bin/env python3
"""
Phase 2-0b step 3 — author 4 rule-targeted fixtures to fill BLOCK-severity
gaps in the corpus (R-STL-02, R-STL-06, R-STL-07, R-SVG-01).

Synthesises from already-bucketed known-good fixtures so geometry provenance
is traceable. Writes to known-broken/ with descriptive filenames.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import numpy as np  # type: ignore
import trimesh  # type: ignore
from lxml import etree  # type: ignore

REPO_ROOT = Path(__file__).resolve().parents[2]
FIX = REPO_ROOT / "docs" / "projects" / "fabrication" / "fixtures"


def author_inverted_winding() -> None:
    """R-STL-02: clone chess-pawn-40mm and flip every face's winding order."""
    src = FIX / "known-good" / "stl" / "chess-pawn-40mm.stl"
    dst = FIX / "known-broken" / "stl" / "chess-pawn-inverted-winding.stl"
    mesh = trimesh.load(str(src), process=False)
    assert isinstance(mesh, trimesh.Trimesh), "expected single mesh"
    # Flip half the faces' winding (reverse vertex order on even-indexed faces).
    # Fully inverting the whole mesh just gives a valid inside-out mesh (still
    # winding-consistent). Inverting HALF the faces produces the real-world
    # error case where the winding is inconsistent across the mesh surface.
    faces = mesh.faces.copy()
    faces[::2] = faces[::2, ::-1]
    bad = trimesh.Trimesh(vertices=mesh.vertices, faces=faces, process=False)
    bad.merge_vertices()
    data = bad.export(file_type="stl")
    if isinstance(data, str):
        data = data.encode()
    dst.write_bytes(data)
    # Verify the synthesised file actually fails the rule.
    check = trimesh.load(str(dst), process=False)
    check.merge_vertices()
    assert not check.is_winding_consistent, (
        "R-STL-02 fixture is still winding-consistent — authoring failed"
    )
    print(f"  AUTHOR  {dst.relative_to(FIX)}  (winding_consistent=False ✓)")


def author_oversized_mount() -> None:
    """R-STL-06: clone mount-bracket-130mm and scale 5× so bbox exceeds any
    reasonable 3D-printer bed."""
    src = FIX / "known-good" / "stl" / "mount-bracket-130mm.stl"
    dst = FIX / "known-broken" / "stl" / "mount-bracket-oversized.stl"
    mesh = trimesh.load(str(src), process=False)
    assert isinstance(mesh, trimesh.Trimesh)
    mesh.apply_scale(5.0)
    # New bbox should be ~650 x 300 x 175 mm — exceeds Bambu X1C (256mm bed).
    extents = mesh.bounds[1] - mesh.bounds[0]
    assert max(extents) > 500, f"scale didn't take effect: {extents}"
    data = mesh.export(file_type="stl")
    if isinstance(data, str):
        data = data.encode()
    dst.write_bytes(data)
    print(
        f"  AUTHOR  {dst.relative_to(FIX)}  (bbox {extents[0]:.0f}×{extents[1]:.0f}×{extents[2]:.0f}mm ✓)"
    )


def author_inch_mistake() -> None:
    """R-STL-07: clone chess-pawn-40mm and scale by 25.4 (the mm→inch confusion
    factor). Result: a pawn that thinks it's 40 inches (= 1016 mm) tall."""
    src = FIX / "known-good" / "stl" / "chess-pawn-40mm.stl"
    dst = FIX / "known-broken" / "stl" / "chess-pawn-inch-mistake.stl"
    mesh = trimesh.load(str(src), process=False)
    assert isinstance(mesh, trimesh.Trimesh)
    mesh.apply_scale(25.4)
    extents = mesh.bounds[1] - mesh.bounds[0]
    # Original was 30×30×40 mm; scaled = 762×762×1016 mm. Bbox diagonal ~1500mm.
    diag = float(np.linalg.norm(extents))
    assert diag > 1000, f"unit-mistake fixture too small: diag={diag}"
    data = mesh.export(file_type="stl")
    if isinstance(data, str):
        data = data.encode()
    dst.write_bytes(data)
    print(f"  AUTHOR  {dst.relative_to(FIX)}  (diag {diag:.0f}mm ✓)")


def author_oversized_svg() -> None:
    """R-SVG-01: clone makercase-box-back-panel and set width/height/viewBox
    to 10000mm so drawing exceeds any laser bed."""
    src = FIX / "known-good" / "svg" / "makercase-box-back-panel.svg"
    dst = FIX / "known-broken" / "svg" / "box-oversized-10m.svg"
    shutil.copy(str(src), str(dst))
    tree = etree.parse(str(dst), etree.XMLParser(recover=True))
    root = tree.getroot()
    # Swap dimensions. viewBox updated to match so aspect stays sane.
    root.set("width", "10000mm")
    root.set("height", "10000mm")
    root.set("viewBox", "0 0 10000 10000")
    tree.write(str(dst), xml_declaration=True, encoding="UTF-8", standalone=False)
    # Verify
    check = etree.parse(str(dst)).getroot()
    assert check.get("width") == "10000mm", "R-SVG-01 fixture width not set"
    print(f"  AUTHOR  {dst.relative_to(FIX)}  (width=10000mm ✓)")


def main() -> int:
    author_inverted_winding()
    author_oversized_mount()
    author_inch_mistake()
    author_oversized_svg()
    return 0


if __name__ == "__main__":
    sys.exit(main())
