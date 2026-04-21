"""Fixture-driven tests for STL geometry integrity rules (R-STL-01..05).

Strategy:
- For each known-good/stl fixture → assert NO R-STL-01..05 rule fires.
- For each known-broken/stl fixture → load its sidecar, filter the
  declared triggers_rules to the R-STL-01..05 set, and assert EXACTLY
  that subset fires (within this rule group — rules from other groups
  are unimplemented in 2A-2 and ignored here).
- Borderline fixtures tested separately with explicit assertions per
  sidecar — since borderline files are designed to sit on a threshold,
  they get bespoke treatment rather than fixture-driven parametrization.

Per Lesson #38 — assertions check EXPECTED rule IDs, not just
non-emptiness.
"""

from __future__ import annotations

import pytest
from conftest import FixtureSpec, MockStorage, MockSupabase, discover_fixtures, make_stl_job

from worker.scan_runner import scan_one_revision

# R-STL-01..05 are the rules implemented in Phase 2A-2. Everything else
# is unimplemented and must be ignored in these assertions.
GEOMETRY_RULE_IDS = {"R-STL-01", "R-STL-02", "R-STL-03", "R-STL-04", "R-STL-05"}


def _scan(fixture: FixtureSpec, mock_supabase: MockSupabase, mock_storage: MockStorage):
    job = make_stl_job(fixture.relpath, machine_profile_id=fixture.intended_machine)
    return scan_one_revision(job, mock_supabase, mock_storage)


# --- known-good: must fire zero rules from the implemented group ------------

KNOWN_GOOD_STL = discover_fixtures("known-good", "stl")


@pytest.mark.parametrize(
    "fixture",
    KNOWN_GOOD_STL,
    ids=[f.relpath for f in KNOWN_GOOD_STL],
)
def test_known_good_stl_fires_no_geometry_rules(
    fixture: FixtureSpec, mock_supabase: MockSupabase, mock_storage: MockStorage
):
    results = _scan(fixture, mock_supabase, mock_storage)
    fired_geometry = [r.id for r in results.rules if r.id in GEOMETRY_RULE_IDS]
    assert fired_geometry == [], (
        f"{fixture.relpath} is known-good but triggered {fired_geometry}"
    )


# --- known-broken: must fire exactly the sidecar-declared R-STL-01..05 set --

KNOWN_BROKEN_STL = discover_fixtures("known-broken", "stl")


@pytest.mark.parametrize(
    "fixture",
    KNOWN_BROKEN_STL,
    ids=[f.relpath for f in KNOWN_BROKEN_STL],
)
def test_known_broken_stl_fires_exactly_declared_geometry_rules(
    fixture: FixtureSpec, mock_supabase: MockSupabase, mock_storage: MockStorage
):
    expected_in_group = {r for r in fixture.triggers_rules if r in GEOMETRY_RULE_IDS}

    results = _scan(fixture, mock_supabase, mock_storage)
    fired_in_group = {r.id for r in results.rules if r.id in GEOMETRY_RULE_IDS}

    # Every declared rule in the implemented group must fire.
    missing = expected_in_group - fired_in_group
    assert not missing, (
        f"{fixture.relpath} sidecar declares {sorted(expected_in_group)} but "
        f"only {sorted(fired_in_group)} fired — missing {sorted(missing)}"
    )

    # No rule outside the declared set may fire within the implemented group.
    unexpected = fired_in_group - expected_in_group
    assert not unexpected, (
        f"{fixture.relpath} sidecar does NOT declare {sorted(unexpected)} but "
        f"the rule fired. Update sidecar or tighten rule logic."
    )


# --- spot-check evidence payloads on the authored fixtures ------------------

def test_r_stl_01_evidence_includes_face_count_on_seahorse(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """Authored-fixture spot check: watertight violation on the seahorse
    produces evidence we can surface in the student UI."""
    job = make_stl_job("known-broken/stl/seahorse-not-watertight.stl")
    results = scan_one_revision(job, mock_supabase, mock_storage)
    rule = next((r for r in results.rules if r.id == "R-STL-01"), None)
    assert rule is not None, "expected R-STL-01 to fire on seahorse"
    assert rule.evidence["face_count"] > 0
    assert rule.evidence["vertex_count"] > 0


def test_r_stl_02_fires_on_authored_inverted_winding_fixture(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """The synthetic R-STL-02 fixture was authored from chess-pawn-40mm
    by flipping every other face's winding. Must fire here; must NOT fire
    on the base known-good pawn."""
    bad = scan_one_revision(
        make_stl_job("known-broken/stl/chess-pawn-inverted-winding.stl"),
        mock_supabase,
        mock_storage,
    )
    good = scan_one_revision(
        make_stl_job("known-good/stl/chess-pawn-40mm.stl"),
        mock_supabase,
        mock_storage,
    )
    assert any(r.id == "R-STL-02" for r in bad.rules)
    assert not any(r.id == "R-STL-02" for r in good.rules)


def test_r_stl_05_fires_on_degenerate_pawn_with_zero_volume(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """Kohta Pawn → degenerate-zero-volume-pawn: bbox 0×0×0, volume 0.
    Evidence should reflect the zero-volume condition."""
    results = scan_one_revision(
        make_stl_job("known-broken/stl/degenerate-zero-volume-pawn.stl"),
        mock_supabase,
        mock_storage,
    )
    rule = next((r for r in results.rules if r.id == "R-STL-05"), None)
    assert rule is not None
    assert abs(rule.evidence["volume_mm3"]) < 0.01


def test_r_stl_04_does_not_fire_on_watertight_multi_component_wheel(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """Intentional multi-component assembly — the wheels have 6 and 12
    components. R-STL-04's v1 threshold is gated on non-watertight state
    so these should NOT fire. Documents the deliberate design choice."""
    for fx in (
        "known-good/stl/wheel-back-toy-vehicle.stl",
        "known-good/stl/wheel-front-toy-vehicle.stl",
    ):
        results = scan_one_revision(make_stl_job(fx), mock_supabase, mock_storage)
        assert not any(r.id == "R-STL-04" for r in results.rules), (
            f"{fx} is watertight multi-component — R-STL-04 must not fire"
        )


def test_r_stl_03_is_deferred_in_v1(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """R-STL-03 (self-intersecting) is intentionally unimplemented in v1.
    No fixture should ever emit it until the rule lands + ruleset version
    bumps. This test will start failing if R-STL-03 implementation goes
    in without updating fixtures — caught early rather than in prod."""
    for bucket, kind in (("known-good", "stl"), ("known-broken", "stl"), ("borderline", "stl")):
        for fx in discover_fixtures(bucket, kind):
            results = scan_one_revision(
                make_stl_job(fx.relpath, machine_profile_id=fx.intended_machine),
                mock_supabase,
                mock_storage,
            )
            assert not any(r.id == "R-STL-03" for r in results.rules), (
                f"R-STL-03 fired on {fx.relpath} but rule is deferred — bump "
                f"STL_RULESET_VERSION and update docs before shipping this rule."
            )
