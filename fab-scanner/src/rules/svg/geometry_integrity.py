"""SVG geometry-integrity rules (R-SVG-07..11).

Phase 2B-1 scaffold: function signature established, returns empty list.
Phase 2B-4 fills in:
  R-SVG-07 Open paths on cut layer (BLOCK - shipped at WARN until fixture authored)
  R-SVG-08 Duplicate / overlapping cut lines (WARN)
  R-SVG-09 Features below kerf width (WARN)
  R-SVG-10 Un-outlined text on cut/engrave layer (BLOCK)
  R-SVG-11 Orphan / zero-length paths (FYI)
"""

from __future__ import annotations

from rules.common import MachineProfile, RuleResult
from worker.svg_loader import SvgDocument


def run_geometry_integrity_rules(
    doc: SvgDocument, profile: MachineProfile
) -> list[RuleResult]:
    """Return rules fired for geometry-integrity checks. Phase 2B-1: empty stub."""
    return []
