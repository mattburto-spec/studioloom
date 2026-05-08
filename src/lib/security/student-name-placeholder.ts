/**
 * Student-name placeholder pattern (security-overview.md §1.3).
 *
 * Single rule across the codebase: a student's real name MUST NOT appear in
 * any prompt body sent to Anthropic (or any LLM provider). The contract:
 *
 *   1. Caller substitutes the real name with STUDENT_NAME_PLACEHOLDER
 *      ("Student") before constructing `messages` / `system` for
 *      callAnthropicMessages.
 *   2. Anthropic only ever sees "Student".
 *   3. After the response returns, caller calls restoreStudentName(text,
 *      realName) to swap "Student" -> realName before persisting or
 *      rendering.
 *
 * Original home: src/lib/tools/report-writer-prompt.ts (Report Writer free
 * tool). Promoted here 2026-05-09 when G3 grading needed the same pattern.
 *
 * The CI regression test at
 * src/lib/security/__tests__/no-pii-in-ai-prompts.test.ts enforces this:
 * any new file calling callAnthropicMessages that references PII identifier
 * tokens (firstName, displayName, etc.) fails the build unless allowlisted
 * because it implements this pattern.
 */

export const STUDENT_NAME_PLACEHOLDER = "Student";

/**
 * Replace the placeholder token with the real teacher-provided student name
 * in the model's output. Capital "Student" as a whole word — both Report
 * Writer (third-person narrative) and G3 grading (second-person feedback)
 * direct the model to use the placeholder verbatim, so capital-S whole-word
 * matches are unambiguous in practice.
 *
 * Edge case: if the model produces "Student" naturally (e.g. "Student
 * leadership skills"), the substitution applies there too. False-positive
 * risk is low because each call is per-student and the prompts steer the
 * model to use the placeholder only as an address term.
 */
export function restoreStudentName(text: string, realName: string): string {
  return text.replace(/\bStudent\b/g, () => realName);
}
