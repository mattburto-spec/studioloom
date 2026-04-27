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

from schemas.ruleset_version import SCAN_RULESET_VERSION
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
        # Phase 8.1d-24: lab_id + machine_category required on
        # ClaimedJob so the surrogate-machine fallback has somewhere
        # to look. Test stays on the path-A flow (specific machine
        # bound) so these are inert — but they have to be valid
        # strings.
        lab_id="lab-test-svg-1",
        machine_category="laser_cutter",
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
    groups with no BLOCK / WARN rules firing. FYI rules (R-SVG-14
    time-estimate + R-SVG-15 layer-summary) always fire on laser
    profiles per spec §6 — assert NON-FYI rules are empty.
    """
    job = _make_svg_job(relpath)

    results = scan_one_revision(job, mock_supabase, mock_storage)

    # Lesson #38: assert EXACT expected values on the severities that
    # actually matter. FYI rules are informational chrome.
    non_fyi = [r.id for r in results.rules if r.severity != "fyi"]
    assert non_fyi == [], (
        f"expected no BLOCK/WARN rules on known-good SVG, got {non_fyi}"
    )
    assert results.ruleset_version == SCAN_RULESET_VERSION, (
        f"ruleset tag drift - expected {SCAN_RULESET_VERSION!r}, got "
        f"{results.ruleset_version!r}"
    )
    # Phase 2B-6 wires a cairo-based thumbnail. On dev machines without
    # libcairo installed (typical macOS), safe_render_svg returns None
    # and thumbnail_path stays None. In prod on Fly, libcairo is
    # installed via the Dockerfile and thumbnail_path will be set.
    # Either case is valid for the dispatch test.
    assert results.thumbnail_path is None or results.thumbnail_path.startswith(
        "fabrication-thumbnails/"
    )
    assert isinstance(results.scan_duration_ms, int)
    assert results.scan_duration_ms >= 0
