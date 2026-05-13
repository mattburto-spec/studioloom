import { describe, it, expect } from "vitest";
import {
  JOURNAL_PROMPTS,
  STRATEGY_CANVAS_PROMPTS,
  SELF_REREAD_PROMPTS,
  FINAL_REFLECTION_PROMPTS,
} from "../presets";

// JOURNAL_PROMPTS is the hot-path preset — runs every studio class in
// the CO2 Racers unit. The 80-char default target was tripping
// non-native G9 students under time pressure at end-of-class; we lowered
// it per-prompt. These tests lock in that contract so a future edit
// doesn't silently un-do the scaffolding.
//
// Per-block sentenceStarters were removed 13 May 2026 (Matt's call —
// defer to a future cross-block sentence-starter system). The
// `sentenceStarters` field stays on StructuredPrompt for forward compat;
// we just don't author them per-preset anymore. Tests below ASSERT
// they're absent from JOURNAL_PROMPTS so a regression re-adding them
// flags loudly.

describe("JOURNAL_PROMPTS — quick-reflection scaffolds", () => {
  it("has 4 prompts (DO/NOTICE/DECIDE/NEXT)", () => {
    expect(JOURNAL_PROMPTS).toHaveLength(4);
    expect(JOURNAL_PROMPTS.map((p) => p.id)).toEqual([
      "did",
      "noticed",
      "decided",
      "next",
    ]);
  });

  it("every prompt has a targetChars set BELOW the 80-char default", () => {
    for (const prompt of JOURNAL_PROMPTS) {
      expect(prompt.targetChars).toBeDefined();
      expect(prompt.targetChars!).toBeLessThan(80);
      expect(prompt.targetChars!).toBeGreaterThanOrEqual(20);
    }
  });

  it("no prompt authors sentence starters (deferred to a future cross-block system 13 May 2026)", () => {
    for (const prompt of JOURNAL_PROMPTS) {
      expect(prompt.sentenceStarters).toBeUndefined();
    }
  });

  it("DECIDE prompt has a slightly higher targetChars to accommodate the 'because' clause", () => {
    const decided = JOURNAL_PROMPTS.find((p) => p.id === "decided");
    const did = JOURNAL_PROMPTS.find((p) => p.id === "did");
    expect(decided?.targetChars).toBeGreaterThanOrEqual(did?.targetChars ?? 0);
  });

  it("keeps criterion tags (DO/NOTICE/DECIDE/NEXT) for stepper colour theming", () => {
    expect(JOURNAL_PROMPTS.map((p) => p.criterion)).toEqual([
      "DO",
      "NOTICE",
      "DECIDE",
      "NEXT",
    ]);
  });
});

describe("Other presets — softCharCap drives default target (no opt-out yet)", () => {
  // The non-Journal presets are intentionally LEFT at the 80-char
  // default — they're substantive prompts (Class 1 Strategy Canvas,
  // mid-unit Self-Reread, Class 14 Final Reflection). Keep them at the
  // bar; if a future smoke shows they're also too long, add targetChars
  // there too.

  it("STRATEGY_CANVAS_PROMPTS leaves targetChars unset (inherits 80)", () => {
    for (const prompt of STRATEGY_CANVAS_PROMPTS) {
      expect(prompt.targetChars).toBeUndefined();
    }
  });

  it("SELF_REREAD_PROMPTS leaves targetChars unset", () => {
    for (const prompt of SELF_REREAD_PROMPTS) {
      expect(prompt.targetChars).toBeUndefined();
    }
  });

  it("FINAL_REFLECTION_PROMPTS leaves targetChars unset", () => {
    for (const prompt of FINAL_REFLECTION_PROMPTS) {
      expect(prompt.targetChars).toBeUndefined();
    }
  });
});
