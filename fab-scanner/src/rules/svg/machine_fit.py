"""SVG machine-fit rules — R-SVG-01..03.

Populated in Phase 2B-2.

Spec source: docs/projects/fabrication-pipeline.md §6 (machine fit).

Rule     | Severity | Fires when
---------|----------|-----------
R-SVG-01 | BLOCK    | the bounding box of actual rendered geometry exceeds
                     machine bed on either axis (only for laser_cutter
                     profiles; skipped on 3D printers because they scan
                     STL, not SVG). Phase 8.1d-12: switched from
                     artboard-size check to content-bbox check so a
                     90mm coaster on a 250mm artboard isn't blocked
                     against a 200mm bed. Falls back to artboard size
                     when content-bbox rendering fails (no libcairo,
                     parse error, etc.) — over-report rather than
                     silently pass.
R-SVG-02 | BLOCK    | stated dimensions use physical units (mm/cm/in) but
                     the viewBox numbers don't correspond to a recognizable
                     scale (1:1 mm-for-mm, or ~3.78 mm-to-px at 96 dpi).
                     Catches the "drew at 2.5× scale, came out tiny" bug.
R-SVG-03 | WARN     | stated width/height missing, percent-based, or a
                     pure number (px-implied). Machine can't know the
                     physical size; cuts come out wrong.

Design notes:
- R-SVG-01 requires BOTH physical units AND a valid parse. If R-SVG-03
  fires (no explicit units), R-SVG-01 is skipped — we can't know the real
  size. One "this is wrong" rule fires, not two on the same root cause.
- R-SVG-02 is suppressed when R-SVG-03 fires for the same reason.
- R-SVG-02's tolerance accepts common-in-the-wild ratios:
    1.00 — viewBox dimensions == stated mm (newer Inkscape, modern workflow)
    3.78 — viewBox in 96dpi pixels, stated in mm (older Inkscape, browsers)
  Ratios outside ±10% of either are flagged.
- Phase 8.1d-34: rotation IS now checked. R-SVG-01 passes if the
  drawing fits in EITHER orientation (as-is OR 90° rotated). Reason:
  every laser slicer (xTool Creative Space, LightBurn, RDWorks)
  rotates trivially, and lab techs rotate parts routinely for
  material economy. BLOCKing a 250×384mm drawing on a 600×308mm
  bed when 384×250 fits perfectly is overzealous — the original
  comment's "students submit what they submit" stance was
  reverted after Matt's smoke 27 Apr.
"""

from __future__ import annotations

import re

from rules.common import MachineProfile, RuleResult, Severity
from schemas.ruleset_version import SVG_RULESET_VERSION
from worker.svg_bbox import compute_content_bbox_mm
from worker.svg_loader import SvgDocument

# Unit conversion to mm.
# 1 inch = 25.4 mm. 1 cm = 10 mm. Pure numbers treated as px (96 dpi standard).
_MM_PER_INCH = 25.4
_MM_PER_CM = 10.0
_MM_PER_PX_96DPI = _MM_PER_INCH / 96.0  # ~0.2645 mm/px

# R-SVG-02 acceptable viewBox-to-stated-mm ratios, with ±10% tolerance.
# 1.0 = viewBox in mm (1 viewBox unit per mm).
# 96/25.4 ≈ 3.7795 = viewBox in px at 96 dpi (Inkscape default pre-1.0).
_EXPECTED_VIEWBOX_RATIOS = (1.0, 96.0 / _MM_PER_INCH)
_RATIO_TOLERANCE = 0.10

# Strip whitespace and a trailing unit suffix in one go.
_DIM_PATTERN = re.compile(
    r"^\s*([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*([a-zA-Z%]*)\s*$"
)


def _parse_dimension_mm(raw: str | None) -> float | None:
    """Parse an SVG width/height string into mm, or None if ambiguous.

    Returns None for: missing, empty, percent-based, or unparseable input.
    A pure number (no unit) is also treated as ambiguous here — we don't
    assume px, because R-SVG-03 exists precisely to catch that case.
    """
    if not raw:
        return None
    m = _DIM_PATTERN.match(raw)
    if m is None:
        return None
    value_str, unit = m.group(1), m.group(2).lower()
    try:
        value = float(value_str)
    except ValueError:
        return None
    if unit == "mm":
        return value
    if unit == "cm":
        return value * _MM_PER_CM
    if unit == "in":
        return value * _MM_PER_INCH
    if unit == "px":
        return value * _MM_PER_PX_96DPI
    # Empty unit (pure number), percent, em, pt, etc. — ambiguous.
    # R-SVG-03 will fire for empty / percent; others are rare and treated
    # the same way rather than silently coerced.
    return None


def _has_explicit_physical_unit(raw: str | None) -> bool:
    """True when the raw dimension string ends in mm / cm / in."""
    if not raw:
        return False
    m = _DIM_PATTERN.match(raw)
    if m is None:
        return False
    unit = m.group(2).lower()
    return unit in ("mm", "cm", "in")


