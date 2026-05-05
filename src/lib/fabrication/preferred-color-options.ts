/**
 * Preferred-color dropdown options for student 3D-printer submissions.
 *
 * Phase 8.1d-COLORv1 (4 May 2026): hardcoded list of common
 * school-makerspace filament colors. Students pick one or use the
 * "Other (specify)" escape hatch which reveals a free-text input.
 *
 * Stored as plain text on `fabrication_jobs.preferred_color` so the
 * fab tech can read whatever the student typed. No enum constraint.
 *
 * v2 (deferred — see FU-COLOR-PREFERENCE v2 path) will move this
 * list into `machine_profiles.available_colors` so a fab can
 * advertise only what's actually loaded on each machine + the
 * student picker filters by selected machine.
 *
 * Rules of the road:
 *   - Add a new option here, NOT in a per-component switch
 *   - "No preference" stays first as the default
 *   - "Other (specify)" stays last as the escape hatch
 *   - Keep labels under ~30 chars so the dropdown doesn't wrap
 *   - PETG / TPU / specialty filaments are intentionally minimal —
 *     most school stocks are 90% PLA, the long tail goes through
 *     "Other (specify)"
 */

export const PREFERRED_COLOR_NO_PREFERENCE = "No preference" as const;
export const PREFERRED_COLOR_OTHER_SENTINEL = "__other__" as const;

export interface PreferredColorOption {
  /** Stored value (also the dropdown <option> value). */
  value: string;
  /** Visible dropdown label. */
  label: string;
}

/** Hardcoded v1 list. Order matters — first is default, last is the escape hatch. */
export const PREFERRED_COLOR_OPTIONS: ReadonlyArray<PreferredColorOption> = [
  { value: PREFERRED_COLOR_NO_PREFERENCE, label: "No preference" },
  { value: "PLA — Black", label: "PLA — Black" },
  { value: "PLA — White", label: "PLA — White" },
  { value: "PLA — Grey", label: "PLA — Grey" },
  { value: "PLA — Red", label: "PLA — Red" },
  { value: "PLA — Blue", label: "PLA — Blue" },
  { value: "PLA — Green", label: "PLA — Green" },
  { value: "PLA — Yellow", label: "PLA — Yellow" },
  { value: "PLA — Orange", label: "PLA — Orange" },
  { value: "PLA — Purple", label: "PLA — Purple" },
  { value: "PLA — Wood", label: "PLA — Wood" },
  { value: "PLA — Glow / Translucent", label: "PLA — Glow / Translucent" },
  { value: "PETG — Clear", label: "PETG — Clear" },
  // Sentinel — UI reveals a free-text input when this is selected,
  // and the resolved value sent to the server is the user's typed
  // string (with an "Other: " prefix for fab readability).
  { value: PREFERRED_COLOR_OTHER_SENTINEL, label: "Other (specify)…" },
];

/** Max chars accepted by the orchestration layer. UI should also enforce. */
export const PREFERRED_COLOR_MAX_LEN = 60;

/**
 * Validate + normalise a preferred-color string from the wire.
 *
 * Accepts:
 *   - null / undefined / "" → null (no preference, treated as "no
 *     preference selected")
 *   - "No preference" → null (canonicalise — saves a join later)
 *   - any other string ≤ 60 chars → trimmed
 *
 * Rejects:
 *   - non-string, > 60 chars
 *
 * Returns the normalised value OR an error object.
 */
export function validatePreferredColor(
  raw: unknown
): { value: string | null } | { error: { status: number; message: string } } {
  if (raw === null || raw === undefined) return { value: null };
  if (typeof raw !== "string") {
    return {
      error: {
        status: 400,
        message: "`preferredColor` must be a string or null.",
      },
    };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { value: null };
  if (trimmed === PREFERRED_COLOR_NO_PREFERENCE) return { value: null };
  if (trimmed === PREFERRED_COLOR_OTHER_SENTINEL) {
    // Pure sentinel without a free-text payload should never reach
    // the server — UI replaces it before submit. Treat as null
    // defensively rather than storing the sentinel string.
    return { value: null };
  }
  if (trimmed.length > PREFERRED_COLOR_MAX_LEN) {
    return {
      error: {
        status: 400,
        message: `\`preferredColor\` must be ${PREFERRED_COLOR_MAX_LEN} characters or fewer (got ${trimmed.length}).`,
      },
    };
  }
  return { value: trimmed };
}

/**
 * Resolve a UI-side selection to the wire value.
 *
 *   resolveColorChoice("No preference", "")     → null
 *   resolveColorChoice("PLA — Black", "")        → "PLA — Black"
 *   resolveColorChoice("__other__", "neon pink") → "Other: neon pink"
 *   resolveColorChoice("__other__", "")          → null  (escape hatch but no payload)
 *
 * Lives in the lib (not the component) so route tests can exercise
 * the same translation logic without rendering the form.
 */
export function resolveColorChoice(
  selectedValue: string,
  freeTextWhenOther: string
): string | null {
  if (selectedValue === PREFERRED_COLOR_NO_PREFERENCE) return null;
  if (selectedValue === PREFERRED_COLOR_OTHER_SENTINEL) {
    const trimmed = freeTextWhenOther.trim();
    if (trimmed.length === 0) return null;
    // Prefix with "Other: " so the fab can tell at a glance the
    // student went off-list. Length budget after prefix: 53 chars
    // — the form should warn but the orchestration's 60-char cap
    // is the hard gate.
    return `Other: ${trimmed}`.slice(0, PREFERRED_COLOR_MAX_LEN);
  }
  return selectedValue;
}
