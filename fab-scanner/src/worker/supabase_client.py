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
        """Phase 8.1d-24: pick any active machine in (lab_id, category)
        as a stand-in for category-only jobs (machine_profile_id IS
        NULL on fabrication_jobs).

        Returns the first active machine ordered by name (stable across
        polls) or None if the lab has no active machines of that
        category. Caller treats None as a hard fail with a clear
        message — student should re-upload after the teacher adds a
        machine to the lab.

        Surrogate semantics: scan rules run against this profile's
        bed/nozzle/kerf/etc. The result is "fits *some* machine in
        this lab", not "fits the smallest". For homogeneous fleets
        (typical NIS case: 2x P1P + 1x P1S, very similar specs) the
        difference is immaterial. PH9-FU-FAB-SURROGATE-CONSERVATIVE
        files the upgrade to scan against the most-restrictive
        constraints across the lab if heterogeneous fleets surface a
        false-pass.
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
