"""Fixture-driven tests for SVG operation-mapping rules (R-SVG-04..06).

Phase 2B-3.

Fixture coverage:
- R-SVG-04: 4 known-broken fixtures with unmapped stroke colours
- R-SVG-05: NONE (no fixture authored) - negative-only against known-good
- R-SVG-06: NONE (no fixture authored) - negative-only against known-good

Per Lesson #38: assertions name expected colours and rule IDs, not
existence. Per Lesson #44: no speculative tests for rule variants we
don't have fixtures for.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from conftest import FIXTURES_DIR
from rules.common import MachineProfile
from rules.svg.operation_mapping import (
    _normalize_colour,
    run_operation_mapping_rules,
)
from worker.svg_loader import load_svg_document


def _load_fixture(relpath: str):
    return load_svg_document((FIXTURES_DIR / relpath).read_bytes())


def _glowforge_plus() -> MachineProfile:
    """Matches conftest — seed map uses lowercase hex. Rule must normalise."""
    return MachineProfile(
        id="glowforge_plus",
        name="Glowforge Plus",
        machine_category="laser_cutter",
        bed_size_x_mm=495,
        bed_size_y_mm=279,
        bed_size_z_mm=None,
        nozzle_diameter_mm=None,
        kerf_mm=0.2,
        operation_color_map={
            "#ff0000": "cut",
            "#0000ff": "score",
            "#000000": "engrave",
        },
        rule_overrides=None,
    )


def _bambu_x1c() -> MachineProfile:
    return MachineProfile(
        id="bambu_x1c",
        name="Bambu X1C",
        machine_category="3d_printer",
        bed_size_x_mm=256,
        bed_size_y_mm=256,
        bed_size_z_mm=256,
        nozzle_diameter_mm=0.4,
        kerf_mm=None,
        operation_color_map=None,
        rule_overrides=None,
    )


# ---------------------------------------------------------------------------
# Colour normalisation — direct unit tests for the hairy bit
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("#FF0000", "#FF0000"),
        ("#ff0000", "#FF0000"),
        ("#f00", "#FF0000"),
        ("#F00", "#FF0000"),
        ("red", "#FF0000"),
        ("RED", "#FF0000"),
        ("rgb(255, 0, 0)", "#FF0000"),
        ("rgb(255,0,0)", "#FF0000"),
        ("#ff6600", "#FF6600"),
        ("orange", "#FFA500"),
        ("black", "#000000"),
        ("white", "#FFFFFF"),
        ("none", None),
        ("transparent", None),
        ("currentColor", None),
        ("", None),
        (None, None),
        ("#zzzzzz", None),  # unparseable
        ("rgb(999, 0, 0)", "#FF0000"),  # clamped to 255
    ],
)
def test_normalize_colour(raw: str | None, expected: str | None) -> None:
    assert _normalize_colour(raw) == expected


# ---------------------------------------------------------------------------
# R-SVG-04 — stroke not in map
# ---------------------------------------------------------------------------


def test_r_svg_04_fires_on_unmapped_orange_stroke() -> None:
    """coaster-orange-unmapped has a single #ff6600 stroke — not in map."""
    doc = _load_fixture("known-broken/svg/coaster-orange-unmapped.svg")
    results = run_operation_mapping_rules(doc, _glowforge_plus())
    fired_ids = [r.id for r in results]
    assert "R-SVG-04" in fired_ids, f"expected R-SVG-04 fire, got {fired_ids}"

    r = next(r for r in results if r.id == "R-SVG-04")
    assert r.severity == "block"
    assert "#FF6600" in r.evidence["unmapped_colours"]


def test_r_svg_04_fires_on_cyan_drawing() -> None:
    """drawing-mixed-colors-with-text has cyan (#00ffff) unmapped paths."""
    doc = _load_fixture("known-broken/svg/drawing-mixed-colors-with-text.svg")
    results = run_operation_mapping_rules(doc, _glowforge_plus())
    fired_ids = [r.id for r in results]
    assert "R-SVG-04" in fired_ids

    r = next(r for r in results if r.id == "R-SVG-04")
    assert r.severity == "block"
    assert "#00FFFF" in r.evidence["unmapped_colours"]


