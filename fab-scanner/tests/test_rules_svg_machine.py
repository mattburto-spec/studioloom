"""Fixture-driven tests for SVG machine-fit rules (R-SVG-01..03).

Phase 2B-2. Every assertion names the expected rule ID + severity
explicitly (Lesson #38 — verify = assert expected values, not existence).

Fixture coverage:
- R-SVG-01: box-oversized-10m.svg (10000mm × 10000mm artboard, but small
  content — see Phase 8.1d-12 note below)
- R-SVG-02: korean-draw-unit-mismatch.svg (297mm / viewBox 742.5 → ratio 2.5)
- R-SVG-03: coaster-flower-percent-width.svg (width="100%")

Plus: known-good SVGs assert NO machine-fit rules fire.

Phase 8.1d-12 — R-SVG-01 now checks content bbox via cairosvg, not
the artboard. Tests that need the content-bbox path are marked
@requires_cairo and skip on macOS dev envs without libcairo. Tests
of the artboard-fallback (cairo missing OR render fails) use inline
SVGs that exercise that branch deterministically.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from conftest import FIXTURES_DIR
from rules.common import MachineProfile
from rules.svg.machine_fit import run_machine_fit_rules
from worker.svg_loader import load_svg_document


def _has_cairo() -> bool:
    """True when cairosvg + libcairo are dlopen-able. Mirrors the runtime
    check in worker.svg_bbox so tests are honest about what they cover."""
    try:
        import cairosvg  # type: ignore  # noqa: F401
    except (ImportError, OSError):
        return False
    return True


requires_cairo = pytest.mark.skipif(
    not _has_cairo(), reason="cairosvg/libcairo not available in this env"
)


def _load_fixture(relpath: str):
    return load_svg_document((FIXTURES_DIR / relpath).read_bytes())


def _load_inline(svg: str):
    """Load an inline SVG string — useful for tests that need a precise
    geometry/artboard combination without authoring a fixture file."""
    return load_svg_document(svg.encode("utf-8"))


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
# R-SVG-01 — bed size (Phase 8.1d-12: content-bbox-based, with artboard
#                     fallback when libcairo isn't available)
# ---------------------------------------------------------------------------


# Truly-oversized inline SVG: a 10m×10m rect with explicit fill so cairo
# rasterises full alpha across the whole viewbox. The artboard AND the
# geometry are both 10000×10000mm, so R-SVG-01 fires regardless of which
# bbox path is taken — no cairo dependency needed for this assertion.
_TRULY_OVERSIZED_SVG = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="10000mm" height="10000mm" viewBox="0 0 10000 10000">
  <rect x="0" y="0" width="10000" height="10000" fill="#ff0000" stroke="#000000"/>
</svg>
"""

# A 250mm × 250mm artboard with only a 90mm circle in the middle — the
# bug Matt reported during the Phase 8.1 smoke. Content fits a 200mm
# bed; the artboard does not. R-SVG-01 must NOT fire.
_COASTER_ON_BIG_ARTBOARD_SVG = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="250mm" height="250mm" viewBox="0 0 250 250">
  <circle cx="125" cy="125" r="45" stroke="#ff0000" fill="none" stroke-width="0.25"/>
