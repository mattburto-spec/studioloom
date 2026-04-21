"""Preflight email dispatch for the scanner worker.

Python port of src/lib/preflight/email.ts (Phase 1B-2-1) — keeps the
notifications_sent JSONB merge contract identical so emails sent from
either the Next.js side (invite, set_password_reset) or the worker side
(scan-complete, etc.) compose into a single audit history per job.

Idempotency model (matches TS helper):
- Each email kind maps to a `<kind>_at` ISO-timestamp key in
  fabrication_jobs.notifications_sent JSONB.
- Read existing notifications_sent → if key already present, skip dispatch.
- Otherwise: send via Resend, then read-modify-write the JSONB to add
  the new {<kind>_at: now} entry. Preserves other keys per Lesson #42.
- Read-modify-write is race-able but we run a single worker instance
  (Phase 2A constraint) so no concurrent dispatch on the same job.

Sender stays `Preflight <hello@loominary.org>` — Loominary verified
in Resend per D-EM-1. Override only via PREFLIGHT_EMAIL_FROM env var.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Literal

import httpx
import structlog

if TYPE_CHECKING:
    from worker.supabase_real import SupabaseServiceClient

log = structlog.get_logger(__name__)

DEFAULT_SENDER = "Preflight <hello@loominary.org>"

# Subset of FabricationEmailKind that the Python worker actually emits.
# The TS helper covers identity flows (invite, set_password_reset) — not
# our concern here. Other status transitions (approved, rejected,
# picked_up, etc.) are dispatched from Next.js routes when the user
# action happens, not by the scanner. Adding a kind here is a 1-line
# edit + an entry in EMAIL_TEMPLATES.
WorkerEmailKind = Literal["submitted"]


@dataclass(frozen=True)
class EmailDispatchResult:
    sent: bool
    skipped: bool
    reason: str | None = None


def _idempotency_key(kind: WorkerEmailKind) -> str:
    return f"{kind}_at"


def _build_subject(kind: WorkerEmailKind, display_name: str | None) -> str:
    name = display_name or "your file"
    if kind == "submitted":
        return f"Preflight scan complete for {name}"
    raise ValueError(f"unknown email kind: {kind}")


def _build_html(
    kind: WorkerEmailKind,
    display_name: str | None,
    highest_severity: str | None,
    job_id: str,
    site_url: str,
) -> str:
    """Minimal HTML — the soft-gate UI renders the real evidence; this
    email is just a notification with a deep link."""
    name = display_name or "your file"
    job_url = f"{site_url.rstrip('/')}/student/preflight/jobs/{job_id}"
    if kind == "submitted":
        if highest_severity == "block":
            verdict = (
                "<p>Some issues need fixing before this can print. "
                "Open the results to see what to change and re-upload.</p>"
            )
        elif highest_severity == "warn":
            verdict = (
                "<p>Your file passed the must-fix checks but has warnings to "
                "review. Open the results, acknowledge the warnings, and "
                "submit when you're ready.</p>"
            )
        else:
            verdict = (
                "<p>Your file passed all checks. Open the results and submit "
                "to send it to the lab tech.</p>"
            )
        return f"""\
