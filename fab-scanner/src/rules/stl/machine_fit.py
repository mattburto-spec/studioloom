"""STL machine fit rules — R-STL-06..08.

Populated in Phase 2A-3.

Spec source: docs/projects/fabrication-pipeline.md §5.2.

Rule | Severity | Fires when
-----|----------|-----------
R-STL-06 | BLOCK | bbox exceeds machine profile bed on any axis
R-STL-07 | WARN  | bbox diagonal is suspiciously small (<5 mm) or
                   suspiciously large (>2000 mm) — classic mm-vs-inch
                   mixup
R-STL-08 | WARN  | rough print-time estimate exceeds machine's
                   max_print_time_min (when set). Null on the profile
                   means "no ceiling, skip rule".

Design notes:
- R-STL-06 has an honest 3-axis check. We're NOT fancy-rotating the mesh
  to see if it would fit oriented differently — that's a slicer's job.
  Students submit what they submit; if bbox > bed, we block.
- R-STL-07 uses bbox diagonal (not single-axis extent) to avoid false
  positives on deliberately long-thin parts. Thresholds are rough.
- R-STL-08's time formula is ±50% accurate. Good enough to catch "this
  will run for 8000 hours"; not good enough for billing. Layer height
  and feedrate are hardcoded v1 heuristics — machine profile could
  expose them later.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np  # type: ignore

from rules.common import MachineProfile, RuleResult, Severity
from schemas.ruleset_version import STL_RULESET_VERSION

if TYPE_CHECKING:
    import trimesh  # type: ignore

# Unit-mismatch thresholds in mm. A mesh with diagonal < 5 mm is so small it's
# almost certainly a mm interpretation of an inch-authored drawing. A mesh
# with diagonal > 2000 mm is bigger than any hobby 3D printer — almost
# certainly an inch interpretation of mm-authored geometry.
_UNIT_MISMATCH_DIAGONAL_MIN_MM = 5.0
_UNIT_MISMATCH_DIAGONAL_MAX_MM = 2000.0

# Rough FDM throughput estimate for a modern consumer printer (Bambu X1C,
# Prusa MK4S) on a normal profile: ~15 mm³/s. This is intentionally
# optimistic so R-STL-08 only fires on genuinely-oversized prints, not
# marginal ones. Older machines (Ender) hit ~5 mm³/s — worth surfacing
# per-machine in v2, but for v1 we use one global estimate.
_FDM_MM3_PER_SECOND = 15.0


def _rule_06_exceeds_bed(
    mesh: "trimesh.Trimesh", profile: MachineProfile
) -> RuleResult | None:
    if profile.machine_category != "3d_printer":
        # Laser files are SVGs — they don't land in the STL pipeline.
        # Safety: just don't fire this rule on non-FDM profiles.
        return None

    extents = mesh.bounds[1] - mesh.bounds[0]  # [x, y, z] size in mm
    violations: list[str] = []
    if extents[0] > profile.bed_size_x_mm:
        violations.append(f"X: {extents[0]:.1f} > {profile.bed_size_x_mm} mm")
    if extents[1] > profile.bed_size_y_mm:
        violations.append(f"Y: {extents[1]:.1f} > {profile.bed_size_y_mm} mm")
    if profile.bed_size_z_mm is not None and extents[2] > profile.bed_size_z_mm:
        violations.append(f"Z: {extents[2]:.1f} > {profile.bed_size_z_mm} mm")

    if not violations:
        return None

    return RuleResult(
        id="R-STL-06",
        severity=Severity.BLOCK,
        title=f"Model is larger than the {profile.name} build area",
        explanation=(
            f"Your model measures "
            f"{extents[0]:.0f} × {extents[1]:.0f} × {extents[2]:.0f} mm "
            f"but the {profile.name} print bed is "
            f"{profile.bed_size_x_mm:.0f} × {profile.bed_size_y_mm:.0f}"
            f"{' × ' + str(int(profile.bed_size_z_mm)) if profile.bed_size_z_mm else ''} "
            "mm. The printer cannot physically reach past its build area — scale "
            "the model down in your modelling tool, or split it into parts that "
            "each fit within the bed."
        ),
        evidence={
            "model_bbox_mm": [round(float(v), 1) for v in extents.tolist()],
            "bed_size_mm": {
                "x": profile.bed_size_x_mm,
                "y": profile.bed_size_y_mm,
                "z": profile.bed_size_z_mm,
            },
            "violations": violations,
        },
        fix_hint=(
            "In Tinkercad: select the shape and drag a corner to scale down. "
            "In Fusion 360: Modify > Scale. Watch the 'Dimensions' panel to "
            "confirm the bbox fits."
        ),
        version=STL_RULESET_VERSION,
    )


def _rule_07_unit_mismatch(
    mesh: "trimesh.Trimesh", profile: MachineProfile
) -> RuleResult | None:
    extents = mesh.bounds[1] - mesh.bounds[0]
    diagonal = float(np.linalg.norm(extents))

    # Degenerate meshes (bbox all-zero) legitimately have diagonal < 5mm,
    # but R-STL-05 already flags them as "file is broken" — which is the
    # more useful message for the student. Suppress R-STL-07 in that case
    # to avoid two competing blockers on the same underlying issue.
    if diagonal < 0.1:
        return None

    if _UNIT_MISMATCH_DIAGONAL_MIN_MM <= diagonal <= _UNIT_MISMATCH_DIAGONAL_MAX_MM:
        return None

    if diagonal < _UNIT_MISMATCH_DIAGONAL_MIN_MM:
        direction = "smaller"
        likely_cause = (
            "The file's coordinates may be in inches but the printer reads them "
            "as millimetres, so the model came out 25× too small."
        )
    else:
        direction = "larger"
        likely_cause = (
            "The file's coordinates may be in millimetres but were interpreted "
            "as inches somewhere — typical when a Fusion 360 file is exported "
            "with the wrong units. The model ends up 25× larger than intended."
        )

    return RuleResult(
        id="R-STL-07",
        severity=Severity.WARN,
        title=f"Unusual size — likely unit mismatch ({direction} than expected)",
        explanation=(
            f"The bounding box diagonal is {diagonal:.1f} mm — well outside the "
            f"typical range for a hobby print ({_UNIT_MISMATCH_DIAGONAL_MIN_MM:.0f}–"
            f"{_UNIT_MISMATCH_DIAGONAL_MAX_MM:.0f} mm). {likely_cause} "
            "If you meant to export at this size, acknowledge this warning to continue."
        ),
        evidence={
            "bbox_diagonal_mm": round(diagonal, 2),
            "bbox_extents_mm": [round(float(v), 1) for v in extents.tolist()],
            "expected_range_mm": [
                _UNIT_MISMATCH_DIAGONAL_MIN_MM,
                _UNIT_MISMATCH_DIAGONAL_MAX_MM,
            ],
        },
        fix_hint=(
            "Check your modelling tool's unit setting before export. In Fusion 360: "
            "Right-click the body > Export > set Units to mm. In Tinkercad: the "
            "workplane grid is in mm by default — confirm the size matches."
        ),
        version=STL_RULESET_VERSION,
    )


def _rule_08_print_time_exceeds_max(
    mesh: "trimesh.Trimesh", profile: MachineProfile
) -> RuleResult | None:
    if profile.max_print_time_min is None:
        return None
    if profile.machine_category != "3d_printer":
        return None

    try:
        volume_mm3 = abs(float(mesh.volume))
    except Exception:
        return None

    # Guard rails: if R-STL-05 already caught zero volume, skip.
    if volume_mm3 <= 0:
        return None

    estimated_seconds = volume_mm3 / _FDM_MM3_PER_SECOND
    estimated_minutes = estimated_seconds / 60.0

    if estimated_minutes <= profile.max_print_time_min:
        return None

    return RuleResult(
        id="R-STL-08",
        severity=Severity.WARN,
        title=(
            f"Estimated print time ({int(estimated_minutes)} min) exceeds lab "
            f"ceiling ({profile.max_print_time_min} min)"
        ),
        explanation=(
            f"Based on a rough throughput estimate, this model would take around "
            f"{int(estimated_minutes)} minutes ({estimated_minutes / 60:.1f} hours) "
            f"to print on the {profile.name}. Your lab has set a {profile.max_print_time_min}-"
            "minute ceiling per job. Consider printing at a lower infill, fewer "
            "perimeters, or scaling down before submitting — or ask your teacher "
            "to approve this as an exception."
        ),
        evidence={
            "estimated_minutes": int(estimated_minutes),
            "max_print_time_min": profile.max_print_time_min,
            "volume_mm3": round(volume_mm3, 1),
            "throughput_mm3_per_sec_assumption": _FDM_MM3_PER_SECOND,
        },
        fix_hint=(
            "In your slicer, preview the real time estimate before committing. "
            "In Bambu Studio / PrusaSlicer: File > Preview after loading the file."
        ),
        version=STL_RULESET_VERSION,
    )


def run_machine_fit_rules(
    mesh: "trimesh.Trimesh",
    profile: MachineProfile,
) -> list[RuleResult]:
    results: list[RuleResult] = []
    for rule in (
        _rule_06_exceeds_bed,
        _rule_07_unit_mismatch,
        _rule_08_print_time_exceeds_max,
    ):
        r = rule(mesh, profile)
        if r is not None:
            results.append(r)
    return results
