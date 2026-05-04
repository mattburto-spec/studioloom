/**
 * Tests for the Lever 1 sub-phase 1E compose-prompt helpers.
 *
 * The project intentionally has no DOM-render test harness (no jsdom).
 * Following existing pattern (see RoleChip.test.tsx, ClassMachinePicker
 * picker-helpers.ts), we test the pure helpers exhaustively. The
 * ComposedPrompt React component is a thin wrapper that composes
 * MarkdownPrompt slots driven by these helpers.
 *
 * Brief: docs/projects/lesson-quality-lever-1-slot-fields.md
 */

import { describe, it, expect } from "vitest";
import {
  composedPromptText,
  hasSlotFields,
} from "../compose-prompt";
import type { ActivitySection } from "@/types";

const baseSection: ActivitySection = {
  prompt: "",
};

describe("composedPromptText — three slots populated", () => {
  it("composes framing + task + success_signal with double-newline separators", () => {
    const section: ActivitySection = {
      ...baseSection,
      framing: "Today we close the loop on Newton's laws.",
      task: "Roll each racer down the ramp.",
      success_signal: "Submit one conclusion sentence.",
      prompt: "should be ignored when slots are present",
    };
    expect(composedPromptText(section)).toBe(
      "Today we close the loop on Newton's laws.\n\n" +
      "Roll each racer down the ramp.\n\n" +
      "Submit one conclusion sentence."
    );
  });

  it("trims surrounding whitespace from each slot", () => {
    const section: ActivitySection = {
      ...baseSection,
      framing: "  Framing  ",
      task: "\nTask\n",
      success_signal: "\tSubmit it.\t",
    };
    expect(composedPromptText(section)).toBe(
      "Framing\n\nTask\n\nSubmit it."
    );
  });
});

describe("composedPromptText — partial slots", () => {
  it("renders only framing when task + signal are empty", () => {
    const section: ActivitySection = {
      ...baseSection,
      framing: "Just framing.",
    };
    expect(composedPromptText(section)).toBe("Just framing.");
  });

  it("renders only task when framing + signal are empty", () => {
    const section: ActivitySection = {
      ...baseSection,
      task: "Just the task body.",
    };
    expect(composedPromptText(section)).toBe("Just the task body.");
  });

  it("renders only success_signal when framing + task are empty", () => {
    const section: ActivitySection = {
      ...baseSection,
      success_signal: "Just submit it.",
    };
    expect(composedPromptText(section)).toBe("Just submit it.");
  });

  it("skips empty middle slot (framing + signal, no task)", () => {
    const section: ActivitySection = {
      ...baseSection,
      framing: "Framing first.",
      task: "",
      success_signal: "Signal last.",
    };
    expect(composedPromptText(section)).toBe(
      "Framing first.\n\nSignal last."
    );
  });

  it("skips whitespace-only slots as if they were empty", () => {
    const section: ActivitySection = {
      ...baseSection,
      framing: "Framing.",
      task: "   \n  \t  ",
      success_signal: "Signal.",
    };
    expect(composedPromptText(section)).toBe(
      "Framing.\n\nSignal."
    );
  });
});

describe("composedPromptText — legacy fallback", () => {
  it("returns trimmed legacy prompt when all three slots are null", () => {
    const section: ActivitySection = {
      ...baseSection,
      prompt: "  This is a legacy single-blob prompt.  ",
    };
    expect(composedPromptText(section)).toBe(
      "This is a legacy single-blob prompt."
    );
  });

  it("returns trimmed legacy prompt when all three slots are empty strings", () => {
    const section: ActivitySection = {
      framing: "",
      task: "",
      success_signal: "",
      prompt: "Legacy prompt.",
    };
    expect(composedPromptText(section)).toBe("Legacy prompt.");
  });

  it("returns trimmed legacy prompt when all three slots are whitespace-only", () => {
    const section: ActivitySection = {
      framing: "   ",
      task: "\n\n",
      success_signal: "\t",
      prompt: "Legacy prompt.",
    };
    expect(composedPromptText(section)).toBe("Legacy prompt.");
  });

  it("returns empty string when EVERYTHING is empty", () => {
    expect(composedPromptText({ prompt: "" })).toBe("");
    expect(composedPromptText({ prompt: "   " })).toBe("");
  });
});

describe("hasSlotFields — boolean detection", () => {
  it("returns false when all three slots are null/undefined", () => {
    expect(hasSlotFields({ prompt: "legacy" })).toBe(false);
  });

  it("returns false when all three slots are empty strings", () => {
    expect(
      hasSlotFields({ framing: "", task: "", success_signal: "", prompt: "x" })
    ).toBe(false);
  });

  it("returns false when all three slots are whitespace-only", () => {
    expect(
      hasSlotFields({
        framing: "   ",
        task: "\n",
        success_signal: "\t",
        prompt: "x",
      })
    ).toBe(false);
  });

  it("returns true when ONLY framing is set", () => {
    expect(hasSlotFields({ framing: "f", prompt: "" })).toBe(true);
  });

  it("returns true when ONLY task is set", () => {
    expect(hasSlotFields({ task: "t", prompt: "" })).toBe(true);
  });

  it("returns true when ONLY success_signal is set", () => {
    expect(hasSlotFields({ success_signal: "s", prompt: "" })).toBe(true);
  });

  it("returns true when all three slots are set", () => {
    expect(
      hasSlotFields({
        framing: "f",
        task: "t",
        success_signal: "s",
        prompt: "",
      })
    ).toBe(true);
  });
});

describe("compose round-trip with real Teaching Move shape", () => {
  it("composes a real post-rewrite Teaching Move correctly", () => {
    const section: ActivitySection = {
      ...baseSection,
      framing:
        "You'll develop an initial idea, pass it blindly to a peer, then improve someone else's concept while honoring their original vision.",
      task:
        "1. Work on your initial idea for 5 minutes. Develop your concept, sketch it out, or draft your thinking as clearly as you can.\n\n2. When time is called, fold your paper in half or turn away so you can't see who receives it.",
      success_signal:
        "Consider which improvements genuinely strengthen your idea and be ready to discuss the exchange.",
    };
    const composed = composedPromptText(section);
    expect(composed).toContain("blindly");
    expect(composed).toContain("5 minutes");
    expect(composed).toContain("Consider which improvements");
    // Slots separated by exactly one blank line
    expect(composed.split("\n\n").length).toBeGreaterThanOrEqual(3);
  });
});
