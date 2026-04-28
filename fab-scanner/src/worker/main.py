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

    # Phase 8.1d-36 (28 Apr): wrap process_one_job in try/except so a
    # transient API error (httpx.ReadTimeout from claim_next_scan_job,
    # network blip between Fly SYD and Supabase, momentary RPC hang)
    # does NOT crash the worker. Pre-fix, an unhandled exception
    # escaped the loop → process exit → Fly restart → same poll fails
    # again → ... 10 times → Fly stops trying ("This machine has
    # exhausted its maximum restart attempts"). Caught in 28 Apr
    # smoke when a ReadTimeout flooded the logs and the worker went
    # down for hours until manual recovery.
    #
    # Resilience strategy: log the exception with full traceback (so
    # it's visible in Fly logs without losing context), exponential
    # backoff capped at 60s (don't tight-loop on a persistent backend
    # issue), then continue. SIGTERM/SIGINT shutdown still propagates
    # — only API exceptions are swallowed.
    consecutive_errors = 0
    while not shutdown_requested:
        try:
            did_work = process_one_job(supabase, storage)
            consecutive_errors = 0  # reset on any successful tick
            if not did_work:
                time.sleep(poll_interval)
        except Exception:
            consecutive_errors += 1
            # Exponential backoff capped at 60s. First failure waits
            # poll_interval, then 2x, 4x, 8x, ... up to 60s. Stops the
            # worker hammering a degraded Supabase but recovers
            # quickly when it comes back.
            backoff = min(60, poll_interval * (2 ** min(consecutive_errors - 1, 4)))
            log.exception(
                "worker.poll_error",
                consecutive_errors=consecutive_errors,
                backoff_seconds=backoff,
            )
            time.sleep(backoff)

    log.info("worker.shutdown_complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
