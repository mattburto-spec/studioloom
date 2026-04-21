"""Fixture-driven tests for STL machine fit rules (R-STL-06..08).

Same pattern as test_rules_stl_geometry.py — parametrize over fixtures,
filter triggers_rules to the R-STL-06..08 group, assert exact match.
"""

from __future__ import annotations

import pytest
from conftest import FixtureSpec, MockStorage, MockSupabase, discover_fixtures, make_stl_job

from worker.scan_runner import scan_one_revision

MACHINE_FIT_RULE_IDS = {"R-STL-06", "R-STL-07", "R-STL-08"}


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
def test_known_good_stl_fires_no_machine_fit_rules(
    fixture: FixtureSpec, mock_supabase: MockSupabase, mock_storage: MockStorage
):
    results = _scan(fixture, mock_supabase, mock_storage)
    fired = [r.id for r in results.rules if r.id in MACHINE_FIT_RULE_IDS]
    assert fired == [], f"{fixture.relpath} known-good but triggered {fired}"


# --- known-broken: must fire exactly the sidecar-declared machine-fit set ---

KNOWN_BROKEN_STL = discover_fixtures("known-broken", "stl")


@pytest.mark.parametrize(
    "fixture",
    KNOWN_BROKEN_STL,
    ids=[f.relpath for f in KNOWN_BROKEN_STL],
)
def test_known_broken_stl_fires_exactly_declared_machine_fit_rules(
    fixture: FixtureSpec, mock_supabase: MockSupabase, mock_storage: MockStorage
):
    expected_in_group = {r for r in fixture.triggers_rules if r in MACHINE_FIT_RULE_IDS}

    results = _scan(fixture, mock_supabase, mock_storage)
    fired_in_group = {r.id for r in results.rules if r.id in MACHINE_FIT_RULE_IDS}

    missing = expected_in_group - fired_in_group
    assert not missing, (
        f"{fixture.relpath} sidecar declares {sorted(expected_in_group)} but "
        f"only {sorted(fired_in_group)} fired — missing {sorted(missing)}"
    )
    unexpected = fired_in_group - expected_in_group
    assert not unexpected, (
        f"{fixture.relpath} sidecar does NOT declare {sorted(unexpected)} but "
        f"the rule fired. Update sidecar or rule logic."
    )


# --- bespoke assertions on the authored machine-fit fixtures ---------------

def test_r_stl_06_evidence_names_violating_axes(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """mount-bracket-oversized is 650×300×175 mm on a 256×256×256 bed —
    X and Y exceed, Z fits. Evidence should list both violating axes."""
    results = scan_one_revision(
        make_stl_job("known-broken/stl/mount-bracket-oversized.stl"),
        mock_supabase,
        mock_storage,
    )
    rule = next((r for r in results.rules if r.id == "R-STL-06"), None)
    assert rule is not None
    violations_text = " ".join(rule.evidence["violations"])
    assert "X:" in violations_text
    assert "Y:" in violations_text
    assert "Z:" not in violations_text  # 175 fits in 256


def test_r_stl_07_does_not_fire_at_v1_threshold_on_inch_mistake_pawn(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """The authored chess-pawn-inch-mistake has diagonal ~1481 mm — below
    the v1 R-STL-07 threshold of 2000 mm. Documents the threshold gap
    and catches regressions if the threshold is tightened without an
    accompanying ruleset version bump."""
    results = scan_one_revision(
        make_stl_job("known-broken/stl/chess-pawn-inch-mistake.stl"),
        mock_supabase,
        mock_storage,
    )
    assert not any(r.id == "R-STL-07" for r in results.rules)


def test_r_stl_08_evidence_includes_time_estimate_and_ceiling(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """mount-bracket-oversized fires R-STL-08 because its scaled volume
    massively exceeds the 120-min lab ceiling. Evidence should carry
    both numbers so the student UI can render a clear compare."""
    results = scan_one_revision(
        make_stl_job("known-broken/stl/mount-bracket-oversized.stl"),
        mock_supabase,
        mock_storage,
    )
    rule = next((r for r in results.rules if r.id == "R-STL-08"), None)
    assert rule is not None
    assert rule.evidence["max_print_time_min"] == 120
    assert rule.evidence["estimated_minutes"] > 120


def test_r_stl_08_does_not_fire_when_profile_has_no_ceiling(
    mock_supabase: MockSupabase, mock_storage: MockStorage
):
    """A profile with max_print_time_min=None should skip R-STL-08
    entirely — labs without a ceiling shouldn't get spurious warnings."""
    mock_supabase.machine_profiles["bambu_x1c"] = {
        **mock_supabase.machine_profiles["bambu_x1c"],
        "max_print_time_min": None,
    }
    results = scan_one_revision(
        make_stl_job("known-broken/stl/mount-bracket-oversized.stl"),
        mock_supabase,
        mock_storage,
    )
    assert not any(r.id == "R-STL-08" for r in results.rules)
    # R-STL-06 still fires because the bed is a physical fact regardless
    # of time ceiling config.
    assert any(r.id == "R-STL-06" for r in results.rules)