def _rule_01_exceeds_bed(
    doc: SvgDocument, profile: MachineProfile
) -> RuleResult | None:
    # Laser-only rule — 3D printers don't scan SVGs.
    if profile.machine_category != "laser_cutter":
        return None

    artboard_w_mm = _parse_dimension_mm(doc.width_raw)
    artboard_h_mm = _parse_dimension_mm(doc.height_raw)
    if artboard_w_mm is None or artboard_h_mm is None:
        # Ambiguous size → defer to R-SVG-03.
        return None
    if not (
        _has_explicit_physical_unit(doc.width_raw)
        and _has_explicit_physical_unit(doc.height_raw)
    ):
        # Pixel-valued widths shouldn't fire a bed-size BLOCK — again
        # defer to R-SVG-03 as the single source of truth.
        return None

    # Phase 8.1d-12: prefer the bounding box of actual rendered geometry
    # over the SVG's stated artboard. A student designing a 90mm coaster
    # inside a 250mm Inkscape "page" was getting a BLOCK against a
    # 200mm bed, even though the laser slicer would only consume the
    # 90mm region. Render-and-getbbox via cairosvg gives us the truth.
    #
    # Fallback: if cairosvg / libcairo aren't available or the render
    # fails, drop back to the artboard check. Over-report > silently
    # pass an oversized job.
    content_bbox = compute_content_bbox_mm(doc, artboard_w_mm, artboard_h_mm)
    if content_bbox is not None:
        check_w_mm, check_h_mm = content_bbox
        bbox_source = "content"
    else:
        check_w_mm, check_h_mm = artboard_w_mm, artboard_h_mm
        bbox_source = "artboard"

    # Phase 8.1d-34: check both orientations. The drawing fits if
    # EITHER as-is OR rotated 90° clears the bed. Slicers handle the
    # rotation trivially and lab techs rotate parts routinely; only
    # BLOCK when neither orientation is viable (the design genuinely
    # exceeds the machine's reach).
    bed_x = profile.bed_size_x_mm
    bed_y = profile.bed_size_y_mm
    fits_unrotated = check_w_mm <= bed_x and check_h_mm <= bed_y
    fits_rotated = check_h_mm <= bed_x and check_w_mm <= bed_y
    if fits_unrotated or fits_rotated:
        return None

    # Neither orientation fits. Build the violation string against
    # the BEST-CASE orientation so the student sees the smallest gap
    # they need to close (e.g. "384 > 308 mm" not "384 > 308 AND 250 > 600").
    # Best case = whichever orientation has the smaller overshoot.
    overshoot_unrotated = max(0, check_w_mm - bed_x) + max(0, check_h_mm - bed_y)
    overshoot_rotated = max(0, check_h_mm - bed_x) + max(0, check_w_mm - bed_y)
    if overshoot_rotated < overshoot_unrotated:
        eff_w, eff_h = check_h_mm, check_w_mm
        orientation_note = " (rotated)"
    else:
        eff_w, eff_h = check_w_mm, check_h_mm
        orientation_note = ""

    violations: list[str] = []
    if eff_w > bed_x:
        violations.append(f"width{orientation_note}: {eff_w:.0f} > {bed_x:.0f} mm")
    if eff_h > bed_y:
        violations.append(
            f"height{orientation_note}: {eff_h:.0f} > {bed_y:.0f} mm"
        )

    # Word the message slightly differently when the bbox came from
    # the artboard fallback so the student knows what we measured. The
    # primary case (content bbox) is the friendlier framing.
    if bbox_source == "content":
        explanation = (
            f"Your drawing measures {check_w_mm:.0f} × {check_h_mm:.0f} mm. "
            f"The {profile.name} bed is {bed_x:.0f} × {bed_y:.0f} mm, and "
            "neither orientation fits — even rotated 90° the design exceeds "
            "the bed. Scale it down or split it into pieces that each fit."
        )
        fix_hint = (
            "Scale your design so the cut/etch geometry fits the bed in at "
            "least one orientation. The slicer can rotate it for you, but "
            "it can't shrink it."
        )
    else:
        explanation = (
            f"Your artboard measures {check_w_mm:.0f} × {check_h_mm:.0f} mm "
            f"but the {profile.name} bed is {bed_x:.0f} × {bed_y:.0f} mm "
            "and neither orientation fits. (We couldn't measure the actual "
            "geometry on this file, so we're checking the artboard.) "
            "Scale down or split into pieces that each fit the bed."
        )
        fix_hint = (
            "In Inkscape: File > Document Properties, set Width/Height to a "
            "size that fits the bed in at least one orientation. In "
            "Illustrator: File > Document Setup > Edit Artboards."
        )

    return RuleResult(
        id="R-SVG-01",
        severity=Severity.BLOCK,
        title=f"Drawing is larger than the {profile.name} bed",
        explanation=explanation,
        evidence={
            "drawing_mm": {
                "width": round(check_w_mm, 1),
                "height": round(check_h_mm, 1),
            },
            "artboard_mm": {
                "width": round(artboard_w_mm, 1),
                "height": round(artboard_h_mm, 1),
            },
            "bbox_source": bbox_source,
            "bed_mm": {
                "width": profile.bed_size_x_mm,
                "height": profile.bed_size_y_mm,
            },
            "violations": violations,
        },
        fix_hint=fix_hint,
        version=SVG_RULESET_VERSION,
    )


