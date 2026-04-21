"""STL informational rules — R-STL-15..17 (FYI severity).

Populated in Phase 2A-5. Unlike BLOCK/WARN rules, FYI rules emit
computed metrics the student UI can surface as "helpful info"
alongside blockers and warnings. R-STL-15/16 fire for every valid
mesh; R-STL-17 fires only when triangle count exceeds the slicer
pain threshold.

Spec source: docs/projects/fabrication-pipeline.md §5.4.

Rule | Severity | Behaviour
-----|----------|----------
R-STL-15 | FYI | Always emit — rough print time estimate
R-STL-16 | FYI | Always emit — filament gram/metre estimate
R-STL-17 | FYI | Fire when face_count > 500_000 (slicer sluggishness)

Design notes:
- Throughput / density constants are borrowed from R-STL-08's formula
  to keep a single v1 source of truth. Filament density is PLA at
  1.24 g/cm³; 1.75mm filament cross-section is ~2.405 mm².
- All three skip on degenerate / NaN geometry (volume <= 0) — surfacing
  "estimated 0 minutes" on a broken file would be misleading.
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING

import numpy as np  # type: ignore

from rules.common import MachineProfile, RuleResult, Severity
from schemas.ruleset_version import STL_RULESET_VERSION

if TYPE_CHECKING:
    import trimesh  # type: ignore

# Kept consistent with R-STL-08 — if a future sub-phase refactors these
# constants into a machine_profile field, both rules pick it up together.
_FDM_MM3_PER_SECOND = 15.0

# PLA defaults. Override when other-material support lands.
_FILAMENT_DENSITY_G_PER_CM3 = 1.24
_FILAMENT_DIAMETER_MM = 1.75
_FILAMENT_CROSS_SECTION_MM2 = math.pi * (_FILAMENT_DIAMETER_MM / 2) ** 2

# Triangle-count threshold for "slicer sluggishness". 500k is the spec
# target — beyond that, Bambu/Prusa slicer previews visibly lag.
_TRIANGLE_COUNT_SLUGGISH_THRESHOLD = 500_000


def _has_usable_volume(mesh: "trimesh.Trimesh") -> float | None:
    try:
        volume = abs(float(mesh.volume))
    except Exception:
        return None
    if volume <= 0 or math.isnan(volume) or math.isinf(volume):
        return None
    if np.isnan(mesh.vertices).any():
        return None
    return volume


def _rule_15_estimated_print_time(
    mesh: "trimesh.Trimesh", profile: MachineProfile
) -> RuleResult | None:
    if profile.machine_category != "3d_printer":
        return None
    volume_mm3 = _has_usable_volume(mesh)
    if volume_mm3 is None:
        return None

    minutes = volume_mm3 / _FDM_MM3_PER_SECOND / 60.0
    if minutes < 1:
        human = f"{int(minutes * 60)} s"
    elif minutes < 60:
        human = f"{int(minutes)} min"
    else:
        human = f"{minutes / 60:.1f} hours"

    return RuleResult(
        id="R-STL-15",
        severity=Severity.FYI,
        title=f"Estimated print time: ~{human}",
        explanation=(
            f"Based on a rough volume-throughput estimate, this model would take "
            f"around {human} to print on the {profile.name}. The real number "
            "depends on your slicer profile (infill, speed, wall count). Use this "
            "as an order-of-magnitude check — open your slicer's preview for a "
            "real estimate before committing."
        ),
        evidence={
            "estimated_minutes": round(minutes, 1),
            "volume_mm3": round(volume_mm3, 1),
            "throughput_mm3_per_sec_assumption": _FDM_MM3_PER_SECOND,
        },
        fix_hint=None,
        version=STL_RULESET_VERSION,
    )


def _rule_16_estimated_filament(
    mesh: "trimesh.Trimesh", profile: MachineProfile
) -> RuleResult | None:
    if profile.machine_category != "3d_printer":
        return None
    volume_mm3 = _has_usable_volume(mesh)
    if volume_mm3 is None:
        return None

    # mm³ → cm³ = /1000; cm³ × g/cm³ = grams
    grams = volume_mm3 / 1000.0 * _FILAMENT_DENSITY_G_PER_CM3
    # volume_mm3 / cross_section_mm² = length_mm; /1000 = length_m
    metres = volume_mm3 / _FILAMENT_CROSS_SECTION_MM2 / 1000.0

    return RuleResult(
        id="R-STL-16",
        severity=Severity.FYI,
        title=f"Estimated filament: ~{grams:.0f} g (~{metres:.1f} m)",
        explanation=(
            f"At PLA density ({_FILAMENT_DENSITY_G_PER_CM3} g/cm³) and "
            f"{_FILAMENT_DIAMETER_MM} mm filament, this model will use about "
            f"{grams:.0f} g or {metres:.1f} m of filament. Check your spool "
            "has enough before starting a long print."
        ),
        evidence={
            "estimated_grams": round(grams, 1),
            "estimated_metres": round(metres, 2),
            "volume_mm3": round(volume_mm3, 1),
            "density_g_per_cm3_assumption": _FILAMENT_DENSITY_G_PER_CM3,
            "filament_diameter_mm_assumption": _FILAMENT_DIAMETER_MM,
        },
        fix_hint=None,
        version=STL_RULESET_VERSION,
    )


def _rule_17_triangle_count(
    mesh: "trimesh.Trimesh", profile: MachineProfile
) -> RuleResult | None:
    face_count = int(len(mesh.faces))
    if face_count <= _TRIANGLE_COUNT_SLUGGISH_THRESHOLD:
        return None

    return RuleResult(
        id="R-STL-17",
        severity=Severity.FYI,
        title=f"High triangle count: {face_count:,}",
        explanation=(
            f"This model has {face_count:,} triangles, above the "
            f"{_TRIANGLE_COUNT_SLUGGISH_THRESHOLD:,}-triangle sluggishness "
            "threshold. Slicers will open and preview this file slowly, and "
            "slicing itself will take longer. Consider reducing complexity in "
            "your modelling tool (decimation, lower curve segments) if the "
            "extra detail isn't needed for the print."
        ),
        evidence={
            "face_count": face_count,
            "threshold": _TRIANGLE_COUNT_SLUGGISH_THRESHOLD,
        },
        fix_hint=(
            "In Fusion 360: Mesh > Modify > Reduce. In Blender: "
            "Decimate modifier at 0.5 ratio. In most CAD tools: lower the "
            "export resolution / tessellation quality."
        ),
        version=STL_RULESET_VERSION,
    )


def run_informational_rules(
    mesh: "trimesh.Trimesh",
    profile: MachineProfile,
) -> list[RuleResult]:
    results: list[RuleResult] = []
    for rule in (
        _rule_15_estimated_print_time,
        _rule_16_estimated_filament,
        _rule_17_triangle_count,
    ):
        r = rule(mesh, profile)
        if r is not None:
            results.append(r)
    return results
