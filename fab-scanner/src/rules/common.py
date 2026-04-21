"""Shared types for rule implementations.

Re-exports Severity + RuleResult from schemas so rule modules import from a
single place. Also hosts the MachineProfile dataclass the rules read for
machine-specific thresholds.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from schemas.scan_results import RuleResult, Severity

__all__ = ["Severity", "RuleResult", "MachineProfile"]


@dataclass(frozen=True)
class MachineProfile:
    """In-memory view of a machine_profiles row.

    Loaded by the worker on each scan; passed to every rule. Rules read
    whatever fields are relevant; extra fields are ignored.

    Fields follow the DB schema in docs/projects/fabrication-pipeline.md §11
    but only the ones the rule catalogue actually consumes.
    """

    id: str
    name: str
    machine_category: str  # "3d_printer" | "laser_cutter"
    bed_size_x_mm: float
    bed_size_y_mm: float
    bed_size_z_mm: float | None
    nozzle_diameter_mm: float | None
    kerf_mm: float | None
    operation_color_map: dict[str, Any] | None
    rule_overrides: dict[str, Any] | None = None