def _rule_02_viewbox_unit_mismatch(
    doc: SvgDocument, profile: MachineProfile
) -> RuleResult | None:
    if doc.viewbox is None:
        return None

    width_mm = _parse_dimension_mm(doc.width_raw)
    height_mm = _parse_dimension_mm(doc.height_raw)
    if width_mm is None or height_mm is None:
        return None
    if not (
        _has_explicit_physical_unit(doc.width_raw)
        and _has_explicit_physical_unit(doc.height_raw)
    ):
        return None

    vb_width = doc.viewbox[2]
    vb_height = doc.viewbox[3]
    if vb_width <= 0 or vb_height <= 0 or width_mm <= 0 or height_mm <= 0:
        return None

    ratio_x = vb_width / width_mm
    ratio_y = vb_height / height_mm

    def _matches_expected(ratio: float) -> bool:
        for expected in _EXPECTED_VIEWBOX_RATIOS:
            if abs(ratio - expected) / expected <= _RATIO_TOLERANCE:
                return True
        return False

    if _matches_expected(ratio_x) and _matches_expected(ratio_y):
        return None

    return RuleResult(
        id="R-SVG-02",
        severity=Severity.BLOCK,
        title="Drawing units don't match the viewBox — size will be wrong on the laser",
        explanation=(
            f"Your stated size is {width_mm:.0f} × {height_mm:.0f} mm but the "
            f"viewBox is {vb_width:.1f} × {vb_height:.1f} units — a scale ratio "
            f"of {ratio_x:.2f}× width / {ratio_y:.2f}× height. Laser software "
            "uses the viewBox to place geometry, so your design will come out "
            "at the wrong size on the bed. Expected ratios are 1.0 (viewBox "
            "in millimetres) or 3.78 (viewBox in 96-dpi pixels)."
        ),
        evidence={
            "stated_mm": {"width": round(width_mm, 1), "height": round(height_mm, 1)},
            "viewbox": {
                "min_x": doc.viewbox[0],
                "min_y": doc.viewbox[1],
                "width": vb_width,
                "height": vb_height,
            },
            "ratio_x": round(ratio_x, 3),
            "ratio_y": round(ratio_y, 3),
            "expected_ratios": list(_EXPECTED_VIEWBOX_RATIOS),
        },
        fix_hint=(
            "In Inkscape: File > Document Properties > Display units = mm, "
            "then Resize page to drawing. In Illustrator: re-export with "
            "'Responsive' unchecked and the artboard sized in mm."
        ),
        version=SVG_RULESET_VERSION,
    )


def _rule_03_no_explicit_units(
    doc: SvgDocument, profile: MachineProfile
) -> RuleResult | None:
    """Fire when width OR height is missing, percent-based, or pure number.

    Every laser workflow needs a deterministic real-world size. Any
    ambiguous case here becomes "machine guesses, usually wrong."
    """

    def _is_problem_dim(raw: str | None) -> tuple[bool, str]:
        if not raw:
            return True, "missing"
        m = _DIM_PATTERN.match(raw)
        if m is None:
            return True, f"unparseable {raw!r}"
        unit = m.group(2).lower()
        if unit in ("mm", "cm", "in"):
            return False, unit
        if unit == "%":
            return True, "percent"
        if unit == "":
            return True, "no unit (pure number)"
        if unit == "px":
            # Explicitly-marked px is legal SVG but ambiguous at the
            # laser. Browsers treat px=1/96in; laser software may treat
            # it as mm. We warn to force a choice.
            return True, "px"
        return True, f"unit {unit!r}"

    w_problem, w_note = _is_problem_dim(doc.width_raw)
    h_problem, h_note = _is_problem_dim(doc.height_raw)
    if not (w_problem or h_problem):
        return None

    return RuleResult(
        id="R-SVG-03",
        severity=Severity.WARN,
        title="Drawing size is ambiguous — units not in mm / cm / in",
        explanation=(
            "Your SVG doesn't declare width and height in physical units (mm, "
            "cm, or in). Laser software has to guess the real size — most "
            "machines default to pixel-at-96-dpi, which gives a tiny result. "
            "Set explicit physical units before submitting."
        ),
        evidence={
            "width_raw": doc.width_raw,
            "height_raw": doc.height_raw,
            "width_issue": w_note,
            "height_issue": h_note,
        },
        fix_hint=(
            "In Inkscape: File > Document Properties > set Width and Height "
            "to mm values. In Illustrator: File > Document Setup > Units = "
            "Millimeters, then re-save."
        ),
        version=SVG_RULESET_VERSION,
    )


def run_machine_fit_rules(
    doc: SvgDocument, profile: MachineProfile
) -> list[RuleResult]:
    results: list[RuleResult] = []
    for rule in (
        _rule_01_exceeds_bed,
        _rule_02_viewbox_unit_mismatch,
        _rule_03_no_explicit_units,
    ):
        r = rule(doc, profile)
        if r is not None:
            results.append(r)
    return results
