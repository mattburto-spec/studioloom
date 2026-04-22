/**
 * Pure helpers for RuleCard + ScanResultsViewer (Phase 5-3).
 *
 * Split out into a `.ts` sibling so tests can exercise them without
 * importing the `.tsx` component (project has no JSX-aware test
 * transformer — same convention as picker-helpers.ts in Phase 4-3).
 *
 * All functions pure over their inputs. No React imports here.
 */

import type { AckChoice } from "@/lib/fabrication/orchestration";
import type { Severity } from "@/lib/fabrication/rule-buckets";

// ============================================================
// Severity display metadata
// ============================================================

export interface SeverityDisplay {
  label: string; // "Must fix" / "Should fix" / "FYI"
  icon: string; // emoji for quick visual — reviewed for accessibility
  /** Tailwind border + background token pairs. Kept as a single string so
   *  the component can plop them straight into className. */
  tintClass: string;
  /** Badge pill tint — darker variant of the container tint. */
  badgeClass: string;
}

const SEVERITY_DISPLAY: Record<Severity, SeverityDisplay> = {
  block: {
    label: "Must fix",
    icon: "🛑",
    tintClass: "border-red-200 bg-red-50",
    badgeClass: "bg-red-100 text-red-900",
  },
  warn: {
    label: "Should fix",
    icon: "⚠️",
    tintClass: "border-amber-200 bg-amber-50",
    badgeClass: "bg-amber-100 text-amber-900",
  },
  fyi: {
    label: "FYI",
    icon: "ℹ️",
    tintClass: "border-gray-200 bg-gray-50",
    badgeClass: "bg-gray-200 text-gray-800",
  },
};

export function severityDisplay(severity: Severity): SeverityDisplay {
  return SEVERITY_DISPLAY[severity];
}

// ============================================================
// Acknowledgement radio option labels
// ============================================================
//
// The three AckChoice values map to these student-facing labels. Wired
// to the radio group in RuleCard for severity='warn'. Order follows the
// spec §8 mock-up: intentional > will-fix-slicer > acknowledged.

export const ACK_OPTION_LABELS: Record<AckChoice, string> = {
  intentional: "I've checked — this is intentional",
  "will-fix-slicer": "I'll add supports in the slicer",
  acknowledged: "Understood",
};

/**
 * Order in which to render the radio options. Explicit rather than
 * relying on Object.keys traversal order (which is ~insertion-ordered
 * in modern JS but not guaranteed by spec).
 */
export const ACK_OPTION_ORDER: readonly AckChoice[] = [
  "intentional",
  "will-fix-slicer",
  "acknowledged",
] as const;

// ============================================================
// Skills Library deep-link
// ============================================================

/**
 * Deep-link URL builder for Skills Library entries keyed by rule id.
 * Phase 5 ships stubs — the library may not have a card for every rule
 * yet. Route convention confirmed in Phase 5 brief §10 decision 7:
 * `/skills/fab-{ruleId}` (e.g. `/skills/fab-R-STL-03`).
 *
 * Returns null for obviously invalid ids so callers can skip rendering
 * a dead link.
 */
export function skillsLibraryUrl(ruleId: string): string | null {
  if (!ruleId || typeof ruleId !== "string") return null;
  // Rule IDs follow the R-{STL|SVG}-NN convention. Reject junk.
  if (!/^R-[A-Z0-9]+-[A-Z0-9-]+$/i.test(ruleId)) return null;
  return `/skills/fab-${ruleId}`;
}

// ============================================================
// Evidence formatting
// ============================================================

/**
 * Render a short human string for the optional `evidence` field on a
 * rule. Worker emits a JSON object with rule-specific shape (face
 * indices, coordinates, min thickness, etc). For v1 we fall back to a
 * JSON-as-string dump — Phase 5-3 UI shows it in a monospace block.
 *
 * Returns null when evidence is absent so the component can skip the
 * section entirely.
 */
export function formatEvidence(evidence: unknown): string | null {
  if (evidence === null || evidence === undefined) return null;
  if (typeof evidence === "string") return evidence;
  if (typeof evidence === "number" || typeof evidence === "boolean") {
    return String(evidence);
  }
  try {
    const str = JSON.stringify(evidence, null, 2);
    // Collapse trivial empties.
    if (str === "{}" || str === "[]" || str === "null") return null;
    return str;
  } catch {
    return null;
  }
}
