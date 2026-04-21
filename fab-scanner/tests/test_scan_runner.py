"""End-to-end scan_runner test.

Phase 2A-1 goal: prove the plumbing holds. A good STL is claimed, loaded,
scanned with the (empty) rule catalogue, and writeback happens with the
expected shape. Individual rules land in 2A-2..2A-5.
"""

from __future__ import annotations

from conftest import MockStorage, MockSupabase, make_stl_job

from schemas.scan_results import ScanResults
from worker.scan_runner import process_one_job, scan_one_revision


def test_scan_one_revision_on_known_good_stl_returns_empty_block_warn_rules(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """End-to-end pipe check: scan_one_revision loads the file, runs the
    full rule catalogue, and emits a well-formed ScanResults with no
    BLOCK/WARN rules. FYI rules (R-STL-15, R-STL-16) fire on every
    valid mesh as informational — we filter them out of this assertion
    because their presence is behaviour, not breakage.

    Lesson #38: assertion on expected content within the relevant
    severity tier, not just existence.
    """
    job = make_stl_job("known-good/stl/small-cube-25mm.stl")

    results = scan_one_revision(job, mock_supabase, mock_storage)

    assert isinstance(results, ScanResults)
    non_fyi = [r.id for r in results.rules if r.severity != "fyi"]
    assert non_fyi == [], (
        f"Expected 0 BLOCK/WARN rules on known-good fixture; got {non_fyi}"
    )
    # 2B-1: combined STL+SVG ruleset tag stored on every scan.
    assert results.ruleset_version == "stl-v1.0.0+svg-v1.0.0"
    assert results.scan_duration_ms >= 0
    # 2A-5: thumbnail is rendered and uploaded via the mock. Path is the
    # deterministic fake from MockStorage.upload_thumbnail.
    assert results.thumbnail_path is not None
    assert results.thumbnail_path.startswith("fabrication-thumbnails/")


def test_process_one_job_writes_done_status_and_results(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """process_one_job() should claim, scan, and write back exactly once
    with scan_status='done' when the scan succeeds."""
    mock_supabase.pending_jobs.append(
        make_stl_job("known-good/stl/small-cube-25mm.stl")
    )

    did_work = process_one_job(mock_supabase, mock_storage)

    assert did_work is True
    assert len(mock_supabase.writes) == 1
    w = mock_supabase.writes[0]
    assert w["scan_status"] == "done"
    assert w["scan_error"] is None
    # 2B-1: combined STL+SVG ruleset tag now appears on both the writeback
    # row-level field and the JSONB scan_results.ruleset_version mirror.
    assert w["ruleset_version"] == "stl-v1.0.0+svg-v1.0.0"
    non_fyi = [r for r in w["scan_results"]["rules"] if r["severity"] != "fyi"]
    assert non_fyi == []
    assert w["scan_results"]["ruleset_version"] == "stl-v1.0.0+svg-v1.0.0"
    assert w["scan_results"]["scan_duration_ms"] >= 0
    assert w["scan_results"]["thumbnail_path"] is not None


def test_process_one_job_empty_queue_returns_false(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """When queue is empty, returns False so caller knows to sleep."""
    did_work = process_one_job(mock_supabase, mock_storage)
    assert did_work is False
    assert mock_supabase.writes == []


def test_process_one_job_writes_error_on_invalid_stl(
    mock_supabase: MockSupabase, mock_storage: MockStorage, tmp_path
):
    """Malformed input → scan_status='error' + scan_error populated, worker
    keeps running. Simulate by pointing at a non-STL file (a .meta.yaml)."""
    mock_supabase.pending_jobs.append(
        make_stl_job("known-good/stl/small-cube-25mm.meta.yaml")
    )

    did_work = process_one_job(mock_supabase, mock_storage)

    assert did_work is True
    assert len(mock_supabase.writes) == 1
    w = mock_supabase.writes[0]
    assert w["scan_status"] == "error"
    assert w["scan_error"] is not None
    assert w["scan_results"] == {}


def test_process_one_job_handles_missing_fixture(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """FileNotFoundError from storage → scan error, worker continues."""
    mock_supabase.pending_jobs.append(
        make_stl_job("known-good/stl/does-not-exist.stl")
    )

    did_work = process_one_job(mock_supabase, mock_storage)

    assert did_work is True
    assert mock_supabase.writes[0]["scan_status"] == "error"
    assert "FileNotFoundError" in mock_supabase.writes[0]["scan_error"]
