"""Fixture-driven tests for SVG raster rules (R-SVG-12..13).

Phase 2B-5.

Fixture coverage:
- R-SVG-12: 3 known-broken/borderline fixtures with embedded rasters
  (hingebox-mixed-colors-text-raster, korean-draw-raster-with-vectors,
  anon-large-file-perf-fixture — all expected by sidecars)
- R-SVG-13: NONE authored — tested with an inline synthetic SVG that
  embeds a RGBA PNG, so the rule has real fire-path coverage.

Lesson #38: evidence assertions name expected keys + ranges, not
just "something fired".
"""

from __future__ import annotations

import base64
import io
from pathlib import Path

import pytest
from PIL import Image

from conftest import FIXTURES_DIR
from rules.common import MachineProfile
from rules.svg.raster import run_raster_rules
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
        operation_color_map={"#ff0000": "cut", "#0000ff": "score", "#000000": "engrave"},
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


def _inline_svg_with_image(
    png_mode: str,
    pixel_size: tuple[int, int],
    rendered_mm: tuple[float, float],
) -> bytes:
    """Build a minimal SVG with one embedded <image> whose raster is
    generated in-memory with the requested PIL mode and pixel size.

    viewBox is a 1:1 mm match with stated width so both rules run.
    """
    img = Image.new(png_mode, pixel_size, color=0)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    # Use 100mm × 100mm canvas; image rendered at rendered_mm size.
    return (
        b'<svg xmlns="http://www.w3.org/2000/svg" '
        b'xmlns:xlink="http://www.w3.org/1999/xlink" '
        b'width="100mm" height="100mm" viewBox="0 0 100 100">'
        b'<image id="embedded-raster" '
        + f'width="{rendered_mm[0]}" height="{rendered_mm[1]}" '.encode()
        + f'xlink:href="data:image/png;base64,{b64}" />'.encode()
        + b'</svg>'
    )


# ---------------------------------------------------------------------------
# R-SVG-12 — raster below 150 DPI
# ---------------------------------------------------------------------------


def test_r_svg_12_fires_on_inline_low_dpi_raster() -> None:
    """100x100 pixels rendered at 100mm × 100mm = ~25 DPI. Below 150."""
    svg_bytes = _inline_svg_with_image("RGB", (100, 100), (100.0, 100.0))
    doc = load_svg_document(svg_bytes)
    results = run_raster_rules(doc, _glowforge_plus())
    fired_ids = [r.id for r in results]
    assert "R-SVG-12" in fired_ids, (
        f"expected R-SVG-12 at ~25 DPI; got {fired_ids}"
    )
    r = next(r for r in results if r.id == "R-SVG-12")
    assert r.severity == "warn"
    assert r.evidence["threshold_dpi"] == 150
    assert r.evidence["total_low_dpi_rasters"] == 1
    off = r.evidence["offending_rasters"][0]
    # 100 px / (100mm / 25.4 = 3.937 in) = 25.4 DPI
    assert 25.0 <= off["effective_dpi"] <= 26.0
    assert off["pixel_size"] == [100, 100]


def test_r_svg_12_does_not_fire_at_200_dpi() -> None:
    """800x800 px rendered at 100mm × 100mm = ~203 DPI. Above 150."""
    svg_bytes = _inline_svg_with_image("RGB", (800, 800), (100.0, 100.0))
    doc = load_svg_document(svg_bytes)
    results = run_raster_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-12" not in ids


def test_r_svg_12_skips_when_viewbox_ratio_ambiguous() -> None:
    """SVG with no stated mm — rule must stay silent (defers to R-SVG-03)."""
    svg_bytes = (
        b'<svg xmlns="http://www.w3.org/2000/svg" '
        b'xmlns:xlink="http://www.w3.org/1999/xlink" '
        b'width="100%" height="100%" viewBox="0 0 100 100">'
        b'<image width="50" height="50" '
        b'xlink:href="data:image/png;base64,iVBORw0KGgo=" />'
        b'</svg>'
    )
    doc = load_svg_document(svg_bytes)
    results = run_raster_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-12" not in ids


def test_r_svg_12_skips_on_3d_printer_profile() -> None:
    svg_bytes = _inline_svg_with_image("RGB", (100, 100), (100.0, 100.0))
    doc = load_svg_document(svg_bytes)
    results = run_raster_rules(doc, _bambu_x1c())
    ids = [r.id for r in results]
    assert "R-SVG-12" not in ids


def test_r_svg_12_fires_on_anon_large_file_fixture() -> None:
    """anon-large-file-perf-fixture embeds 5 rasters, several below 150 DPI
    (74–149 DPI). Rule fires with the low-DPI offenders listed."""
    doc = _load_fixture("borderline/svg/anon-large-file-perf-fixture.svg")
    results = run_raster_rules(doc, _glowforge_plus())
    fired_ids = [r.id for r in results]
    assert "R-SVG-12" in fired_ids, f"expected R-SVG-12; got {fired_ids}"

    r = next(r for r in results if r.id == "R-SVG-12")
    # At least 3 of the 5 embedded rasters fall below 150 DPI per
    # the sandbox survey (74, 107, 137, 142, 149).
    assert r.evidence["total_low_dpi_rasters"] >= 3
    for off in r.evidence["offending_rasters"]:
        assert off["effective_dpi"] < 150


