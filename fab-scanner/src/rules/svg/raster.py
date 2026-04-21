"""SVG raster rules — R-SVG-12..13.

Populated in Phase 2B-5.

Spec source: docs/projects/fabrication-pipeline.md §6 (raster).

Rule     | Severity | Fires when
---------|----------|-----------
R-SVG-12 | WARN     | embedded raster resolution < 150 DPI, computed
                     against the image's rendered size on the SVG
                     canvas. Low-DPI rasters engrave as visible pixels
                     instead of clean tones. Only fired when a clean
                     viewBox-to-mm conversion is available (stated dims
                     in mm AND viewBox ratio ~1:1).
R-SVG-13 | WARN     | embedded raster with alpha transparency. Lasers
                     want grayscale or pure RGB; transparency flattens
                     unpredictably during rasterisation.

Design notes:
- Both rules walk <image> elements outside <defs>. External-URL
  images (http/https href) are SKIPPED — we don't fetch, because
  worker network hits outside Supabase are an unintended surface.
  Data URIs (data:image/...;base64,...) are decoded in-memory.
- Raster inspection uses Pillow (PIL). Pillow is already installed
  transitively via matplotlib; Phase 2B-5 adds it as an explicit
  dependency so we don't rely on the transitive chain.
- R-SVG-12 honours the same unit-ambiguity guard as R-SVG-09: if
  stated width isn't mm or viewBox ratio isn't ~1:1, the rule is
  silent rather than emit noise. R-SVG-02/03 cover the unit case.
- R-SVG-13's alpha test looks at PIL mode + transparency info.
  RGBA / LA / P-with-transparency all count. RGB / L / CMYK / 1 pass.
"""

from __future__ import annotations

import base64
import io
import re
from dataclasses import dataclass

from lxml import etree  # type: ignore

from rules.common import MachineProfile, RuleResult, Severity
from schemas.ruleset_version import SVG_RULESET_VERSION
from worker.svg_loader import SVG_NS, XLINK_NS, SvgDocument

_IMAGE_TAG = f"{{{SVG_NS}}}image"
_DEFS_TAG = f"{{{SVG_NS}}}defs"
_XLINK_HREF = f"{{{XLINK_NS}}}href"

_DATA_URI = re.compile(r"^data:image/([a-zA-Z0-9.+-]+);base64,(.*)$", re.DOTALL)

# R-SVG-12 threshold (spec §6). Below this, engraves look pixelated.
_MIN_DPI = 150

# R-SVG-09-style unit tolerance: viewBox-to-mm ratio within ±10% of 1:1.
_MM_RATIO_TOLERANCE = 0.10


@dataclass(frozen=True)
class _RasterInspection:
    element_id: str
    rendered_width_svg: float | None  # viewBox units — the <image width=>
    rendered_height_svg: float | None
    pixel_width: int | None
    pixel_height: int | None
    pil_mode: str | None  # e.g. "RGBA", "RGB", "L", "P"
    has_alpha: bool
    mime_type: str | None
    decode_ok: bool


def _parse_svg_length_to_float(raw: str | None) -> float | None:
    """Pull a numeric value out of an <image width="..."> attribute.
    Image widths in SVG are conventionally unit-less (viewBox space) but
    we accept trailing px defensively.
    """
    if raw is None:
        return None
    m = re.match(r"^\s*([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)", raw.strip())
    if m is None:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def _inspect_image_element(el: etree._Element) -> _RasterInspection:
    """Decode an <image> element's raster and read its pixel dims + mode.

    Errors stay inside the inspection: malformed data URIs or PIL
    failures set decode_ok=False rather than raise. The caller (rules
    below) treats "couldn't decode" as "skip this element" so we
    don't block scans on one weird image.
    """
    element_id = el.get("id") or ""
    svg_w = _parse_svg_length_to_float(el.get("width"))
    svg_h = _parse_svg_length_to_float(el.get("height"))

    href = el.get("href") or el.get(_XLINK_HREF)
    base = _RasterInspection(
        element_id=element_id,
        rendered_width_svg=svg_w,
        rendered_height_svg=svg_h,
        pixel_width=None,
        pixel_height=None,
        pil_mode=None,
        has_alpha=False,
        mime_type=None,
        decode_ok=False,
    )
    if not href:
        return base

    m = _DATA_URI.match(href.strip())
    if m is None:
        # External URL, xlink to a resource, etc. We don't fetch.
        return base
    mime_type = m.group(1).lower()
    b64 = m.group(2).strip().replace("\n", "").replace(" ", "")
    try:
        raw = base64.b64decode(b64, validate=False)
    except Exception:
        return base.__class__(**{**base.__dict__, "mime_type": mime_type})

    try:
        from PIL import Image  # type: ignore
    except ImportError:
        return base.__class__(**{**base.__dict__, "mime_type": mime_type})

    try:
        with Image.open(io.BytesIO(raw)) as img:
            img.load()
            mode = img.mode
            w, h = img.size
            # Alpha signals: explicit RGBA/LA/PA modes, or 'transparency'
            # info in a palette/greyscale PNG.
            has_alpha = (
                mode in ("RGBA", "LA", "PA")
                or "A" in mode
                or "transparency" in img.info
            )
            return _RasterInspection(
                element_id=element_id,
                rendered_width_svg=svg_w,
                rendered_height_svg=svg_h,
                pixel_width=w,
                pixel_height=h,
                pil_mode=mode,
                has_alpha=has_alpha,
                mime_type=mime_type,
                decode_ok=True,
            )
    except Exception:
        return base.__class__(**{**base.__dict__, "mime_type": mime_type})


