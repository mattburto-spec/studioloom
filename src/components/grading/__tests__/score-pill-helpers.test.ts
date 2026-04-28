import { describe, it, expect } from "vitest";
import {
  SCORE_PILL_BASE_CLASSES,
  classifyScorePillState,
  formatScoreForPill,
  getScorePillClasses,
  getScorePillVariantClasses,
  getScoreTier,
} from "../score-pill-helpers";
import type { GradingScale } from "@/lib/constants";

/**
 * The project has no DOM-render harness (no @testing-library/react,
 * no jsdom). ScorePill follows the project pattern (see
 * src/components/fabrication/__tests__/ClassMachinePicker.test.tsx):
 * extract every decision into a pure helper, test the helpers exhaustively.
 *
 * Lesson #38: assert exact strings, not just non-null. Any unintended
 * visual change shows up here as a failing assertion.
 */

const MYP_SCALE: GradingScale = {
  type: "numeric",
  min: 1,
  max: 8,
  step: 1,
  formatDisplay: (v) => `${v}`,
};

const PERCENT_SCALE: GradingScale = {
  type: "percentage",
  min: 0,
  max: 100,
  step: 1,
  formatDisplay: (v) => `${v}%`,
};

const ACARA_SCALE: GradingScale = {
  type: "letter",
  min: 1,
  max: 5,
  step: 1,
  labels: ["A", "B", "C", "D", "E"],
  displayAsLabel: true,
  formatDisplay: (v) => ["A", "B", "C", "D", "E"][v - 1] ?? `${v}`,
};

describe("classifyScorePillState", () => {
  it("returns 'empty' when score is null and not confirmed", () => {
    expect(
      classifyScorePillState({ score: null, confirmed: false, aiPreScore: null }),
    ).toBe("empty");
  });

  it("returns 'empty' even if AI suggested a score, when score is still null", () => {
    expect(
      classifyScorePillState({ score: null, confirmed: false, aiPreScore: 6 }),
    ).toBe("empty");
  });

  it("returns 'ai-suggested' when score is set and not confirmed", () => {
    expect(
      classifyScorePillState({ score: 6, confirmed: false, aiPreScore: 6 }),
    ).toBe("ai-suggested");
  });

  it("returns 'confirmed' when teacher confirms the AI score", () => {
    expect(
      classifyScorePillState({ score: 6, confirmed: true, aiPreScore: 6 }),
    ).toBe("confirmed");
  });

  it("returns 'overridden' when teacher confirms a score different from AI", () => {
    expect(
      classifyScorePillState({ score: 7, confirmed: true, aiPreScore: 6 }),
    ).toBe("overridden");
  });

  it("returns 'confirmed' (not 'overridden') when no AI baseline exists", () => {
    expect(
      classifyScorePillState({ score: 7, confirmed: true, aiPreScore: null }),
    ).toBe("confirmed");
  });
});

describe("getScoreTier", () => {
  it("returns 'red' below 40% of max", () => {
    expect(getScoreTier(3, 8)).toBe("red"); // 0.375
    expect(getScoreTier(0, 8)).toBe("red");
  });

  it("returns 'amber' between 40% and below 60% of max", () => {
    expect(getScoreTier(4, 8)).toBe("amber"); // 0.5
    expect(getScoreTier(35, 100)).toBe("red"); // boundary check at 0.35
    expect(getScoreTier(40, 100)).toBe("amber"); // boundary check at 0.40
  });

  it("returns 'teal' between 60% and below 80% of max", () => {
    expect(getScoreTier(5, 8)).toBe("teal"); // 0.625
    expect(getScoreTier(6, 8)).toBe("teal"); // 0.75
  });

  it("returns 'violet' at or above 80% of max", () => {
    expect(getScoreTier(7, 8)).toBe("violet"); // 0.875
    expect(getScoreTier(8, 8)).toBe("violet"); // 1.0
    expect(getScoreTier(80, 100)).toBe("violet"); // exactly 0.8
  });

  it("returns 'red' for null score regardless of max", () => {
    expect(getScoreTier(null, 8)).toBe("red");
    expect(getScoreTier(null, 100)).toBe("red");
  });

  it("returns 'red' when max is non-positive (defensive)", () => {
    expect(getScoreTier(5, 0)).toBe("red");
    expect(getScoreTier(5, -1)).toBe("red");
  });
});

