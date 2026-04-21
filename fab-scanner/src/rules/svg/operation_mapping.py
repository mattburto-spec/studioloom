"""SVG operation-mapping rules — R-SVG-04..06.

Populated in Phase 2B-3.

Spec source: docs/projects/fabrication-pipeline.md §6 (operation mapping).

Rule     | Severity | Fires when
---------|----------|-----------
R-SVG-04 | BLOCK    | any rendering element uses a stroke colour that
                     isn't in the machine profile's operation_color_map.
                     Laser software can't decide cut/score/engrave.
R-SVG-05 | WARN     | elements whose stroke maps to 'cut' have a
                     non-hairline stroke-width. Laser software
                     interprets wide strokes as fill engrave, not cut.
                     Ship conservative — only fire when the width
                     exceeds a generous threshold (no fixture coverage).
R-SVG-06 | WARN     | elements whose stroke maps to 'cut' have a
                     visible fill (non-'none', non-missing). Filled
                     shapes on a cut layer become fill-engraves.

Design notes:
- Stroke and fill colours can be set via the `stroke=""` attribute or
  inline `style="stroke: ...;"`. We inspect both, with `style` winning
  when both are present on the same element (SVG cascade order).
- Elements inside <defs> are declarations (gradients, patterns,
  clip-paths, reusable symbols) — they never render. Skip them so we
  don't false-positive on gradient stops.
- Colour normalisation canonicalises to uppercase 6-char hex before
  lookup. The profile's map may hold lowercase keys (as the test mock
  does); we normalise the map too so #FF0000 / #ff0000 / #f00 / red /
  rgb(255,0,0) all match the same entry.
- R-SVG-05 threshold is intentionally generous (0.5 mm) for v1. Real
  hairline is ~0.01 mm but stated stroke-width is in viewBox units,
  not mm, and wrongly-authored SVGs with 1.965-pixel strokes shouldn't
  drown the queue in warnings. Tighten in a later ruleset bump after
  real-world data lands.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from lxml import etree  # type: ignore

from rules.common import MachineProfile, RuleResult, Severity
from schemas.ruleset_version import SVG_RULESET_VERSION
from worker.svg_loader import SVG_NS, SvgDocument

# Elements that actually render. <defs> children never reach the canvas,
# so we exclude them by walking only the non-defs subtree.
_RENDERING_TAGS: tuple[str, ...] = (
    f"{{{SVG_NS}}}path",
    f"{{{SVG_NS}}}line",
    f"{{{SVG_NS}}}polyline",
    f"{{{SVG_NS}}}polygon",
    f"{{{SVG_NS}}}rect",
    f"{{{SVG_NS}}}circle",
    f"{{{SVG_NS}}}ellipse",
    f"{{{SVG_NS}}}text",
)
_DEFS_TAG = f"{{{SVG_NS}}}defs"

# A small set of CSS named colours DT students actually use. Not the full
# CSS3 palette — we'd rather fire R-SVG-04 on something weird than
# silently accept "burlywood".
_NAMED_COLOURS: dict[str, str] = {
    "black": "#000000",
    "white": "#FFFFFF",
    "red": "#FF0000",
    "lime": "#00FF00",
    "blue": "#0000FF",
    "yellow": "#FFFF00",
    "cyan": "#00FFFF",
    "aqua": "#00FFFF",
    "magenta": "#FF00FF",
    "fuchsia": "#FF00FF",
    "green": "#008000",
    "orange": "#FFA500",
    "gray": "#808080",
    "grey": "#808080",
}

_HEX_6 = re.compile(r"^#([0-9a-fA-F]{6})$")
_HEX_3 = re.compile(r"^#([0-9a-fA-F]{3})$")
_RGB = re.compile(
    r"^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$"
)
_STYLE_PROP = re.compile(r"([a-z-]+)\s*:\s*([^;]+)")

# R-SVG-05 threshold — see module docstring. Stated stroke-widths below
# this in viewBox units count as hairline for v1.
_CUT_STROKE_HAIRLINE_MAX = 0.5


@dataclass(frozen=True)
class _StrokeSpec:
    """The bits of one rendering element we need for operation-mapping rules."""

    element_id: str  # best-effort — empty string if <element> has no id
    stroke_normalized: str | None  # canonical "#RRGGBB" or None ('none'/missing)
    stroke_width_raw: str | None  # e.g. "0.5", "1.965", or None
    fill_normalized: str | None  # canonical "#RRGGBB" or None ('none'/missing)


def _parse_style(style: str | None) -> dict[str, str]:
    """Parse a CSS-style 'a:b;c:d' blob into a dict. Empty or missing → {}."""
    if not style:
        return {}
    out: dict[str, str] = {}
    for m in _STYLE_PROP.finditer(style):
        out[m.group(1).strip().lower()] = m.group(2).strip()
    return out


def _normalize_colour(raw: str | None) -> str | None:
    """Return canonical '#RRGGBB' uppercase, or None for unpaintable values.

    None for: missing, 'none', 'transparent', 'currentColor', 'inherit',
    or unrecognizable strings. Callers decide whether that matters
    (R-SVG-04 treats 'no stroke' as not-a-cut-line; R-SVG-06 treats
    'no fill' as valid).
    """
    if raw is None:
        return None
    v = raw.strip().lower()
    if v in ("none", "transparent", "currentcolor", "inherit", ""):
        return None
    # 6-char hex
    m = _HEX_6.match(v)
    if m:
        return "#" + m.group(1).upper()
    # 3-char hex — expand to 6.
    m = _HEX_3.match(v)
    if m:
        exp = "".join(ch * 2 for ch in m.group(1))
        return "#" + exp.upper()
    # rgb(r, g, b)
    m = _RGB.match(v)
    if m:
        try:
            r, g, b = (max(0, min(255, int(m.group(i)))) for i in (1, 2, 3))
        except ValueError:
            return None
        return f"#{r:02X}{g:02X}{b:02X}"
    # Named CSS colour.
    if v in _NAMED_COLOURS:
        return _NAMED_COLOURS[v]
    # Something we don't understand — treat as 'unrecognisable', which
    # R-SVG-04 will flag as "not in map" via its own path.
    return None


def _resolve_inherited_attr(
    el: etree._Element, prop: str
) -> str | None:
    """Resolve an SVG presentation property (stroke/fill/stroke-width) by
    walking self + ancestors per the SVG/CSS cascade.

    On each element, inline style takes precedence over the attribute —
    so if style declares the property, the attribute on the same element
    is IGNORED (even if style says 'inherit', attr doesn't get a second
    chance at this level). This matches CSS2 specificity: inline style
    wins, `inherit` means 'use parent', which forces the walk up.

    If neither style nor attribute has a value at this level, walk up.
    If the value is empty ('') or explicitly 'inherit', walk up.
    Any other value (including 'none' / 'transparent' / hex / named)
    terminates the walk and returns the stripped raw string — callers
    normalise via _normalize_colour / _parse_stroke_width_units.

    Phase 2B-4a: addresses reviewer finding that R-SVG-04/05/06 were
    silently missing strokes inherited from `<g stroke='...'>` parent
    groups — the most common Inkscape-layers / Illustrator-groups pattern
    in school DT lab files.

    Phase 2B-4b: fixed precedence ordering per 2nd review — previous
    implementation had a loop over (style, attr) that fell through
    inherit-in-style to attr-on-same-element, deviating from CSS2.
    """
    cur: etree._Element | None = el
    while cur is not None:
        style = _parse_style(cur.get("style"))
        # Inline style takes precedence even if it says 'inherit'.
        if prop in style:
            value = style[prop].strip()
            if value and value.lower() != "inherit":
                return value
            # style explicitly set but inherit/empty — walk up without
            # falling through to this element's attribute.
            cur = cur.getparent()
            continue
        attr = cur.get(prop)
        if attr is not None:
            value = attr.strip()
            if value and value.lower() != "inherit":
                return value
            # attr explicit but inherit/empty — same walk-up behaviour.
            cur = cur.getparent()
            continue
        # Neither style nor attr at this level — walk up.
        cur = cur.getparent()
    return None


def _extract_stroke_spec(el: etree._Element) -> _StrokeSpec:
    """Read stroke + fill from self and ancestors per the SVG cascade.

    Returns _StrokeSpec with normalized stroke/fill colours and raw
    stroke-width. Inheritance walk lives in _resolve_inherited_attr —
    see its docstring for the cascade rules.
    """
    return _StrokeSpec(
        element_id=el.get("id") or "",
        stroke_normalized=_normalize_colour(
            _resolve_inherited_attr(el, "stroke")
        ),
        stroke_width_raw=_resolve_inherited_attr(el, "stroke-width"),
        fill_normalized=_normalize_colour(
            _resolve_inherited_attr(el, "fill")
        ),
    )


def _iter_rendering_elements(doc: SvgDocument) -> list[etree._Element]:
    """Walk the tree, yielding rendering elements that aren't inside <defs>."""
    out: list[etree._Element] = []
    for el in doc.root.iter():
        if el.tag not in _RENDERING_TAGS:
            continue
        # Skip anything inside <defs>. iterancestors is lxml-specific.
        if any(a.tag == _DEFS_TAG for a in el.iterancestors()):
            continue
        out.append(el)
    return out


