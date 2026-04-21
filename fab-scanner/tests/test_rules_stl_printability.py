"""Fixture-driven tests for STL printability rules (R-STL-09..14).

Unlike the geometry + machine-fit tests, printability rules can
legitimately WARN on known-good files (overhangs on a mount bracket,
rounded base on a wheel — these are real printability concerns that
the scanner should surface). So we use sidecar triggers_rules as the
ground truth regardless of bucket: the file fires exactly what its
sidecar says it fires, within this rule group.

R-STL-12 (feature size) is deferred in v1 — documented separately.
"""

from __future__ import annotations

import pytest
from conftest import FixtureSpec, MockStorage, MockSupabase, discover_fixtures, make_stl_job

from worker.scan_runner import scan_one_revision

PRINTABILITY_RULE_IDS = {
    "R-STL-09",
    "R-STL-10",
    "R-STL-11",
    "R-STL-12",
    "R-STL-13",
    "R-STL-14",
}


def _scan(fixture: FixtureSpec, mock_supabase: MockSupabase, mock_storage: MockStorage):
    job = make_stl_job(fixture.relpath, machine_profile_id=fixture.intended_machine)
    return scan_one_revision(job, mock_supabase, mock_storage)


ALL_STL_FIXTURES = (
    discover_fixtures("known-good", "stl")
    + discover_fixtures("known-broken", "stl")
    + discover_fixtures("borderline", "stl")
)


@pytest.mark.parametrize(
    "fixture",
    ALL_STL_FIXTURES,
    ids=[f.relpath for f in ALL_STL_FIXTURES],
)
def test_every_stl_fires_exactly_declared_printability_rules(
    fixture: FixtureSpec, mock_supabase: MockSupabase, mock_storage: MockStorage
):
    expected = {r for r in fixture.triggers_rules if r in PRINTABILITY_RULE_IDS}

    results = _scan(fixture, mock_supabase, mock_storage)
    fired = {r.id for r in results.rules if r.id in PRINTABILITY_RULE_IDS}

    missing = expected - fired
    assert not missing, (
        f"{fixture.relpath} sidecar declares {sorted(expected)} but only "
        f"{sorted(fired)} fired — missing {sorted(missing)}"
    )
    unexpected = fired - expected
    assert not unexpected, (
        f"{fixture.relpath} sidecar does NOT declare {sorted(unexpected)} but "
        f"the rule fired. Update sidecar (if behaviour is intentional) or "
        f"tighten the rule."
    )


# --- bespoke assertions ------------------------------------------------------


def test_r_stl_11_fires_on_mount_bracket_with_reasonable_evidence(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """mount-bracket-130mm has an L-ish shape — the underside of the
    flange is a real overhang. Scanner should surface the fraction."""
    results = scan_one_revision(
        make_stl_job("known-good/stl/mount-bracket-130mm.stl"),
        mock_supabase,
        mock_storage,
    )
    rule = next((r for r in results.rules if r.id == "R-STL-11"), None)
    assert rule is not None
    # At our 25% area threshold, a firing fixture should have at least that much.
    assert rule.evidence["overhang_fraction"] >= 0.25


def test_r_stl_13_does_not_fire_on_cubes_that_have_full_flat_base(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """small-cube-25mm's bottom IS its full footprint — 100% coverage,
    well above the 10% threshold. Must not fire."""
    results = scan_one_revision(
        make_stl_job("known-good/stl/small-cube-25mm.stl"),
        mock_supabase,
        mock_storage,
    )
    assert not any(r.id == "R-STL-13" for r in results.rules)


def test_r_stl_13_fires_on_wheel_with_round_base(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """A wheel has a round cross-section. Its true contact area with
    the bed is tiny vs the XY bbox. Evidence should surface the ratio."""
    results = scan_one_revision(
        make_stl_job("known-good/stl/wheel-front-toy-vehicle.stl"),
        mock_supabase,
        mock_storage,
    )
    rule = next((r for r in results.rules if r.id == "R-STL-13"), None)
    assert rule is not None
    assert rule.evidence["base_area_fraction"] < 0.10


def test_r_stl_14_does_not_fire_on_any_current_fixture(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """All current fixtures have Z/max(X,Y) ≤ 5. If a future fixture
    changes that, its sidecar should list R-STL-14 — and this test will
    fail, catching the drift. Acts as a coverage gap watchdog."""
    any_fired = False
    for fx in ALL_STL_FIXTURES:
        results = scan_one_revision(
            make_stl_job(fx.relpath, machine_profile_id=fx.intended_machine),
            mock_supabase,
            mock_storage,
        )
        if any(r.id == "R-STL-14" for r in results.rules):
            any_fired = True
            break
    assert not any_fired, (
        "R-STL-14 fired on an existing fixture — add a dedicated tall-thin "
        "fixture with its own sidecar triggers_rules entry, or adjust the "
        "ratio threshold."
    )


def test_r_stl_12_is_deferred_in_v1(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """R-STL-12 (feature size) is deferred. No fixture should emit it
    until the rule lands and STL_RULESET_VERSION bumps. Same pattern as
    the R-STL-03 deferred-rule guard in test_rules_stl_geometry.py."""
    for fx in ALL_STL_FIXTURES:
        results = scan_one_revision(
            make_stl_job(fx.relpath, machine_profile_id=fx.intended_machine),
            mock_supabase,
            mock_storage,
        )
        assert not any(r.id == "R-STL-12" for r in results.rules), (
            f"R-STL-12 fired on {fx.relpath} but rule is deferred — bump "
            f"STL_RULESET_VERSION and update docs before shipping this rule."
        )


def test_wall_thickness_rules_skip_non_watertight_meshes(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """R-STL-09 and R-STL-10 must skip broken meshes — ray-cast on
    non-watertight geometry gives garbage distances and would pile onto
    the R-STL-01 BLOCK with false noise."""
    for fx_path in (
        "known-broken/stl/seahorse-not-watertight.stl",
        "known-broken/stl/whale-not-watertight.stl",
    ):
        results = scan_one_revision(
            make_stl_job(fx_path), mock_supabase, mock_storage
        )
        assert not any(r.id in ("R-STL-09", "R-STL-10") for r in results.rules), (
            f"{fx_path} is non-watertight — wall-thickness rules should skip"
        )
