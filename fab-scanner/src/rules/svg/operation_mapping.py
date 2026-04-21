"""SVG operation-mapping rules (R-SVG-04..06).

Phase 2B-1 scaffold: function signature established, returns empty list.
Phase 2B-3 fills in:
  R-SVG-04 Stroke colour not in machine operation map (BLOCK)
  R-SVG-05 Cut-layer strokes have non-hairline width (WARN)
  R-SVG-06 Fill set on cut layer (WARN)
"""

from __future__ import annotations

from rules.common import MachineProfile, RuleResult
from worker.svg_loader import SvgDocument


def run_operation_mapping_rules(
    doc: SvgDocument, profile: MachineProfile
) -> list[RuleResult]:
    """Return rules fired for operation-mapping checks. Phase 2B-1: empty stub."""
    return []