describe("getScorePillVariantClasses — exact strings (Lesson #38)", () => {
  // Matrix: 4 states × 4 tiers = 16 cases. Asserting exact strings so any
  // unintended visual change requires updating the test (deliberate).

  it("empty + red", () => {
    expect(getScorePillVariantClasses("empty", "red")).toBe(
      "bg-red-500/10 border-red-500/35 text-red-500 border-dashed opacity-50",
    );
  });

  it("empty + amber", () => {
    expect(getScorePillVariantClasses("empty", "amber")).toBe(
      "bg-amber-500/10 border-amber-500/35 text-amber-600 border-dashed opacity-50",
    );
  });

  it("ai-suggested + teal", () => {
    expect(getScorePillVariantClasses("ai-suggested", "teal")).toBe(
      "bg-teal-500/10 border-teal-500/35 text-teal-600 border-dashed",
    );
  });

  it("ai-suggested + violet", () => {
    expect(getScorePillVariantClasses("ai-suggested", "violet")).toBe(
      "bg-violet-600/10 border-violet-600/35 text-violet-700 border-dashed",
    );
  });

  it("confirmed + red", () => {
    expect(getScorePillVariantClasses("confirmed", "red")).toBe(
      "bg-red-500 border-red-500 text-white border-solid",
    );
  });

  it("confirmed + violet", () => {
    expect(getScorePillVariantClasses("confirmed", "violet")).toBe(
      "bg-violet-600 border-violet-600 text-white border-solid",
    );
  });

  it("overridden renders identically to confirmed", () => {
    // The two states differ in audit-log source, not in pill rendering.
    expect(getScorePillVariantClasses("overridden", "teal")).toBe(
      getScorePillVariantClasses("confirmed", "teal"),
    );
    expect(getScorePillVariantClasses("overridden", "amber")).toBe(
      getScorePillVariantClasses("confirmed", "amber"),
    );
  });
});

describe("getScorePillClasses (composer)", () => {
  it("prepends the base layout classes to the variant classes", () => {
    const result = getScorePillClasses("confirmed", "violet");
    expect(result).toBe(
      `${SCORE_PILL_BASE_CLASSES} bg-violet-600 border-violet-600 text-white border-solid`,
    );
  });

  it("base classes contain the layout primitives", () => {
    expect(SCORE_PILL_BASE_CLASSES).toContain("inline-flex");
    expect(SCORE_PILL_BASE_CLASSES).toContain("rounded-full");
    expect(SCORE_PILL_BASE_CLASSES).toContain("font-extrabold");
    expect(SCORE_PILL_BASE_CLASSES).toContain("border");
    expect(SCORE_PILL_BASE_CLASSES).toContain("transition");
  });
});

describe("formatScoreForPill", () => {
  it("formats null as the scale's min (placeholder)", () => {
    expect(formatScoreForPill(null, MYP_SCALE)).toBe("1");
    expect(formatScoreForPill(null, PERCENT_SCALE)).toBe("0%");
    expect(formatScoreForPill(null, ACARA_SCALE)).toBe("A");
  });

  it("formats numeric MYP scores as raw numbers", () => {
    expect(formatScoreForPill(5, MYP_SCALE)).toBe("5");
    expect(formatScoreForPill(8, MYP_SCALE)).toBe("8");
  });

  it("formats percentage scores with a percent suffix", () => {
    expect(formatScoreForPill(72, PERCENT_SCALE)).toBe("72%");
    expect(formatScoreForPill(100, PERCENT_SCALE)).toBe("100%");
    expect(formatScoreForPill(0, PERCENT_SCALE)).toBe("0%");
  });

  it("formats ACARA letter scores via the scale's label map", () => {
    expect(formatScoreForPill(1, ACARA_SCALE)).toBe("A");
    expect(formatScoreForPill(3, ACARA_SCALE)).toBe("C");
    expect(formatScoreForPill(5, ACARA_SCALE)).toBe("E");
  });
});
