/**
 * Pure-logic adapter for MultiQuestionResponse field normalisation.
 *
 * Lives in a `.ts` sibling per Lesson #71 — pure functions can't be
 * exported from the `.tsx` parent and unit-tested directly under this
 * repo's vitest config (vite chokes on JSX during the import-analysis
 * pass). Extract → import from both `index.tsx` and the test file.
 *
 * Adapter responsibility:
 *   - Accept either the explicit MultiQuestionField[] (storybook /
 *     standalone) OR a StructuredPromptsConfig (production via
 *     ResponseInput → activity block prompts).
 *   - Map StructuredPrompt → MultiQuestionField, resolving target /
 *     max / criterion / sentence starters.
 *
 * Target resolution precedence (highest → lowest):
 *   1. `sp.targetChars`                    — explicit author override
 *   2. `CRITERION_TARGET_DEFAULTS[sp.criterion]` — picks up journal
 *      scaffolds even on blocks created before the targetChars field
 *      existed (Phase C backfill, 13 May 2026)
 *   3. `DEFAULT_TARGET` (80)               — generic fallback
 * Capped by `softCharCap` so we never ask for more than the prompt
 * allows.
 */

import type {
  StructuredPrompt,
  StructuredPromptsConfig,
} from "@/lib/structured-prompts/types";
import type { Criterion, MultiQuestionField } from "./types";

export const DEFAULT_TARGET = 80;
export const DEFAULT_MAX = 800;

/**
 * Per-criterion target defaults — applied when an authored prompt has
 * a `criterion` tag but no explicit `targetChars`. Backfills the
 * scaffolding for journal-shape blocks that were created BEFORE the
 * per-prompt `targetChars` field shipped (13 May 2026), since prompts
 * are snapshotted into the block JSONB at create-time.
 *
 * Targets match the JOURNAL_PROMPTS values in
 * `src/lib/structured-prompts/presets.ts` — keep these in sync.
 *
 * DECIDE is 10 chars higher than DO/NOTICE to give the "because"
 * clause room. NEXT is 10 chars lower because it's just a next-move
 * pointer that auto-feeds the Kanban backlog.
 */
export const CRITERION_TARGET_DEFAULTS: Record<Criterion, number> = {
  DO: 40,
  NOTICE: 40,
  DECIDE: 50,
  NEXT: 30,
};

export function adaptFields(
  fields: MultiQuestionField[] | StructuredPromptsConfig,
): MultiQuestionField[] {
  return fields.map((f) => {
    if ("target" in f && "max" in f) {
      // Already a MultiQuestionField (legacy storybook shape).
      return f;
    }
    const sp = f as StructuredPrompt & { criterion?: Criterion };
    const cap = sp.softCharCap ?? DEFAULT_MAX;
    const criterionDefault = sp.criterion
      ? CRITERION_TARGET_DEFAULTS[sp.criterion]
      : undefined;
    const target = Math.min(
      sp.targetChars ?? criterionDefault ?? DEFAULT_TARGET,
      cap,
    );
    return {
      id: sp.id,
      label: sp.label,
      helper: sp.helper,
      placeholder: sp.placeholder,
      target,
      max: cap,
      criterion: sp.criterion,
      // Forward sentence starters to the StarterChip renderer. The
      // per-block sentenceStarters field is currently un-authored
      // (deferred to a future cross-block system, 13 May 2026) — but
      // the wiring stays so the future system can drop them in
      // without renderer changes.
      starters: sp.sentenceStarters,
    };
  });
}