def _normalized_operation_map(
    profile_map: dict[str, object] | None,
) -> dict[str, str]:
    """Profile maps may have lowercase keys — normalise to canonical hex."""
    if not profile_map:
        return {}
    out: dict[str, str] = {}
    for k, v in profile_map.items():
        norm = _normalize_colour(k)
        if norm is not None and isinstance(v, str):
            out[norm] = v
    return out


def _rule_04_stroke_not_in_map(
    doc: SvgDocument, profile: MachineProfile
) -> RuleResult | None:
    if profile.machine_category != "laser_cutter":
        return None
    op_map = _normalized_operation_map(profile.operation_color_map)
    if not op_map:
        # No map to check against — rule is disabled for this machine.
        return None

    unmapped: list[tuple[str, str]] = []  # (colour, element_id)
    seen: set[str] = set()
    for el in _iter_rendering_elements(doc):
        spec = _extract_stroke_spec(el)
        if spec.stroke_normalized is None:
            continue  # no stroke, not a cut line candidate
        if spec.stroke_normalized in op_map:
            continue
        key = f"{spec.stroke_normalized}:{spec.element_id}"
        if key in seen:
            continue
        seen.add(key)
        unmapped.append((spec.stroke_normalized, spec.element_id))

    if not unmapped:
        return None

    unmapped_colours = sorted({c for c, _ in unmapped})
    return RuleResult(
        id="R-SVG-04",
        severity=Severity.BLOCK,
        title=(
            f"Unmapped stroke colour{'s' if len(unmapped_colours) > 1 else ''} — "
            "the laser doesn't know what to do with "
            f"{', '.join(unmapped_colours)}"
        ),
        explanation=(
            f"Your {profile.name} uses stroke colour to decide between cut, "
            "score, and engrave. The machine profile maps "
            f"{', '.join(sorted(op_map.keys()))} to specific operations — "
            "any other colour is ambiguous. Recolour every stroke to one of "
            "those hex values (or ask your teacher to extend the machine "
            "profile's colour map if a new operation is needed)."
        ),
        evidence={
            "unmapped_colours": unmapped_colours,
            "allowed_map": op_map,
            "example_elements": [
                {"colour": c, "element_id": eid}
                for c, eid in unmapped[:5]
            ],
            "total_offending_elements": len(unmapped),
        },
        fix_hint=(
            "In Inkscape: select the path, open Object Properties, set "
            "Stroke paint to a colour in your lab's map (e.g. red for cut). "
            "In Illustrator: Window > Stroke, then recolour."
        ),
        version=SVG_RULESET_VERSION,
    )


