"""Production Supabase + Storage clients for the Preflight scanner.

Implements the SupabaseClient + StorageClient Protocols from
worker/supabase_client.py and worker/storage.py against the real
Supabase Python SDK. Phase 2A-6a code only — no prod traffic until
2A-6b mints the service-role key and runs `fly deploy`.

Design notes:
- Service-role auth bypasses RLS by design. The worker is the only
  consumer of fabrication_scan_jobs and writes scan_results back; both
  tables intentionally have deny-all RLS policies (FU-FF pattern).
- claim_next_scan_job is a Postgres RPC (migration 104) — keeps
  FOR UPDATE SKIP LOCKED semantics in the database where they belong.
- write_scan_results does THREE updates (job_revisions full results,
  fabrication_jobs latest_scan_results denormalisation, scan_jobs status).
  Wrapped in a single supabase.rpc would be cleaner — left for v2.
- Storage downloads use signed URLs (15-min TTL) instead of long-lived
  public URLs — defends against bucket misconfiguration.
"""

from __future__ import annotations

import os
import socket
from typing import Any

import httpx
import structlog

from worker.storage import StorageClient
from worker.supabase_client import ClaimedJob, StudentForEmail, SupabaseClient

log = structlog.get_logger(__name__)

UPLOAD_BUCKET = "fabrication-uploads"
THUMBNAIL_BUCKET = "fabrication-thumbnails"

# Signed-URL TTL for fixture downloads. 15 min is plenty for a scan
# (expected p99 < 10 s) plus generous slack for cold starts.
_SIGNED_URL_TTL_SECONDS = 15 * 60


def worker_id() -> str:
    """Stable worker identifier for fabrication_scan_jobs.locked_by.

    On Fly.io machines the FLY_MACHINE_ID env var is set automatically.
    Falls back to hostname for local dev.
    """
    return (
        os.environ.get("FLY_MACHINE_ID")
        or os.environ.get("HOSTNAME")
        or socket.gethostname()
    )


def _build_supabase_client():
    """Lazy import of supabase-py — keeps test suite startup light when
    only mock clients are exercised."""
    from supabase import create_client  # type: ignore

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


