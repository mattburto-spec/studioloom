"""Worker entrypoint: infinite poll loop over fabrication_scan_jobs.

Phase 2A-1 ships this skeleton with a "NotImplementedError if real Supabase
credentials are set" guard — we don't want a half-built worker accidentally
connecting to prod before Phase 2A-6's Checkpoint.
"""

from __future__ import annotations

import os
import signal
import sys
import time

import structlog

from worker.observability import configure_logging


def _real_supabase_client():
    """Phase 2A-6 will implement. Until then, halt if prod env is set."""
    raise NotImplementedError(
        "Real SupabaseServiceClient is minted at Phase 2A-6 just before "
        "the first Fly deploy. Until then, use MockSupabaseClient via the "
        "sandbox CLI or pytest."
    )


def _real_storage_client():
    """Phase 2A-6 will implement."""
    raise NotImplementedError(
        "Real StorageClient (signed-URL) is minted at Phase 2A-6."
    )


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

    supabase = _real_supabase_client()
    storage = _real_storage_client()

    from worker.scan_runner import process_one_job  # local import: heavy deps

    while not shutdown_requested:
        did_work = process_one_job(supabase, storage)
        if not did_work:
            # Queue empty — poll again after interval.
            time.sleep(poll_interval)

    log.info("worker.shutdown_complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
