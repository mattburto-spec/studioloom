/**
 * Tests for the Lever 1 sub-phase 1C backfill heuristic.
 *
 * Brief: docs/projects/lesson-quality-lever-1-slot-fields.md
 *
 * Per Lesson #38 (assert exact values, not just non-null) and the brief's
 * 1C verification gate ("3 hand-curated test cases asserted with exact
 * split values"), the three "happy path" test cases at the top of this
 * file lock literal expected splits. If the heuristic regresses, these
 * fixtures will trip immediately rather than silently producing
 * different-but-also-valid splits.
 *
 * Beyond the 3 happy-path locks, edge cases assert the `needs_review`
 * branch decisions — empty, too-short, single-sentence, no-signal-verb,
 * no-task-body. These guard the bail logic so production rows that
 * resist clean splitting are flagged rather than silently mangled.
 */

import { describe, it, expect } from "vitest";
import { splitPrompt } from "../split-prompt-heuristic";

describe("splitPrompt — happy-path locked fixtures (Lesson #38)", () => {
  it("Fixture 1: classic three-part prompt with explicit Write closer", () => {
    const prompt =
      "Today we close the loop on Newton's laws. Roll each of the three sample racers down the ramp and observe carefully. Write one conclusion sentence: which was fastest, and why?";

    const result = splitPrompt(prompt);

    expect(result.needs_review).toBe(false);
    expect(result.reason).toBeUndefined();
    expect(result.framing).toBe("Today we close the loop on Newton's laws.");
    expect(result.task).toBe(
      "Roll each of the three sample racers down the ramp and observe carefully."
    );
    expect(result.success_signal).toBe(
      "Write one conclusion sentence: which was fastest, and why?"
    );
  });

  it("Fixture 2: longer body with multi-sentence task and Record closer", () => {
    const prompt =
      "Investigate how centre of mass affects stability. Test each of the three sample racers by rolling them down the ramp. For each one, watch how it tracks and where it tips. Compare the configurations side by side using the PMI framework. Record your strongest finding in one sentence.";

    const result = splitPrompt(prompt);

    expect(result.needs_review).toBe(false);
    expect(result.framing).toBe(
      "Investigate how centre of mass affects stability."
    );
    expect(result.task).toBe(
      "Test each of the three sample racers by rolling them down the ramp. For each one, watch how it tracks and where it tips. Compare the configurations side by side using the PMI framework."
    );
    expect(result.success_signal).toBe(
      "Record your strongest finding in one sentence."
    );
  });

  it("Fixture 3: prompt with markdown emphasis + Submit closer", () => {
    const prompt =
      "Wheels and weight distribution are the **final pieces** of the puzzle. Compare two wheel options — Wheel A is wide, thick, and heavy; Wheel B is thin, narrow, and light. Predict which racer will be faster and why. Submit your prediction with one sentence of reasoning.";

    const result = splitPrompt(prompt);

    expect(result.needs_review).toBe(false);
    expect(result.framing).toBe(
      "Wheels and weight distribution are the **final pieces** of the puzzle."
    );
    expect(result.task).toBe(
      "Compare two wheel options — Wheel A is wide, thick, and heavy; Wheel B is thin, narrow, and light. Predict which racer will be faster and why."
    );
    expect(result.success_signal).toBe(
      "Submit your prediction with one sentence of reasoning."
    );
  });
});

