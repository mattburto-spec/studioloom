/**
 * Tests for Dimensions v2 helper functions in chunk.ts
 * Covers: derivePhaseGrouping, derivePhaseUdlCheckpoints,
 *         collectAllUdlCheckpoints, mapGroupingLabel
 */
import { describe, it, expect } from "vitest";
import {
  _derivePhaseGrouping as derivePhaseGrouping,
  _derivePhaseUdlCheckpoints as derivePhaseUdlCheckpoints,
  _collectAllUdlCheckpoints as collectAllUdlCheckpoints,
  _mapGroupingLabel as mapGroupingLabel,
} from "../chunk";
import type { LessonProfile, LessonFlowPhase } from "@/types/lesson-intelligence";

// ─── Helpers ───

function makePhase(overrides: Partial<LessonFlowPhase> = {}): LessonFlowPhase {
  return {
    title: "Test Phase",
    description: "A test phase",
    phase: "independent_work",
    estimated_minutes: 15,
    activity_type: "hands-on making",
    pedagogical_purpose: "Practice skills",
    teacher_role: "circulating",
    student_cognitive_level: "apply",
    scaffolding_present: [],
    scaffolding_removed: [],
    energy_state: "productive_struggle",
    ...overrides,
  };
}

function makeProfile(overrides: Partial<LessonProfile> = {}): LessonProfile {
  return {
    title: "Test Lesson",
    subject_area: "Design",
    grade_level: "Year 8",
    lesson_type: "design_process",
    lesson_flow: [],
    ...overrides,
  } as LessonProfile;
}

// ─── mapGroupingLabel ───

describe("mapGroupingLabel", () => {
  it("maps 'individual' keyword", () => {
    expect(mapGroupingLabel("individual work")).toBe("individual");
  });

  it("maps 'solo' keyword", () => {
    expect(mapGroupingLabel("solo practice")).toBe("individual");
  });

  it("maps 'pair' keyword", () => {
    expect(mapGroupingLabel("pair discussion")).toBe("pair");
  });

  it("maps 'small group' keyword", () => {
    expect(mapGroupingLabel("small group activity")).toBe("small_group");
  });

  it("maps 'whole class' keyword", () => {
    expect(mapGroupingLabel("whole class discussion")).toBe("whole_class");
  });

  it("maps 'flexible' keyword", () => {
    expect(mapGroupingLabel("flexible grouping")).toBe("flexible");
  });

  it("returns undefined for empty input", () => {
    expect(mapGroupingLabel(undefined)).toBeUndefined();
    expect(mapGroupingLabel("")).toBeUndefined();
  });

  it("returns undefined for unknown labels", () => {
    expect(mapGroupingLabel("something unusual")).toBeUndefined();
  });
});

// ─── derivePhaseGrouping ───

describe("derivePhaseGrouping", () => {
  const emptyProfile = makeProfile();

  it("maps warm_up to whole_class", () => {
    const phase = makePhase({ phase: "warm_up" });
    expect(derivePhaseGrouping(phase, emptyProfile)).toBe("whole_class");
  });

  it("maps making to individual", () => {
    const phase = makePhase({ phase: "making" });
    expect(derivePhaseGrouping(phase, emptyProfile)).toBe("individual");
  });

  it("maps guided_practice to pair", () => {
    const phase = makePhase({ phase: "guided_practice" });
    expect(derivePhaseGrouping(phase, emptyProfile)).toBe("pair");
  });

  it("maps collaboration to small_group", () => {
    const phase = makePhase({ phase: "collaboration" });
    expect(derivePhaseGrouping(phase, emptyProfile)).toBe("small_group");
  });

  it("maps critique to small_group", () => {
    const phase = makePhase({ phase: "critique" });
    expect(derivePhaseGrouping(phase, emptyProfile)).toBe("small_group");
  });

  it("maps presentation to whole_class", () => {
    const phase = makePhase({ phase: "presentation" });
    expect(derivePhaseGrouping(phase, emptyProfile)).toBe("whole_class");
  });

  it("falls back to grouping_analysis.progression", () => {
    // Use a phase type that's NOT in the phaseGroupingMap to test the fallback
    // station_rotation IS in the map, so we cast to bypass TS for testing
    const phase = makePhase({
      phase: "custom_phase" as unknown as LessonFlowPhase["phase"],
      title: "ideation",
    });
    const profile = makeProfile({
      grouping_analysis: {
        progression: "whole-class (intro) → pairs (ideation) → individual (making)",
      },
    });
    expect(derivePhaseGrouping(phase, profile)).toBe("pair");
  });

  it("returns undefined for unknown phase with no progression", () => {
    const phase = makePhase({
      phase: "unknown_phase" as unknown as LessonFlowPhase["phase"],
      title: "Mystery Step",
    });
    expect(derivePhaseGrouping(phase, emptyProfile)).toBeUndefined();
  });
});

