"""STL printability rules — R-STL-09..14. Populated in Phase 2A-4."""

from __future__ import annotations

from typing import TYPE_CHECKING

from rules.common import MachineProfile, RuleResult

if TYPE_CHECKING:
    import trimesh  # type: ignore


def run_printability_rules(
    mesh: "trimesh.Trimesh",
    profile: MachineProfile,
) -> list[RuleResult]:
    """Phase 2A-4 will populate. For now, no-op."""
    return []
