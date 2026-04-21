"""Tests for the real Supabase writeback path.

Existing scan_runner tests use MockSupabase (conftest.py) and only assert
on the JSONB shape in `writes[i]["scan_results"]`. That misses the real
SupabaseServiceClient's per-column update payload — which is exactly
where the thumbnail_path column-vs-JSONB drift (Apr 22) slipped past CI.

This file exercises SupabaseServiceClient directly with a mocked
supabase-py client and asserts on the exact column payload that PostgREST
receives. If a future refactor drops a column from the update dict, this
test fails loudly.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

from worker.supabase_real import SupabaseServiceClient


def _make_client_with_recording_update() -> tuple[Any, list[dict[str, Any]]]:
    """Build a mock supabase-py client that records every .update() payload.

    Returns (client, recorded_updates). Each recorded entry is:
      {"table": str, "payload": dict, "eq": (col, val)}
    """
    recorded: list[dict[str, Any]] = []

    def make_table_chain(table_name: str) -> Any:
        chain = MagicMock(name=f"table[{table_name}]")

        def update(payload: dict[str, Any]) -> Any:
            entry: dict[str, Any] = {"table": table_name, "payload": payload}
            recorded.append(entry)

            eq_chain = MagicMock(name=f"table[{table_name}].update.eq")

            def eq(col: str, val: Any) -> Any:
                entry["eq"] = (col, val)
                exec_chain = MagicMock(name=f"table[{table_name}].update.eq.execute")
                exec_chain.execute.return_value = MagicMock(data=[])
                return exec_chain

            eq_chain.eq.side_effect = eq
            return eq_chain

        chain.update.side_effect = update
        return chain

    client = MagicMock(name="supabase_client")
    client.table.side_effect = make_table_chain
    return client, recorded


def test_write_scan_results_includes_thumbnail_path_column():
    """Regression guard — the denormalised thumbnail_path column on
    fabrication_job_revisions must be set from scan_results["thumbnail_path"].

    Before 22 Apr 2026 this column was left NULL even when cairo rendered
    and the thumbnail was uploaded to storage; the value lived only in
    the scan_results JSONB. The UI reads the column, so students saw no
    thumbnails. See docs/lessons-learned.md and CLAUDE.md.
    """
    client, updates = _make_client_with_recording_update()
    svc = SupabaseServiceClient(client=client, worker_identifier="test-worker")

    scan_results = {
        "rules": [],
        "ruleset_version": "stl-v1.0.0+svg-v1.0.0",
        "scan_duration_ms": 123,
        "thumbnail_path": "abc-123.png",
    }
    svc.write_scan_results(
        job_id="job-1",
        job_revision_id="rev-1",
        scan_job_id="sj-1",
        scan_results=scan_results,
        ruleset_version="stl-v1.0.0+svg-v1.0.0",
        scan_status="done",
    )

    # Find the update targeting fabrication_job_revisions.
    rev_updates = [u for u in updates if u["table"] == "fabrication_job_revisions"]
    assert len(rev_updates) == 1, f"expected 1 revision update, got {len(rev_updates)}"
    payload = rev_updates[0]["payload"]

    # Assert actual value, not just key presence (Lesson #38).
    assert payload["thumbnail_path"] == "abc-123.png"
    assert payload["scan_status"] == "done"
    assert payload["scan_ruleset_version"] == "stl-v1.0.0+svg-v1.0.0"
    assert payload["scan_results"] is scan_results  # full JSONB round-trips
    assert rev_updates[0]["eq"] == ("id", "rev-1")


def test_write_scan_results_thumbnail_path_none_when_missing():
    """When cairo rendering fails or scan errors before thumbnail upload,
    scan_results has no thumbnail_path key. Column must be set to None,
    not raise KeyError."""
    client, updates = _make_client_with_recording_update()
    svc = SupabaseServiceClient(client=client, worker_identifier="test-worker")

    scan_results: dict[str, Any] = {
        "rules": [],
        "ruleset_version": "stl-v1.0.0",
        "scan_duration_ms": 42,
        # thumbnail_path intentionally absent
    }
    svc.write_scan_results(
        job_id="job-2",
        job_revision_id="rev-2",
        scan_job_id="sj-2",
        scan_results=scan_results,
        ruleset_version="stl-v1.0.0",
        scan_status="done",
    )

    rev_updates = [u for u in updates if u["table"] == "fabrication_job_revisions"]
    assert len(rev_updates) == 1
    payload = rev_updates[0]["payload"]
    assert "thumbnail_path" in payload
    assert payload["thumbnail_path"] is None


def test_write_scan_results_updates_all_three_tables():
    """Writeback hits revisions, jobs, and scan_jobs — in that order.

    Not strictly a column-level regression guard, but locks the intent
    documented in supabase_real.py write_scan_results docstring so a
    future refactor that drops one of the three writes fails here.
    """
    client, updates = _make_client_with_recording_update()
    svc = SupabaseServiceClient(client=client, worker_identifier="test-worker")

    svc.write_scan_results(
        job_id="job-3",
        job_revision_id="rev-3",
        scan_job_id="sj-3",
        scan_results={"rules": [], "thumbnail_path": "t.png"},
        ruleset_version="stl-v1.0.0",
        scan_status="done",
    )

    tables_touched = [u["table"] for u in updates]
    assert tables_touched == [
        "fabrication_job_revisions",
        "fabrication_jobs",
        "fabrication_scan_jobs",
    ]

    # scan_jobs update should include terminal status.
    scan_jobs_update = next(u for u in updates if u["table"] == "fabrication_scan_jobs")
    assert scan_jobs_update["payload"]["status"] == "done"
    assert scan_jobs_update["eq"] == ("id", "sj-3")