def test_hingebox_fires_r_svg_06_not_r_svg_04() -> None:
    """Sidecar drift: hingebox-mixed-colors-text-raster.meta.yaml claims
    triggers_rules includes R-SVG-04, but the file has NO unmapped stroke
    colours (only #ff0000/#000000/#0000ff/rgb(0,0,0) — all mapped).

    What it DOES have is cut-stroke paths with fill:#000000, which is
    exactly what R-SVG-06 catches. Rule is correct; sidecar is wrong.
    Tracked as FU-SVG-FIXTURE-METADATA-DRIFT.
    """
    doc = _load_fixture("known-broken/svg/hingebox-mixed-colors-text-raster.svg")
    results = run_operation_mapping_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-04" not in ids, "no unmapped strokes — R-SVG-04 must not fire"
    assert "R-SVG-06" in ids, f"expected R-SVG-06 on fill-on-cut, got {ids}"


def test_r_svg_04_fires_on_makercase_odd_colors() -> None:
    """box-makercase-odd-colors has #304fbf (navy) + #2121de (blue-ish)
    as unmapped text strokes. Red/black elsewhere ARE mapped — must not
    also show up in unmapped_colours."""
    doc = _load_fixture("known-broken/svg/box-makercase-odd-colors.svg")
    results = run_operation_mapping_rules(doc, _glowforge_plus())
    r = next(r for r in results if r.id == "R-SVG-04")
    unmapped = r.evidence["unmapped_colours"]
    # Must include at least one of the odd colours.
    assert any(c in unmapped for c in ("#304FBF", "#2121DE")), (
        f"expected odd navy colours in unmapped, got {unmapped}"
    )
    # Must NOT include #FF0000 or #000000 (those are in the map).
    assert "#FF0000" not in unmapped
    assert "#000000" not in unmapped


def test_r_svg_04_skips_on_3d_printer_profile() -> None:
    """Laser-only rule."""
    doc = _load_fixture("known-broken/svg/coaster-orange-unmapped.svg")
    results = run_operation_mapping_rules(doc, _bambu_x1c())
    ids = [r.id for r in results]
    assert "R-SVG-04" not in ids


def test_r_svg_04_resolves_inherited_stroke_from_group() -> None:
    """Phase 2B-4a fix: R-SVG-04 must fire on a path whose stroke is
    inherited from a parent <g stroke="#ff6600">. Pre-fix, this was a
    silent false-negative — the rule only looked at the element's own
    stroke attribute, so every child of an Inkscape Layers group with
    group-level colour was skipped. The single most common real-world
    DT-lab pattern.
    """
    from worker.svg_loader import load_svg_document

    svg_bytes = (
        b'<svg xmlns="http://www.w3.org/2000/svg" '
        b'width="100mm" height="100mm" viewBox="0 0 100 100">'
        b'<g stroke="#ff6600" fill="none">'
        b'<path id="child-a" d="M 0 0 L 10 10"/>'
        b'<path id="child-b" d="M 20 20 L 30 30"/>'
        b'</g>'
        b'</svg>'
    )
    doc = load_svg_document(svg_bytes)
    results = run_operation_mapping_rules(doc, _glowforge_plus())
    fired_ids = [r.id for r in results]
    assert "R-SVG-04" in fired_ids, (
        f"R-SVG-04 must inherit stroke from <g>; got {fired_ids}"
    )
    r = next(r for r in results if r.id == "R-SVG-04")
    assert "#FF6600" in r.evidence["unmapped_colours"]
    assert r.evidence["total_offending_elements"] == 2