def test_r_svg_12_hingebox_sidecar_drift_does_not_fire() -> None:
    """Sidecar drift #4: hingebox-mixed-colors-text-raster.meta.yaml
    claims triggers_rules includes R-SVG-12, but the embedded JPEG is
    375×263 px rendered at ~51.5×36.1 mm — effective DPI is 184.9,
    well above the 150 threshold. Rule correctly does NOT fire.
    Tracked under FU-SVG-FIXTURE-METADATA-DRIFT."""
    doc = _load_fixture("known-broken/svg/hingebox-mixed-colors-text-raster.svg")
    results = run_raster_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-12" not in ids


def test_r_svg_12_skips_korean_draw_unit_mismatch_ambiguous_units() -> None:
    """korean-draw-unit-mismatch has viewBox ratio 2.5:1, so R-SVG-12
    skips rather than report a possibly-wrong DPI. R-SVG-02 catches
    the unit mismatch separately (different rule group)."""
    doc = _load_fixture("known-broken/svg/korean-draw-unit-mismatch.svg")
    results = run_raster_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-12" not in ids


# ---------------------------------------------------------------------------
# R-SVG-13 — raster with transparency
# ---------------------------------------------------------------------------


def test_r_svg_13_fires_on_inline_rgba_png() -> None:
    """RGBA PNG has alpha channel → R-SVG-13 fires."""
    svg_bytes = _inline_svg_with_image("RGBA", (200, 200), (50.0, 50.0))
    doc = load_svg_document(svg_bytes)
    results = run_raster_rules(doc, _glowforge_plus())
    fired_ids = [r.id for r in results]
    assert "R-SVG-13" in fired_ids, (
        f"expected R-SVG-13 on RGBA PNG; got {fired_ids}"
    )
    r = next(r for r in results if r.id == "R-SVG-13")
    assert r.severity == "warn"
    assert r.evidence["total_transparent_rasters"] == 1
    off = r.evidence["offending_rasters"][0]
    assert off["pil_mode"] == "RGBA"


def test_r_svg_13_does_not_fire_on_inline_rgb_png() -> None:
    svg_bytes = _inline_svg_with_image("RGB", (200, 200), (50.0, 50.0))
    doc = load_svg_document(svg_bytes)
    results = run_raster_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-13" not in ids


def test_r_svg_13_does_not_fire_on_grayscale_png() -> None:
    """Mode 'L' is flat greyscale — no alpha."""
    svg_bytes = _inline_svg_with_image("L", (200, 200), (50.0, 50.0))
    doc = load_svg_document(svg_bytes)
    results = run_raster_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-13" not in ids


def test_r_svg_13_fires_on_anon_large_file_fixture() -> None:
    """All 5 rasters in anon-large-file-perf-fixture are RGBA. Real
    fixture coverage for R-SVG-13 beyond the inline synthetic test."""
    doc = _load_fixture("borderline/svg/anon-large-file-perf-fixture.svg")
    results = run_raster_rules(doc, _glowforge_plus())
    fired_ids = [r.id for r in results]
    assert "R-SVG-13" in fired_ids

    r = next(r for r in results if r.id == "R-SVG-13")
    assert r.evidence["total_transparent_rasters"] == 5
    for off in r.evidence["offending_rasters"]:
        assert off["pil_mode"] == "RGBA"


def test_r_svg_13_skips_on_3d_printer_profile() -> None:
    svg_bytes = _inline_svg_with_image("RGBA", (200, 200), (50.0, 50.0))
    doc = load_svg_document(svg_bytes)
    results = run_raster_rules(doc, _bambu_x1c())
    ids = [r.id for r in results]
    assert "R-SVG-13" not in ids


# ---------------------------------------------------------------------------
# Malformed / skipped inputs
# ---------------------------------------------------------------------------


def test_malformed_data_uri_skips_without_crashing() -> None:
    """Garbage base64 must not crash the worker."""
    svg_bytes = (
        b'<svg xmlns="http://www.w3.org/2000/svg" '
        b'xmlns:xlink="http://www.w3.org/1999/xlink" '
        b'width="100mm" height="100mm" viewBox="0 0 100 100">'
        b'<image width="50" height="50" '
        b'xlink:href="data:image/png;base64,!!!not-b64!!!" />'
        b'</svg>'
    )
    doc = load_svg_document(svg_bytes)
    results = run_raster_rules(doc, _glowforge_plus())
    # No crash is the pass condition; rules should be silent.
    ids = [r.id for r in results]
    assert "R-SVG-12" not in ids
    assert "R-SVG-13" not in ids


def test_external_url_image_is_skipped() -> None:
    """We don't fetch HTTP resources in the scan — external refs skipped."""
    svg_bytes = (
        b'<svg xmlns="http://www.w3.org/2000/svg" '
        b'xmlns:xlink="http://www.w3.org/1999/xlink" '
        b'width="100mm" height="100mm" viewBox="0 0 100 100">'
        b'<image width="50" height="50" '
        b'xlink:href="https://example.com/img.png" />'
        b'</svg>'
    )
    doc = load_svg_document(svg_bytes)
    results = run_raster_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert ids == []


# ---------------------------------------------------------------------------
# Known-good parametric regression
# ---------------------------------------------------------------------------


KNOWN_GOOD_SVG = sorted(
    str(p.relative_to(FIXTURES_DIR))
    for p in (FIXTURES_DIR / "known-good" / "svg").glob("*.svg")
)


@pytest.mark.parametrize("relpath", KNOWN_GOOD_SVG, ids=lambda p: Path(p).name)
def test_no_raster_rules_fire_on_known_good(relpath: str) -> None:
    """Known-good SVGs must not trigger raster rules. None of them
    embed raster images, so this is effectively asserting that the
    rules don't fire spuriously when no <image> elements exist."""
    doc = _load_fixture(relpath)
    results = run_raster_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert ids == [], f"known-good {relpath} fired raster rules: {ids}"
