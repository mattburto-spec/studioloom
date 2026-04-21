"""STL machine fit rules — R-STL-06..08. Populated in Phase 2A-3."""

from __future__ import annotations

from typing import TYPE_CHECKING

from rules.common import MachineProfile, RuleResult

if TYPE_CHECKING:
    import trimesh  # type: ignore


def run_machine_fit_rules(
    mesh: "trimesh.Trimesh",
    profile: MachineProfile,
) -> list[RuleResult]:
    """Phase 2A-3 will populate. For now, no-op."""
    return []
