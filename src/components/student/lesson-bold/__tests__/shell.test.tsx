import { describe, it, expect } from "vitest";
import {
  derivePhaseState,
  isLevelSelected,
  AUTONOMY_LEVELS,
  type AutonomyLevel,
} from "../helpers";

/**
 * Project has no DOM-render harness (no @testing-library/react, no jsdom,
 * no JSX transform in vitest config). Convention: test pure helpers, not
 * JSX output. See ClassMachinePicker.test.tsx + DesignAssistantWidget.test.tsx
 * for the same pattern. .tsx extension kept for sibling proximity; no JSX here.
 */

describe("derivePhaseState", () => {
  it("returns 'done' when done=true — including the done+current edge case (done wins)", () => {
    expect(derivePhaseState({ done: true })).toBe("done");
    expect(derivePhaseState({ done: true, current: true })).toBe("done");
  });

  it("returns 'current' when done is falsy and current=true, 'upcoming' otherwise", () => {
    expect(derivePhaseState({ current: true })).toBe("current");
    expect(derivePhaseState({ done: false, current: true })).toBe("current");
    expect(derivePhaseState({})).toBe("upcoming");
    expect(derivePhaseState({ done: false, current: false })).toBe("upcoming");
  });
});

describe("AUTONOMY_LEVELS", () => {
  it("exposes exactly 3 levels in the fixed order scaffolded → balanced → independent", () => {
    expect(AUTONOMY_LEVELS).toHaveLength(3);
    expect(AUTONOMY_LEVELS.map((l) => l.id)).toEqual([
      "scaffolded",
      "balanced",
      "independent",
    ]);
  });
});

describe("isLevelSelected", () => {
  it("matches the exact level and returns false for null / mismatches", () => {
    const allLevels: AutonomyLevel[] = ["scaffolded", "balanced", "independent"];
    for (const l of allLevels) {
      expect(isLevelSelected(l, l)).toBe(true);
      expect(isLevelSelected(null, l)).toBe(false);
    }
    expect(isLevelSelected("balanced", "scaffolded")).toBe(false);
    expect(isLevelSelected("independent", "balanced")).toBe(false);
  });
});
