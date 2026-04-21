#!/usr/bin/env python3
"""
Phase 2-0b step 2 — strip identifying metadata from bucketed fixture files.

For every .stl and .svg under known-good/, known-broken/, borderline/:

  STL (binary): re-export via trimesh with a fresh, generic 80-byte header.
    - Preserves geometry (faces/vertices) exactly.
    - Wipes exporter-set author / project-path bytes from the header.

  SVG (XML): remove identifying elements/attributes:
    - <title> elements (render-invisible caption, may contain student name)
    - <desc> elements (alt-text caption)
    - sodipodi:docname attribute on root (Inkscape filename)
    - inkscape:label attribute on any element
    - <metadata> elements and their children
    - Keeps visible paths/text/styles untouched so scan results don't change.

Idempotent — running twice leaves files unchanged on second pass.
"""

from __future__ import annotations

import sys
from pathlib import Path

import trimesh  # type: ignore
from lxml import etree  # type: ignore

REPO_ROOT = Path(__file__).resolve().parents[2]
FIX = REPO_ROOT / "docs" / "projects" / "fabrication" / "fixtures"

BUCKETS = ("known-good", "known-broken", "borderline")

# Inkscape / sodipodi / RDF namespace URIs — strip attributes/elements in these.
STRIP_NS = {
    "http://www.inkscape.org/namespaces/inkscape": "inkscape",
    "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd": "sodipodi",
}


def strip_stl(path: Path) -> bool:
    """Re-export the STL through trimesh to reset the header. Returns True
    if file was modified."""
    try:
        mesh = trimesh.load(str(path), process=False)
    except Exception as e:
        print(f"  STL FAIL {path.name}: {e}", file=sys.stderr)
        return False

    if isinstance(mesh, trimesh.Scene):
        geoms = [g for g in mesh.geometry.values() if isinstance(g, trimesh.Trimesh)]
        if not geoms:
            print(f"  STL SKIP (empty scene) {path.name}", file=sys.stderr)
            return False
        mesh = geoms[0] if len(geoms) == 1 else trimesh.util.concatenate(geoms)

    if not isinstance(mesh, trimesh.Trimesh):
        print(f"  STL SKIP (not a mesh) {path.name}", file=sys.stderr)
        return False

    # trimesh binary export writes an 80-byte zeroed header by default.
    data = mesh.export(file_type="stl")
    if isinstance(data, str):
        data = data.encode()
    path.write_bytes(data)
    return True


def _localname(el: object) -> str | None:
    tag = getattr(el, "tag", None)
    return etree.QName(tag).localname if isinstance(tag, str) else None


def _namespace(el: object) -> str | None:
    tag = getattr(el, "tag", None)
    if not isinstance(tag, str):
        return None
    q = etree.QName(tag)
    return q.namespace


def strip_svg(path: Path) -> bool:
    """Remove <title>, <desc>, <metadata>, inkscape/sodipodi attributes + elements."""
    parser = etree.XMLParser(recover=True, huge_tree=True)
    try:
        tree = etree.parse(str(path), parser)
    except Exception as e:
        print(f"  SVG FAIL {path.name}: {e}", file=sys.stderr)
        return False
    root = tree.getroot()
    if root is None:
        return False

    modified = False

    # Collect elements to drop. lxml doesn't like removing while iterating.
    to_drop: list = []
    for el in root.iter():
        ln = _localname(el)
        ns = _namespace(el)
        if ln in {"title", "desc", "metadata"}:
            to_drop.append(el)
        elif ns in STRIP_NS:
            # Any element in the inkscape or sodipodi namespace — drop.
            to_drop.append(el)

    for el in to_drop:
        parent = el.getparent()
        if parent is not None:
            parent.remove(el)
            modified = True

    # Strip namespaced attributes from every remaining element.
    for el in root.iter():
        attrs_to_drop = []
        for attr_name in list(el.attrib.keys()):
            # Qualified names have '{ns}local' form when namespaced.
            if attr_name.startswith("{"):
                ns = attr_name[1:].split("}", 1)[0]
                if ns in STRIP_NS:
                    attrs_to_drop.append(attr_name)
        for a in attrs_to_drop:
            del el.attrib[a]
            modified = True

    if not modified:
        return False

    # Write back. keep_blank_text=False is default; we preserve declaration.
    tree.write(
        str(path),
        xml_declaration=True,
        encoding="UTF-8",
        standalone=False,
    )
    return True


def main() -> int:
    total = 0
    stl_modified = 0
    svg_modified = 0
    for bucket in BUCKETS:
        for kind in ("stl", "svg"):
            d = FIX / bucket / kind
            if not d.exists():
                continue
            for f in sorted(d.iterdir()):
                total += 1
                if f.suffix.lower() == ".stl":
                    if strip_stl(f):
                        stl_modified += 1
                        print(f"  STRIP STL  {f.relative_to(FIX)}")
                elif f.suffix.lower() == ".svg":
                    if strip_svg(f):
                        svg_modified += 1
                        print(f"  STRIP SVG  {f.relative_to(FIX)}")

    print(f"\nProcessed: {total}")
    print(f"STL modified: {stl_modified}")
    print(f"SVG modified: {svg_modified}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