def _parse_stroke_width_units(raw: str | None) -> float | None:
    """Parse '0.5', '1.965px', '0.01mm' → a float in its original units.

    This is NOT a unit conversion — stroke-width is SVG-relative by
    default. We compare against a viewBox-space threshold in R-SVG-05.
    """
    if not raw:
        return None
    # Strip any trailing unit suffix; accept digits / exponent.
    m = re.match(r"^\s*([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)", raw)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def _rule_05_cut_stroke_not_hairline(
    doc: SvgDocument, profile: MachineProfile
) -> RuleResult | None:
    if profile.machine_category != "laser_cutter":
        return None
    op_map = _normalized_operation_map(profile.operation_color_map)
    if not op_map:
        return None

    offenders: list[dict[str, object]] = []
    for el in _iter_rendering_elements(doc):
        spec = _extract_stroke_spec(el)
        if spec.stroke_normalized is None:
            continue
        if op_map.get(spec.stroke_normalized) != "cut":
            continue
        width = _parse_stroke_width_units(spec.stroke_width_raw)
        if width is None:
            continue
        if width <= _CUT_STROKE_HAIRLINE_MAX:
            continue
        offenders.append(
            {
                "element_id": spec.element_id,
                "stroke_width": round(width, 3),
                "stroke_colour": spec.stroke_normalized,
            }
        )

    if not offenders:
        return None

    return RuleResult(
        id="R-SVG-05",
        severity=Severity.WARN,
        title=(
            f"{len(offenders)} cut-layer stroke"
            f"{'s' if len(offenders) != 1 else ''} exceed hairline width"
        ),
        explanation=(
            "Laser cut layers should use hairline strokes — most software "
            "treats a wide stroke as a fill engrave, not a cut. Your file "
            f"has {len(offenders)} path(s) on the cut colour with stroke "
            f"wider than {_CUT_STROKE_HAIRLINE_MAX} units. Thin them down "
            "before submitting."
        ),
        evidence={
            "hairline_threshold": _CUT_STROKE_HAIRLINE_MAX,
            "offending_elements": offenders[:10],
            "total_offending_elements": len(offenders),
        },
        fix_hint=(
            "In Inkscape: Object > Fill and Stroke > Stroke style > "
            "set Width to 0.01 mm (or the lab's convention). In Illustrator: "
            "set stroke weight to 0.001 pt."
        ),
        version=SVG_RULESET_VERSION,
    )


