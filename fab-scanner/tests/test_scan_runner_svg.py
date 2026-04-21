"""End-to-end SVG dispatch test.

Phase 2B-1 asserts: a known-good SVG routed through the worker returns
scan_status='done' with empty rules[] and the combined ruleset_version
string. No thumbnail yet (Phase 2B-6 adds cairo rendering).

Lesson #38: each assertion checks an EXPECTED value, not just truthy.
The combined ruleset tag MUST match the constant in schemas/ruleset_version
exactly - a drift here means teachers see inconsistent scan results.
"""

from __future__ import annotations

import pytest

from worker.scan_runner import scan_one_revision
from worker.supabase_client import ClaimedJob


def _make_svg_job(fixture_relpath: str) -> ClaimedJob:
    """Build a ClaimedJob pointing at an SVG fixture.

    Uses generic_large_laser (600×500mm bed) rather than glowforge_plus
    because the known-good SVG corpus contains A3 and 466×383 fixtures
    that don't physically fit a Glowforge Plus bed — the machine-fit
    rule correctly flags them on that profile. Sidecar metadata drift
    is tracked separately as FU-SVG-FIXTURE-MACHINE-MISMATCH.
    """
    return ClaimedJob(
        scan_job_id="scan-svg-test-1",
        job_id="job-svg-test-1",
        job_revision_id="rev-svg-test-1",
        storage_path=fixture_relpath,
        file_type="svg",
        machine_profile_id="generic_large_laser",
        student_id="student-svg-test-1",
    )


@pytest.mark.parametrize(
    "relpath",
    [
        # Known truly-clean fixtures — zero geometry quirks. Using
        # these rather than the full known-good set because a handful
        # of makercase + student-authored fixtures carry a single
        # duplicate cut path each (R-SVG-08 authoring quirk tracked
        # as FU-SVG-FIXTURE-METADATA-DRIFT).
        "known-good/svg/inkscape-single-path-a4.svg",
        "known-good/svg/makercase-box-back-panel.svg",
        "known-good/svg/coaster-clove-no-stroke-attr.svg",
    ],
    ids=lambda p: p.rsplit("/", 1)[-1],
)
def test_known_good_svg_scans_clean(
    relpath: str,
    mock_supabase,
    mock_storage,
) -> None:
    """End-to-end dispatch: known-clean SVGs route through all rule
    groups and emit empty rules[] + combined ruleset tag. Rules
    themselves are covered by their respective test_rules_svg_*.py
    modules.
    """
    job = _make_svg_job(relpath)

    results = scan_one_revision(job, mock_supabase, mock_storage)

    # Lesson #38: assert EXACT expected values.
    assert results.rules == [], (
        f"expected no rules on known-good SVG, got {results.rules}"
    )
    assert results.ruleset_version == "stl-v1.0.0+svg-v1.0.0", (
        f"ruleset tag drift - expected combined stl+svg, got "
        f"{results.ruleset_version!r}"
    )
    # Phase 2B-6 adds cairo thumbnails; for 2B-1 the SVG branch
    # intentionally skips rendering.
    assert results.thumbnail_path is None, (
        f"Phase 2B-1 must not emit a thumbnail, got {results.thumbnail_path!r}"
    )
    # Scan duration is recorded for perf monitoring - just check it's
    # a non-negative int, not a specific value.
    assert isinstance(results.scan_duration_ms, int)
    assert results.scan_duration_ms >= 0