class SupabaseServiceClient(SupabaseClient):
    """Production SupabaseClient using the service-role key.

    Constructed once at worker startup; reused across every poll cycle.
    """

    def __init__(self, client: Any | None = None, worker_identifier: str | None = None):
        self._client = client if client is not None else _build_supabase_client()
        self._worker_id = worker_identifier or worker_id()

    def claim_next_job(self) -> ClaimedJob | None:
        """Calls the claim_next_scan_job RPC (migration 104).

        Returns the next pending row (atomically marked 'running') or
        None if the queue is empty.
        """
        result = self._client.rpc(
            "claim_next_scan_job", {"p_worker_id": self._worker_id}
        ).execute()
        rows = result.data or []
        if not rows:
            return None
        row = rows[0]
        return ClaimedJob(
            scan_job_id=row["scan_job_id"],
            job_id=row["job_id"],
            job_revision_id=row["job_revision_id"],
            storage_path=row["storage_path"],
            file_type=row["file_type"],
            # Phase 8.1d-22: machine_profile_id can now be NULL.
            # Pass it through unchanged — the scan_runner branches
            # on None to call load_surrogate_machine_profile instead.
            machine_profile_id=row.get("machine_profile_id"),
            lab_id=row["lab_id"],
            machine_category=row["machine_category"],
            student_id=row["student_id"],
        )

    def load_machine_profile(self, profile_id: str) -> dict[str, Any]:
        result = (
            self._client.table("machine_profiles")
            .select("*")
            .eq("id", profile_id)
            .single()
            .execute()
        )
        if not result.data:
            raise KeyError(f"machine profile not found: {profile_id}")
        return result.data

    def load_surrogate_machine_profile(
        self, lab_id: str, machine_category: str
    ) -> dict[str, Any] | None:
        """Phase 8.1d-24: surrogate lookup for category-only jobs.

        Picks the first active machine in (lab_id, machine_category)
        ordered by name. Returns None if no active machines exist —
        caller hard-fails the scan in that case.
        """
        result = (
            self._client.table("machine_profiles")
            .select("*")
            .eq("lab_id", lab_id)
            .eq("machine_category", machine_category)
            .eq("is_active", True)
            .order("name", desc=False)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        return rows[0] if rows else None

    def write_scan_results(
        self,
        *,
        job_id: str,
        job_revision_id: str,
        scan_job_id: str,
        scan_results: dict[str, Any],
        ruleset_version: str,
        scan_status: str,
        scan_error: str | None = None,
    ) -> None:
        """Writes to three tables. Not transactional across them — if a
        later write fails, earlier writes stick. Acceptable v1 since the
        scan_jobs table status is the authoritative source for retry
        eligibility, and we update it last.
        """
        # 1. fabrication_job_revisions — full scan_results JSONB + status.
        # thumbnail_path is a denormalised column (migration 095) — the UI
        # and admin queries read it directly rather than digging into the
        # scan_results JSONB. Pull it out of the payload explicitly so the
        # render+upload work in scan_runner doesn't get stranded inside
        # the JSONB with a NULL column. None on missing key = no thumbnail.
        self._client.table("fabrication_job_revisions").update(
            {
                "scan_results": scan_results,
                "scan_status": scan_status,
                "scan_error": scan_error,
                "scan_completed_at": "now()",
                "scan_ruleset_version": ruleset_version,
                "thumbnail_path": scan_results.get("thumbnail_path"),
            }
        ).eq("id", job_revision_id).execute()

        # 2. fabrication_jobs — denormalised latest_scan_results
        self._client.table("fabrication_jobs").update(
            {
                "latest_scan_results": scan_results,
                "scan_ruleset_version": ruleset_version,
            }
        ).eq("id", job_id).execute()

        # 3. fabrication_scan_jobs — terminal status (done | error)
        scan_jobs_status = "done" if scan_status == "done" else "error"
        update_payload: dict[str, Any] = {"status": scan_jobs_status}
        if scan_error:
            update_payload["error_detail"] = scan_error
        self._client.table("fabrication_scan_jobs").update(update_payload).eq(
            "id", scan_job_id
        ).execute()

    def load_student_for_email(self, student_id: str) -> StudentForEmail | None:
        result = (
            self._client.table("students")
            .select("id, email, name, fabrication_notify_email")
            .eq("id", student_id)
            .maybe_single()
            .execute()
        )
        row = result.data
        if not row:
            return None
        return StudentForEmail(
            student_id=row["id"],
            email=row.get("email"),
            display_name=row.get("name"),
            notify_email_opt_in=bool(row.get("fabrication_notify_email", True)),
        )


class SupabaseStorageClient(StorageClient):
    """Production StorageClient — signed-URL download + direct upload.

    Constructed alongside SupabaseServiceClient at startup; shares the
    same supabase-py instance to amortise auth overhead.
    """

    def __init__(self, client: Any | None = None):
        self._client = client if client is not None else _build_supabase_client()
        # Bounded HTTP client — 30 s per file is plenty for STLs we accept.
        self._http = httpx.Client(timeout=30.0)

    def download_fixture(self, storage_path: str) -> bytes:
        """Two-step: ask Supabase for a signed URL, then GET the bytes.

        Storage paths are stored in fabrication_job_revisions.storage_path
        as the bucket-relative path (no bucket prefix). Bucket is always
        the upload bucket for downloads.
        """
        signed = (
            self._client.storage.from_(UPLOAD_BUCKET)
            .create_signed_url(storage_path, _SIGNED_URL_TTL_SECONDS)
        )
        signed_url = signed.get("signedURL") or signed.get("signed_url")
        if not signed_url:
            raise FileNotFoundError(
                f"could not sign URL for {storage_path}: {signed!r}"
            )
        response = self._http.get(signed_url)
        if response.status_code == 404:
            raise FileNotFoundError(f"object not found in bucket: {storage_path}")
        response.raise_for_status()
        return response.content

    def upload_thumbnail(
        self,
        job_revision_id: str,
        png_bytes: bytes,
        content_type: str = "image/png",
    ) -> str:
        """Uploads to fabrication-thumbnails/<job_revision_id>.png.

        Returns the storage path (NOT a URL). Caller writes this to
        fabrication_job_revisions.thumbnail_path; UI generates signed URLs
        as needed via its own Supabase client.

        upsert=True so a re-scan of the same revision overwrites the old
        thumbnail rather than failing.
        """
        path = f"{job_revision_id}.png"
        self._client.storage.from_(THUMBNAIL_BUCKET).upload(
            path,
            png_bytes,
            file_options={
                "content-type": content_type,
                "upsert": "true",
            },
        )
        return path
