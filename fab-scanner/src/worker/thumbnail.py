"""STL thumbnail rendering.

Phase 2A-5: matplotlib-based isometric render with overhang highlighting.
Output is a PNG byte buffer suitable for direct upload to the
fabrication-thumbnails bucket.

Why matplotlib vs trimesh.Scene.save_image():
- trimesh's native rendering requires pyglet + OpenGL, which is painful
  on a headless Fly worker.
- matplotlib + mplot3d is CPU-only, stable, and good enough at 400×400.

Performance note: Poly3DCollection slows significantly past ~50k faces.
We downsample by taking every Nth face for high-poly meshes — this
produces a slightly sparse silhouette but keeps scan time predictable.
A better render pipeline (via moderngl or egl) is a nice-to-have for v2.
"""

from __future__ import annotations

import io
import math
from typing import TYPE_CHECKING

import matplotlib  # type: ignore

# Force non-interactive backend before pyplot import — the Fly container
# has no display; matplotlib defaults to Agg when DISPLAY is unset but
# being explicit avoids surprises on dev machines with X11 forwarding.
matplotlib.use("Agg")

import matplotlib.pyplot as plt  # type: ignore  # noqa: E402
import numpy as np  # type: ignore  # noqa: E402
from mpl_toolkits.mplot3d.art3d import Poly3DCollection  # type: ignore  # noqa: E402

if TYPE_CHECKING:
    import trimesh  # type: ignore

# Match the overhang thresholds used in R-STL-11 so the thumbnail and
# the rule agree about what "overhang" means.
_OVERHANG_Z_COMPONENT_THRESHOLD = -0.707
_BED_LEVEL_TOLERANCE_MM = 1.0

# Triangle budget for the render. Above this we stride-sample faces.
# 10k balances readability (silhouettes stay clear) against render time
# (~500 ms vs multi-second on a 175k-face mesh). Lift if the v2 UI needs
# denser visuals.
_RENDER_MAX_FACES = 10_000


def _face_color_array(mesh: "trimesh.Trimesh") -> np.ndarray:
    """Return a (n_faces, 4) RGBA colour array.

    Overhang faces get a warm red; bed-level faces get a cool blue; all
    others a neutral grey. The three-band legend keeps the image
    readable without needing a separate legend overlay.
    """
    n = len(mesh.faces)
    colors = np.tile([0.72, 0.72, 0.78, 1.0], (n, 1))  # default grey

    face_verts = mesh.vertices[mesh.faces]
    face_centroid_z = face_verts[:, :, 2].mean(axis=1)
    bbox_min_z = float(mesh.bounds[0][2])

    above_bed = face_centroid_z > bbox_min_z + _BED_LEVEL_TOLERANCE_MM
    bed = ~above_bed

    normals = mesh.face_normals
    overhang = (normals[:, 2] < _OVERHANG_Z_COMPONENT_THRESHOLD) & above_bed

    # Bed-level faces: soft blue (student sees "this sits on the plate")
    colors[bed] = [0.55, 0.70, 0.90, 1.0]
    # Overhang faces: warm red (student sees "this needs support")
    colors[overhang] = [0.95, 0.45, 0.35, 1.0]

    return colors


def _stride_downsample_indices(total: int, target: int) -> np.ndarray:
    """Deterministic every-Nth sampling so a given mesh renders the same
    thumbnail on every scan — downstream dedup / compare workflows rely
    on stable rendering."""
    if total <= target:
        return np.arange(total)
    stride = max(1, total // target)
    return np.arange(0, total, stride)


def render_stl_isometric_with_overhangs(
    mesh: "trimesh.Trimesh",
    output_size_px: tuple[int, int] = (400, 400),
    dpi: int = 100,
) -> bytes:
    """Render mesh to a PNG byte buffer. Caller uploads; never writes to disk.

    Raises ValueError on empty meshes. Other exceptions bubble — caller
    decides whether to fall back to a None thumbnail_path.
    """
    if len(mesh.faces) == 0:
        raise ValueError("cannot render empty mesh")

    face_indices = _stride_downsample_indices(len(mesh.faces), _RENDER_MAX_FACES)
    faces = mesh.vertices[mesh.faces[face_indices]]  # (k, 3, 3)
    colors = _face_color_array(mesh)[face_indices]

    fig_w = output_size_px[0] / dpi
    fig_h = output_size_px[1] / dpi
    fig = plt.figure(figsize=(fig_w, fig_h), dpi=dpi)
    try:
        ax = fig.add_subplot(111, projection="3d")

        poly = Poly3DCollection(
            faces,
            facecolors=colors,
            edgecolor=(0, 0, 0, 0.15),
            linewidths=0.1,
        )
        ax.add_collection3d(poly)

        extents = mesh.bounds[1] - mesh.bounds[0]
        mid = (mesh.bounds[0] + mesh.bounds[1]) / 2
        radius = float(np.linalg.norm(extents)) / 2 + 1e-3
        ax.set_xlim(mid[0] - radius, mid[0] + radius)
        ax.set_ylim(mid[1] - radius, mid[1] + radius)
        ax.set_zlim(mid[2] - radius, mid[2] + radius)
        # Isometric-ish viewpoint: elev 30°, azim -60°.
        ax.view_init(elev=30, azim=-60)
        ax.set_box_aspect((1, 1, 1))
        ax.set_axis_off()

        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight", pad_inches=0.05)
        return buf.getvalue()
    finally:
        plt.close(fig)


def safe_render(mesh: "trimesh.Trimesh") -> bytes | None:
    """Best-effort wrapper: returns None if rendering fails. Use this
    from the scan pipeline so a broken thumbnail never fails the scan.
    """
    try:
        return render_stl_isometric_with_overhangs(mesh)
    except Exception:
        return None
