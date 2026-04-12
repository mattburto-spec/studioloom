/**
 * render-helpers — criterion tag rendering for student/teacher render paths.
 *
 * Pure, side-effect-free module that absorbs the 3 criterion-tag input shapes
 * render sites see in the wild:
 *
 *   1. Neutral keys (post-5.2 Stage 4 output, e.g. "researching", "analysing")
 *      → delegate to 5.9 toLabel(neutralKey, framework).
 *   2. Framework-native shorts ("AO1", "A", "Design", …)
 *      → reverse lookup via getCriterionLabels(framework).
 *   3. Legacy MYP letters ("A"/"B"/"C"/"D") on a non-MYP framework
 *      → soft passthrough with a deduped console.warn per (framework, tag) pair.
 *
 * Unknown tags return {kind:"unknown", tag} — soft-fail, matches 5.9 fromLabel's
 * `[]` sentinel precedent. Render sites decide whether to show a grey "?" pill
 * or suppress entirely.
 *
 * Shape-detection order matters: IB_MYP "A" MUST resolve as shape 2 (native short)
 * before shape 3 fires, so live MYP units never trigger the legacy warn.
 *
 * See 5.10.2 pre-flight decisions Q1–Q5 for rationale on color delegation,
 * unknown fallback, dedupe reset, test scope, and shape-detection order.
 */

import {
  toLabel,
  getCriterionLabels,
  type CriterionLabelResult,
  type FrameworkId,
  NEUTRAL_CRITERION_KEYS,
  type NeutralCriterionKey,
} from "./adapter";
import { getCriterionDisplay } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────

/**
 * Widened union — 5.9's CriterionLabelResult plus an "unknown" sentinel so the
 * helper can absorb dirty data without throwing. Render sites discriminate on
 * `kind` and decide grey-pill vs suppression.
 */
export type RenderedCriterion =
  | CriterionLabelResult
  | { kind: "unknown"; tag: string };

// ─── Module state (dedupe for shape-3 warn) ───────────────────────────────

const LEGACY_MYP_LETTERS = new Set(["A", "B", "C", "D"]);
const _warnedLegacyTags = new Set<string>();

/** Dev-only test hook — clears the dedupe set between test cases. */
export function __resetWarnedLegacyTags(): void {
  _warnedLegacyTags.clear();
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function isNeutralKey(s: string): s is NeutralCriterionKey {
  return (NEUTRAL_CRITERION_KEYS as readonly string[]).includes(s);
}

// ─── API ──────────────────────────────────────────────────────────────────

/**
 * Render a criterion tag into a display label within the given framework.
 * Handles the 3 input shapes documented at the top of this file. Unknown tags
 * are returned as {kind:"unknown", tag} rather than throwing — render sites
 * absorb dirtiness, they don't propagate it.
 */
export function renderCriterionLabel(
  tag: string,
  framework: FrameworkId,
): RenderedCriterion {
  // Shape 1: neutral key → delegate to 5.9 adapter (authoritative).
  if (isNeutralKey(tag)) {
    return toLabel(tag, framework);
  }

  // Shape 2: framework-native short → reverse lookup on criteria array.
  const defs = getCriterionLabels(framework);
  const hit = defs.find((d) => d.short === tag);
  if (hit) {
    return { kind: "label", short: hit.short, full: hit.full, name: hit.name };
  }

  // Shape 3: legacy MYP letter on non-MYP framework → passthrough + warn once.
  if (LEGACY_MYP_LETTERS.has(tag) && framework !== "IB_MYP") {
    const warnKey = `${framework}:${tag}`;
    if (!_warnedLegacyTags.has(warnKey)) {
      _warnedLegacyTags.add(warnKey);
      console.warn(
        `[render-helpers] Legacy MYP letter "${tag}" on framework ${framework} — migrate tag to a neutral key or framework-native short.`,
      );
    }
    return { kind: "label", short: tag, full: tag, name: `Criterion ${tag}` };
  }

  return { kind: "unknown", tag };
}

/**
 * Color for a criterion short within a framework. Thin wrapper over
 * constants.ts:getCriterionDisplay — delegates the 3-way fallback
 * (framework → unitType → MYP → grey #6B7280).
 *
 * Note: getCriterionDisplay's signature is (key, unitType?, framework?) —
 * this wrapper swaps to (short, framework, unitType?) to match what render
 * sites actually pass. The swap is at the call site below, not a bug.
 */
export function getCriterionColor(
  short: string,
  framework: FrameworkId,
  unitType?: string,
): string {
  return getCriterionDisplay(short, unitType, framework).color;
}

// ─── Chip collection (5.10.3) ─────────────────────────────────────────────

/**
 * React-renderable chip produced by collectCriterionChips. Carries a stable
 * `key` for React reconciliation plus a discriminated payload matching
 * RenderedCriterion's shape.
 */
export type CriterionChip =
  | { key: string; kind: "label"; short: string; full: string; name: string }
  | {
      key: string;
      kind: "implicit";
      short: string;
      full: string;
      name: string;
      note: string;
    }
  | { key: string; kind: "not_assessed" }
  | { key: string; kind: "unknown"; tag: string };

/**
 * Flatten a set of sections into a deduplicated, framework-aware chip list
 * for badge rendering at the top of a lesson/page.
 *
 * Partition dedup rule (5.10.3 Q1):
 *   - labels + implicits dedupe by resolved `short` (first-occurrence wins).
 *     Cross-neutral-key collisions (e.g. GCSE "designing" + "creating" both →
 *     AO2) collapse to one chip — this is a behavior change from the old
 *     `.flatMap().filter()` pipeline which deduped on the neutral-key string.
 *   - not_assessed + unknown chips pass through individually with indexed
 *     keys and are appended AFTER labelLike, preserving the "known first,
 *     unknown after" visual order.
 *
 * Structural input typing (`{ criterionTags?: string[] }`) deliberately loose
 * so call sites can pass `ActivitySection[]` without cast.
 */
export function collectCriterionChips(
  sections: ReadonlyArray<{ criterionTags?: string[] }>,
  framework: FrameworkId,
): CriterionChip[] {
  const labelLike: CriterionChip[] = [];
  const other: CriterionChip[] = [];
  const seenShorts = new Set<string>();
  let unknownIdx = 0;
  let notAssessedIdx = 0;

  for (const section of sections) {
    for (const tag of section.criterionTags || []) {
      const result = renderCriterionLabel(tag, framework);
      if (result.kind === "label") {
        if (seenShorts.has(result.short)) continue;
        seenShorts.add(result.short);
        labelLike.push({
          key: result.short,
          kind: "label",
          short: result.short,
          full: result.full,
          name: result.name,
        });
      } else if (result.kind === "implicit") {
        if (seenShorts.has(result.short)) continue;
        seenShorts.add(result.short);
        labelLike.push({
          key: result.short,
          kind: "implicit",
          short: result.short,
          full: result.full,
          name: result.name,
          note: result.note,
        });
      } else if (result.kind === "not_assessed") {
        other.push({
          key: `not_assessed:${notAssessedIdx++}`,
          kind: "not_assessed",
        });
      } else {
        other.push({
          key: `unknown:${unknownIdx++}:${result.tag}`,
          kind: "unknown",
          tag: result.tag,
        });
      }
    }
  }

  return [...labelLike, ...other];
}
