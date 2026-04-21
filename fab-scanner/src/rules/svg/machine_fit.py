"""SVG machine-fit rules (R-SVG-01..03).

Phase 2B-1 scaffold: function signature established, returns empty list.
Phase 2B-2 fills in:
  R-SVG-01 Exceeds bed size (BLOCK)
  R-SVG-02 Unit mismatch viewBox vs stated dimensions (BLOCK)
  R-SVG-03 No explicit units (WARN)
"""

from __future__ import annotations

from rules.common import MachineProfile, RuleResult
from worker.svg_loader import SvgDocument


def run_machine_fit_rules(
    doc: SvgDocument, profile: MachineProfile
) -> list[RuleResult]:
    """Return rules fired for machine-fit checks. Phase 2B-1: empty stub."""
    return []
