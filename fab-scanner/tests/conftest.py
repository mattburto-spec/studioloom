"""Pytest fixtures + in-memory mocks for Supabase and Storage.

These two mocks underpin every rule test 2A-2 onwards. Rule tests claim
a ClaimedJob pointing at a real file under docs/projects/fabrication/
fixtures/, run scan_one_revision, and assert the RuleResult list matches
the fixture's .meta.yaml sidecar.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pytest
import yaml  # type: ignore

from worker.supabase_client import ClaimedJob, StudentForEmail

# Resolved at import time: …/questerra/docs/projects/fabrication/fixtures/
REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES_DIR = REPO_ROOT / "docs" / "projects" / "fabrication" / "fixtures"


@dataclass(frozen=True)
class FixtureSpec:
    """One bucketed fixture + its sidecar metadata. Produced by discovery
    helpers and fed into pytest.mark.parametrize."""

    relpath: str  # e.g. "known-good/stl/small-cube-25mm.stl"
    bucket: str  # "known-good" | "known-broken" | "borderline"
    kind: str  # "stl" | "svg"
    intended_machine: str
    expected_result: str  # "pass" | "warn" | "block"
    triggers_rules: tuple[str, ...]

    @property
    def id_for_parametrize(self) -> str:
        return self.relpath


def _load_sidecar(fixture_path: Path) -> dict[str, Any]:
    sidecar = fixture_path.parent / f"{fixture_path.stem}.meta.yaml"
    if not sidecar.exists():
        raise FileNotFoundError(f"missing sidecar for {fixture_path.name}")
    with sidecar.open() as f:
        return yaml.safe_load(f)


def discover_fixtures(bucket: str, kind: str) -> list[FixtureSpec]:
    """Walk a bucket + kind dir, return a FixtureSpec per file.

    Sidecars that fail to parse are raised loudly — tests shouldn't run
    against unparseable metadata.
    """
    base = FIXTURES_DIR / bucket / kind
    specs: list[FixtureSpec] = []
    for f in sorted(base.glob(f"*.{kind}")):
        meta = _load_sidecar(f)
        specs.append(
            FixtureSpec(
                relpath=str(f.relative_to(FIXTURES_DIR)),
                bucket=bucket,
                kind=kind,
                intended_machine=meta["intended_machine"],
                expected_result=meta["expected_result"],
                triggers_rules=tuple(meta.get("triggers_rules") or ()),
            )
        )
    return specs


@dataclass
class MockSupabase:
    """Fakes just enough of the SupabaseClient Protocol for scan_runner tests.

    Callers pre-populate `pending_jobs` + `machine_profiles` and read the
    `writes` list afterwards to assert writeback shape.
    """

    pending_jobs: list[ClaimedJob] = field(default_factory=list)
    machine_profiles: dict[str, dict[str, Any]] = field(default_factory=dict)
    writes: list[dict[str, Any]] = field(default_factory=list)
    students: dict[str, StudentForEmail] = field(default_factory=dict)
    student_lookups: list[str] = field(default_factory=list)

    def claim_next_job(self) -> ClaimedJob | None:
        if not self.pending_jobs:
            return None
        return self.pending_jobs.pop(0)

    def load_machine_profile(self, profile_id: str) -> dict[str, Any]:
        if profile_id not in self.machine_profiles:
            raise KeyError(f"machine profile not seeded in test: {profile_id}")
        return self.machine_profiles[profile_id]

    def load_surrogate_machine_profile(
        self, lab_id: str, machine_category: str
    ) -> dict[str, Any] | None:
        """Phase 8.1d-24 + 8.1d-33: pick the LARGEST-bed seeded
        machine matching (lab_id, machine_category, is_active).
        Mirrors the prod selector in supabase_real.py — tests that
        seed multiple machines in the same lab+category will
        receive the one with the biggest bed area, with name
        tiebreak."""
        candidates = [
            p
            for p in self.machine_profiles.values()
            if p.get("lab_id") == lab_id
            and p.get("machine_category") == machine_category
            and p.get("is_active", True)
        ]
        if not candidates:
            return None
        candidates.sort(
            key=lambda r: (
                -(float(r.get("bed_size_x_mm") or 0)
                  * float(r.get("bed_size_y_mm") or 0)),
                str(r.get("name") or ""),
            )
        )
        return candidates[0]

    def write_scan_results(
        self,
        *,
        job_id: str,
        job_revision_id: str,
        scan_job_id: str,
        scan_results: dict[str, Any],
        ruleset_version: str,
        scan_status: str,
        scan_error: str | None = None,
    ) -> None:
        self.writes.append(
            {
                "job_id": job_id,
                "job_revision_id": job_revision_id,
                "scan_job_id": scan_job_id,
                "scan_results": scan_results,
                "ruleset_version": ruleset_version,
                "scan_status": scan_status,
                "scan_error": scan_error,
            }
        )

    def load_student_for_email(self, student_id: str) -> StudentForEmail | None:
        self.student_lookups.append(student_id)
        return self.students.get(student_id)


@dataclass
class MockStorage:
    """Reads local fixture bytes directly. `download_fixture(storage_path)`
    treats the path as a relative path under fixtures/.
    """

    def download_fixture(self, storage_path: str) -> bytes:
        path = FIXTURES_DIR / storage_path
        if not path.exists():
            raise FileNotFoundError(f"fixture not found: {storage_path}")
        return path.read_bytes()

    def upload_thumbnail(
        self,
        job_revision_id: str,
        png_bytes: bytes,
        content_type: str = "image/png",
    ) -> str:
        # Phase 2A-5 wires the real caller. For now, record and return a
        # deterministic fake path so tests can assert on it.
        return f"fabrication-thumbnails/{job_revision_id}.png"


@pytest.fixture
def mock_supabase() -> MockSupabase:
    """Fresh MockSupabase with the default Bambu X1C machine profile loaded.

    Rule tests add more profiles as needed.
    """
    mock = MockSupabase()
    mock.machine_profiles["bambu_x1c"] = _default_bambu_x1c_profile()
    mock.machine_profiles["glowforge_plus"] = _default_glowforge_plus_profile()
    mock.machine_profiles["generic_large_laser"] = _default_generic_large_laser_profile()
    return mock


@pytest.fixture
def mock_storage() -> MockStorage:
    return MockStorage()


@pytest.fixture
def fixtures_dir() -> Path:
    return FIXTURES_DIR


def _default_bambu_x1c_profile() -> dict[str, Any]:
    """Mirror of the bambu_x1c seed row from migration 093 — only the
    columns rules actually use. Full schema in fabrication-pipeline.md §11.

    max_print_time_min=120 is a reasonable lab-class ceiling (2 hours per
    student job). Seed data in migration 093 may choose a different value
    per school; this is just the test default.
    """
    return {
        "id": "bambu_x1c",
        "name": "Bambu X1C",
        "machine_category": "3d_printer",
        "bed_size_x_mm": 256,
        "bed_size_y_mm": 256,
        "bed_size_z_mm": 256,
        "nozzle_diameter_mm": 0.4,
        "kerf_mm": None,
        "operation_color_map": None,
        "max_print_time_min": 120,
        "rule_overrides": None,
    }


def _default_glowforge_plus_profile() -> dict[str, Any]:
    return {
        "id": "glowforge_plus",
        "name": "Glowforge Plus",
        "machine_category": "laser_cutter",
        "bed_size_x_mm": 495,
        "bed_size_y_mm": 279,
        "bed_size_z_mm": None,
        "nozzle_diameter_mm": None,
        "kerf_mm": 0.2,
        "operation_color_map": {
            "#ff0000": "cut",
            "#0000ff": "score",
            "#000000": "engrave",
        },
        "rule_overrides": None,
    }


def _default_generic_large_laser_profile() -> dict[str, Any]:
    """600×500mm bed — big enough to fit every known-good SVG fixture
    regardless of whether its sidecar's intended_machine is internally
    consistent. Used by tests that need known-good SVG throughput without
    being derailed by FU-SVG-FIXTURE-MACHINE-MISMATCH (the corpus includes
    A3-portrait and 466×383 fixtures that don't fit a real Glowforge Plus).
    """
    return {
        "id": "generic_large_laser",
        "name": "Generic Large Laser (test-only)",
        "machine_category": "laser_cutter",
        "bed_size_x_mm": 600,
        "bed_size_y_mm": 500,
        "bed_size_z_mm": None,
        "nozzle_diameter_mm": None,
        "kerf_mm": 0.2,
        "operation_color_map": {
            "#ff0000": "cut",
            "#0000ff": "score",
            "#000000": "engrave",
        },
        "rule_overrides": None,
    }


def make_stl_job(
    fixture_relpath: str,
    machine_profile_id: str | None = "bambu_x1c",
    scan_job_id: str = "scan-job-test-1",
    job_id: str = "job-test-1",
    job_revision_id: str = "rev-test-1",
    student_id: str = "student-test-1",
    lab_id: str = "lab-test-1",
    machine_category: str = "3d_printer",
) -> ClaimedJob:
    """Build a ClaimedJob pointing at a fixture under fixtures/.

    Phase 8.1d-24: machine_profile_id is now nullable (pass None to
    exercise the surrogate-machine fallback path). lab_id +
    machine_category required either way — they came along on the
    RPC return shape from migration 123.
    """
    return ClaimedJob(
        scan_job_id=scan_job_id,
        job_id=job_id,
        job_revision_id=job_revision_id,
        storage_path=fixture_relpath,
        file_type="stl",
        machine_profile_id=machine_profile_id,
        lab_id=lab_id,
        machine_category=machine_category,
        student_id=student_id,
    )
