"""Tests for SVG informational rules (R-SVG-14..15) and the SVG thumbnail
renderer.

Phase 2B-6. Both rules always fire on laser profiles with at least one
path; layer summary fires unconditionally.

Thumbnail tests cover the safe_render_svg fallback path (cairo missing)
and the PNG-signature happy path when cairo is available.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from conftest import FIXTURES_DIR
from rules.common import MachineProfile
from rules.svg.informational import run_informational_rules
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


# ---------------------------------------------------------------------------
# R-SVG-14 — estimated cut time
# ---------------------------------------------------------------------------


def test_r_svg_14_fires_with_minutes_estimate_on_mm_1to1_svg() -> None:
    """Inline SVG with a single 100mm red cut line. At 15 mm/s cut speed,
    that's ~0.11 min. Rule reports it."""
    from worker.svg_loader import load_svg_document

    svg_bytes = (
        b'<svg xmlns="http://www.w3.org/2000/svg" '
        b'width="100mm" height="100mm" viewBox="0 0 100 100">'
        b'<path d="M 0 50 L 100 50" stroke="#ff0000" fill="none"/>'
        b'</svg>'
    )
    doc = load_svg_document(svg_bytes)
    results = run_informational_rules(doc, _glowforge_plus())
    fired_ids = [r.id for r in results]
    assert "R-SVG-14" in fired_ids

    r = next(r for r in results if r.id == "R-SVG-14")
    assert r.severity == "fyi"
    # 100mm / 15 mm/s = 6.67s = 0.111 min. Accept small FP drift.
    assert 0.10 <= r.evidence["estimated_minutes"] <= 0.13
    assert r.evidence["per_operation_minutes"]["cut"] > 0
    assert r.evidence["per_operation_minutes"]["score"] == 0.0
    assert r.evidence["per_operation_minutes"]["engrave"] == 0.0
    assert r.evidence["path_counts_by_operation"]["cut"] == 1


def test_r_svg_14_reports_unavailable_on_ambiguous_units() -> None:
    """percent-width SVG → minutes estimate unavailable, but rule still
    fires with path counts."""
    from worker.svg_loader import load_svg_document

    svg_bytes = (
        b'<svg xmlns="http://www.w3.org/2000/svg" '
        b'width="100%" viewBox="0 0 100 100">'
        b'<path d="M 0 50 L 100 50" stroke="#ff0000" fill="none"/>'
        b'</svg>'
    )
    doc = load_svg_document(svg_bytes)
    results = run_informational_rules(doc, _glowforge_plus())
    r = next(r for r in results if r.id == "R-SVG-14")
    assert "unavailable" in r.title.lower()
    assert r.evidence["total_mapped_paths"] == 1
    # No estimated_minutes on this path.
    assert "estimated_minutes" not in r.evidence


def test_r_svg_14_skips_when_no_mapped_paths() -> None:
    """Empty SVG (or one with only unmapped strokes) → rule silent.
    R-SVG-15 handles the empty-file case instead."""
    from worker.svg_loader import load_svg_document

    svg_bytes = (
        b'<svg xmlns="http://www.w3.org/2000/svg" '
        b'width="100mm" height="100mm" viewBox="0 0 100 100">'
        b'<path d="M 0 50 L 100 50" stroke="#ff6600" fill="none"/>'
        b'</svg>'
    )
    doc = load_svg_document(svg_bytes)
    results = run_informational_rules(doc, _glowforge_plus())
    ids = [r.id for r in results]
    assert "R-SVG-14" not in ids


def test_r_svg_14_skips_on_3d_printer_profile() -> None:
    doc = _load_fixture("known-good/svg/makercase-box-back-panel.svg")
    results = run_informational_rules(doc, _bambu_x1c())
    ids = [r.id for r in results]
    assert "R-SVG-14" not in ids


def test_r_svg_14_on_real_makercase_fixture() -> None:
    """makercase-box-back-panel is 297mm × 420mm with all cut paths.
    Should get a real minutes estimate."""
    doc = _load_fixture("known-good/svg/makercase-box-back-panel.svg")
    results = run_informational_rules(doc, _glowforge_plus())
    r = next(r for r in results if r.id == "R-SVG-14")
    assert r.severity == "fyi"
    # Real file has many cut paths; estimate should be a positive number.
    assert r.evidence["estimated_minutes"] > 0
    assert r.evidence["path_counts_by_operation"]["cut"] > 0


# ---------------------------------------------------------------------------
# R-SVG-15 — layer summary
# ---------------------------------------------------------------------------


