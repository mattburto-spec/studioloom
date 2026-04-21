#!/usr/bin/env python3
"""Sandbox CLI — run a scan against a local fixture without hitting Supabase.

Usage:
  python scripts/sandbox.py known-good/stl/small-cube-25mm.stl
  python scripts/sandbox.py known-broken/stl/seahorse-not-watertight.stl \\
    --machine glowforge_plus

Prints the scan_results JSON to stdout so rules can be developed in-loop
without deploying. Intentionally does NOT touch Supabase or Storage —
it loads fixtures directly from the repo.

Phase 2A-1: emits an empty rules list. Subsequent phases fill it in.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Let the sandbox run straight from `python scripts/sandbox.py` without needing
# the package installed — add fab-scanner/src to sys.path.
SCRIPT_DIR = Path(__file__).resolve().parent
SRC_DIR = SCRIPT_DIR.parent / "src"
sys.path.insert(0, str(SRC_DIR))

# Import after sys.path mutation.
from schemas.scan_results import ScanResults  # noqa: E402
from worker.scan_runner import scan_one_revision  # noqa: E402
from worker.supabase_client import ClaimedJob  # noqa: E402

# Pull the conftest helpers by adding tests/ to sys.path too — they're the
# canonical in-memory mocks.
sys.path.insert(0, str(SCRIPT_DIR.parent / "tests"))
from conftest import MockStorage, MockSupabase  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "fixture_relpath",
        help="Path relative to docs/projects/fabrication/fixtures/",
    )
    parser.add_argument(
        "--machine",
        default="bambu_x1c",
        help="Machine profile ID to scan against (default: bambu_x1c)",
    )
    args = parser.parse_args()

    supabase = MockSupabase()
    # Seed both standard machine profiles so either can be named.
    supabase.machine_profiles.update(
        {
            "bambu_x1c": {
                "id": "bambu_x1c",
                "name": "Bambu X1C",
                "machine_category": "3d_printer",
                "bed_size_x_mm": 256,
                "bed_size_y_mm": 256,
                "bed_size_z_mm": 256,
                "nozzle_diameter_mm": 0.4,
                "kerf_mm": None,
                "operation_color_map": None,
                "rule_overrides": None,
            },
            "glowforge_plus": {
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
            },
        }
    )
    storage = MockStorage()

    file_type = Path(args.fixture_relpath).suffix.lstrip(".").lower()
    job = ClaimedJob(
        scan_job_id="sandbox-job",
        job_id="sandbox-job-logical",
        job_revision_id="sandbox-rev",
        storage_path=args.fixture_relpath,
        file_type=file_type,
        machine_profile_id=args.machine,
    )

    results: ScanResults = scan_one_revision(job, supabase, storage)
    print(json.dumps(results.model_dump(mode="json"), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
