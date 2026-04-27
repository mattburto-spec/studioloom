"""Supabase access layer for the scanner worker.

Phase 2A-1..2A-5 develop against MockSupabaseClient — the real
SupabaseServiceClient is not minted until Phase 2A-6 just before first Fly
deploy, so the prod service-role key never touches the developer laptop
during rule-authoring.

The Protocol defines the minimum surface the scanner needs: claim a job,
load its revision + machine profile, and write scan results back. If Phase 2B
or 2C need more, add to the Protocol (and both implementations) in a
dedicated commit.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class ClaimedJob:
    """One row from fabrication_scan_jobs with all the fields the worker
    needs to run a scan. Assembled by the Supabase client so the worker
    doesn't have to know the multi-table join shape.

    Phase 8.1d-22 made machine_profile_id nullable on fabrication_jobs
    (category-only "Any 3D printer" submissions). 8.1d-24 surfaces
    lab_id + machine_category so the worker can pick a surrogate
    machine profile when machine_profile_id is None.
    """

    scan_job_id: str
    job_id: str  # fabrication_jobs.id
    job_revision_id: str  # fabrication_job_revisions.id
    storage_path: str  # path in the fabrication-uploads bucket
    file_type: str  # 'stl' | 'svg'
    machine_profile_id: str | None  # 8.1d-22: now nullable
    lab_id: str  # 8.1d-24: required — every job belongs to a lab
    machine_category: str  # 8.1d-24: '3d_printer' | 'laser_cutter'
    student_id: str  # fabrication_jobs.student_id — used for email dispatch


@dataclass(frozen=True)
class StudentForEmail:
    """Subset of students columns the worker needs to send a scan-complete
    email — keeps the Supabase Protocol surface minimal."""

    student_id: str
    email: str | None  # NULL when no email on file → skip dispatch
    display_name: str | None
    notify_email_opt_in: bool  # students.fabrication_notify_email


class SupabaseClient(Protocol):
    """Minimum surface the scanner needs.

    Methods return plain dicts/dataclasses, never raw PostgREST objects,
    so tests can mock without pulling in supabase-py.
    """

    def claim_next_job(self) -> ClaimedJob | None:
        """Poll fabrication_scan_jobs for one pending row.

        Implementation contract: use `SELECT ... FOR UPDATE SKIP LOCKED
        LIMIT 1` semantics so a second worker instance would never claim
        the same row. Mark the returned row `status='running'` and
        `locked_at=now()` before returning so a supervisor can recover
        stuck jobs.

        Returns None when the queue is empty.
        """
        ...

    def load_machine_profile(self, profile_id: str) -> dict[str, Any]:
        """Fetch a machine_profiles row as a plain dict keyed by column name."""
        ...

    def load_surrogate_machine_profile(
        self, lab_id: str, machine_category: str
    ) -> dict[str, Any] | None:
        """Phase 8.1d-24 + 8.1d-33: pick a stand-in machine for
        category-only jobs (machine_profile_id IS NULL on
        fabrication_jobs — student picked "Any cutter" / "Any
        printer").

        Returns the LARGEST-bed active machine in (lab_id, category),
        with name as deterministic tiebreak. None if the lab has
        no active machines — caller hard-fails the scan with a
        clear message asking the teacher to add a machine.

        Surrogate semantics: scan rules run against this profile's
        bed/kerf/colour-map/etc. The result is "fits *some* machine
        in this lab" — bed-fit rules pass when the file fits the
        largest bed (definitionally a home exists) and BLOCK when
        even the biggest can't take it (no machine can). Other
        rules (kerf, colour map, min feature) read the same
        surrogate; for homogeneous fleets (typical school case:
        same brand, same operating standard) the result is
        meaningful. The proper fix — evaluate every rule against
        every machine and BLOCK only when ALL fail — is filed as
        PH9-FU-FAB-SURROGATE-MULTIPLE-EVAL.

        Why "largest" replaced "alphabetical-first" (the original
        8.1d-24 design): caught 27 Apr in Phase 8.1 smoke — an SVG
        was BLOCKed against "xTool F1 Ultra" (220×220mm) when the
        same lab had an "xTool P3" (600×308mm) that would fit fine.
        Alphabetical sort surfaced the smaller bed → false-positive
        BLOCK. Largest-bed surrogate matches the user-intent of
        "Any cutter" submissions.
        """
        ...

    def write_scan_results(
        self,
        job_id: str,
        job_revision_id: str,
        scan_job_id: str,
        scan_results: dict[str, Any],
        ruleset_version: str,
        scan_status: str,
        scan_error: str | None = None,
    ) -> None:
        """Persist the scan outcome.

        Writes in one logical transaction to both rows:
          - fabrication_job_revisions: full scan_results JSONB + status
          - fabrication_jobs: latest_scan_results (denormalised) + version
        Updates fabrication_scan_jobs.status='done' or 'error'.
        """
        ...

    def load_student_for_email(self, student_id: str) -> StudentForEmail | None:
        """Fetch the columns the worker needs to dispatch a scan-complete
        email. Returns None if the student row is missing — caller treats
        this as 'skip dispatch'. notify_email_opt_in defaults true per
        migration 100, so an opted-out student is the only no-op case."""
        ...
