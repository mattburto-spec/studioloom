"""STL printability rules — R-STL-09..14.

Populated in Phase 2A-4. These are the hardest rules in the catalogue
because they require geometric analysis beyond simple property reads.

Spec source: docs/projects/fabrication-pipeline.md §5.3.

Rule | Severity | Approach
-----|----------|---------
R-STL-09 | BLOCK | Ray-cast wall-thickness sampling (200 pts); fire if
                   10th percentile < nozzle × 1.5
R-STL-10 | WARN  | Same sampling; fire if 10th percentile < nozzle × 3
                   AND R-STL-09 did not already fire
R-STL-11 | WARN  | Face-normal analysis vs +Z; fire if overhang surface
                   area > 10% of total surface area (45° threshold)
R-STL-12 | WARN  | DEFERRED in v1 — "feature size < 1mm" requires
                   component/cluster analysis we don't have budget for
R-STL-13 | WARN  | Sum face areas where face-bbox-Z ≤ bbox_min_z + tol
                   as "bottom area"; fire if < 10% of XY footprint
R-STL-14 | WARN  | Z-extent / max(X, Y) > 5 (tall-thin instability)

Design notes:
- R-STL-09 and R-STL-10 ONLY fire on watertight meshes. On broken meshes
  R-STL-01 already dominates; running ray-casts on them produces garbage
  distances that would pile on noisy BLOCKs. Worth the gate.
- R-STL-11's 10% threshold is intentionally conservative. Real student
  prints almost always have SOME overhang; firing on every tiny overhang
  would be noise. Tightening in v2 = MAJOR ruleset version bump.
- R-STL-13 is surprisingly hard to get right in a generic way — a sphere
  sitting on a tangent point really has zero "flat" area. We approximate
  with "faces whose z is within tol of bbox minimum" = ~flat-bottom
  proxy. Works well on chess pieces (round base) vs cubes (full base).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np  # type: ignore

from rules.common import MachineProfile, RuleResult, Severity
from schemas.ruleset_version import STL_RULESET_VERSION

if TYPE_CHECKING:
    import trimesh  # type: ignore

# Wall-thickness sampling config. 200 samples is a balance between
# accuracy and scan-time budget (<500 ms on typical meshes).
_WALL_SAMPLE_COUNT = 200
_WALL_THICKNESS_PERCENTILE = 10  # p10 — robust to surface noise

# Overhang detection: face normals with a downward Z component past this
# threshold are considered overhang surface.
# z_component = -sin(overhang_angle_from_vertical), so
#   z < -0.707  ↔ angle > 45°  ↔ "overhang" per spec §5.3
# We also exclude faces at bed level (bottom of the bbox) — those sit on
# the build plate, they're not overhangs to support.
_OVERHANG_Z_COMPONENT_THRESHOLD = -0.707
_OVERHANG_AREA_FRACTION_THRESHOLD = 0.25  # tuned against fixture corpus
_BED_LEVEL_TOLERANCE_MM = 1.0  # faces within 1mm of min-Z count as "on the bed"

# Flat-base detection: sum face area within this tolerance (mm) of the
# mesh's minimum Z. Below 10% of footprint → warn.
_FLAT_BASE_Z_TOLERANCE_MM = 0.1
_FLAT_BASE_AREA_FRACTION_THRESHOLD = 0.10

# Tall-thin instability ratio.
_TALL_THIN_RATIO_THRESHOLD = 5.0


def _sample_wall_thicknesses(mesh: "trimesh.Trimesh") -> np.ndarray | None:
    """Ray-cast wall thickness at random surface samples. Returns an
    array of hit distances in mm, or None if sampling fails.

    Method: sample N points on the surface, step slightly INSIDE along
    the inverse normal, then ray-cast in the same inverse-normal direction
    to find the opposite wall. Distance from the step-in point to the
    closest hit is half the local wall thickness — we return distance * 2
    as the thickness estimate.
    """
    try:
        import trimesh  # type: ignore

        samples, face_indices = trimesh.sample.sample_surface(
            mesh, count=_WALL_SAMPLE_COUNT
        )
        if len(samples) == 0:
            return None
        normals = mesh.face_normals[face_indices]
        # Step slightly inside so we don't hit our own starting face.
        epsilon = 0.001
        ray_origins = samples - normals * epsilon
        ray_directions = -normals

        locations, index_ray, _ = mesh.ray.intersects_location(
            ray_origins=ray_origins, ray_directions=ray_directions, multiple_hits=False
        )
        if len(locations) == 0:
            return None

        # distance = |hit - origin| + epsilon we offset (approximate)
        distances = np.linalg.norm(locations - ray_origins[index_ray], axis=1) + epsilon
        return distances
    except Exception:
        return None


def _rule_09_wall_thickness_block(
    mesh: "trimesh.Trimesh", profile: MachineProfile
) -> tuple[RuleResult | None, float | None]:
    """Returns (result_or_None, observed_p10_mm) so R-STL-10 can avoid
    re-sampling."""
    if not mesh.is_watertight:
        return None, None
    if profile.nozzle_diameter_mm is None:
        return None, None

    distances = _sample_wall_thicknesses(mesh)
    if distances is None:
        return None, None

    p10 = float(np.percentile(distances, _WALL_THICKNESS_PERCENTILE))
    threshold = profile.nozzle_diameter_mm * 1.5

    if p10 >= threshold:
        return None, p10

    return (
        RuleResult(
            id="R-STL-09",
            severity=Severity.BLOCK,
            title=f"Wall thickness too thin ({p10:.2f} mm) for {profile.nozzle_diameter_mm}mm nozzle",
            explanation=(
                f"The scanner sampled {len(distances)} points across the model and "
                f"found that at least 10% of the walls are under {p10:.2f} mm thick. "
                f"The {profile.name} uses a {profile.nozzle_diameter_mm} mm nozzle, so "
                f"walls under {threshold:.2f} mm (nozzle × 1.5) can't form a complete "
                "extrusion — the print will have missing walls or gaps. Thicken the "
                "walls in your model, or increase the overall scale."
            ),
            evidence={
                "observed_p10_thickness_mm": round(p10, 3),
                "threshold_mm": round(threshold, 3),
                "nozzle_diameter_mm": profile.nozzle_diameter_mm,
                "sample_count": int(len(distances)),
                "observed_min_mm": round(float(distances.min()), 3),
            },
            fix_hint=(
                "In Tinkercad: thicken walls by resizing Z. "
                "In Fusion 360: use Modify > Thicken with an inward offset."
            ),
            version=STL_RULESET_VERSION,
        ),
        p10,
    )


def _rule_10_wall_thickness_warn(
    mesh: "trimesh.Trimesh",
    profile: MachineProfile,
    already_failed_09: bool,
    observed_p10: float | None,
) -> RuleResult | None:
    """Only fires when R-STL-09 did NOT — avoids duplicating the message."""
    if already_failed_09:
        return None
    if not mesh.is_watertight:
        return None
    if profile.nozzle_diameter_mm is None:
        return None

    # Re-sample only if R-STL-09 didn't produce a p10 for us.
    p10 = observed_p10
    if p10 is None:
        distances = _sample_wall_thicknesses(mesh)
        if distances is None:
            return None
        p10 = float(np.percentile(distances, _WALL_THICKNESS_PERCENTILE))

    threshold = profile.nozzle_diameter_mm * 3.0
    if p10 >= threshold:
        return None

    return RuleResult(
        id="R-STL-10",
        severity=Severity.WARN,
        title=f"Walls are thin ({p10:.2f} mm) — single-perimeter warning",
        explanation=(
            f"Your walls are between {profile.nozzle_diameter_mm * 1.5:.2f} mm and "
            f"{threshold:.2f} mm thick. The print will succeed but the slicer will "
            "produce single-perimeter walls — they print successfully on good machines "
            "but are fragile and can split under handling. Consider thickening if the "
            "part will be functional rather than decorative."
        ),
        evidence={
            "observed_p10_thickness_mm": round(p10, 3),
            "threshold_mm": round(threshold, 3),
            "nozzle_diameter_mm": profile.nozzle_diameter_mm,
        },
        fix_hint=(
            "If this part will be handled, scale up or thicken to ≥2 perimeters. "
            "Purely decorative prints are fine at this thickness."
        ),
        version=STL_RULESET_VERSION,
    )


def _rule_11_overhangs(
    mesh: "trimesh.Trimesh", profile: MachineProfile
) -> RuleResult | None:
    """Sum the area of faces whose normal points sufficiently downward —
    those are surfaces the printer has to bridge or support."""
    if profile.machine_category != "3d_printer":
        return None

    normals = mesh.face_normals
    areas = mesh.area_faces
    if normals is None or areas is None or len(normals) == 0:
        return None

    # Compute per-face centroid Z to exclude bed-level faces from overhang.
    face_verts = mesh.vertices[mesh.faces]
    face_centroid_z = face_verts[:, :, 2].mean(axis=1)
    bbox_min_z = float(mesh.bounds[0][2])
    above_bed = face_centroid_z > bbox_min_z + _BED_LEVEL_TOLERANCE_MM

    z_components = normals[:, 2]
    overhang_mask = (z_components < _OVERHANG_Z_COMPONENT_THRESHOLD) & above_bed
    overhang_area = float(areas[overhang_mask].sum())
    total_area = float(areas.sum())
    if total_area <= 0:
        return None

    fraction = overhang_area / total_area
    if fraction < _OVERHANG_AREA_FRACTION_THRESHOLD:
        return None

    return RuleResult(
        id="R-STL-11",
        severity=Severity.WARN,
        title=f"Overhangs cover {fraction * 100:.0f}% of the model surface",
        explanation=(
            f"About {fraction * 100:.0f}% of your model's surface area points "
            "downward at a steep angle. These surfaces need supports to print "
            "cleanly — without them the printer will try to extrude into thin air "
            "and produce stringy, sagging geometry. Your slicer can add supports "
            "automatically, but consider whether the model can be re-oriented so "
            "the overhangs face up or sideways instead."
        ),
        evidence={
            "overhang_area_mm2": round(overhang_area, 1),
            "total_surface_area_mm2": round(total_area, 1),
            "overhang_fraction": round(fraction, 3),
            "threshold_fraction": _OVERHANG_AREA_FRACTION_THRESHOLD,
        },
        fix_hint=(
            "Enable 'Supports' in your slicer. Rotate the model to reduce overhang "
            "area if possible — flipping a bowl upside-down turns all its overhang "
            "into easy outward curves, for example."
        ),
        version=STL_RULESET_VERSION,
    )


def _rule_12_feature_size(
    mesh: "trimesh.Trimesh", profile: MachineProfile
) -> RuleResult | None:
    """DEFERRED in v1 — "feature size < 1mm" needs component/cluster
    analysis (identifying a "pin" or "hole" in a complex mesh) that we
    don't have budget for. Empty pass-through until the rule lands;
    bumping STL_RULESET_VERSION is required when it does.
    """
    return None


def _rule_13_no_flat_base(
    mesh: "trimesh.Trimesh", profile: MachineProfile
) -> RuleResult | None:
    """Approximate: faces whose Z is within 0.1mm of the mesh minimum Z
    are the 'flat base.' Compare that area to the XY footprint of the
    bbox; fire when it's <10%."""
    if profile.machine_category != "3d_printer":
        return None

    bbox_min = mesh.bounds[0]
    bbox_max = mesh.bounds[1]
    extents = bbox_max - bbox_min
    footprint = float(extents[0] * extents[1])
    if footprint <= 0:
        return None

    # For each face, compute its centroid Z. Simple + fast.
    face_verts = mesh.vertices[mesh.faces]  # shape (n_faces, 3, 3)
    face_centroid_z = face_verts[:, :, 2].mean(axis=1)
    base_mask = face_centroid_z <= bbox_min[2] + _FLAT_BASE_Z_TOLERANCE_MM
    base_area = float(mesh.area_faces[base_mask].sum())

    fraction = base_area / footprint
    if fraction >= _FLAT_BASE_AREA_FRACTION_THRESHOLD:
        return None

    return RuleResult(
        id="R-STL-13",
        severity=Severity.WARN,
        title=f"Flat base only covers {fraction * 100:.0f}% of the footprint",
        explanation=(
            f"Your model's flat bottom surface is only {fraction * 100:.0f}% of its "
            "bounding-box footprint — there isn't much for the printer to grip onto. "
            "Without a brim or raft, the print risks lifting off the bed mid-print "
            "(especially with ABS/PETG)."
        ),
        evidence={
            "base_area_mm2": round(base_area, 1),
            "footprint_mm2": round(footprint, 1),
            "base_area_fraction": round(fraction, 3),
            "threshold_fraction": _FLAT_BASE_AREA_FRACTION_THRESHOLD,
        },
        # Phase 8.1d-18 (Tier 1 of build-orientation gap):
        # Re-ordered the advice so orientation comes FIRST. A better
        # orientation removes the problem entirely; brim is a workaround
        # that wastes material + needs cleaning afterwards. Calling out
        # the auto-orient buttons by slicer name turns vague "consider
        # re-orienting" into a one-click action — most students don't
        # know their slicer can do this. Tier 2 (file as
        # PH9-FU-STL-BUILD-ORIENTATION) would have us test 6 axis-
        # aligned orientations server-side and recommend the best one;
        # for now we route students at the slicer's own optimiser.
        fix_hint=(
            "Best fix: try your slicer's auto-orient. "
            "Bambu Studio: right-click the part > 'Auto orient'. "
            "OrcaSlicer / PrusaSlicer: select the part > 'Place on face' "
            "(keyboard 'F') or 'Optimize orientation'. "
            "Cura: right-click > 'Lay flat'. "
            "Auto-orient finds the face that puts the most material on the "
            "bed.\n\n"
            "If no orientation gives a flat base (rounded models, points, "
            "curves), enable a brim instead: 5–10 mm in any slicer. Adds a "
            "thin rim around the print that you snap off after."
        ),
        version=STL_RULESET_VERSION,
    )


