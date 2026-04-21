"""SVG informational rules (R-SVG-14..15).

Phase 2B-1 scaffold: function signature established, returns empty list.
Phase 2B-6 fills in:
  R-SVG-14 Estimated cut time (FYI)
  R-SVG-15 Layer summary (FYI)
"""

from __future__ import annotations

from rules.common import MachineProfile, RuleResult
from worker.svg_loader import SvgDocument


def run_informational_rules(
    doc: SvgDocument, profile: MachineProfile
) -> list[RuleResult]:
    """Return FYI rule results. Phase 2B-1: empty stub."""
    return []
