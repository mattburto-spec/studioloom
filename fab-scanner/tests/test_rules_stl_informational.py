"""Tests for STL informational rules (R-STL-15..17) + thumbnail rendering.

Unlike BLOCK/WARN rules, FYI rules are deterministic functions of mesh
properties — they don't represent interpretive calls. So these tests
assert rule behaviour directly rather than cross-referencing sidecar
triggers_rules (which would otherwise need R-STL-15/16 appended to
every STL sidecar). Keeps sidecars focused on what's interesting.
"""

from __future__ import annotations

import pytest
from conftest import FixtureSpec, MockStorage, MockSupabase, discover_fixtures, make_stl_job

from worker.scan_runner import scan_one_revision

ALL_STL_FIXTURES = (
    discover_fixtures("known-good", "stl")
    + discover_fixtures("known-broken", "stl")
    + discover_fixtures("borderline", "stl")
)


def _scan(fixture: FixtureSpec, mock_supabase: MockSupabase, mock_storage: MockStorage):
    job = make_stl_job(fixture.relpath, machine_profile_id=fixture.intended_machine)
    return scan_one_revision(job, mock_supabase, mock_storage)


# --- R-STL-15 / R-STL-16 behaviour ----------------------------------------


def test_r_stl_15_16_fire_on_every_known_good_fixture(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """Every known-good STL has a computable positive volume, so the two
    informational rules should always emit."""
    for fx in discover_fixtures("known-good", "stl"):
        results = _scan(fx, mock_supabase, mock_storage)
        fired = {r.id for r in results.rules}
        assert "R-STL-15" in fired, f"{fx.relpath} missing R-STL-15"
        assert "R-STL-16" in fired, f"{fx.relpath} missing R-STL-16"


def test_r_stl_15_evidence_contains_minutes_and_volume(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    results = scan_one_revision(
        make_stl_job("known-good/stl/mount-bracket-130mm.stl"),
        mock_supabase,
        mock_storage,
    )
    rule = next((r for r in results.rules if r.id == "R-STL-15"), None)
    assert rule is not None
    assert rule.evidence["estimated_minutes"] > 0
    assert rule.evidence["volume_mm3"] > 0


def test_r_stl_16_evidence_contains_grams_and_metres(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    results = scan_one_revision(
        make_stl_job("known-good/stl/mount-bracket-130mm.stl"),
        mock_supabase,
        mock_storage,
    )
    rule = next((r for r in results.rules if r.id == "R-STL-16"), None)
    assert rule is not None
    assert rule.evidence["estimated_grams"] > 0
    assert rule.evidence["estimated_metres"] > 0


def test_r_stl_15_16_skip_on_near_zero_volume_fixture(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """chess-pawn-inverted-winding has signed volume ~0 (half faces
    inverted). abs(volume) <= 0 trips the degenerate guard; FYI rules
    should skip. Scanner correctly surfaces R-STL-02 + R-STL-05 only."""
    results = scan_one_revision(
        make_stl_job("known-broken/stl/chess-pawn-inverted-winding.stl"),
        mock_supabase,
        mock_storage,
    )
    fired = {r.id for r in results.rules}
    assert "R-STL-15" not in fired
    assert "R-STL-16" not in fired


# --- R-STL-17 ---------------------------------------------------------------


def test_r_stl_17_does_not_fire_on_any_current_fixture(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """No current fixture has >500k faces (largest is ~175k).  If one
    appears, either its sidecar should mention R-STL-17 or the threshold
    needs tuning — this test catches either drift."""
    any_fired = False
    for fx in ALL_STL_FIXTURES:
        results = _scan(fx, mock_supabase, mock_storage)
        if any(r.id == "R-STL-17" for r in results.rules):
            any_fired = True
            break
    assert not any_fired, (
        "R-STL-17 fired on an existing fixture — add a >500k-face fixture "
        "with matching sidecar, or tune _TRIANGLE_COUNT_SLUGGISH_THRESHOLD."
    )


# --- thumbnail rendering ---------------------------------------------------


def test_every_valid_stl_produces_a_thumbnail_path(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """Every fixture that loads as a trimesh.Trimesh should produce a
    thumbnail_path via MockStorage.upload_thumbnail (which returns a
    deterministic fake path). If render fails on a specific fixture,
    scan_runner's safe_render catches the exception and we get None —
    which this test would flag."""
    failures = []
    for fx in ALL_STL_FIXTURES:
        results = _scan(fx, mock_supabase, mock_storage)
        if results.thumbnail_path is None:
            failures.append(fx.relpath)
    assert not failures, f"thumbnail render failed for: {failures}"


def test_thumbnail_path_points_at_fabrication_thumbnails_bucket(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """MockStorage's upload_thumbnail returns 'fabrication-thumbnails/<id>.png'
    — asserts the scan pipeline uses it rather than stashing raw PNG bytes
    somewhere uncooperative."""
    results = scan_one_revision(
        make_stl_job("known-good/stl/small-cube-25mm.stl"),
        mock_supabase,
        mock_storage,
    )
    assert results.thumbnail_path == "fabrication-thumbnails/rev-test-1.png"
