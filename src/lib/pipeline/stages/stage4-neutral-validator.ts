/**
 * Stage 4 neutral content validator (Phase 2 sub-task 5.2).
 *
 * Fail-loud enforcement that Stage 4 polish output contains NO framework-
 * specific vocabulary. Framework labels (Criterion A-D, AO1-4, MYP, GCSE)
 * must only appear at render time via FrameworkAdapter — never baked into
 * generated content.
 *
 * If end-to-end generation starts throwing NeutralValidationError, the
 * validator is working — fix the prompt or model output. Do NOT loosen
 * the validator. See docs/projects/dimensions3-phase-2-brief.md §5 row
 * 5.2 and docs/specs/neutral-criterion-taxonomy.md for the 8 neutral keys.
 */

export const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "Criterion A-D", pattern: /\bCriterion\s+[A-D]\b/ },
  { name: "AO1-AO4", pattern: /\bAO[1-4]\b/ },
  { name: "MYP", pattern: /\bMYP\b/ },
  { name: "GCSE", pattern: /\bGCSE\b/ },
] as const;

export const NEUTRAL_CRITERION_KEYS = [
  "researching",
  "analysing",
  "designing",
  "creating",
  "evaluating",
  "reflecting",
  "communicating",
  "planning",
] as const;

export type NeutralCriterionKey = (typeof NEUTRAL_CRITERION_KEYS)[number];

export class NeutralValidationError extends Error {
  public readonly forbiddenName: string;
  public readonly sample: string;

  constructor(forbiddenName: string, sample: string) {
    super(
      `Stage 4 polish output contains forbidden framework token "${forbiddenName}". Sample: "${sample}". See dimensions3-phase-2-brief.md §5 row 5.2 + neutral-criterion-taxonomy.md for the 8 neutral keys.`
    );
    this.name = "NeutralValidationError";
    this.forbiddenName = forbiddenName;
    this.sample = sample;
  }
}

/**
 * Scan `text` for any forbidden framework token. Throws
 * NeutralValidationError on the first match (deterministic ordering per
 * FORBIDDEN_PATTERNS). Returns undefined on success.
 */
export function validateNeutralContent(text: string): void {
  for (const { name, pattern } of FORBIDDEN_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      throw new NeutralValidationError(name, match[0]);
    }
  }
}
