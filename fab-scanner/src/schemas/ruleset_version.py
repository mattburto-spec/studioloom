"""Ruleset version constant.

Bumped semver-style whenever a rule's threshold or behaviour changes.
Stored on every scan result so teachers can answer "why did my file pass
last week and fail this week?"

Version bump policy (from docs/projects/preflight-phase-2a-brief.md §8):
  PATCH  — rule explanation text tweak, no behaviour change
  MINOR  — rule threshold LOOSENED (fewer files fail) OR new rule added
  MAJOR  — rule threshold TIGHTENED OR rule removed

History:
  2026-04-21  stl-v1.0.0  Phase 2A launch — 17 STL rules implemented.
                          Initial thresholds per fabrication-pipeline.md §5.
  2026-04-21  svg-v1.0.0  Phase 2B-1 — SVG scaffold + dispatch wiring.
                          Rule catalogue filled in sub-phases 2B-2..2B-6.
                          Combined tag stl-v1.0.0+svg-v1.0.0 stored on
                          every scan result.
  2026-04-26  stl-v1.0.1  Phase 8.1d-18 — R-STL-13 fix-hint copy update.
                          No behaviour change. Reorders advice so
                          orientation (proper fix) leads brim (workaround),
                          and names the auto-orient button per slicer
                          (Bambu Studio / OrcaSlicer / PrusaSlicer / Cura).
                          PATCH bump per the policy above.

Pending audit:
  Phase 8.1d-12 changed R-SVG-01 from artboard-based to content-bbox-
  based — a behaviour change that should have triggered an SVG MINOR
  bump (svg-v1.1.0). Shipped without one. File `FU-RULESET-VERSION-
  AUDIT` to back-fill the bump on the next clean cut so prod scan
  results tagged `svg-v1.0.0` after 8.1d-12 are explicitly logged as
  historical.
"""

STL_RULESET_VERSION = "stl-v1.0.1"
SVG_RULESET_VERSION = "svg-v1.0.0"

# Combined version label stored on fabrication_jobs.scan_ruleset_version.
# Teachers can answer "what ruleset saw this file?" with one string.
SCAN_RULESET_VERSION = f"{STL_RULESET_VERSION}+{SVG_RULESET_VERSION}"
