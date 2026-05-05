/**
 * Tests for the Lever 1 sub-phase 1D slot-field validator.
 *
 * Brief: docs/projects/lesson-quality-lever-1-slot-fields.md
 * Style: docs/specs/lesson-content-style-guide-v2-draft.md
 *
 * Pure function — no mocks. Asserts exact-value branching behaviour
 * (Lesson #38).
 */

import { describe, it, expect } from "vitest";
import {
  validateSlotFields,
  LEVER_1_DEPRECATED_HEADER,
  LEVER_1_DEPRECATED_VALUE_PROMPT_ONLY,
} from "../validate-slot-fields";

describe("validateSlotFields — happy path", () => {
  it("accepts three valid slot fields with no prompt", () => {
    const v = validateSlotFields({
      framing: "Today we close the loop on Newton's laws.",
      task: "Roll each racer down the ramp.",
      success_signal: "Write one conclusion sentence.",
    });
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
    expect(v.legacyPromptOnly).toBe(false);
  });

  it("accepts mixed write (slots + prompt)", () => {
    const v = validateSlotFields(
      {
        framing: "Framing text",
        task: "Task body",
        success_signal: "Submit your answer.",
      },
      "Composed: framing + task + success"
    );
    expect(v.ok).toBe(true);
    expect(v.legacyPromptOnly).toBe(false);
  });

  it("accepts the lock-fixture shape (the canonical post-rewrite Teaching Move)", () => {
    const v = validateSlotFields({
      framing:
        "You'll develop an initial idea, pass it blindly to a peer, then improve someone else's concept while honoring their original vision.",
      task: "Work on your initial idea for 5 minutes.",
      success_signal:
        "Consider which improvements genuinely strengthen your idea and be ready to discuss the exchange.",
    });
    expect(v.ok).toBe(true);
    expect(v.warnings).toEqual([]);
  });
});

describe("validateSlotFields — hard rejects", () => {
  it("rejects framing > 200 chars (exact-value error message)", () => {
    const oversize = "x".repeat(201);
    const v = validateSlotFields({ framing: oversize });
    expect(v.ok).toBe(false);
    expect(v.errors).toEqual([
      "framing exceeds 200-char cap (201 chars)",
    ]);
    expect(v.warnings).toEqual([]);
  });

  it("rejects success_signal > 200 chars (exact-value error message)", () => {
    const oversize = "y".repeat(250);
    const v = validateSlotFields({ success_signal: oversize });
    expect(v.ok).toBe(false);
    expect(v.errors).toEqual([
      "success_signal exceeds 200-char cap (250 chars)",
    ]);
  });

  it("rejects when BOTH framing and success_signal are oversize (multiple errors)", () => {
    const v = validateSlotFields({
      framing: "F".repeat(300),
      success_signal: "S".repeat(300),
    });
    expect(v.ok).toBe(false);
    expect(v.errors).toHaveLength(2);
    expect(v.errors[0]).toContain("framing");
    expect(v.errors[1]).toContain("success_signal");
  });

  it("accepts framing at exactly 200 chars (boundary inclusive)", () => {
    const exact = "x".repeat(200);
    const v = validateSlotFields({ framing: exact });
    expect(v.ok).toBe(true);
  });
});

describe("validateSlotFields — soft warnings (non-blocking)", () => {
  it("warns task > 800 chars but stays ok=true", () => {
    const oversize = "z".repeat(900);
    const v = validateSlotFields({ task: oversize });
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([
      "task exceeds 800-char soft cap (900 chars) — Lever 2 lint will surface this",
    ]);
  });

  it("does NOT warn task at exactly 800 chars (boundary inclusive)", () => {
    const exact = "z".repeat(800);
    const v = validateSlotFields({ task: exact });
    expect(v.ok).toBe(true);
    expect(v.warnings).toEqual([]);
  });

  it("emits warning AND error when task is over soft cap and framing is over hard cap", () => {
    const v = validateSlotFields({
      framing: "F".repeat(201),
      task: "T".repeat(801),
    });
    expect(v.ok).toBe(false);
    expect(v.errors).toHaveLength(1);
    expect(v.warnings).toHaveLength(1);
  });
});

describe("validateSlotFields — legacyPromptOnly detection", () => {
  it("flags legacyPromptOnly when prompt is set but no slots", () => {
    const v = validateSlotFields({}, "legacy prompt body");
    expect(v.ok).toBe(true);
    expect(v.legacyPromptOnly).toBe(true);
  });

  it("does NOT flag legacyPromptOnly when prompt + framing both set", () => {
    const v = validateSlotFields({ framing: "F" }, "legacy prompt body");
    expect(v.legacyPromptOnly).toBe(false);
  });

  it("does NOT flag legacyPromptOnly when only task is set + no prompt", () => {
    const v = validateSlotFields({ task: "T" });
    expect(v.legacyPromptOnly).toBe(false);
  });

  it("does NOT flag legacyPromptOnly when prompt is empty string + no slots", () => {
    const v = validateSlotFields({}, "");
    expect(v.legacyPromptOnly).toBe(false);
  });

  it("does NOT flag legacyPromptOnly when prompt is whitespace-only", () => {
    const v = validateSlotFields({}, "   \n\t   ");
    expect(v.legacyPromptOnly).toBe(false);
  });

  it("does NOT flag legacyPromptOnly when slots are whitespace-only strings", () => {
    // Whitespace-only slots are treated as empty for the legacy check
    const v = validateSlotFields({ framing: "   ", task: "" }, "real prompt");
    expect(v.legacyPromptOnly).toBe(true);
  });
});

describe("validateSlotFields — empty inputs", () => {
  it("accepts empty input (validator does not enforce required-ness)", () => {
    const v = validateSlotFields({});
    expect(v.ok).toBe(true);
    expect(v.legacyPromptOnly).toBe(false);
  });

  it("treats null and undefined identically", () => {
    const a = validateSlotFields({ framing: null, task: undefined });
    const b = validateSlotFields({});
    expect(a.ok).toBe(b.ok);
    expect(a.errors).toEqual(b.errors);
    expect(a.legacyPromptOnly).toBe(b.legacyPromptOnly);
  });
});

describe("constants — header name + value (locked for 1G consumers)", () => {
  it("header name is X-Lever-1-Deprecated", () => {
    expect(LEVER_1_DEPRECATED_HEADER).toBe("X-Lever-1-Deprecated");
  });

  it("header value for prompt-only writes is prompt-write-only", () => {
    expect(LEVER_1_DEPRECATED_VALUE_PROMPT_ONLY).toBe("prompt-write-only");
  });
});
