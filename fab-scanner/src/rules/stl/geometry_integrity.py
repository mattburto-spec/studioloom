"""STL geometry integrity rules — R-STL-01..05.

Populated in Phase 2A-2. Each rule is a self-contained function; the
module-level run_geometry_integrity_rules() concatenates results.

Spec source: docs/projects/fabrication-pipeline.md §5.1.

Rule | Severity | Fires when
-----|----------|-----------
R-STL-01 | BLOCK | mesh.is_watertight is False
R-STL-02 | BLOCK | mesh.is_winding_consistent is False
R-STL-03 | WARN  | (DEFERRED in v1 — self-intersection requires
                   fcl/CollisionManager binding or custom rtree
                   narrowphase; deferred until there is a demonstrable
                   fixture and a budget conversation)
R-STL-04 | WARN  | not watertight AND component_count > 1
R-STL-05 | BLOCK | mesh.volume <= epsilon OR any vertex is NaN/inf

Design notes:
- R-STL-04's "only fires when non-watertight" constraint avoids false
  positives on intentional multi-component watertight assemblies (our
  wheel-back-toy-vehicle fixture has 6 components + is watertight → ok).
  Tightening this threshold in v2 will require a ruleset version bump
  per docs/projects/preflight-phase-2a-brief.md §8.
- R-STL-05 drops the spec's "<100 faces" criterion. The chess-bishop-60mm
  known-good fixture has 96 faces. Low face count alone is not a
  printability failure.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np  # type: ignore

from rules.common import MachineProfile, RuleResult, Severity
from schemas.ruleset_version import STL_RULESET_VERSION

if TYPE_CHECKING:
    import trimesh  # type: ignore

# Minimum volume (mm³) that still counts as "geometry exists".
# 0.01 mm³ = roughly a 0.2mm cube. Anything smaller is degenerate.
_VOLUME_EPSILON_MM3 = 0.01


def _rule_01_watertight(mesh: "trimesh.Trimesh") -> RuleResult | None:
    if mesh.is_watertight:
        return None
    # Best-effort hole count — trimesh exposes broken edges when not watertight.
    try:
        broken_edges = int(len(mesh.edges_sorted) - len(mesh.edges_unique))
    except Exception:
        broken_edges = None
    evidence: dict = {
        "face_count": int(len(mesh.faces)),
        "vertex_count": int(len(mesh.vertices)),
    }
    if broken_edges is not None:
        evidence["approx_broken_edge_count"] = broken_edges
    return RuleResult(
        id="R-STL-01",
        severity=Severity.BLOCK,
        title="Mesh is not watertight",
        explanation=(
            "Your 3D model has gaps or holes in its surface. Slicers can't tell what's "
            "inside versus outside the shape, so the print fails — usually mid-layer "
            "with unexpected bridges or missing features. This is the single most "
            "common cause of print failures on student submissions. Fix it in your "
            "modelling tool before re-uploading."
        ),
        evidence=evidence,
        fix_hint=(
            "In Tinkercad: group all overlapping parts and use 'Solid' mode. "
            "In Fusion 360: use Mesh > Repair > Fill Holes. "
            "In Blender: edit mode, select all, Mesh > Clean Up > Fill Holes."
        ),
        version=STL_RULESET_VERSION,
    )


def _rule_02_winding_consistent(mesh: "trimesh.Trimesh") -> RuleResult | None:
    if mesh.is_winding_consistent:
        return None
    return RuleResult(
        id="R-STL-02",
        severity=Severity.BLOCK,
        title="Inconsistent face winding (flipped normals)",
        explanation=(
            "Some faces of your model point 'inside-out' — their normal vectors "
            "disagree with their neighbours. Slicers interpret face direction to "
            "decide which side is solid and which is air; inconsistent winding "
            "produces unpredictable prints, often with missing walls or inverted "
            "infill regions."
        ),
        evidence={
            "face_count": int(len(mesh.faces)),
            "vertex_count": int(len(mesh.vertices)),
        },
        fix_hint=(
            "Most slicers have a 'Repair > Fix Normals' action. In Blender: edit "
            "mode, select all, Mesh > Normals > Recalculate Outside."
        ),
        version=STL_RULESET_VERSION,
    )


def _rule_03_self_intersecting(mesh: "trimesh.Trimesh") -> RuleResult | None:
    """DEFERRED in v1 — see module docstring.

    Returning None (not firing) is the honest v1 behaviour. When this
    rule lands, bump STL_RULESET_VERSION per docs/projects/preflight-
    phase-2a-brief.md §8 (MINOR for new rule).
    """
    return None


def _rule_04_floating_islands(mesh: "trimesh.Trimesh") -> RuleResult | None:
    # Intentional watertight assemblies (printed-in-place parts) should not
    # trigger — gate the rule on non-watertight state first.
    if mesh.is_watertight:
        return None
    try:
        components = mesh.split(only_watertight=False)
        component_count = len(components)
    except Exception:
        return None
    if component_count <= 1:
        return None
    return RuleResult(
        id="R-STL-04",
        severity=Severity.WARN,
        title=f"Mesh splits into {component_count} disconnected pieces",
        explanation=(
            f"Your model is made of {component_count} disconnected pieces that "
            "aren't touching each other. When the mesh also isn't watertight "
            "(see R-STL-01), these pieces are usually unintended fragments from a "
            "broken export — not separate parts you meant to print side-by-side. "
            "Merging or rejoining them in your modelling tool will usually fix "
            "the underlying watertight error too."
        ),
        evidence={"component_count": int(component_count)},
        fix_hint=(
            "In Blender: edit mode, select all, Mesh > Merge > By Distance. "
            "In Tinkercad: group all parts before exporting."
        ),
        version=STL_RULESET_VERSION,
    )


def _rule_05_zero_volume_or_degenerate(mesh: "trimesh.Trimesh") -> RuleResult | None:
    has_nan = bool(np.isnan(mesh.vertices).any() or np.isinf(mesh.vertices).any())

    # mesh.volume raises on degenerate geometry in some trimesh versions.
    try:
        volume = float(mesh.volume)
    except Exception:
        volume = 0.0

    # Signed volume can go negative on winding-inverted meshes; for this rule
    # only the magnitude matters.
    degenerate_by_volume = abs(volume) <= _VOLUME_EPSILON_MM3

    if not (has_nan or degenerate_by_volume):
        return None

    bbox = mesh.bounds  # [[xmin,ymin,zmin],[xmax,ymax,zmax]]
    extents = (
        [round(float(v), 3) for v in (bbox[1] - bbox[0]).tolist()] if bbox is not None else None
    )

    return RuleResult(
        id="R-STL-05",
        severity=Severity.BLOCK,
        title="Mesh is degenerate — zero volume or invalid coordinates",
        explanation=(
            "Your file loaded but the geometry has collapsed — either the bounding "
            "box is zero-size, the volume is effectively nothing, or vertex "
            "coordinates contain NaN/infinity values. The file is structurally "
            "broken; re-export from your modelling tool before uploading again."
        ),
        evidence={
            "volume_mm3": round(volume, 6),
            "bbox_mm": extents,
            "has_nan_or_inf": has_nan,
        },
        fix_hint=(
            "Check your modelling tool for error messages on the last export. "
            "Re-create the shape if the underlying model looks corrupted on reload."
        ),
        version=STL_RULESET_VERSION,
    )


def run_geometry_integrity_rules(
    mesh: "trimesh.Trimesh",
    profile: MachineProfile,
) -> list[RuleResult]:
    """Run all R-STL-01..05 rules against the mesh, return the firing set.

    Rules are independent; a single mesh can fire multiple (e.g. the
    seahorse fixture fires R-STL-01 and R-STL-04 together).
    """
    results: list[RuleResult] = []
    for rule in (
        _rule_01_watertight,
        _rule_02_winding_consistent,
        _rule_03_self_intersecting,
        _rule_04_floating_islands,
        _rule_05_zero_volume_or_degenerate,
    ):
        r = rule(mesh)
        if r is not None:
            results.append(r)
    return results