describe("splitPrompt — needs_review branches", () => {
  it("returns reason='empty' on empty string", () => {
    const result = splitPrompt("");
    expect(result.needs_review).toBe(true);
    expect(result.reason).toBe("empty");
    expect(result.framing).toBeNull();
    expect(result.task).toBeNull();
    expect(result.success_signal).toBeNull();
  });

  it("returns reason='empty' on whitespace-only", () => {
    const result = splitPrompt("   \n\n  \t ");
    expect(result.needs_review).toBe(true);
    expect(result.reason).toBe("empty");
  });

  it("returns reason='empty' on null/undefined", () => {
    expect(splitPrompt(null).reason).toBe("empty");
    expect(splitPrompt(undefined).reason).toBe("empty");
  });

  it("returns reason='too-short' on short prompt without punctuation", () => {
    const result = splitPrompt("Compare wheel sizes");
    expect(result.needs_review).toBe(true);
    expect(result.reason).toBe("too-short");
    expect(result.task).toBe("Compare wheel sizes");
  });

  it("returns reason='single-sentence' when only one sentence is detected", () => {
    // Has terminal punctuation but no sentence boundaries within
    const prompt =
      "Compare the three sample racers using the criteria of stability and speed across all phases.";
    const result = splitPrompt(prompt);
    expect(result.needs_review).toBe(true);
    expect(result.reason).toBe("single-sentence");
    expect(result.task).toBe(prompt);
  });

  it("returns reason='no-signal-verb' when last sentence has no production verb", () => {
    const prompt =
      "Today we explore wheel mass. Heavier wheels need more force to accelerate. Lighter wheels accelerate faster but lose grip. The relationship is governed by Newton's second law.";

    const result = splitPrompt(prompt);

    expect(result.needs_review).toBe(true);
    expect(result.reason).toBe("no-signal-verb");
    expect(result.framing).toBe("Today we explore wheel mass.");
    expect(result.task).toContain("Heavier wheels");
    expect(result.success_signal).toBeNull();
  });

  it("returns reason='no-task-body' when only framing + signal sentence (no middle)", () => {
    const prompt = "Test each wheel option. Write one sentence about your finding.";
    const result = splitPrompt(prompt);
    expect(result.needs_review).toBe(true);
    expect(result.reason).toBe("no-task-body");
    expect(result.framing).toBe("Test each wheel option.");
    expect(result.success_signal).toBe(
      "Write one sentence about your finding."
    );
    expect(result.task).toBeNull();
  });
});

describe("splitPrompt — robustness", () => {
  it("handles prompts that start with a markdown heading", () => {
    const prompt =
      "### Sustained Work\n\nInvestigate three configurations. Compare them across speed and stability. Record your strongest finding.";
    const result = splitPrompt(prompt);
    // The heading line gets stripped by normaliseLeadingNoise, leaving "Sustained Work"
    expect(result.framing?.toLowerCase()).toContain("sustained work");
    expect(result.success_signal?.toLowerCase()).toContain("record");
    expect(result.needs_review).toBe(false);
  });

  it("treats CASE-INSENSITIVE signal verbs", () => {
    const prompt =
      "Investigate the variables. Run the three tests and observe carefully. WRITE one conclusion.";
    const result = splitPrompt(prompt);
    expect(result.needs_review).toBe(false);
    expect(result.success_signal?.toLowerCase()).toContain("write");
  });

  it("handles signal verb mid-sentence in the closer (not just at start)", () => {
    const prompt =
      "Look at the three options. Compare them across criteria of stability and speed. Then submit your final decision.";
    const result = splitPrompt(prompt);
    expect(result.needs_review).toBe(false);
    expect(result.success_signal).toContain("submit");
  });

  it("preserves the prompt verbatim — no whitespace mangling within sentences", () => {
    const prompt =
      "Today we test wheels. Roll each of the three sample racers down the  ramp.   For each, record what works. Write one sentence: which was fastest?";
    const result = splitPrompt(prompt);
    // Internal double-spaces preserved within sentence boundaries
    expect(result.task).toContain("down the  ramp.");
    expect(result.task).toContain("each, record");
  });

  it("is idempotent — running on a single (long-enough) sentence returns single-sentence", () => {
    // Must be ≥50 chars so it doesn't trip the too-short bail first.
    const oneSentence =
      "Today we close the loop on Newton's laws and bring the wheels into focus for the design brief.";
    const result = splitPrompt(oneSentence);
    expect(result.needs_review).toBe(true);
    expect(result.reason).toBe("single-sentence");
  });
});
