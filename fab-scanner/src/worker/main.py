"""Worker entrypoint: infinite poll loop over fabrication_scan_jobs.

Phase 2A-6a: real SupabaseServiceClient + SupabaseStorageClient land,
gated on env vars. Until SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are
set (Phase 2A-6b), the worker raises NotImplementedError on startup so
we cannot accidentally connect to prod from a half-configured laptop.

scan_complete email dispatch is wired here too — fired after a
successful scan when the recipient student has opted-in via
students.fabrication_notify_email (default true per migration 100).
"""

from __future__ import annotations

import os
import signal
import sys
import time

import structlog

from worker.observability import configure_logging


def _build_supabase_client():
    """Construct the production SupabaseServiceClient. Raises if env is
    not configured — guards against accidental prod connection from
    laptops that haven't gone through the 2A-6b setup."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise NotImplementedError(
            "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required. "
            "Use the sandbox CLI for local fixture testing; the worker "
            "starts only when prod credentials are set (Phase 2A-6b)."
        )
    from worker.supabase_real import SupabaseServiceClient

    return SupabaseServiceClient()


def _build_storage_client():
    """Construct the production SupabaseStorageClient. Same env guard
    as _build_supabase_client — both clients share the same key surface."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise NotImplementedError(
            "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required for storage."
        )
    from worker.supabase_real import SupabaseStorageClient

    return SupabaseStorageClient()


def main() -> int:
    configure_logging()
    log = structlog.get_logger(__name__)

    poll_interval = int(os.environ.get("POLL_INTERVAL_SECONDS", "5"))
    dry_run = os.environ.get("DRY_RUN", "false").lower() in ("1", "true", "yes")
    billing_tag = os.environ.get("BILLING_TAG")

    log.info(
        "worker.starting",
        poll_interval_seconds=poll_interval,
        dry_run=dry_run,
        billing_tag=billing_tag,
    )

    # Graceful shutdown — let an in-flight scan finish before exiting.
    shutdown_requested = False

    def request_shutdown(signum, _frame):
        nonlocal shutdown_requested
        log.info("worker.shutdown_requested", signal=signum)
        shutdown_requested = True

    signal.signal(signal.SIGTERM, request_shutdown)
    signal.signal(signal.SIGINT, request_shutdown)

    supabase = _build_supabase_client()
    storage = _build_storage_client()

    # Local imports so the heavy deps (trimesh, matplotlib) don't load
    # until the env guard above has succeeded.
    from worker.scan_runner import process_one_job

    while not shutdown_requested:
        did_work = process_one_job(supabase, storage)
        if not did_work:
            time.sleep(poll_interval)

    log.info("worker.shutdown_complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
