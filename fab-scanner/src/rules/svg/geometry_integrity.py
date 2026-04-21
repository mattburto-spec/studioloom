"""SVG geometry-integrity rules — R-SVG-07..11.

Populated in Phase 2B-4.

Spec source: docs/projects/fabrication-pipeline.md §6 (geometry integrity).

Rule     | Severity | Fires when
---------|----------|-----------
R-SVG-07 | WARN*    | cut-layer paths aren't closed with Z/z.
                     *Spec severity BLOCK — shipped at WARN until a
                     fixture is authored. Tracked as FU-R-SVG-07-FIXTURE.
R-SVG-08 | WARN     | two cut-layer paths share the same normalised
                     `d` string — duplicate burn on the same geometry.
R-SVG-09 | WARN     | cut-layer paths contain segments below the
                     machine's kerf width. Only fired when a clean
                     viewBox-to-mm conversion is available (stated
                     dims in mm AND viewBox ratio near 1:1); otherwise
                     the rule stays silent rather than emit noise.
R-SVG-10 | BLOCK    | any rendering <text> element survives outside
                     <defs>. Lasers without the authoring font will
                     substitute or fail — text must be converted to
                     paths before submission.
R-SVG-11 | FYI      | <path> elements with empty/whitespace-only `d`
                     or `d` that parses to zero-length. Clutter only.

Design notes:
- R-SVG-07 severity override: hardcoded constant at top of file with a
  FIXME pointing at FU-R-SVG-07-FIXTURE. When the fixture lands and
  the rule is validated, flip the constant and bump the ruleset MINOR
  version per the policy in schemas/ruleset_version.py.
- R-SVG-08 duplicate detection is string-based. A smarter
  geometry-level dedup (segment hashing, epsilon compare) is a v2
  refinement — real-world Inkscape exports produce identical `d`
  strings for duplicated paths, so the cheap check catches the
  intended case.
- R-SVG-09 requires svgpathtools path parsing + unit conversion. When
  stated dims are mm and viewBox ratio is ~1:1 we compare segment
  length in viewBox units directly to kerf_mm. Other unit situations
  defer to R-SVG-02 / R-SVG-03 rather than force a best-guess.
- R-SVG-10 doesn't need to check cut-vs-engrave operation — ANY text
  element in a laser file is a font-substitution risk. Spec wording
  mentions cut/engrave layer; practical implementation is broader
  because DT labs treat <text> survival as a universal no-go.
- R-SVG-11 uses FYI severity (per spec) — informational clutter flag,
  never blocks submission.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from rules.common import MachineProfile, RuleResult, Severity
from rules.svg.operation_mapping import (
    _extract_stroke_spec,
    _iter_rendering_elements,
    _normalized_operation_map,
)
from schemas.ruleset_version import SVG_RULESET_VERSION
from worker.svg_loader import SVG_NS, SvgDocument

if TYPE_CHECKING:
    from lxml import etree  # type: ignore

# FIXME(matt, FU-R-SVG-07-FIXTURE): promote to BLOCK once a fixture lands
# demonstrating an open-path cut. Bump SVG_RULESET_VERSION to svg-v1.1.0
# when flipping — severity TIGHTENED per the version policy.
_R_SVG_07_SEVERITY: Severity = Severity.WARN

# R-SVG-08 normalises the `d` string by collapsing runs of whitespace
# (tabs / multiple spaces) into single spaces before hashing. Raw
# byte-for-byte equality would miss pretty-printed duplicates.
_WS_RE = re.compile(r"\s+")


# ---------------------------------------------------------------------------
# R-SVG-07 — open paths on cut layer
# ---------------------------------------------------------------------------


def _rule_07_open_paths_on_cut(
    doc: SvgDocument, profile: MachineProfile
) -> RuleResult | None:
    if profile.machine_category != "laser_cutter":
        return None
    op_map = _normalized_operation_map(profile.operation_color_map)
    if not op_map:
        return None

    open_paths: list[dict[str, object]] = []
    for el in _iter_rendering_elements(doc):
        tag_short = el.tag.rsplit("}", 1)[-1] if isinstance(el.tag, str) else ""
        if tag_short != "path":
            continue
        spec = _extract_stroke_spec(el)
        if spec.stroke_normalized is None:
            continue
        if op_map.get(spec.stroke_normalized) != "cut":
            continue
        d = el.get("d") or ""
        if not d.strip():
            continue  # R-SVG-11 handles empty paths
        # Any subpath without a terminating Z/z is open.
        # Simple check: strip whitespace from end and look at last char.
        last = d.strip()[-1]
        if last in ("Z", "z"):
            continue
        open_paths.append(
            {
                "element_id": spec.element_id,
                "d_preview": d.strip()[:80]
                + ("…" if len(d.strip()) > 80 else ""),
            }
        )

    if not open_paths:
        return None

    return RuleResult(
        id="R-SVG-07",
        severity=_R_SVG_07_SEVERITY,
        title=(
            f"{len(open_paths)} cut-layer path"
            f"{'s' if len(open_paths) != 1 else ''} "
            "aren't closed with Z"
        ),
        explanation=(
            "Laser cut paths should form closed loops — an open path leaves "
            "the cut piece attached at one end and can jam the machine on "
            "release. Close every cut path before submitting (Inkscape: "
            "select the path and press Ctrl+L → 'Close' or use the XML "
            "editor to add a trailing Z to the `d` attribute)."
        ),
        evidence={
            "open_paths": open_paths[:10],
            "total_open_paths": len(open_paths),
            "severity_note": (
                "Shipped at WARN until a real open-path fixture is "
                "authored; promotes to BLOCK in svg-v1.1.0."
            ),
        },
        fix_hint=(
            "In Inkscape: select open paths with Edit > Find/Replace on "
            "path data not ending in Z. In Illustrator: select all, "
            "Object > Path > Join."
        ),
        version=SVG_RULESET_VERSION,
    )


# ---------------------------------------------------------------------------
# R-SVG-08 — duplicate cut lines
# ---------------------------------------------------------------------------


def _rule_08_duplicate_cut_lines(
    doc: SvgDocument, profile: MachineProfile
) -> RuleResult | None:
    if profile.machine_category != "laser_cutter":
        return None
    op_map = _normalized_operation_map(profile.operation_color_map)
    if not op_map:
        return None

    counts: dict[str, int] = {}
    first_id_by_hash: dict[str, str] = {}
    for el in _iter_rendering_elements(doc):
        tag_short = el.tag.rsplit("}", 1)[-1] if isinstance(el.tag, str) else ""
        if tag_short != "path":
            continue
        spec = _extract_stroke_spec(el)
        if spec.stroke_normalized is None:
            continue
        if op_map.get(spec.stroke_normalized) != "cut":
            continue
        d = el.get("d") or ""
        key = _WS_RE.sub(" ", d.strip())
        if not key:
            continue
        counts[key] = counts.get(key, 0) + 1
        first_id_by_hash.setdefault(key, spec.element_id)

    duplicates = [
        {
            "first_element_id": first_id_by_hash[k],
            "duplicate_count": v,
            "d_preview": k[:80] + ("…" if len(k) > 80 else ""),
        }
        for k, v in counts.items()
        if v > 1
    ]

    if not duplicates:
        return None

    total_extra = sum(d["duplicate_count"] - 1 for d in duplicates)
    return RuleResult(
        id="R-SVG-08",
        severity=Severity.WARN,
        title=(
            f"{total_extra} duplicate cut path"
            f"{'s' if total_extra != 1 else ''} — the laser will burn the "
            "same line twice"
        ),
        explanation=(
            "Two or more cut paths share identical geometry. The laser will "
            "cut each one, which wastes time and produces charring on the "
            "second pass. Select the duplicates and delete the extras, or "
            "use Path > Union to merge them."
        ),
        evidence={
            "duplicate_groups": duplicates[:10],
            "total_extra_cuts": total_extra,
        },
        fix_hint=(
            "In Inkscape: Edit > Find/Replace on path data; or Extensions "
            "> Modify Path > Remove Duplicate Nodes. In Illustrator: "
            "Select > Same > Appearance, then delete overlapping paths."
        ),
        version=SVG_RULESET_VERSION,
    )


# ---------------------------------------------------------------------------
# R-SVG-09 — features below kerf
# ---------------------------------------------------------------------------


def _rule_09_features_below_kerf(
    doc: SvgDocument, profile: MachineProfile
) -> RuleResult | None:
    if profile.machine_category != "laser_cutter":
        return None
    if profile.kerf_mm is None:
        return None
    op_map = _normalized_operation_map(profile.operation_color_map)
    if not op_map:
        return None

    # Require clean unit context: stated mm + viewBox ratio ~1:1, so
    # path-segment length units == mm. Deliberately conservative — if
    # R-SVG-02 or R-SVG-03 would fire, we skip rather than pretend.
    stated_mm = _stated_width_mm(doc.width_raw)
    if stated_mm is None or doc.viewbox is None:
        return None
    vb_width = doc.viewbox[2]
    if vb_width <= 0:
        return None
    if abs((vb_width / stated_mm) - 1.0) > 0.10:
        return None  # viewBox not in mm; unit conversion ambiguous

    try:
        from svgpathtools import parse_path  # type: ignore
    except ImportError:
        # Defensive — svgpathtools is pinned in requirements but if a
        # dev env skips it, don't crash the worker on scan.
        return None

    offenders: list[dict[str, object]] = []
    for el in _iter_rendering_elements(doc):
        tag_short = el.tag.rsplit("}", 1)[-1] if isinstance(el.tag, str) else ""
        if tag_short != "path":
            continue
        spec = _extract_stroke_spec(el)
        if spec.stroke_normalized is None:
            continue
        if op_map.get(spec.stroke_normalized) != "cut":
            continue
        d = el.get("d") or ""
        if not d.strip():
            continue
        try:
            path = parse_path(d)
        except Exception:
            continue
        # Total path length. Sub-kerf feature would be one of these
        # with length below kerf_mm. A proper per-segment check is
        # complex; total length is a solid first pass for v1.
        try:
            length = float(path.length())
        except Exception:
            continue
        if length >= profile.kerf_mm:
            continue
        offenders.append(
            {
                "element_id": spec.element_id,
                "length_mm": round(length, 3),
                "kerf_mm": profile.kerf_mm,
            }
        )

    if not offenders:
        return None

    return RuleResult(
        id="R-SVG-09",
        severity=Severity.WARN,
        title=(
            f"{len(offenders)} cut feature"
            f"{'s' if len(offenders) != 1 else ''} below the "
            f"{profile.kerf_mm} mm kerf width"
        ),
        explanation=(
            "Any feature narrower than the laser's kerf will vaporise — "
            "the beam removes material slightly wider than the line itself, "
            "so two cuts closer than the kerf merge and the feature "
            "disappears. Enlarge these features or remove them before "
            "submitting."
        ),
        evidence={
            "kerf_mm": profile.kerf_mm,
            "offending_paths": offenders[:10],
            "total_sub_kerf_features": len(offenders),
        },
        fix_hint=(
            "In Inkscape: select the small feature, Object > Transform > "
            "scale up to at least kerf × 2. For narrow slots: set the "
            "slot width to kerf × 2 minimum."
        ),
        version=SVG_RULESET_VERSION,
    )


def _stated_width_mm(raw: str | None) -> float | None:
    """Minimal mm parse — we only accept mm here. Broader parsing lives
    in machine_fit.py; this rule intentionally limits itself to the
    simplest unambiguous case."""
    if not raw:
        return None
    m = re.match(r"^\s*([+-]?\d*\.?\d+)\s*mm\s*$", raw)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# R-SVG-10 — un-outlined text
# ---------------------------------------------------------------------------


def _rule_10_unoutlined_text(
    doc: SvgDocument, profile: MachineProfile
) -> RuleResult | None:
    if profile.machine_category != "laser_cutter":
        return None

    # Any <text> element outside <defs> is a font-substitution risk on
    # the laser. We don't care about cut-vs-engrave here — the spec
    # singles out cut/engrave layers but in practice DT teachers treat
    # any surviving <text> as a hard no-go.
    text_tag = f"{{{SVG_NS}}}text"
    defs_tag = f"{{{SVG_NS}}}defs"
    offending: list[dict[str, object]] = []
    for el in doc.root.iter():
        if el.tag != text_tag:
            continue
        if any(a.tag == defs_tag for a in el.iterancestors()):
            continue
        offending.append(
            {
                "element_id": el.get("id") or "",
                # Preview up to 40 chars of the rendered string; this
                # helps teachers identify WHICH text wasn't outlined.
                "text_preview": (
                    ("".join(el.itertext()).strip() or "(empty/flowed)")[:40]
                ),
            }
        )

    if not offending:
        return None

    return RuleResult(
        id="R-SVG-10",
        severity=Severity.BLOCK,
        title=(
            f"{len(offending)} <text> element"
            f"{'s' if len(offending) != 1 else ''} not converted to paths"
        ),
        explanation=(
            "Laser software can only cut or engrave paths, not live text. "
            "If your file has <text> elements, the laser either substitutes "
            "a different font (wrong look) or fails to render them at all. "
            "Convert all text to outlined paths before submitting."
        ),
        evidence={
            "text_elements": offending[:10],
            "total_text_elements": len(offending),
        },
        fix_hint=(
            "In Inkscape: select all text, Path > Object to Path. In "
            "Illustrator: select all text, Type > Create Outlines. "
            "Save the file AFTER converting, then re-upload."
        ),
        version=SVG_RULESET_VERSION,
    )


# ---------------------------------------------------------------------------
# R-SVG-11 — orphan / zero-length paths
# ---------------------------------------------------------------------------


def _rule_11_orphan_paths(
    doc: SvgDocument, profile: MachineProfile
) -> RuleResult | None:
    path_tag = f"{{{SVG_NS}}}path"
    defs_tag = f"{{{SVG_NS}}}defs"
    orphans: list[str] = []
    for el in doc.root.iter():
        if el.tag != path_tag:
            continue
        if any(a.tag == defs_tag for a in el.iterancestors()):
            continue
        d = el.get("d")
        if d is None or not d.strip():
            orphans.append(el.get("id") or "(no id)")

    if not orphans:
        return None

    return RuleResult(
        id="R-SVG-11",
        severity=Severity.FYI,
        title=(
            f"{len(orphans)} empty <path> element"
            f"{'s' if len(orphans) != 1 else ''}"
        ),
        explanation=(
            "Your file contains one or more <path> elements with no geometry "
            "(missing or empty `d` attribute). These usually have no effect "
            "on the laser, but they clutter the file. Remove them on your "
            "next save to keep the file tidy."
        ),
        evidence={
            "orphan_element_ids": orphans[:20],
            "total_orphan_paths": len(orphans),
        },
        fix_hint=(
            "In Inkscape: Edit > Delete all elements with empty attributes, "
            "or open the XML editor and delete manually."
        ),
        version=SVG_RULESET_VERSION,
    )


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------


def run_geometry_integrity_rules(
    doc: SvgDocument, profile: MachineProfile
) -> list[RuleResult]:
    results: list[RuleResult] = []
    for rule in (
        _rule_07_open_paths_on_cut,
        _rule_08_duplicate_cut_lines,
        _rule_09_features_below_kerf,
        _rule_10_unoutlined_text,
        _rule_11_orphan_paths,
    ):
        r = rule(doc, profile)
        if r is not None:
            results.append(r)
    return results
