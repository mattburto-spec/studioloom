#!/usr/bin/env python3
"""
Preflight fixture inspector — Phase 2-0a.

Walks docs/projects/fabrication/fixtures/ (root + new svgs/) and extracts
structural properties from every .stl and .svg file. Produces:

  - docs/projects/fabrication/fixtures/INSPECTION.json  (machine-readable)
  - docs/projects/fabrication/fixtures/INSPECTION.md    (human-readable table)

No side effects on fixture files. Idempotent.

Not part of the scanner — throwaway classification tool for Gate B.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

import trimesh  # type: ignore
from lxml import etree  # type: ignore

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES_DIR = REPO_ROOT / "docs" / "projects" / "fabrication" / "fixtures"

# Don't re-inspect files already living under bucketed dirs.
BUCKET_DIRS = {"known-good", "known-broken", "borderline"}

# Where we dump output.
JSON_OUT = FIXTURES_DIR / "INSPECTION.json"
MD_OUT = FIXTURES_DIR / "INSPECTION.md"


def discover_files() -> list[Path]:
    """Find every .stl and .svg in the root + 'new svgs/' subdir.

    Skips bucketed dirs (future state — none exist yet).
    """
    out: list[Path] = []
    for path in sorted(FIXTURES_DIR.iterdir()):
        if path.is_dir():
            if path.name in BUCKET_DIRS:
                continue
            # Scan one level into subdirectories like 'new svgs/'
            for child in sorted(path.iterdir()):
                if child.is_file() and child.suffix.lower() in {".stl", ".svg"}:
                    out.append(child)
        elif path.is_file() and path.suffix.lower() in {".stl", ".svg"}:
            out.append(path)
    return out


def inspect_stl(path: Path) -> dict[str, Any]:
    """Structural inspection of an STL file. No rule firing — just facts.

    We load with process=False to avoid trimesh's auto-repair pass, but
    then explicitly call merge_vertices() so that connectedness, watertight,
    and winding checks see shared edges (STL's face-soup format has no
    vertex identity on its own). Vertex-merging is structural analysis,
    not repair — two vertices at identical coordinates are genuinely the
    same point.
    """
    try:
        mesh = trimesh.load(str(path), process=False)
    except Exception as e:
        return {"error": f"load_failed: {type(e).__name__}: {e}"}

    # Some files load as a Scene containing multiple meshes — concatenate
    # to get global geometry properties.
    if isinstance(mesh, trimesh.Scene):
        geoms = [g for g in mesh.geometry.values() if isinstance(g, trimesh.Trimesh)]
        if not geoms:
            return {"error": "scene_empty"}
        if len(geoms) == 1:
            mesh = geoms[0]
        else:
            mesh = trimesh.util.concatenate(geoms)

    if not isinstance(mesh, trimesh.Trimesh):
        return {"error": f"not_a_trimesh: {type(mesh).__name__}"}

    try:
        mesh.merge_vertices()
    except Exception:
        pass  # if merging fails we still want whatever properties we can get

    try:
        components = mesh.split(only_watertight=False)
        component_count = len(components)
    except Exception:
        component_count = None

    bbox = mesh.bounds  # [[xmin,ymin,zmin],[xmax,ymax,zmax]]
    extents = (bbox[1] - bbox[0]).tolist() if bbox is not None else [None, None, None]
    diagonal = float(((bbox[1] - bbox[0]) ** 2).sum() ** 0.5) if bbox is not None else None

    # NaN / inf detection — trimesh.vertices may contain bad values on broken files.
    verts = mesh.vertices
    import numpy as np  # type: ignore

    has_nan = bool(np.isnan(verts).any() or np.isinf(verts).any())

    try:
        volume = float(mesh.volume)
    except Exception:
        volume = None

    return {
        "face_count": int(len(mesh.faces)),
        "vertex_count": int(len(mesh.vertices)),
        "is_watertight": bool(mesh.is_watertight),
        "is_winding_consistent": bool(mesh.is_winding_consistent),
        "volume_mm3": volume,
        "bbox_mm": [round(v, 3) for v in extents],
        "bbox_diagonal_mm": round(diagonal, 3) if diagonal is not None else None,
        "has_nan_or_inf": has_nan,
        "component_count": component_count,
        "file_size_bytes": path.stat().st_size,
    }


# Extract stroke colour from both stroke="..." attr and style="stroke:..." inline.
STROKE_STYLE_RE = re.compile(r"stroke\s*:\s*([^;]+)")


def _collect_stroke_colors(root: etree._Element) -> set[str]:
    colors: set[str] = set()
    for el in root.iter():
        stroke_attr = el.get("stroke")
        if stroke_attr:
            colors.add(stroke_attr.strip().lower())
        style = el.get("style")
        if style:
            m = STROKE_STYLE_RE.search(style)
            if m:
                colors.add(m.group(1).strip().lower())
    # Normalise 'none' (no stroke) separately
    return colors


def _localname(el: Any) -> str | None:
    """Safely get an element's local (namespace-stripped) tag.

    Comments, processing instructions, and other non-element nodes have
    non-string .tag values — return None so callers can skip them.
    """
    tag = getattr(el, "tag", None)
    if not isinstance(tag, str):
        return None
    return etree.QName(tag).localname


def _count_paths(root: etree._Element) -> int:
    n = 0
    for el in root.iter():
        if _localname(el) == "path":
            n += 1
    return n


def _has_text_outside_defs(root: etree._Element) -> bool:
    # Walk; if we find a <text> whose ancestry contains <defs>, skip it.
    for el in root.iter():
        if _localname(el) != "text":
            continue
        parent = el.getparent()
        inside_defs = False
        while parent is not None:
            if _localname(parent) == "defs":
                inside_defs = True
                break
            parent = parent.getparent()
        if not inside_defs:
            return True
    return False


def _has_raster(root: etree._Element) -> bool:
    for el in root.iter():
        if _localname(el) == "image":
            return True
    return False


def _parse_dim(val: str | None) -> dict[str, Any]:
    """Parse an SVG width/height attribute like '210mm' or '500' or '100%'."""
    if not val:
        return {"raw": None, "value": None, "unit": None}
    val = val.strip()
    m = re.match(r"^([0-9.+-eE]+)\s*([a-zA-Z%]*)$", val)
    if not m:
        return {"raw": val, "value": None, "unit": None}
    try:
        num = float(m.group(1))
    except ValueError:
        return {"raw": val, "value": None, "unit": None}
    unit = m.group(2) or "px"  # SVG default is px when units omitted
    return {"raw": val, "value": num, "unit": unit.lower()}


def inspect_svg(path: Path) -> dict[str, Any]:
    try:
        # Parse with recover=True so files with minor issues still yield data.
        parser = etree.XMLParser(recover=True, huge_tree=True)
        tree = etree.parse(str(path), parser)
        root = tree.getroot()
        if root is None:
            return {"error": "parse_produced_no_root"}
    except Exception as e:
        return {"error": f"parse_failed: {type(e).__name__}: {e}"}

    width = _parse_dim(root.get("width"))
    height = _parse_dim(root.get("height"))
    viewbox_raw = root.get("viewBox")
    viewbox = None
    if viewbox_raw:
        try:
            parts = re.split(r"[\s,]+", viewbox_raw.strip())
            viewbox = [float(p) for p in parts if p]
        except ValueError:
            viewbox = None

    colors = _collect_stroke_colors(root)

    # Unit-mismatch heuristic: width stated in mm but viewBox width doesn't
    # match (ratio outside 0.9..1.1 of stated mm value suggests px viewBox
    # vs mm dim — the classic "came out tiny" mis-config).
    unit_mismatch_suspected = False
    if (
        width["unit"] in {"mm", "cm", "in"}
        and viewbox is not None
        and len(viewbox) >= 4
        and width["value"] is not None
        and width["value"] > 0
    ):
        ratio = viewbox[2] / width["value"]
        if not (0.9 <= ratio <= 1.1):
            unit_mismatch_suspected = True

    return {
        "width": width,
        "height": height,
        "viewbox": viewbox,
        "viewbox_raw": viewbox_raw,
        "path_count": _count_paths(root),
        "stroke_colors_used": sorted(colors),
        "has_text_element_outside_defs": _has_text_outside_defs(root),
        "has_embedded_raster": _has_raster(root),
        "unit_mismatch_suspected": unit_mismatch_suspected,
        "file_size_bytes": path.stat().st_size,
    }


def rel_path(p: Path) -> str:
    return str(p.relative_to(FIXTURES_DIR))


def main() -> int:
    files = discover_files()
    if not files:
        print(f"No fixtures found under {FIXTURES_DIR}")
        return 1

    results: list[dict[str, Any]] = []
    for f in files:
        kind = "stl" if f.suffix.lower() == ".stl" else "svg"
        print(f"  {kind.upper()}  {rel_path(f)}", file=sys.stderr)
        if kind == "stl":
            data = inspect_stl(f)
        else:
            data = inspect_svg(f)
        results.append(
            {
                "path": rel_path(f),
                "kind": kind,
                **data,
            }
        )

    JSON_OUT.write_text(json.dumps(results, indent=2, sort_keys=True) + "\n")

    # Human-readable table
    lines = [
        "# Fixture Inspection Report",
        "",
        f"Auto-generated by `scripts/fab-fixtures/inspect_fixtures.py`. {len(results)} files.",
        "",
        "## STL",
        "",
        "| Path | Faces | Watertight | Winding | Components | BBox (mm) | Diag | Volume (mm³) | NaN |",
        "|---|---:|:---:|:---:|---:|---|---:|---:|:---:|",
    ]
    for r in results:
        if r["kind"] != "stl":
            continue
        if "error" in r:
            lines.append(
                f"| `{r['path']}` | ⚠️ {r['error']} | | | | | | | |"
            )
            continue
        bbox = r["bbox_mm"]
        bbox_str = (
            f"{bbox[0]:.1f} × {bbox[1]:.1f} × {bbox[2]:.1f}"
            if bbox and bbox[0] is not None
            else "—"
        )
        diag = r["bbox_diagonal_mm"]
        vol = r["volume_mm3"]
        diag_str = f"{diag:.1f}" if diag is not None else "—"
        vol_str = f"{vol:.0f}" if vol is not None else "—"
        nan_str = "⚠️" if r["has_nan_or_inf"] else ""
        water_str = "✅" if r["is_watertight"] else "❌"
        wind_str = "✅" if r["is_winding_consistent"] else "❌"
        lines.append(
            f"| `{r['path']}` | {r['face_count']} | {water_str} | {wind_str} "
            f"| {r['component_count']} | {bbox_str} | {diag_str} | {vol_str} | {nan_str} |"
        )

    lines += [
        "",
        "## SVG",
        "",
        "| Path | Width | Height | ViewBox | Paths | Stroke colors | Text? | Raster? | Unit mismatch? |",
        "|---|---|---|---|---:|---|:---:|:---:|:---:|",
    ]
    for r in results:
        if r["kind"] != "svg":
            continue
        if "error" in r:
            lines.append(f"| `{r['path']}` | ⚠️ {r['error']} | | | | | | | |")
            continue
        vb = r["viewbox"]
        vb_str = ", ".join(f"{v:g}" for v in vb) if vb else "—"
        colors = ", ".join(r["stroke_colors_used"]) if r["stroke_colors_used"] else "(none)"
        lines.append(
            f"| `{r['path']}` "
            f"| {r['width']['raw'] or '—'} "
            f"| {r['height']['raw'] or '—'} "
            f"| {vb_str} "
            f"| {r['path_count']} "
            f"| {colors[:60]}{'…' if len(colors) > 60 else ''} "
            f"| {'⚠️' if r['has_text_element_outside_defs'] else ''} "
            f"| {'⚠️' if r['has_embedded_raster'] else ''} "
            f"| {'⚠️' if r['unit_mismatch_suspected'] else ''} |"
        )

    MD_OUT.write_text("\n".join(lines) + "\n")

    print(
        f"\nWrote {JSON_OUT.relative_to(REPO_ROOT)} + {MD_OUT.relative_to(REPO_ROOT)}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
