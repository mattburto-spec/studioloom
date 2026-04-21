"""Fixture-driven tests for SVG machine-fit rules (R-SVG-01..03).

Phase 2B-2. Every assertion names the expected rule ID + severity
explicitly (Lesson #38 — verify = assert expected values, not existence).

Fixture coverage:
- R-SVG-01: box-oversized-10m.svg (10000mm × 10000mm)
- R-SVG-02: korean-draw-unit-mismatch.svg (297mm / viewBox 742.5 → ratio 2.5)
- R-SVG-03: coaster-flower-percent-width.svg (width="100%")

Plus: known-good SVGs assert NO machine-fit rules fire.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from conftest import FIXTURES_DIR
from rules.common import MachineProfile
from rules.svg.machine_fit import run_machine_fit_rules
from worker.svg_loader import load_svg_document


def _load_fixture(relpath: str):
    return load_svg_document((FIXTURES_DIR / relpath).read_bytes())


def _glowforge_plus() -> MachineProfile:
    """Matches conftest._default_glowforge_plus_profile but as the
    frozen dataclass the rules consume (dispatcher maps it in prod)."""
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
    """3D printer — should cause R-SVG-01 to skip (laser-only rule)."""
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


def _generic_large_laser() -> MachineProfile:
    """600×500mm bed — big enough to fit every known-good fixture regardless
    of whether the sidecar metadata is internally consistent. Used for the
    regression-guard parametrised test.

    Why not the glowforge_plus profile the sidecars claim? Known-good SVGs
    in the corpus include A3 (297×420) and 466×383 makercase sheets that
    don't fit a Glowforge Plus (495×279). Sidecar `intended_machine` drift
    is tracked as FU-SVG-FIXTURE-MACHINE-MISMATCH; solved for the test by
    using a larger-bed profile so R-SVG-01 machine-fit is purely about the
    rule logic, not about fixture metadata consistency.
    """
    return MachineProfile(
        id="generic_large_laser",
        name="Generic Large Laser (test-only)",
        machine_category="laser_cutter",
        bed_size_x_mm=600,
        bed_size_y_mm=500,
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


# ---------------------------------------------------------------------------
# R-SVG-01 — bed size
# ---------------------------------------------------------------------------


def test_r_svg_01_fires_on_oversized_drawing() -> None:
    doc = _load_fixture("known-broken/svg/box-oversized-10m.svg")
    results = run_machine_fit_rules(doc, _glowforge_plus())
    fired_ids = [r.id for r in results]
    assert "R-SVG-01" in fired_ids, (
        f"expected R-SVG-01 on 10000mm drawing, got {fired_ids}"
    )

    r = next(r for r in results if r.id == "R-SVG-01")
    assert r.severity == "block"
    assert r.evidence["drawing_mm"]["width"] == 10000.0
    assert r.evidence["drawing_mm"]["height"] == 10000.0
    assert r.evidence["bed_mm"]["width"] == 495
    assert r.evidence["bed_mm"]["height"] == 279
    assert len(r.evidence["violations"]) == 2  # both axes exceed


def test_r_svg_01_skips_on_3d_printer_profile() -> None:
    """Laser-only rule; 3D printer profiles must not fire it even on
    the oversized fixture (3D printers don't accept SVGs in practice,
    but belt-and-braces on the rule-level skip)."""
    doc = _load_fixture("known-broken/svg/box-oversized-10m.svg")
    results = run_machine_fit_rules(doc, _bambu_x1c())
    ids = [r.id for r in results]
    assert "R-SVG-01" not in ids


def test_r_svg_01_does_not_fire_on_fitting_drawing() -> None:
    """makercase-box-back-panel is 297×420mm — fits on a 600×500 bed."""
    doc = _load_fixture("known-good/svg/makercase-box-back-panel.svg")
    results = run_machine_fit_rules(doc, _generic_large_laser())
    ids = [r.id for r in results]
    assert "R-SVG-01" not in ids


# ---------------------------------------------------------------------------
# R-SVG-02 — viewBox unit mismatch
# ---------------------------------------------------------------------------


def test_r_svg_02_fires_on_ratio_2_5() -> None:
    doc = _load_fixture("known-broken/svg/korean-draw-unit-mismatch.svg")
    results = run_machine_fit_rules(doc, _glowforge_plus())
    fired_ids = [r.id for r in results]
    assert "R-SVG-02" in fired_ids, (
        f"expected R-SVG-02 on 297mm/742.5 viewBox fixture, got {fired_ids}"
    )

    r = next(r for r in results if r.id == "R-SVG-02")
    assert r.severity == "block"
    assert r.evidence["stated_mm"]["width"] == 297.0
    assert r.evidence["stated_mm"]["height"] == 420.0
    assert r.evidence["viewbox"]["width"] == 742.5
    assert r.evidence["viewbox"]["height"] == 1050.0
    # 742.5 / 297 = 2.5
    assert r.evidence["ratio_x"] == 2.5


def test_r_svg_02_does_not_fire_on_1_to_1_viewbox() -> None:
    """All makercase known-good fixtures use viewBox == stated mm."""
    doc = _load_fixture("known-good/svg/makercase-box-back-panel.svg")
    results = run_machine_fit_rules(doc, _generic_large_laser())
    ids = [r.id for r in results]
    assert "R-SVG-02" not in ids


def test_r_svg_02_suppressed_when_no_physical_units() -> None:
    """When stated dims are percent-based, we can't check the ratio at
    all. Only R-SVG-03 should fire, not R-SVG-02 as well."""
    doc = _load_fixture("known-broken/svg/coaster-flower-percent-width.svg")
    results = run_machine_fit_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-02" not in ids


# ---------------------------------------------------------------------------
# R-SVG-03 — no explicit units
# ---------------------------------------------------------------------------


def test_r_svg_03_fires_on_percent_width() -> None:
    doc = _load_fixture("known-broken/svg/coaster-flower-percent-width.svg")
    results = run_machine_fit_rules(doc, _glowforge_plus())
    fired_ids = [r.id for r in results]
    assert "R-SVG-03" in fired_ids, (
        f"expected R-SVG-03 on percent-width fixture, got {fired_ids}"
    )

    r = next(r for r in results if r.id == "R-SVG-03")
    assert r.severity == "warn"
    assert r.evidence["width_raw"] == "100%"
    assert r.evidence["width_issue"] == "percent"


def test_r_svg_03_does_not_fire_on_mm_dimensions() -> None:
    doc = _load_fixture("known-good/svg/anon-student-i-box-297x420.svg")
    results = run_machine_fit_rules(doc, _generic_large_laser())
    ids = [r.id for r in results]
    assert "R-SVG-03" not in ids


# ---------------------------------------------------------------------------
# Known-good parametric — nothing machine-fit-related should ever fire
# ---------------------------------------------------------------------------


KNOWN_GOOD_SVG = sorted(
    str(p.relative_to(FIXTURES_DIR))
    for p in (FIXTURES_DIR / "known-good" / "svg").glob("*.svg")
)


@pytest.mark.parametrize("relpath", KNOWN_GOOD_SVG, ids=lambda p: Path(p).name)
def test_every_known_good_svg_fires_no_machine_fit_rules(relpath: str) -> None:
    """Regression guard: known-good fixtures must never trip a BLOCK/WARN
    machine-fit rule on a sufficiently-large laser. FYI rules land in
    Phase 2B-6, not here.

    Uses _generic_large_laser() not _glowforge_plus(): the corpus includes
    A3-portrait fixtures that physically do not fit the 495×279 Glowforge
    Plus bed. The rule IS working correctly when it flags those — the
    fixture metadata claiming glowforge_plus is the problem (tracked as
    FU-SVG-FIXTURE-MACHINE-MISMATCH). For this regression test we're
    checking rule logic, not fixture-metadata consistency.
    """
    doc = _load_fixture(relpath)
    results = run_machine_fit_rules(doc, _generic_large_laser())
    ids = [r.id for r in results]
    assert ids == [], f"known-good {relpath} fired machine-fit rules: {ids}"
