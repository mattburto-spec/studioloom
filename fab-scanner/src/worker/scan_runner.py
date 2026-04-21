"""Scan dispatcher — end-to-end glue between job claim and results writeback.

Phase 2A-1 implements the plumbing with an empty rule catalogue. Each
subsequent sub-phase fills in one rule group:
  2A-2 — geometry integrity (R-STL-01..05)
  2A-3 — machine fit (R-STL-06..08)
  2A-4 — printability (R-STL-09..14)
  2A-5 — informational (R-STL-15..17) + thumbnail rendering
"""

from __future__ import annotations

import io
import time

import structlog
import trimesh  # type: ignore

from rules.common import MachineProfile, RuleResult
from rules.stl.geometry_integrity import run_geometry_integrity_rules
from rules.stl.informational import run_informational_rules
from rules.stl.machine_fit import run_machine_fit_rules
from rules.stl.printability import run_printability_rules
from schemas.ruleset_version import SCAN_RULESET_VERSION
from schemas.scan_results import ScanResults
from worker.storage import StorageClient
from worker.supabase_client import ClaimedJob, SupabaseClient
from worker.thumbnail import safe_render

log = structlog.get_logger(__name__)


def _machine_profile_from_dict(row: dict) -> MachineProfile:
    """Map a Supabase row dict to the frozen MachineProfile dataclass.

    Only the fields rules actually consume are extracted — extras dropped.
    """
    return MachineProfile(
        id=row["id"],
        name=row["name"],
        machine_category=row["machine_category"],
        bed_size_x_mm=float(row["bed_size_x_mm"]),
        bed_size_y_mm=float(row["bed_size_y_mm"]),
        bed_size_z_mm=(
            float(row["bed_size_z_mm"]) if row.get("bed_size_z_mm") is not None else None
        ),
        nozzle_diameter_mm=(
            float(row["nozzle_diameter_mm"])
            if row.get("nozzle_diameter_mm") is not None
            else None
        ),
        kerf_mm=float(row["kerf_mm"]) if row.get("kerf_mm") is not None else None,
        operation_color_map=row.get("operation_color_map"),
        max_print_time_min=(
            int(row["max_print_time_min"]) if row.get("max_print_time_min") is not None else None
        ),
        rule_overrides=row.get("rule_overrides"),
    )


def _load_stl_mesh(data: bytes) -> trimesh.Trimesh:
    """Load an STL byte-blob and return a processed single-mesh.

    We call merge_vertices after load because is_watertight / components
    / winding checks require shared-edge identity that STL's face-soup
    format doesn't carry. Not a repair pass — two vertices at identical
    coordinates are structurally the same point.
    """
    mesh = trimesh.load(io.BytesIO(data), file_type="stl", process=False)
    if isinstance(mesh, trimesh.Scene):
        geoms = [g for g in mesh.geometry.values() if isinstance(g, trimesh.Trimesh)]
        if not geoms:
            raise ValueError("empty STL scene")
        mesh = geoms[0] if len(geoms) == 1 else trimesh.util.concatenate(geoms)
    if not isinstance(mesh, trimesh.Trimesh):
        raise ValueError(f"unexpected mesh type: {type(mesh).__name__}")
    mesh.merge_vertices()
    return mesh


def _run_all_stl_rules(
    mesh: trimesh.Trimesh, profile: MachineProfile
) -> list[RuleResult]:
    """Dispatcher — concatenates every STL rule group's output.

    Order is stable (integrity → fit → printability → informational) so
    the UI can render rules in a predictable bucket order.
    """
    results: list[RuleResult] = []
    results.extend(run_geometry_integrity_rules(mesh, profile))
    results.extend(run_machine_fit_rules(mesh, profile))
    results.extend(run_printability_rules(mesh, profile))
    results.extend(run_informational_rules(mesh, profile))
    return results


def scan_one_revision(
    job: ClaimedJob,
    supabase: SupabaseClient,
    storage: StorageClient,
) -> ScanResults:
    """Execute one scan end-to-end. Returns the populated ScanResults.

    Caller is responsible for writeback — see process_one_job().
    """
    started = time.monotonic()
    profile = _machine_profile_from_dict(
        supabase.load_machine_profile(job.machine_profile_id)
    )
    data = storage.download_fixture(job.storage_path)

    thumbnail_path: str | None = None

    if job.file_type == "stl":
        mesh = _load_stl_mesh(data)
        rules = _run_all_stl_rules(mesh, profile)
        # Thumbnail rendering is best-effort — a failed render must not
        # fail the scan. safe_render returns None on any exception.
        png = safe_render(mesh)
        if png is not None:
            try:
                thumbnail_path = storage.upload_thumbnail(job.job_revision_id, png)
            except Exception:
                log.warning(
                    "thumbnail.upload_failed",
                    scan_job_id=job.scan_job_id,
                    job_revision_id=job.job_revision_id,
                )
    elif job.file_type == "svg":
        # Phase 2B populates rules + cairo thumbnail.
        rules = []
    else:
        raise ValueError(f"unsupported file_type: {job.file_type}")

    duration_ms = int((time.monotonic() - started) * 1000)
    return ScanResults(
        rules=rules,
        ruleset_version=SCAN_RULESET_VERSION,
        scan_duration_ms=duration_ms,
        thumbnail_path=thumbnail_path,
    )


def process_one_job(
    supabase: SupabaseClient,
    storage: StorageClient,
) -> bool:
    """Claim + scan + writeback one job. Returns True when work was done.

    Returns False when the queue was empty (caller sleeps and retries).
    """
    job = supabase.claim_next_job()
    if job is None:
        return False

    log.info("scan.claimed", scan_job_id=job.scan_job_id, job_id=job.job_id)

    try:
        results = scan_one_revision(job, supabase, storage)
    except Exception as e:
        log.exception("scan.error", scan_job_id=job.scan_job_id)
        supabase.write_scan_results(
            job_id=job.job_id,
            job_revision_id=job.job_revision_id,
            scan_job_id=job.scan_job_id,
            scan_results={},
            ruleset_version=SCAN_RULESET_VERSION,
            scan_status="error",
            scan_error=f"{type(e).__name__}: {e}",
        )
        return True

    supabase.write_scan_results(
        job_id=job.job_id,
        job_revision_id=job.job_revision_id,
        scan_job_id=job.scan_job_id,
        scan_results=results.model_dump(mode="json"),
        ruleset_version=results.ruleset_version,
        scan_status="done",
    )
    log.info(
        "scan.done",
        scan_job_id=job.scan_job_id,
        rules_fired=len(results.rules),
        duration_ms=results.scan_duration_ms,
        highest_severity=str(results.highest_severity()),
    )
    return True