def test_r_svg_15_always_fires_on_laser_profile() -> None:
    """Even an empty SVG gets a layer summary ('no mapped paths')."""
    from worker.svg_loader import load_svg_document

    svg_bytes = (
        b'<svg xmlns="http://www.w3.org/2000/svg" '
        b'width="100mm" height="100mm" viewBox="0 0 100 100"/>'
    )
    doc = load_svg_document(svg_bytes)
    results = run_informational_rules(doc, _glowforge_plus())
    r = next(r for r in results if r.id == "R-SVG-15")
    assert r.severity == "fyi"
    assert "no mapped paths" in r.title
    assert r.evidence["total_mapped_paths"] == 0


def test_r_svg_15_counts_mixed_operations() -> None:
    from worker.svg_loader import load_svg_document

    svg_bytes = (
        b'<svg xmlns="http://www.w3.org/2000/svg" '
        b'width="100mm" height="100mm" viewBox="0 0 100 100">'
        b'<path id="cut1" d="M 0 0 L 10 10" stroke="#ff0000"/>'
        b'<path id="cut2" d="M 20 20 L 30 30" stroke="#ff0000"/>'
        b'<path id="score1" d="M 40 40 L 50 50" stroke="#0000ff"/>'
        b'<path id="engrave1" d="M 60 60 L 70 70" stroke="#000000"/>'
        b'<path id="unmapped1" d="M 80 80 L 90 90" stroke="#ff6600"/>'
        b'</svg>'
    )
    doc = load_svg_document(svg_bytes)
    results = run_informational_rules(doc, _glowforge_plus())
    r = next(r for r in results if r.id == "R-SVG-15")
    assert r.evidence["path_counts_by_operation"]["cut"] == 2
    assert r.evidence["path_counts_by_operation"]["score"] == 1
    assert r.evidence["path_counts_by_operation"]["engrave"] == 1
    assert r.evidence["unmapped_stroke_count"] == 1
    assert r.evidence["total_mapped_paths"] == 4


def test_r_svg_15_skips_on_3d_printer_profile() -> None:
    doc = _load_fixture("known-good/svg/makercase-box-back-panel.svg")
    results = run_informational_rules(doc, _bambu_x1c())
    ids = [r.id for r in results]
    assert "R-SVG-15" not in ids


# ---------------------------------------------------------------------------
# SVG thumbnail — safe_render_svg fallback + happy path
# ---------------------------------------------------------------------------


def test_safe_render_svg_returns_none_when_cairosvg_missing() -> None:
    """Simulate cairosvg not being importable. Must return None, not raise."""
    import sys

    from worker import thumbnail_svg

    # Remove cairosvg from sys.modules so the lazy import fails.
    # __import__ of a missing module → ImportError → log + return None.
    with patch.dict(sys.modules, {"cairosvg": None}):
        result = thumbnail_svg.safe_render_svg(b"<svg></svg>")
    assert result is None


def test_safe_render_svg_returns_none_on_malformed_bytes() -> None:
    """Garbage bytes → cairosvg raises → we return None."""
    from worker import thumbnail_svg

    result = thumbnail_svg.safe_render_svg(b"not-an-svg")
    # Either cairosvg is missing locally (None) or cairosvg errors on
    # garbage (None). Both paths converge on None.
    assert result is None


def test_safe_render_svg_happy_path_returns_png_bytes(monkeypatch) -> None:
    """Mocks cairosvg.svg2png to return valid PNG bytes into the buffer.
    Verifies safe_render_svg returns the PNG and checks signature."""
    from worker import thumbnail_svg

    fake_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100  # valid signature + pad

    class FakeCairosvg:
        @staticmethod
        def svg2png(*, bytestring, write_to, output_width):
            assert bytestring == b"<svg/>"
            assert output_width == thumbnail_svg.THUMBNAIL_WIDTH_PX
            write_to.write(fake_png)

    import sys

    monkeypatch.setitem(sys.modules, "cairosvg", FakeCairosvg)
    result = thumbnail_svg.safe_render_svg(b"<svg/>")
    assert result == fake_png


def test_safe_render_svg_rejects_non_png_output(monkeypatch) -> None:
    """If cairosvg somehow writes non-PNG bytes, return None (defensive)."""
    from worker import thumbnail_svg

    class FakeCairosvg:
        @staticmethod
        def svg2png(*, bytestring, write_to, output_width):
            write_to.write(b"JFIF-JPEG-or-similar-not-PNG")

    import sys

    monkeypatch.setitem(sys.modules, "cairosvg", FakeCairosvg)
    result = thumbnail_svg.safe_render_svg(b"<svg/>")
    assert result is None
