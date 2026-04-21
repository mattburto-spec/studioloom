"""STL geometry integrity rules — R-STL-01..05.

Populated in Phase 2A-2. Stubs only here so scan_runner can import the
dispatcher without failing.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from rules.common import MachineProfile, RuleResult

if TYPE_CHECKING:
    import trimesh  # type: ignore


def run_geometry_integrity_rules(
    mesh: "trimesh.Trimesh",
    profile: MachineProfile,
) -> list[RuleResult]:
    """Phase 2A-2 will populate. For now, no-op."""
    return []
