"""SVG informational rules — R-SVG-14..15.

Populated in Phase 2B-6.

Spec source: docs/projects/fabrication-pipeline.md §6 (informational).

Rule     | Severity | Fires when
---------|----------|-----------
R-SVG-14 | FYI      | always (if at least one mapped path exists).
                     Reports estimated cut/score/engrave time based on
                     total path length × typical laser speed per
                     operation.
R-SVG-15 | FYI      | always. Reports count of paths per operation
                     plus unmapped stroke colours count. Surface-level
                     "what's in this file" for the teacher.

Design notes:
- R-SVG-14 speed assumptions (cut 15 mm/s, score 40 mm/s, engrave
  30 mm/s) are v1 generic defaults matching 40W CO2 on 3mm plywood.
  Real throughput depends on material + power — the FYI wording makes
  this explicit ("rough estimate"). Per-profile speed tables are a
  future refinement once we have per-school data.
- R-SVG-14 honours the same unit-ambiguity guard as R-SVG-09/12:
  only reports minutes when viewBox is mm-1:1. Otherwise reports just
  the total path length in viewBox units, not a minutes estimate.
- Both rules use the cascade-resolved stroke via _extract_stroke_spec
  so inherited group strokes are counted correctly (Phase 2B-4a).
- Both rules always emit a result (even "0 paths mapped") so teachers
  see layer-summary information on every scan.
"""

from __future__ import annotations

import re
from collections import Counter

from rules.common import MachineProfile, RuleResult, Severity
from rules.svg.operation_mapping import (
    _extract_stroke_spec,
    _iter_rendering_elements,
    _normalized_operation_map,
)
from schemas.ruleset_version import SVG_RULESET_VERSION
from worker.svg_loader import SvgDocument

# Typical laser speeds for 40W CO2 on 3mm ply. mm per second.
# Cut is slowest (full material depth); score lightest/fastest; engrave
# between the two.
_SPEED_MM_PER_SEC: dict[str, float] = {
    "cut": 15.0,
    "score": 40.0,
    "engrave": 30.0,
}


def _viewbox_is_mm_1_to_1(doc: SvgDocument) -> bool:
    """Duplicate of the identical helper in raster.py. Tiny enough to
    not warrant premature extraction — Lesson #44."""
    if doc.viewbox is None or not doc.width_raw:
        return False
    m = re.match(r"^\s*([+-]?\d*\.?\d+)\s*mm\s*$", doc.width_raw)
    if not m:
        return False
    try:
        stated_mm = float(m.group(1))
    except ValueError:
        return False
    if stated_mm <= 0 or doc.viewbox[2] <= 0:
        return False
    return abs((doc.viewbox[2] / stated_mm) - 1.0) <= 0.10


def _path_length_svg_units(d: str) -> float | None:
    """Use svgpathtools to compute total path length. Returns None on parse
    failure (logged but not blocking)."""
    try:
        from svgpathtools import parse_path  # type: ignore
    except ImportError:
        return None
    try:
        p = parse_path(d)
        return float(p.length())
    except Exception:
        return None


def _collect_by_operation(
    doc: SvgDocument, profile: MachineProfile
) -> tuple[dict[str, float], dict[str, int], int]:
    """Walk paths once, return per-operation (total_length_svg, count)
    tuple plus unmapped-stroke path count."""
    op_map = _normalized_operation_map(profile.operation_color_map)
    lengths: dict[str, float] = {op: 0.0 for op in _SPEED_MM_PER_SEC}
    counts: dict[str, int] = {op: 0 for op in _SPEED_MM_PER_SEC}
    unmapped_count = 0
    for el in _iter_rendering_elements(doc):
        tag_short = el.tag.rsplit("}", 1)[-1] if isinstance(el.tag, str) else ""
        if tag_short != "path":
            continue
        spec = _extract_stroke_spec(el)
        if spec.stroke_normalized is None:
            continue
        op = op_map.get(spec.stroke_normalized) if op_map else None
        if op is None:
            unmapped_count += 1
            continue
        if op not in counts:
            # Unknown operation label in the profile map (future-proof).
            continue
        counts[op] += 1
        d = el.get("d") or ""
        length = _path_length_svg_units(d) if d.strip() else 0.0
        if length is not None:
            lengths[op] += length
    return lengths, counts, unmapped_count


