import { describe, it, expect } from "vitest";
import { derivePhaseState } from "../helpers";

/**
 * Project has no DOM-render harness (no @testing-library/react, no jsdom,
 * no JSX transform in vitest config). Convention: test pure helpers, not
 * JSX output. See ClassMachinePicker.test.tsx + DesignAssistantWidget.test.tsx
 * for the same pattern. .tsx extension kept for sibling proximity; no JSX here.
 *
 * Phase 0 of language-scaffolding-redesign rolled back the AutonomyPicker +
 * its 5 helpers (resolveAutonomyDisplay, hintsAvailable, hintsOpenByDefault,
 * exampleVisible, exampleOpenByDefault) + AUTONOMY_LEVELS + isLevelSelected.
 * Migration 121 also dropped via migration 122. The 8 corresponding tests
 * are gone with them. Only derivePhaseState (used by PhaseStrip) survives.
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