def _rule_06_fill_on_cut_layer(
    doc: SvgDocument, profile: MachineProfile
) -> RuleResult | None:
    if profile.machine_category != "laser_cutter":
        return None
    op_map = _normalized_operation_map(profile.operation_color_map)
    if not op_map:
        return None

    offenders: list[dict[str, object]] = []
    for el in _iter_rendering_elements(doc):
        spec = _extract_stroke_spec(el)
        if spec.stroke_normalized is None:
            continue
        if op_map.get(spec.stroke_normalized) != "cut":
            continue
        if spec.fill_normalized is None:
            continue  # fill='none' or missing — valid
        offenders.append(
            {
                "element_id": spec.element_id,
                "fill_colour": spec.fill_normalized,
                "stroke_colour": spec.stroke_normalized,
            }
        )

    if not offenders:
        return None

    return RuleResult(
        id="R-SVG-06",
        severity=Severity.WARN,
        title=(
            f"{len(offenders)} cut-layer path"
            f"{'s' if len(offenders) != 1 else ''} have a visible fill"
        ),
        explanation=(
            "Laser cut lines should be strokes only — when they also have a "
            "fill, most laser software will engrave the fill as well, which "
            "burns the whole interior rather than just cutting the outline. "
            "Set fill to 'none' on cut paths."
        ),
        evidence={
            "offending_elements": offenders[:10],
            "total_offending_elements": len(offenders),
        },
        fix_hint=(
            "In Inkscape: select the cut path, Object > Fill and Stroke, "
            "click the X (no paint) under Fill. In Illustrator: set Fill to "
            "None in the toolbar."
        ),
        version=SVG_RULESET_VERSION,
    )


def run_operation_mapping_rules(
    doc: SvgDocument, profile: MachineProfile
) -> list[RuleResult]:
    results: list[RuleResult] = []
    for rule in (
        _rule_04_stroke_not_in_map,
        _rule_05_cut_stroke_not_hairline,
        _rule_06_fill_on_cut_layer,
    ):
        r = rule(doc, profile)
        if r is not None:
            results.append(r)
    return results