<!doctype html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5">
<h2>Preflight scan complete</h2>
<p>Your scan of <strong>{name}</strong> is back.</p>
{verdict}
<p><a href="{job_url}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 16px;text-decoration:none;border-radius:6px">Open scan results</a></p>
<p style="color:#666;font-size:12px">You can opt out of these emails in your StudioLoom settings.</p>
</body></html>
"""
    raise ValueError(f"unknown email kind: {kind}")


def _send_via_resend(
    *,
    api_key: str,
    sender: str,
    to: str,
    subject: str,
    html: str,
) -> EmailDispatchResult:
    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={"from": sender, "to": [to], "subject": subject, "html": html},
            timeout=10.0,
        )
    except httpx.HTTPError as e:
        return EmailDispatchResult(
            sent=False, skipped=False, reason=f"network error: {e!r}"
        )
    if response.status_code >= 400:
        log.error(
            "email.resend_error",
            status=response.status_code,
            body=response.text[:500],
        )
        return EmailDispatchResult(
            sent=False,
            skipped=False,
            reason=f"resend api {response.status_code}",
        )
    return EmailDispatchResult(sent=True, skipped=False)


def dispatch_scan_complete_email(
    *,
    supabase: "SupabaseServiceClient",
    job_id: str,
    to: str,
    display_name: str | None,
    highest_severity: str | None,
) -> EmailDispatchResult:
    """Send the post-scan notification, with idempotent JSONB merge.

    Caller decides whether to call this — typically only when a scan
    completes successfully (not on scan_status=error).
    """
    api_key = os.environ.get("RESEND_API_KEY")
    sender = os.environ.get("PREFLIGHT_EMAIL_FROM", DEFAULT_SENDER)
    site_url = os.environ.get("NEXT_PUBLIC_SITE_URL", "https://studioloom.org")

    if not to:
        return EmailDispatchResult(sent=False, skipped=True, reason="no recipient")

    kind: WorkerEmailKind = "submitted"
    key = _idempotency_key(kind)

    # 1. Idempotency check.
    notifications = _read_notifications_sent(supabase, job_id)
    if notifications is None:
        return EmailDispatchResult(
            sent=False, skipped=False, reason="notifications_sent read failed"
        )
    if key in notifications:
        return EmailDispatchResult(
            sent=False, skipped=True, reason=f"already sent ({key} present)"
        )

    if not api_key:
        log.info(
            "email.would_send",
            kind=kind,
            to=to,
            job_id=job_id,
            note="RESEND_API_KEY not set — console fallback",
        )
        return EmailDispatchResult(
            sent=False, skipped=False, reason="RESEND_API_KEY not set"
        )

    # 2. Send.
    subject = _build_subject(kind, display_name)
    html = _build_html(kind, display_name, highest_severity, job_id, site_url)
    result = _send_via_resend(
        api_key=api_key, sender=sender, to=to, subject=subject, html=html
    )
    if not result.sent:
        return result

    # 3. JSONB merge. Read again then overwrite — small race window if
    # somebody else writes between read and write, but a single-instance
    # worker doesn't have concurrent writers on the same job.
    now_iso = datetime.now(timezone.utc).isoformat()
    current = _read_notifications_sent(supabase, job_id) or {}
    merged = {**current, key: now_iso}
    try:
        # SupabaseServiceClient doesn't expose a notifications_sent setter
        # directly — use the underlying client. This is the one place the
        # worker reaches past the SupabaseClient Protocol; tolerable for
        # a single audit-write.
        supabase._client.table("fabrication_jobs").update(  # type: ignore[attr-defined]
            {"notifications_sent": merged}
        ).eq("id", job_id).execute()
    except Exception as e:
        log.warning(
            "email.audit_write_failed",
            job_id=job_id,
            error=repr(e),
            note="email sent but notifications_sent write failed; next call will re-send",
        )
        return EmailDispatchResult(
            sent=True,
            skipped=False,
            reason=f"sent but audit write failed: {e!r}",
        )

    return EmailDispatchResult(sent=True, skipped=False)


def _read_notifications_sent(
    supabase: "SupabaseServiceClient", job_id: str
) -> dict | None:
    """Returns the current notifications_sent JSONB as a dict, or {}
    when the column is null. Returns None on read error so callers
    distinguish 'no data' from 'failed to read'."""
    try:
        result = (
            supabase._client.table("fabrication_jobs")  # type: ignore[attr-defined]
            .select("notifications_sent")
            .eq("id", job_id)
            .maybe_single()
            .execute()
        )
    except Exception as e:
        log.warning("email.notifications_read_failed", job_id=job_id, error=repr(e))
        return None
    row = result.data or {}
    return row.get("notifications_sent") or {}