def test_r_svg_04_nested_group_cascade() -> None:
    """Inner <g> stroke beats outer <g> stroke (closest ancestor wins)."""
    from worker.svg_loader import load_svg_document

    svg_bytes = (
        b'<svg xmlns="http://www.w3.org/2000/svg" '
        b'width="100mm" height="100mm" viewBox="0 0 100 100">'
        b'<g stroke="#ff0000">'  # outer: mapped (cut)
        b'<g stroke="#ff6600">'  # inner: unmapped
        b'<path id="inherits-inner" d="M 0 0 L 10 10"/>'
        b'</g>'
        b'<path id="inherits-outer" d="M 20 20 L 30 30"/>'
        b'</g>'
        b'</svg>'
    )
    doc = load_svg_document(svg_bytes)
    results = run_operation_mapping_rules(doc, _glowforge_plus())
    fired_ids = [r.id for r in results]
    assert "R-SVG-04" in fired_ids
    r = next(r for r in results if r.id == "R-SVG-04")
    # Only the inner-group child should count as unmapped (#FF6600).
    # The outer-group child inherits #FF0000 which IS mapped.
    assert r.evidence["unmapped_colours"] == ["#FF6600"]
    assert r.evidence["total_offending_elements"] == 1


def test_r_svg_04_explicit_none_on_child_overrides_group() -> None:
    """Explicit stroke='none' on the child terminates the cascade and
    the path is treated as not-a-cut-line (no R-SVG-04 fire)."""
    from worker.svg_loader import load_svg_document

    svg_bytes = (
        b'<svg xmlns="http://www.w3.org/2000/svg" '
        b'width="100mm" height="100mm" viewBox="0 0 100 100">'
        b'<g stroke="#ff6600">'
        b'<path id="no-stroke" d="M 0 0 L 10 10" stroke="none"/>'
        b'</g>'
        b'</svg>'
    )
    doc = load_svg_document(svg_bytes)
    results = run_operation_mapping_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-04" not in ids


def test_r_svg_04_ignores_defs_children() -> None:
    """Gradient <stop> elements inside <defs> must not be treated as
    rendered strokes. drawing-mixed-colors-with-text has many
    <stop style='stop-color:#000000'> entries inside <defs> — they are
    black, which IS in the map, so this is a weak test; the stronger
    check is that iteration doesn't even see them.
    """
    doc = _load_fixture("known-broken/svg/drawing-mixed-colors-with-text.svg")
    results = run_operation_mapping_rules(doc, _glowforge_plus())
    # R-SVG-04 fires because of cyan paths, not because of defs <stop>
    # entries. The explicit assertion is that the fire passes the
    # R-SVG-04 path — existence of the rule result is enough here.
    assert any(r.id == "R-SVG-04" for r in results)


# ---------------------------------------------------------------------------
# R-SVG-05 / R-SVG-06 — negative-only (no fixtures authored)
# ---------------------------------------------------------------------------


def test_r_svg_05_does_not_fire_on_known_good_makercase() -> None:
    """Known-good makercase SVGs use cut strokes at viewBox-pixel widths
    (~0.26 units = Inkscape's default 1px at 96dpi in mm-viewBox). These
    are below the hairline threshold, so R-SVG-05 must not fire."""
    doc = _load_fixture("known-good/svg/makercase-box-back-panel.svg")
    results = run_operation_mapping_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-05" not in ids


def test_r_svg_06_does_not_fire_on_known_good_makercase() -> None:
    """Known-good fixtures use fill='none' on cut paths. R-SVG-06 must
    stay silent."""
    doc = _load_fixture("known-good/svg/makercase-box-back-panel.svg")
    results = run_operation_mapping_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-06" not in ids


# ---------------------------------------------------------------------------
# Known-good parametric regression
# ---------------------------------------------------------------------------


KNOWN_GOOD_SVG = sorted(
    str(p.relative_to(FIXTURES_DIR))
    for p in (FIXTURES_DIR / "known-good" / "svg").glob("*.svg")
)


@pytest.mark.parametrize("relpath", KNOWN_GOOD_SVG, ids=lambda p: Path(p).name)
def test_no_operation_rules_fire_on_known_good(relpath: str) -> None:
    """All known-good SVGs must pass operation-mapping checks clean.

    If this starts failing on a new fixture, first question: does the
    fixture genuinely use only mapped colours, or did the corpus drift?
    """
    doc = _load_fixture(relpath)
    results = run_operation_mapping_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert ids == [], (
        f"known-good {relpath} fired operation rules: {ids}"
    )