</svg>
"""


def test_r_svg_01_fires_on_truly_oversized_geometry() -> None:
    """R-SVG-01 fires when the actual rendered content exceeds the bed.

    Uses an inline 10000×10000mm rect so the geometry — not just the
    artboard — is over-budget. Both bbox paths (cairo or fallback)
    must agree, so this test runs without the requires_cairo marker.
    """
    doc = _load_inline(_TRULY_OVERSIZED_SVG)
    results = run_machine_fit_rules(doc, _glowforge_plus())
    fired_ids = [r.id for r in results]
    assert "R-SVG-01" in fired_ids, (
        f"expected R-SVG-01 on a 10000mm-wide rect, got {fired_ids}"
    )

    r = next(r for r in results if r.id == "R-SVG-01")
    assert r.severity == "block"
    assert r.evidence["bed_mm"]["width"] == 495
    assert r.evidence["bed_mm"]["height"] == 279
    assert r.evidence["artboard_mm"]["width"] == 10000.0
    assert r.evidence["artboard_mm"]["height"] == 10000.0
    assert len(r.evidence["violations"]) == 2  # both axes exceed
    # bbox_source should be "content" when cairo is available, "artboard"
    # otherwise — both are correct, only the messaging changes.
    assert r.evidence["bbox_source"] in ("content", "artboard")


@requires_cairo
def test_r_svg_01_does_not_fire_on_small_content_with_huge_artboard() -> None:
    """Phase 8.1d-12 regression: a 90mm coaster on a 250mm artboard
    must NOT trip R-SVG-01 against a 495×279mm Glowforge bed.

    This was the actual smoke-test bug — students design at a generous
    artboard and the laser slicer only consumes the geometry's bbox.
    Failing this test means the rule has reverted to artboard checking.
    """
    doc = _load_inline(_COASTER_ON_BIG_ARTBOARD_SVG)
    results = run_machine_fit_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-01" not in ids, (
        f"R-SVG-01 fired on a 90mm circle inside a 250mm artboard — "
        f"the geometry fits a 495mm bed easily. Got: {ids}"
    )


@requires_cairo
def test_r_svg_01_evidence_records_content_bbox_source() -> None:
    """When cairo is available, R-SVG-01's evidence should distinguish
    artboard size from the measured content bbox so the UI / future
    debugging can tell which path fired."""
    doc = _load_inline(_TRULY_OVERSIZED_SVG)
    results = run_machine_fit_rules(doc, _glowforge_plus())
    r = next(r for r in results if r.id == "R-SVG-01")
    assert r.evidence["bbox_source"] == "content"
    # Content bbox of a fully-filled 10m rect at our render resolution
    # should be very close to 10000mm — allow a couple of percent for
    # the 4096-pixel-cap rounding.
    assert r.evidence["drawing_mm"]["width"] >= 9500
    assert r.evidence["drawing_mm"]["height"] >= 9500


def test_r_svg_01_box_oversized_fixture_geometry_is_actually_small() -> None:
    """Phase 8.1d-12 calibration: the legacy box-oversized-10m fixture
    has a 10m artboard but only ~150×300mm of actual path geometry
    (it was synthesised by rewriting width/height/viewBox on a
    makercase-derived drawing). With content-bbox checking, R-SVG-01
    must NOT fire — the fixture turned out to be the exact bug the
    rule was designed to catch.

    If a future engineer wants a fixture for "true 10m geometry",
    use _TRULY_OVERSIZED_SVG above (already covered by
    test_r_svg_01_fires_on_truly_oversized_geometry). The legacy
    fixture is preserved as a regression marker — flipping back to
    artboard checking would make this test fail loudly.

    Skips on no-cairo envs because the fallback path correctly
    surfaces the artboard violation there.
    """
    if not _has_cairo():
        pytest.skip("artboard fallback path covered separately")
    doc = _load_fixture("known-broken/svg/box-oversized-10m.svg")
    results = run_machine_fit_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-01" not in ids, (
        "box-oversized-10m's content geometry is small (~150×300mm); "
        "R-SVG-01 should not fire when content-bbox checking is active. "
        f"Got: {ids}"
    )


def test_r_svg_01_artboard_fallback_when_render_fails() -> None:
    """When the content-bbox helper returns None (cairo missing or
    render error), R-SVG-01 falls back to the artboard check.

    We exercise this by patching compute_content_bbox_mm to return
    None, regardless of whether cairo is actually installed locally.
    Important: a cairo-less prod deploy must still catch oversized
    artboards rather than silently letting them through."""
    import rules.svg.machine_fit as mf

    doc = _load_inline(_TRULY_OVERSIZED_SVG)
    original = mf.compute_content_bbox_mm
    mf.compute_content_bbox_mm = lambda *_a, **_k: None  # type: ignore[assignment]
    try:
        results = run_machine_fit_rules(doc, _glowforge_plus())
    finally:
        mf.compute_content_bbox_mm = original  # type: ignore[assignment]

    r = next(r for r in results if r.id == "R-SVG-01")
    assert r.severity == "block"
    assert r.evidence["bbox_source"] == "artboard"
    assert r.evidence["drawing_mm"]["width"] == 10000.0
    assert r.evidence["drawing_mm"]["height"] == 10000.0


def test_r_svg_01_skips_on_3d_printer_profile() -> None:
    """Laser-only rule; 3D printer profiles must not fire it even on
    a 10000mm rect (3D printers don't accept SVGs in practice, but
    belt-and-braces on the rule-level skip)."""
    doc = _load_inline(_TRULY_OVERSIZED_SVG)
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
