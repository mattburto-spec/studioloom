# Preflight Scanner — Python Worker

Deterministic STL + SVG validator for student fabrication submissions. Runs
on Fly.io, polls `fabrication_scan_jobs` in the StudioLoom Supabase, writes
structured results + thumbnails back.

**Status:** Phase 2A-1 (scaffold) — scanner walks end-to-end with an empty
rule catalogue. Rules arrive in 2A-2 through 2A-5. Fly deploy at 2A-6.

**Spec:** `../docs/projects/fabrication-pipeline.md` §5 (STL rules),
§6 (SVG rules), §12 (worker infra).
**Phase brief:** `../docs/projects/preflight-phase-2a-brief.md`.

## Layout

```
fab-scanner/
  src/
    worker/         poll loop, Supabase + Storage clients, scan dispatcher
    rules/stl/      R-STL-01..17 (Phase 2A-2..2A-5)
    rules/svg/      R-SVG-01..15 (Phase 2B)
    schemas/        ruleset version + scan_results Pydantic models
  tests/            pytest — every rule tested against bucketed fixtures
  scripts/
    sandbox.py      CLI: scan a fixture locally, print JSON
  Dockerfile        Python 3.11 multi-stage, Agg matplotlib
  pyproject.toml    dep ranges, source of truth
  requirements.txt  pinned deps for the Fly builder
```

## Local development

```bash
# Create venv (ignored by git)
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e ".[dev]"

# Run tests
pytest

# Sandbox — scan a fixture directly, no Supabase needed
python scripts/sandbox.py known-good/stl/small-cube-25mm.stl
python scripts/sandbox.py known-broken/stl/seahorse-not-watertight.stl --machine bambu_x1c
```

## Fly.io deploy (Phase 2A-6, not yet)

```bash
# From fab-scanner/ directory
fly launch --no-deploy            # creates preflight-scanner app + fly.toml
fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
fly deploy
```

Single-instance, SYD region, hobby tier `shared-cpu-1x@256MB` (~$5/mo, free
during active trial). Upgrade to 512MB if OOM on large student STLs.

## Adding a rule

1. Pick the right module: `rules/stl/{geometry_integrity, machine_fit,
   printability, informational}.py`.
2. Implement as a standalone function returning `list[RuleResult]`.
3. Add a `list[RuleResult]` test in `tests/test_rules_stl_*.py` against at
   least one known-good fixture (assert rule DOES NOT fire) and one
   known-broken fixture listed in `triggers_rules:` on a sidecar (assert
   rule DOES fire with expected evidence values, per Lesson #38).
4. Bump `schemas/ruleset_version.py` if the change affects behaviour.

Each rule's `version` field on `RuleResult` is the ruleset version at
emission time — stored on every scan so teachers can answer "why did my
file pass last week and fail this week?"

## Observability

All scans log as structured JSON to stdout (Fly.io log ingest). Key events:

- `worker.starting` — startup with poll interval, dry-run flag
- `scan.claimed` — job pulled from queue
- `scan.done` — rules fired count, duration, highest severity
- `scan.error` — exception during scan; worker continues

Query in Fly logs with: `fly logs --app preflight-scanner | grep scan.`
