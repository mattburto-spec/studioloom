/**
 * Lever 1 sub-phase 1H — composedPromptText accepts any slot-bearing
 * shape, not just ActivitySection.
 *
 * 1H widened the input type from `ActivitySection` to a structural
 * `SlotBearing` so the helper works over wizard-state activities
 * (TimelineActivity), Activity Block rows, AI tool payloads, fixtures,
 * etc. without forcing every caller to widen at the type level.
 *
 * These tests assert the helper runs against representative shapes
 * so a regression that re-narrows the parameter type is caught in CI.
 *
 * Brief: docs/projects/lesson-quality-lever-1-slot-fields.md
 */

import { describe, it, expect } from "vitest";
import { composedPromptText, hasSlotFields } from "../compose-prompt";

describe("Lever 1 1H — composedPromptText accepts structural SlotBearing shapes", () => {
  it("accepts a TimelineActivity-like shape (prompt + slots optional)", () => {
    const timelineActivity = {
      id: "a1",
      role: "core" as const,
      title: "Ramp test",
      prompt: "auto-composed legacy",
      framing: "Framing line.",
      task: "Task body.",
      success_signal: "Submit one sentence.",
      durationMinutes: 15,
    };

    expect(composedPromptText(timelineActivity)).toBe(
      "Framing line.\n\nTask body.\n\nSubmit one sentence.",
    );
    expect(hasSlotFields(timelineActivity)).toBe(true);
  });

  it("accepts an Activity Block row shape (slots are nullable in DB)", () => {
    const block = {
      id: "block-1",
      title: "Investigate users",
      prompt: "Interview 3 users about their daily routines.",
      framing: null,
      task: null,
      success_signal: null,
    };

    // All slots null → falls back to legacy prompt
    expect(composedPromptText(block)).toBe("Interview 3 users about their daily routines.");
    expect(hasSlotFields(block)).toBe(false);
  });

  it("accepts a v2 Activity Block row (slots populated, legacy prompt is composed copy)", () => {
    const block = {
      id: "block-2",
      title: "Test ramp",
      prompt: "F\n\nT\n\nS",
      framing: "F",
      task: "T",
      success_signal: "S",
    };

    // Slots take priority over the legacy prompt
    expect(composedPromptText(block)).toBe("F\n\nT\n\nS");
    expect(hasSlotFields(block)).toBe(true);
  });

  it("accepts a minimal AI-tool-payload shape (just slots, no prompt yet)", () => {
    const payload = {
      framing: "Framing",
      task: "Task",
      success_signal: "Signal",
    };

    expect(composedPromptText(payload)).toBe("Framing\n\nTask\n\nSignal");
    expect(hasSlotFields(payload)).toBe(true);
  });

  it("returns empty string when nothing is populated", () => {
    expect(composedPromptText({})).toBe("");
    expect(composedPromptText({ prompt: "" })).toBe("");
    expect(composedPromptText({ framing: "", task: "", success_signal: "", prompt: "" })).toBe("");
    expect(hasSlotFields({})).toBe(false);
  });

  it("treats whitespace-only slots as empty (regression: trim before filter)", () => {
    const section = {
      framing: "   ",
      task: "\n\n",
      success_signal: "\t",
      prompt: "Legacy fallback.",
    };

    expect(composedPromptText(section)).toBe("Legacy fallback.");
    expect(hasSlotFields(section)).toBe(false);
  });
});
