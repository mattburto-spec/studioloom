"""SVG thumbnail rendering via cairosvg.

Phase 2B-6.

Matches the STL thumbnail pattern (worker/thumbnail.py) — a single
`safe_render_svg(svg_bytes) -> bytes | None` entry point returns PNG
bytes on success or None on any failure (missing libcairo at runtime,
malformed SVG, rendering exception). The caller's writeback code
treats None as "no thumbnail this scan" without failing the scan.

Design:
- cairosvg uses the system libcairo via cairocffi. On Fly.io Docker the
  libcairo2 + libpango-1.0-0 runtime packages are installed in the
  Dockerfile (Phase 2B-1 added libcairo2-dev to the builder stage and
  libcairo2 to runtime).
- Local macOS dev envs typically don't have libcairo installed; the
  safe_render fallback returns None, tests mock the render call. This
  is intentional — we don't want to block CI or local runs on a system
  dependency that's only needed in prod.
- v1 renders the SVG as-authored. Operation-based stroke recolouring
  (render all cut paths red, score blue, engrave black regardless of
  original authoring colour) is FU-SVG-THUMBNAIL-RECOLOUR — queue once
  a prod scan or teacher review shows it's worth the complexity.
- Output is a 400px-wide PNG (aspect ratio preserved). Matches the STL
  thumbnail size for UI consistency.
"""

from __future__ import annotations

import io

import structlog

log = structlog.get_logger(__name__)

THUMBNAIL_WIDTH_PX = 400


def safe_render_svg(svg_bytes: bytes) -> bytes | None:
    """Render SVG bytes to a PNG thumbnail. Returns None on any failure.

    Never raises. Swallows every cairosvg / cairocffi / OSError path so
    one pathological SVG can't crash the worker loop.
    """
    try:
        import cairosvg  # type: ignore
    except ImportError:
        log.info("svg_thumbnail.cairosvg_unavailable")
        return None
    except OSError as e:
        # libcairo missing at dlopen time — prod Dockerfile should have
        # installed it. Log so deploy misses are visible.
        log.warning("svg_thumbnail.cairo_missing", error=str(e))
        return None

    try:
        buf = io.BytesIO()
        cairosvg.svg2png(
            bytestring=svg_bytes,
            write_to=buf,
            output_width=THUMBNAIL_WIDTH_PX,
        )
        data = buf.getvalue()
        if not data.startswith(b"\x89PNG\r\n\x1a\n"):
            log.warning("svg_thumbnail.non_png_output", size=len(data))
            return None
        return data
    except Exception as e:
        # cairosvg errors include malformed SVG, missing font subsets,
        # paths cairo can't rasterize. All non-fatal.
        log.warning("svg_thumbnail.render_failed", error=str(e))
        return None