def _iter_image_elements(doc: SvgDocument) -> list[etree._Element]:
    out: list[etree._Element] = []
    for el in doc.root.iter():
        if el.tag != _IMAGE_TAG:
            continue
        if any(a.tag == _DEFS_TAG for a in el.iterancestors()):
            continue
        out.append(el)
    return out


def _viewbox_is_mm_1_to_1(doc: SvgDocument) -> bool:
    """True when viewBox and stated-mm-width are a clean 1:1 ratio,
    allowing <image> width values (in viewBox units) to be treated as
    mm without ambiguity."""
    if doc.viewbox is None:
        return False
    if not doc.width_raw:
        return False
    m = re.match(r"^\s*([+-]?\d*\.?\d+)\s*mm\s*$", doc.width_raw)
    if not m:
        return False
    try:
        stated_mm = float(m.group(1))
    except ValueError:
        return False
    if stated_mm <= 0:
        return False
    vb_width = doc.viewbox[2]
    if vb_width <= 0:
        return False
    return abs((vb_width / stated_mm) - 1.0) <= _MM_RATIO_TOLERANCE


# ---------------------------------------------------------------------------
# R-SVG-12 — raster below 150 DPI
# ---------------------------------------------------------------------------


def _rule_12_raster_low_dpi(
    doc: SvgDocument, profile: MachineProfile
) -> RuleResult | None:
    if profile.machine_category != "laser_cutter":
        return None
    if not _viewbox_is_mm_1_to_1(doc):
        return None

    offenders: list[dict[str, object]] = []
    for el in _iter_image_elements(doc):
        insp = _inspect_image_element(el)
        if not insp.decode_ok:
            continue
        if insp.pixel_width is None or insp.rendered_width_svg is None:
            continue
        # viewBox-1:1 means rendered_width_svg mm ≈ rendered_width_svg.
        rendered_mm = insp.rendered_width_svg
        if rendered_mm <= 0:
            continue
        rendered_in = rendered_mm / 25.4
        dpi = float(insp.pixel_width) / rendered_in if rendered_in > 0 else 0
        if dpi >= _MIN_DPI:
            continue
        offenders.append(
            {
                "element_id": insp.element_id,
                "effective_dpi": round(dpi, 1),
                "pixel_size": [insp.pixel_width, insp.pixel_height],
                "rendered_mm": [
                    round(rendered_mm, 2),
                    round(insp.rendered_height_svg or 0, 2),
                ],
                "mime_type": insp.mime_type,
            }
        )

    if not offenders:
        return None

    return RuleResult(
        id="R-SVG-12",
        severity=Severity.WARN,
        title=(
            f"{len(offenders)} embedded raster"
            f"{'s' if len(offenders) != 1 else ''} below "
            f"{_MIN_DPI} DPI"
        ),
        explanation=(
            "Embedded raster images will engrave as individual pixels rather "
            "than a clean tone when their effective resolution is below "
            f"{_MIN_DPI} DPI at the rendered size on the bed. Replace the "
            "image with a higher-resolution copy, or scale it smaller on "
            "the canvas so the DPI density increases."
        ),
        evidence={
            "threshold_dpi": _MIN_DPI,
            "offending_rasters": offenders[:10],
            "total_low_dpi_rasters": len(offenders),
        },
        fix_hint=(
            "In Inkscape: File > Export as PNG at a higher DPI, then "
            "replace the embedded image. Or resize the image on the canvas "
            "to make it smaller — DPI = pixels ÷ inches."
        ),
        version=SVG_RULESET_VERSION,
    )


# ---------------------------------------------------------------------------
# R-SVG-13 — raster with transparency
# ---------------------------------------------------------------------------


def _rule_13_raster_with_transparency(
    doc: SvgDocument, profile: MachineProfile
) -> RuleResult | None:
    if profile.machine_category != "laser_cutter":
        return None

    offenders: list[dict[str, object]] = []
    for el in _iter_image_elements(doc):
        insp = _inspect_image_element(el)
        if not insp.decode_ok:
            continue
        if not insp.has_alpha:
            continue
        offenders.append(
            {
                "element_id": insp.element_id,
                "pil_mode": insp.pil_mode,
                "mime_type": insp.mime_type,
                "pixel_size": [insp.pixel_width, insp.pixel_height],
            }
        )

    if not offenders:
        return None

    return RuleResult(
        id="R-SVG-13",
        severity=Severity.WARN,
        title=(
            f"{len(offenders)} embedded raster"
            f"{'s' if len(offenders) != 1 else ''} with alpha transparency"
        ),
        explanation=(
            "Laser engraving needs solid greyscale or RGB — alpha channels "
            "get flattened during rasterisation, often producing unexpected "
            "outlines or missing regions. Flatten the image against a solid "
            "background (usually white) before embedding."
        ),
        evidence={
            "offending_rasters": offenders[:10],
            "total_transparent_rasters": len(offenders),
        },
        fix_hint=(
            "In Inkscape: Edit the embedded image in an external editor, "
            "flatten the background (GIMP: Image > Flatten; Photoshop: "
            "Layer > Flatten Image), re-export as PNG or JPEG."
        ),
        version=SVG_RULESET_VERSION,
    )


def run_raster_rules(
    doc: SvgDocument, profile: MachineProfile
) -> list[RuleResult]:
    results: list[RuleResult] = []
    for rule in (_rule_12_raster_low_dpi, _rule_13_raster_with_transparency):
        r = rule(doc, profile)
        if r is not None:
            results.append(r)
    return results
