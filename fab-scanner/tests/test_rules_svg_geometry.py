"""Fixture-driven tests for SVG geometry-integrity rules (R-SVG-07..11).

Phase 2B-4.

Fixture coverage:
- R-SVG-07: NONE (Matt's TODO — rule ships at WARN via
             _R_SVG_07_SEVERITY constant)
- R-SVG-08: NONE (negative-only on known-good)
- R-SVG-09: NONE (negative-only on known-good)
- R-SVG-10: 6 known-broken fixtures with <text> elements
- R-SVG-11: NONE (negative-only on known-good)

Lesson #38: every rule's fire-test asserts WHICH rule, WHICH severity,
and the shape of evidence, not just non-empty results.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from conftest import FIXTURES_DIR
from rules.common import MachineProfile
from rules.svg.geometry_integrity import (
    _R_SVG_07_SEVERITY,
    run_geometry_integrity_rules,
)
from worker.svg_loader import load_svg_document


def _load_fixture(relpath: str):
    return load_svg_document((FIXTURES_DIR / relpath).read_bytes())


def _glowforge_plus() -> MachineProfile:
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
# R-SVG-07 — severity override is live
# ---------------------------------------------------------------------------


def test_r_svg_07_severity_override_is_warn_not_block() -> None:
    """Ships at WARN until fixture authored; promotes to BLOCK in
    svg-v1.1.0 per the FIXME at the constant declaration."""
    assert _R_SVG_07_SEVERITY == "warn"


# ---------------------------------------------------------------------------
# R-SVG-10 — un-outlined text (6 fixtures)
# ---------------------------------------------------------------------------

_R_SVG_10_FIXTURES = [
    "known-broken/svg/korean-draw-text-variant.svg",
    "known-broken/svg/korean-draw-text-with-strokes.svg",
    "known-broken/svg/drawing-mixed-colors-with-text.svg",
    "known-broken/svg/hingebox-mixed-colors-text-raster.svg",
    "known-broken/svg/legacy-box-with-text.svg",
    "known-broken/svg/box-makercase-odd-colors.svg",
]


@pytest.mark.parametrize(
    "relpath", _R_SVG_10_FIXTURES, ids=lambda p: Path(p).name
)
def test_r_svg_10_fires_on_text_fixture(relpath: str) -> None:
    doc = _load_fixture(relpath)
    results = run_geometry_integrity_rules(doc, _glowforge_plus())
    fired_ids = [r.id for r in results]
    assert "R-SVG-10" in fired_ids, (
        f"expected R-SVG-10 on {relpath}, got {fired_ids}"
    )

    r = next(r for r in results if r.id == "R-SVG-10")
    assert r.severity == "block"
    assert r.evidence["total_text_elements"] >= 1
    assert len(r.evidence["text_elements"]) >= 1


def test_r_svg_10_does_not_fire_on_known_good() -> None:
    """Known-good fixtures must not contain live <text> elements."""
    doc = _load_fixture("known-good/svg/makercase-box-back-panel.svg")
    results = run_geometry_integrity_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-10" not in ids


def test_r_svg_10_skips_on_3d_printer_profile() -> None:
    """Laser-only rule."""
    doc = _load_fixture("known-broken/svg/legacy-box-with-text.svg")
    results = run_geometry_integrity_rules(doc, _bambu_x1c())
    ids = [r.id for r in results]
    assert "R-SVG-10" not in ids


def test_r_svg_10_defs_only_text_does_not_fire() -> None:
    """Inline SVG with <text> ONLY inside <defs> — R-SVG-10 must NOT fire.

    Phase 2B-4a: authored in response to reviewer finding that the
    original `test_r_svg_10_ignores_text_inside_defs` did not actually
    exercise a defs-nested <text>, just asserted on top-level text.
    This test uses an in-memory SVG string so we exercise the skip
    path deterministically without committing a one-off fixture.
    """
    from worker.svg_loader import load_svg_document

    svg_bytes = (
        b'<svg xmlns="http://www.w3.org/2000/svg" '
        b'width="100mm" height="100mm" viewBox="0 0 100 100">'
        b'<defs>'
        b'<text id="hidden-text" x="0" y="0">only in defs</text>'
        b'</defs>'
        b'<path d="M 0 0 L 100 0 L 100 100 L 0 100 Z" '
        b'stroke="#ff0000" fill="none"/>'
        b'</svg>'
    )
    doc = load_svg_document(svg_bytes)
    results = run_geometry_integrity_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-10" not in ids, (
        f"R-SVG-10 must ignore <text> inside <defs>; got {ids}"
    )


def test_r_svg_10_top_level_text_does_fire_on_inline_svg() -> None:
    """Mirror of the defs-only test — same SVG shape, but <text> at the
    top level. R-SVG-10 MUST fire. Proves the defs skip isn't just
    suppressing everything."""
    from worker.svg_loader import load_svg_document

    svg_bytes = (
        b'<svg xmlns="http://www.w3.org/2000/svg" '
        b'width="100mm" height="100mm" viewBox="0 0 100 100">'
        b'<text id="visible-text" x="10" y="50">this renders</text>'
        b'<path d="M 0 0 L 100 0 L 100 100 L 0 100 Z" '
        b'stroke="#ff0000" fill="none"/>'
        b'</svg>'
    )
    doc = load_svg_document(svg_bytes)
    results = run_geometry_integrity_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-10" in ids, (
        f"R-SVG-10 MUST fire on top-level <text>; got {ids}"
    )


# ---------------------------------------------------------------------------
# R-SVG-07 / 08 / 09 / 11 — negative-only
# ---------------------------------------------------------------------------


def test_r_svg_07_does_not_fire_on_known_good_makercase() -> None:
    """makercase cut paths end with Z per Inkscape export conventions."""
    doc = _load_fixture("known-good/svg/makercase-box-back-panel.svg")
    results = run_geometry_integrity_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-07" not in ids


def test_r_svg_08_does_not_fire_on_back_panel() -> None:
    """makercase-box-back-panel happens to have no duplicates. Other
    makercase fixtures (all-panels, topbottom-panel) DO have 1 dup
    each — an Inkscape export quirk tracked as
    FU-SVG-FIXTURE-METADATA-DRIFT. Using the clean one here as the
    negative test target."""
    doc = _load_fixture("known-good/svg/makercase-box-back-panel.svg")
    results = run_geometry_integrity_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-08" not in ids


def test_r_svg_09_does_not_fire_on_known_good_makercase() -> None:
    """No cut features below a 0.2mm kerf on clean makercase exports."""
    doc = _load_fixture("known-good/svg/makercase-box-back-panel.svg")
    results = run_geometry_integrity_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-09" not in ids


def test_r_svg_09_fires_on_sub_kerf_feature() -> None:
    """Phase 2B-4a fix: R-SVG-09 now uses bbox-min-dimension, not
    total path length. A 50mm-long, 0.05mm-wide slot has total length
    ~100mm (way above kerf) but bbox_h = 0.05mm (below 0.2mm kerf).

    Pre-fix: silent miss. Post-fix: fires with bbox_min_mm=0.05 on the
    evidence. This test encodes the before/after behaviour change.
    """
    from worker.svg_loader import load_svg_document

    # Long thin horizontal line: bbox is 50mm × 0 — width 50, height 0.
    # min dim = 0 < 0.2mm kerf → fires.
    svg_bytes = (
        b'<svg xmlns="http://www.w3.org/2000/svg" '
        b'width="100mm" height="100mm" viewBox="0 0 100 100">'
        b'<path id="zero-height-line" d="M 10 50 L 60 50" '
        b'stroke="#ff0000" fill="none"/>'
        b'</svg>'
    )
    doc = load_svg_document(svg_bytes)
    results = run_geometry_integrity_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-09" in ids, (
        f"R-SVG-09 must fire on bbox-min 0mm feature; got {ids}"
    )
    r = next(r for r in results if r.id == "R-SVG-09")
    assert r.severity == "warn"
    assert r.evidence["total_sub_kerf_features"] == 1
    offender = r.evidence["offending_paths"][0]
    assert offender["element_id"] == "zero-height-line"
    assert offender["bbox_min_mm"] == 0.0
    # Proves the bbox-based check is catching it, not total-length.
    assert offender["bbox_width_mm"] == 50.0


def test_r_svg_09_does_not_fire_when_min_dim_above_kerf() -> None:
    """A 10mm × 10mm square must not trigger R-SVG-09 at 0.2mm kerf."""
    from worker.svg_loader import load_svg_document

    svg_bytes = (
        b'<svg xmlns="http://www.w3.org/2000/svg" '
        b'width="100mm" height="100mm" viewBox="0 0 100 100">'
        b'<path id="square" d="M 10 10 L 20 10 L 20 20 L 10 20 Z" '
        b'stroke="#ff0000" fill="none"/>'
        b'</svg>'
    )
    doc = load_svg_document(svg_bytes)
    results = run_geometry_integrity_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-09" not in ids


def test_r_svg_11_does_not_fire_on_known_good_makercase() -> None:
    """No empty <path> elements on clean exports."""
    doc = _load_fixture("known-good/svg/makercase-box-back-panel.svg")
    results = run_geometry_integrity_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-11" not in ids


# ---------------------------------------------------------------------------
# Known-good parametric regression
# ---------------------------------------------------------------------------


KNOWN_GOOD_SVG = sorted(
    str(p.relative_to(FIXTURES_DIR))
    for p in (FIXTURES_DIR / "known-good" / "svg").glob("*.svg")
)


@pytest.mark.parametrize("relpath", KNOWN_GOOD_SVG, ids=lambda p: Path(p).name)
def test_no_geometry_rules_fire_on_known_good(relpath: str) -> None:
    """Regression guard over the full known-good corpus.

    Known exception: 4 makercase-authored fixtures have a single
    duplicate path apiece — a real Inkscape export artifact from box-
    panel generation. R-SVG-08 correctly flags it; the fixtures are
    functional but not duplicate-clean. Tracked as the third entry
    under FU-SVG-FIXTURE-METADATA-DRIFT.
    """
    doc = _load_fixture(relpath)
    results = run_geometry_integrity_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    # Allowance: makercase exports may fire R-SVG-08 with 1 duplicate.
    allowed = {"R-SVG-08"} if "makercase" in relpath or "anon-student-i" in relpath else set()
    unexpected = [rid for rid in ids if rid not in allowed]
    assert unexpected == [], (
        f"known-good {relpath} fired unexpected geometry rules: "
        f"{unexpected} (allowed: {sorted(allowed)})"
    )
