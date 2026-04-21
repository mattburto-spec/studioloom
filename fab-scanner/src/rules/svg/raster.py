"""SVG raster rules (R-SVG-12..13).

Phase 2B-1 scaffold: function signature established, returns empty list.
Phase 2B-5 fills in:
  R-SVG-12 Embedded raster resolution < 150 DPI (WARN)
  R-SVG-13 Embedded raster in RGB with transparency (WARN)
"""

from __future__ import annotations

from rules.common import MachineProfile, RuleResult
from worker.svg_loader import SvgDocument


def run_raster_rules(
    doc: SvgDocument, profile: MachineProfile
) -> list[RuleResult]:
    """Return rules fired for embedded-raster checks. Phase 2B-1: empty stub."""
    return []
