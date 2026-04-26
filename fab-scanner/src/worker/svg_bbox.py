"""Compute the bounding box of actual rendered geometry in an SVG, in mm.

Phase 8.1d-12 hotfix.

Why this exists: R-SVG-01 (drawing exceeds laser bed) was checking the
SVG's stated `width`/`height` attributes — i.e. the artboard. A
student designing a 90mm coaster on a 250mm artboard kept getting
blocked even though the actual cuttable geometry (the coaster outline)
fits comfortably on a 200mm bed. The artboard is a designer convention;
laser slicers (LightBurn, Trotec, Glowforge) treat the geometry bbox
as the cut envelope, so the rule should too.

Approach: render the SVG via cairosvg at a low resolution and read the
alpha-channel bbox via PIL. This sidesteps the considerable mess of
manually computing geometry bboxes for SVG (nested transforms, text
font metrics, embedded images, gradients, clip paths, `<use>` refs).
The laser sees what the renderer renders.

Failure modes:
- libcairo / Pillow missing in this env → return None, caller falls
  back to artboard-size check (existing behaviour).
- cairosvg parse / render error → return None, same fallback.
- Massive artboards (10m+) are clamped to a 4096-pixel maximum
  dimension so we don't blow memory on a pathological fixture.
- A fully-opaque SVG (e.g. an artboard-sized filled background rect)
  reports bbox == artboard, which is the right answer: that pixel
  area really would be cut/etched if sent to the machine.

This module is intentionally separate from svg_loader so the rules
file stays slim and the heavy import (cairosvg pulls cairocffi which
pulls libcairo) only happens when the rule actually runs.
"""

from __future__ import annotations

from io import BytesIO
from typing import Optional, Tuple

from worker.svg_loader import SvgDocument

# 4 px/mm at the ideal end. Bbox precision is ±0.25 mm at this scale,
# which is well below the smallest meaningful kerf (~0.1 mm on diode
# lasers) — and the rule output rounds to whole millimetres anyway.
_PX_PER_MM_TARGET = 4.0

# Memory ceiling: never render larger than 4096 × 4096 px (~64 MB
# RGBA). A 10m × 10m oversized fixture would otherwise want
# 40000 × 40000 px = ~6 GB.
_MAX_PIXEL_DIMENSION = 4096


def compute_content_bbox_mm(
    doc: SvgDocument, stated_width_mm: float, stated_height_mm: float
) -> Optional[Tuple[float, float]]:
    """Return (content_width_mm, content_height_mm) of the visible
    (non-transparent) area, or None if rendering is unavailable / fails.

    Caller is expected to have already confirmed the document declares
    physical units (mm/cm/in) on width and height — passing the parsed
    mm values in directly avoids a re-parse here.
    """
    if stated_width_mm <= 0 or stated_height_mm <= 0:
        return None

    # Choose a px/mm scale that keeps both dimensions ≤ 4096 px. For a
    # normal A4-ish artboard this lands at the target 4 px/mm; for an
    # oversized artboard it scales down proportionally.
    px_per_mm = _PX_PER_MM_TARGET
    longest_mm = max(stated_width_mm, stated_height_mm)
    max_at_target = longest_mm * px_per_mm
    if max_at_target > _MAX_PIXEL_DIMENSION:
        px_per_mm = _MAX_PIXEL_DIMENSION / longest_mm

    output_width_px = max(1, int(round(stated_width_mm * px_per_mm)))
    output_height_px = max(1, int(round(stated_height_mm * px_per_mm)))

    # Lazy-import so a dev env without libcairo (mac without Homebrew
    # cairo) doesn't crash the rule on import. Caller falls back to
    # artboard-size check when None is returned.
    try:
        import cairosvg  # type: ignore
        from PIL import Image  # type: ignore
    except ImportError:
        return None

    try:
        png_bytes = cairosvg.svg2png(
            bytestring=doc.raw_bytes,
            output_width=output_width_px,
            output_height=output_height_px,
        )
    except Exception:
        return None
    if not png_bytes:
        return None

    try:
        img = Image.open(BytesIO(png_bytes))
        if img.mode != "RGBA":
            img = img.convert("RGBA")
        # Look at the alpha channel only — content bbox is "what's
        # opaque", not "what's coloured". A black-on-transparent
        # outline reads as content; an empty quadrant of the
        # artboard reads as background.
        alpha = img.split()[3]
        bbox = alpha.getbbox()
    except Exception:
        return None

    if bbox is None:
        # Fully transparent canvas. Return zero-size content; caller
        # will treat as "fits everywhere".
        return (0.0, 0.0)

    left, upper, right, lower = bbox
    content_w_mm = (right - left) / px_per_mm
    content_h_mm = (lower - upper) / px_per_mm
    return (content_w_mm, content_h_mm)
