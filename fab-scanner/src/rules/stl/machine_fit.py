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
- R-STL-06 checks both XY orientations (Phase 8.1d-34): a part fits
  if EITHER as-is OR rotated 90° around Z clears the bed. Z is
  checked the same way in both cases (gravity is gravity). Slicers
  auto-rotate around Z trivially, so blocking 250×384×N when 384×250×N
  fits the printer is overzealous. We don't try arbitrary 3D rotation —
  swapping X↔Z would change the print orientation, which has real
  consequences for overhangs/surface quality and is the operator's
  call.
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
    x_size, y_size, z_size = float(extents[0]), float(extents[1]), float(extents[2])
    bed_x = profile.bed_size_x_mm
    bed_y = profile.bed_size_y_mm
    bed_z = profile.bed_size_z_mm

    # Phase 8.1d-34: check both XY orientations. Z stays vertical
    # (gravity), so the Z fit is identical in both cases.
    z_fits = bed_z is None or z_size <= bed_z
    fits_unrotated = x_size <= bed_x and y_size <= bed_y and z_fits
    fits_rotated = y_size <= bed_x and x_size <= bed_y and z_fits
    if fits_unrotated or fits_rotated:
        return None

    # Pick the smaller-overshoot orientation for the violation report
    # so the student sees the gentlest framing of the problem.
    overshoot_unrotated = max(0.0, x_size - bed_x) + max(0.0, y_size - bed_y)
    overshoot_rotated = max(0.0, y_size - bed_x) + max(0.0, x_size - bed_y)
    if overshoot_rotated < overshoot_unrotated:
        eff_x, eff_y = y_size, x_size
        orientation_note = " (rotated)"
    else:
        eff_x, eff_y = x_size, y_size
        orientation_note = ""

    violations: list[str] = []
    if eff_x > bed_x:
        violations.append(f"X{orientation_note}: {eff_x:.1f} > {bed_x} mm")
    if eff_y > bed_y:
        violations.append(f"Y{orientation_note}: {eff_y:.1f} > {bed_y} mm")
    if bed_z is not None and z_size > bed_z:
        violations.append(f"Z: {z_size:.1f} > {bed_z} mm")

    return RuleResult(
        id="R-STL-06",
        severity=Severity.BLOCK,
        title=f"Model is larger than the {profile.name} build area",
        explanation=(
            f"Your model measures "
            f"{x_size:.0f} × {y_size:.0f} × {z_size:.0f} mm "
            f"but the {profile.name} print bed is "
            f"{bed_x:.0f} × {bed_y:.0f}"
            f"{' × ' + str(int(bed_z)) if bed_z else ''} "
            "mm. Even rotated 90° around the vertical axis it doesn't "
            "fit. Scale the model down in your modelling tool, or split "
            "it into parts that each fit within the bed."
        ),
        evidence={
            "model_bbox_mm": [round(float(v), 1) for v in extents.tolist()],
            "bed_size_mm": {
                "x": bed_x,
                "y": bed_y,
                "z": bed_z,
            },
            "violations": violations,
        },
        fix_hint=(
            "In Tinkercad: select the shape and drag a corner to scale down. "
            "In Fusion 360: Modify > Scale. Watch the 'Dimensions' panel to "
            "confirm the bbox fits in at least one orientation."
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
