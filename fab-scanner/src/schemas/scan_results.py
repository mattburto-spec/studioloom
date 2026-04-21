"""Scan result schema — the JSONB shape that lands on
fabrication_job_revisions.scan_results and fabrication_jobs.latest_scan_results.

Pydantic models so we get validation for free on writeback + on read in tests.
Stable enough that rules/ modules can import the types and emit matching
structures.

All field names match the spec in docs/projects/fabrication-pipeline.md §5–6:
  {id, severity, title, explanation, evidence, fix_hint}
plus a `version` field the spec calls for in §6.4 (per-rule versioning).
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class Severity(str, Enum):
    """Rule severity levels used by the student-facing soft-gate UI.

    BLOCK   — student cannot submit until resolved.
    WARN    — student acknowledges per-rule before submit (ack-each-one flow).
    FYI     — informational only; no acknowledgement required.
    """

    BLOCK = "block"
    WARN = "warn"
    FYI = "fyi"


class RuleResult(BaseModel):
    """One row in scan_results.rules[]."""

    id: str = Field(..., description="Rule ID, e.g. 'R-STL-01'.")
    severity: Severity
    title: str = Field(..., description="Short human-readable rule name.")
    explanation: str = Field(
        ...,
        description=(
            "Longer paragraph the student reads in the results UI. "
            "Should explain the physical/pedagogical reason, not just 'it fails'."
        ),
    )
    evidence: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Rule-specific structured evidence (face indices, coordinates, "
            "bbox mismatch values, etc.). Consumers render this differently "
            "per rule — unstructured dict keeps the scanner flexible."
        ),
    )
    fix_hint: str | None = Field(
        default=None,
        description="One-line suggested next step the student can take.",
    )
    version: str = Field(
        ...,
        description="The rule-catalogue version string this result was produced with.",
    )


class ScanResults(BaseModel):
    """Full scan_results JSONB — emitted by scan_runner.scan_one_revision."""

    rules: list[RuleResult] = Field(default_factory=list)
    ruleset_version: str = Field(..., description="Mirror of the top-level column.")
    scan_duration_ms: int = Field(..., ge=0)
    thumbnail_path: str | None = Field(
        default=None,
        description=(
            "Storage path in the fabrication-thumbnails bucket. "
            "Null when thumbnail rendering has not yet been added (pre-2A-5)."
        ),
    )

    def highest_severity(self) -> Severity | None:
        """Return the highest severity present in rules, or None if empty."""
        if not self.rules:
            return None
        order = [Severity.BLOCK, Severity.WARN, Severity.FYI]
        for s in order:
            if any(r.severity == s for r in self.rules):
                return s
        return None