def _rule_14_estimated_time(
    doc: SvgDocument, profile: MachineProfile
) -> RuleResult | None:
    if profile.machine_category != "laser_cutter":
        return None
    lengths, counts, _ = _collect_by_operation(doc, profile)
    total_paths = sum(counts.values())
    if total_paths == 0:
        return None  # Nothing mapped — R-SVG-15 handles the "empty" case.

    mm_per_unit = 1.0 if _viewbox_is_mm_1_to_1(doc) else None

    estimated_seconds = 0.0
    per_op_minutes: dict[str, float] = {}
    for op, mm in lengths.items():
        if mm_per_unit is None:
            per_op_minutes[op] = -1.0  # unknown
            continue
        length_mm = mm * mm_per_unit
        speed = _SPEED_MM_PER_SEC[op]
        secs = length_mm / speed if speed > 0 else 0.0
        estimated_seconds += secs
        per_op_minutes[op] = round(secs / 60.0, 2)

    if mm_per_unit is None:
        # Can't give a minutes estimate — report path counts only.
        return RuleResult(
            id="R-SVG-14",
            severity=Severity.FYI,
            title="Cut-time estimate unavailable — unit context is ambiguous",
            explanation=(
                "The file doesn't declare dimensions in mm / cm / in, so we "
                "can't convert path length to a real-world time estimate. "
                "Set the SVG width/height in physical units (see R-SVG-03) "
                "to get a minutes estimate on the next upload."
            ),
            evidence={
                "path_counts_by_operation": counts,
                "total_mapped_paths": total_paths,
                "notes": "Minutes estimate requires stated mm and viewBox ~1:1.",
            },
            fix_hint=None,
            version=SVG_RULESET_VERSION,
        )

    estimated_minutes = estimated_seconds / 60.0
    return RuleResult(
        id="R-SVG-14",
        severity=Severity.FYI,
        title=f"Estimated laser time: ~{estimated_minutes:.1f} min",
        explanation=(
            f"Rough estimate based on a 40W CO2 laser on 3mm plywood: "
            f"cut at {_SPEED_MM_PER_SEC['cut']:.0f} mm/s, score at "
            f"{_SPEED_MM_PER_SEC['score']:.0f} mm/s, engrave at "
            f"{_SPEED_MM_PER_SEC['engrave']:.0f} mm/s. Real run time "
            "depends on material, power setting, and number of passes."
        ),
        evidence={
            "estimated_minutes": round(estimated_minutes, 2),
            "per_operation_minutes": per_op_minutes,
            "speeds_mm_per_sec": _SPEED_MM_PER_SEC,
            "path_counts_by_operation": counts,
        },
        fix_hint=None,
        version=SVG_RULESET_VERSION,
    )


def _rule_15_layer_summary(
    doc: SvgDocument, profile: MachineProfile
) -> RuleResult | None:
    if profile.machine_category != "laser_cutter":
        return None
    _, counts, unmapped = _collect_by_operation(doc, profile)
    total_mapped = sum(counts.values())

    parts: list[str] = []
    for op, n in counts.items():
        if n == 0:
            continue
        parts.append(f"{n} {op}{'s' if n != 1 else ''}")
    if unmapped > 0:
        parts.append(f"{unmapped} unmapped-stroke")
    summary = ", ".join(parts) if parts else "no mapped paths"

    return RuleResult(
        id="R-SVG-15",
        severity=Severity.FYI,
        title=f"Layer summary: {summary}",
        explanation=(
            "Breakdown of paths by operation (derived from the stroke "
            "colour against the machine's operation colour map). Helps "
            "spot-check that the design has the operations the teacher "
            "expects."
        ),
        evidence={
            "path_counts_by_operation": counts,
            "unmapped_stroke_count": unmapped,
            "total_mapped_paths": total_mapped,
        },
        fix_hint=None,
        version=SVG_RULESET_VERSION,
    )


def run_informational_rules(
    doc: SvgDocument, profile: MachineProfile
) -> list[RuleResult]:
    results: list[RuleResult] = []
    for rule in (_rule_14_estimated_time, _rule_15_layer_summary):
        r = rule(doc, profile)
        if r is not None:
            results.append(r)
    return results