// ─── derivePhaseUdlCheckpoints ───

describe("derivePhaseUdlCheckpoints", () => {
  const profileWithUdl = makeProfile({
    udl_coverage: {
      engagement: ["1.1 recruiting interest", "1.3 self-regulation"],
      representation: ["2.1 clarify vocabulary", "3.2 highlight patterns"],
      action_expression: ["5.1 use multiple media", "6.2 support planning"],
    },
  });

  it("returns engagement checkpoints for warm_up phase", () => {
    const phase = makePhase({ phase: "warm_up" });
    const result = derivePhaseUdlCheckpoints(phase, profileWithUdl);
    expect(result).toContain("1.1 recruiting interest");
    expect(result).toContain("1.3 self-regulation");
    expect(result).not.toContain("5.1 use multiple media");
  });

  it("returns representation checkpoints for demonstration phase", () => {
    const phase = makePhase({ phase: "demonstration" });
    const result = derivePhaseUdlCheckpoints(phase, profileWithUdl);
    expect(result).toContain("2.1 clarify vocabulary");
    expect(result).toContain("3.2 highlight patterns");
  });

  it("returns action_expression checkpoints for making phase", () => {
    const phase = makePhase({ phase: "making" });
    const result = derivePhaseUdlCheckpoints(phase, profileWithUdl);
    expect(result).toContain("5.1 use multiple media");
    expect(result).toContain("6.2 support planning");
  });

  it("returns BOTH engagement and representation for introduction phase", () => {
    const phase = makePhase({ phase: "introduction" });
    const result = derivePhaseUdlCheckpoints(phase, profileWithUdl);
    // introduction is in both engagement and representation sets
    expect(result).toContain("1.1 recruiting interest");
    expect(result).toContain("2.1 clarify vocabulary");
  });

  it("deduplicates checkpoints", () => {
    const phase = makePhase({ phase: "vocabulary" });
    const profile = makeProfile({
      udl_coverage: {
        engagement: ["1.1 recruiting interest"],
        representation: ["1.1 recruiting interest"], // same checkpoint
        action_expression: [],
      },
    });
    const result = derivePhaseUdlCheckpoints(phase, profile);
    // vocabulary is in engagement AND representation, both contain "1.1 recruiting interest"
    const count = result?.filter((c) => c === "1.1 recruiting interest").length;
    expect(count).toBe(1);
  });

  it("returns undefined for phase with no matching UDL principle", () => {
    const phase = makePhase({ phase: "testing" });
    const profile = makeProfile({
      udl_coverage: {
        engagement: ["1.1 test"],
        representation: ["2.1 test"],
        action_expression: [], // testing is action_expression, but it's empty
      },
    });
    // testing is in actionExpressionPhases, but action_expression is empty
    // Only engagement phases would return engagement, and testing isn't one
    const result = derivePhaseUdlCheckpoints(phase, profile);
    expect(result).toBeUndefined();
  });

  it("returns undefined when profile has no udl_coverage", () => {
    const phase = makePhase({ phase: "warm_up" });
    const profile = makeProfile({ udl_coverage: undefined });
    expect(derivePhaseUdlCheckpoints(phase, profile)).toBeUndefined();
  });
});

// ─── collectAllUdlCheckpoints ───

describe("collectAllUdlCheckpoints", () => {
  it("collects and extracts IDs from all 3 principles", () => {
    const profile = makeProfile({
      udl_coverage: {
        engagement: ["1.1 recruiting interest", "1.3 self-regulation"],
        representation: ["4.2 highlight patterns"],
        action_expression: ["7.1 optimize choice"],
      },
    });
    const result = collectAllUdlCheckpoints(profile);
    expect(result).toContain("1.1");
    expect(result).toContain("1.3");
    expect(result).toContain("4.2");
    expect(result).toContain("7.1");
    expect(result).toHaveLength(4);
  });

  it("deduplicates checkpoint IDs", () => {
    const profile = makeProfile({
      udl_coverage: {
        engagement: ["1.1 something"],
        representation: ["1.1 different description"],
        action_expression: [],
      },
    });
    const result = collectAllUdlCheckpoints(profile);
    expect(result.filter((id) => id === "1.1")).toHaveLength(1);
  });

  it("returns empty array when no udl_coverage", () => {
    const profile = makeProfile({ udl_coverage: undefined });
    expect(collectAllUdlCheckpoints(profile)).toEqual([]);
  });

  it("handles strings without numeric prefix", () => {
    const profile = makeProfile({
      udl_coverage: {
        engagement: ["general engagement strategy"],
        representation: [],
        action_expression: [],
      },
    });
    const result = collectAllUdlCheckpoints(profile);
    // Should fall back to using the full string
    expect(result).toContain("general engagement strategy");
  });
});
