/**
 * Preflight Pilot Mode flag — single source of truth.
 *
 * During the early Preflight pilot, the scanner can false-positive a
 * fine model into a BLOCK-severity rule and trap the student in a
 * re-upload loop with no escape. Pilot Mode lets the student override
 * blocking rules with a strong-warning explicit-acknowledge UX.
 *
 * When this flips to `false`:
 *   - canSubmit() returns the pre-pilot behaviour: BLOCK rules force
 *     re-upload, no override path is offered.
 *   - The student-facing override CTA disappears (server enforces).
 *   - Existing jobs with pilot_override_at NOT NULL keep their
 *     historical record — the column is not retroactively cleared.
 *
 * Flip when:
 *   - We have ≥ 100 real student submissions through the scanner.
 *   - The /admin/preflight/flagged dev surface shows < 5% override
 *     rate AND zero "wrongly flagged a clean file" stories.
 *   - The ruleset has been tuned based on the override_rule_ids
 *     histogram.
 *
 * v1: hardcoded boolean. v2 (deferred) could promote to a feature
 * flag in admin_settings if multiple schools land on this codepath
 * with different pilot windows.
 */
export const PILOT_MODE_ENABLED = true;
