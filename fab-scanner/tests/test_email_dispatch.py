"""Tests for the worker's scan-complete email dispatch + student lookup.

These exercise the integration between scan_runner.process_one_job and
the optional email path: opt-out, missing email, missing student row,
and the happy-path lookup. The actual Resend HTTP call is not exercised
here — those tests live separately so we don't accidentally hit the
real API in CI. dispatch_scan_complete_email skips the HTTP call when
RESEND_API_KEY is unset, which is the default in tests.
"""

from __future__ import annotations

from conftest import MockStorage, MockSupabase, make_stl_job

from worker.scan_runner import process_one_job
from worker.supabase_client import StudentForEmail


def test_email_skipped_when_student_not_found(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """Worker shouldn't crash when the joined student row is missing.
    Scan completes successfully, dispatch silently skips."""
    mock_supabase.pending_jobs.append(
        make_stl_job(
            "known-good/stl/small-cube-25mm.stl", student_id="ghost-student"
        )
    )

    did_work = process_one_job(mock_supabase, mock_storage)

    assert did_work is True
    assert mock_supabase.writes[0]["scan_status"] == "done"
    # Lookup attempted, returned None
    assert mock_supabase.student_lookups == ["ghost-student"]


def test_email_skipped_when_student_opted_out(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """Honour students.fabrication_notify_email — opt-out students
    don't get scan-complete notifications."""
    mock_supabase.students["student-test-1"] = StudentForEmail(
        student_id="student-test-1",
        email="optout@example.com",
        display_name="Opt Out Sam",
        notify_email_opt_in=False,
    )
    mock_supabase.pending_jobs.append(
        make_stl_job("known-good/stl/small-cube-25mm.stl")
    )

    process_one_job(mock_supabase, mock_storage)

    # Still looked up so the worker knows what they wanted; just skipped send.
    assert mock_supabase.student_lookups == ["student-test-1"]


def test_email_skipped_when_student_has_no_email_on_file(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    mock_supabase.students["student-test-1"] = StudentForEmail(
        student_id="student-test-1",
        email=None,
        display_name="Nameless",
        notify_email_opt_in=True,
    )
    mock_supabase.pending_jobs.append(
        make_stl_job("known-good/stl/small-cube-25mm.stl")
    )

    process_one_job(mock_supabase, mock_storage)

    assert mock_supabase.student_lookups == ["student-test-1"]


def test_email_lookup_attempted_for_opted_in_student_with_email(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """Happy path — student is opted in and has an email. Worker calls
    the dispatch helper. With RESEND_API_KEY unset (test default) the
    helper logs and returns sent=false but doesn't error."""
    mock_supabase.students["student-test-1"] = StudentForEmail(
        student_id="student-test-1",
        email="student@example.com",
        display_name="Eli Engineer",
        notify_email_opt_in=True,
    )
    mock_supabase.pending_jobs.append(
        make_stl_job("known-good/stl/small-cube-25mm.stl")
    )

    process_one_job(mock_supabase, mock_storage)

    assert mock_supabase.student_lookups == ["student-test-1"]
    # Scan still landed as done — dispatch outcome doesn't affect scan status.
    assert mock_supabase.writes[0]["scan_status"] == "done"


def test_email_dispatch_failure_does_not_flip_scan_to_error(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """If load_student_for_email throws, the scan is already 'done' and
    must stay that way. Process_one_job swallows the exception."""
    original = mock_supabase.load_student_for_email

    def boom(_student_id: str):
        raise RuntimeError("simulated student-table outage")

    mock_supabase.load_student_for_email = boom  # type: ignore[method-assign]
    try:
        mock_supabase.pending_jobs.append(
            make_stl_job("known-good/stl/small-cube-25mm.stl")
        )
        did_work = process_one_job(mock_supabase, mock_storage)
        assert did_work is True
        assert mock_supabase.writes[0]["scan_status"] == "done"
    finally:
        mock_supabase.load_student_for_email = original  # type: ignore[method-assign]
