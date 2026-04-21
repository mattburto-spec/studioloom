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
"""

STL_RULESET_VERSION = "stl-v1.0.0"

# Combined version label stored on fabrication_jobs.scan_ruleset_version.
# Phase 2B will extend this to "stl-v1.0.0+svg-v1.0.0".
SCAN_RULESET_VERSION = STL_RULESET_VERSION