def _rule_14_tall_and_thin(
    mesh: "trimesh.Trimesh", profile: MachineProfile
) -> RuleResult | None:
    """Z-extent / max(X, Y) > 5 → at-risk of tipping during print."""
    if profile.machine_category != "3d_printer":
        return None

    extents = mesh.bounds[1] - mesh.bounds[0]
    height = float(extents[2])
    base_dim = float(max(extents[0], extents[1]))
    if base_dim <= 0:
        return None

    ratio = height / base_dim
    if ratio <= _TALL_THIN_RATIO_THRESHOLD:
        return None

    return RuleResult(
        id="R-STL-14",
        severity=Severity.WARN,
        title=f"Tall and narrow (ratio {ratio:.1f}) — tipping risk",
        explanation=(
            f"Your model is {height:.0f} mm tall but only {base_dim:.0f} mm across "
            f"at its widest — a height-to-base ratio of {ratio:.1f}. Tall narrow "
            "prints can tip over mid-print due to the printer's motion, especially "
            "during fast travel moves. Consider laying the model on its side, "
            "adding a brim for stability, or printing at a slower outer-wall speed."
        ),
        evidence={
            "height_mm": round(height, 1),
            "base_dimension_mm": round(base_dim, 1),
            "height_to_base_ratio": round(ratio, 2),
            "threshold_ratio": _TALL_THIN_RATIO_THRESHOLD,
        },
        fix_hint=(
            "Rotate the model onto its side if the geometry allows. "
            "Otherwise enable brim + slow outer-wall speed in your slicer."
        ),
        version=STL_RULESET_VERSION,
    )


def run_printability_rules(
    mesh: "trimesh.Trimesh",
    profile: MachineProfile,
) -> list[RuleResult]:
    results: list[RuleResult] = []

    r09, p10 = _rule_09_wall_thickness_block(mesh, profile)
    if r09 is not None:
        results.append(r09)

    r10 = _rule_10_wall_thickness_warn(mesh, profile, already_failed_09=r09 is not None, observed_p10=p10)
    if r10 is not None:
        results.append(r10)

    for rule in (
        _rule_11_overhangs,
        _rule_12_feature_size,
        _rule_13_no_flat_base,
        _rule_14_tall_and_thin,
    ):
        r = rule(mesh, profile)
        if r is not None:
            results.append(r)
    return results
