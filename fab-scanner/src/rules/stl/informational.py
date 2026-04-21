"""STL informational rules — R-STL-15..17. Populated in Phase 2A-5."""

from __future__ import annotations

from typing import TYPE_CHECKING

from rules.common import MachineProfile, RuleResult

if TYPE_CHECKING:
    import trimesh  # type: ignore


def run_informational_rules(
    mesh: "trimesh.Trimesh",
    profile: MachineProfile,
) -> list[RuleResult]:
    """Phase 2A-5 will populate. For now, no-op."""
    return []
