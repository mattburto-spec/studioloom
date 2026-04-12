/**
 * Dimensions3 Phase D — Feedback System Tests
 *
 * Tests for: edit tracking (D1), efficacy formula (D2),
 * guardrails (D3), self-healing (D4).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractActivities,
  computeDiffPercentage,
  classifyEdit,
  computeEditDiffs,
  summarizeDiffs,
} from "../edit-tracker";
import { computeEfficacyScore, getConfidence } from "../efficacy";
import {
  validateEfficacyChange,
  validateTimeWeightChange,
  requiresManualApproval,
  validateMetadataChangePercent,
  canAutoApprove,
  validateProposal,
} from "../guardrails";
import {
  detectTimeWeightMismatch,
  detectLowCompletion,
  detectHighDeletion,
  analyzeSelfHealing,
} from "../self-healing";
import { DEFAULT_GUARDRAIL_CONFIG, HARD_GUARDRAILS } from "../types";

// ═════════════════════════════════════════════════════════════════
// D1: Edit Tracker
// ═════════════════════════════════════════════════════════════════

describe("D1: Edit Tracker", () => {
  describe("extractActivities", () => {
    it("extracts activities from v2 pages format", () => {
      const content = {
        pages: [
          {
            sections: [
              { activityId: "a1", title: "Intro", prompt: "Do this" },
              { activityId: "a2", title: "Main", prompt: "Do that" },
            ],
          },
          {
            sections: [
              { activityId: "a3", title: "Wrap", prompt: "Reflect" },
            ],
          },
        ],
      };
      const activities = extractActivities(content);
      expect(activities).toHaveLength(3);
      expect(activities[0].id).toBe("a1");
      expect(activities[2].id).toBe("a3");
    });

    it("generates position-based IDs when activityId missing", () => {
      const content = {
        pages: [{ sections: [{ title: "A" }, { title: "B" }] }],
      };
      const activities = extractActivities(content);
      expect(activities[0].id).toBe("pos_0");
      expect(activities[1].id).toBe("pos_1");
    });

    it("handles empty content gracefully", () => {
      expect(extractActivities({})).toHaveLength(0);
      expect(extractActivities({ pages: [] })).toHaveLength(0);
    });
  });

  describe("computeDiffPercentage", () => {
    it("returns 0 for identical strings", () => {
      expect(computeDiffPercentage("hello world", "hello world")).toBe(0);
    });

    it("returns 100 for completely different strings", () => {
      expect(computeDiffPercentage("alpha beta gamma", "one two three")).toBe(100);
    });

    it("returns 0 for both empty", () => {
      expect(computeDiffPercentage("", "")).toBe(0);
    });

    it("returns 100 when one is empty", () => {
      expect(computeDiffPercentage("hello", "")).toBe(100);
      expect(computeDiffPercentage("", "hello")).toBe(100);
    });

    it("ignores case and whitespace", () => {
      expect(computeDiffPercentage("Hello World", "hello   world")).toBe(0);
    });

    it("returns partial diff for overlapping content", () => {
      const pct = computeDiffPercentage("the cat sat on the mat", "the dog sat on the rug");
      expect(pct).toBeGreaterThan(0);
      expect(pct).toBeLessThan(100);
    });
  });

  describe("classifyEdit", () => {
    const makeActivity = (overrides = {}) => ({
      id: "a1", title: "Test", prompt: "Do this", description: "",
      scaffolding: null, example_response: "", bloom_level: "", time_weight: "",
      grouping: "", phase: "", activity_category: "", lesson_structure_role: "",
      source_block_id: null, ...overrides,
    });

    it("classifies identical activities as kept", () => {
      const a = makeActivity();
      const { editType } = classifyEdit(a, a, 0, 0);
      expect(editType).toBe("kept");
    });

    it("classifies moved activities as reordered", () => {
      const a = makeActivity();
      const { editType } = classifyEdit(a, a, 0, 3);
      expect(editType).toBe("reordered");
    });

    it("classifies major text changes as rewritten", () => {
      const before = makeActivity({ prompt: "Sketch three ideas for your product design" });
      const after = makeActivity({ prompt: "Build a prototype using cardboard and tape" });
      const { editType, diffPercentage } = classifyEdit(before, after, 0, 0);
      expect(editType).toBe("rewritten");
      expect(diffPercentage).toBeGreaterThanOrEqual(20);
    });

    it("classifies scaffolding-only changes correctly", () => {
      const before = makeActivity({ scaffolding: { hints: ["hint1"] } });
      const after = makeActivity({ scaffolding: { hints: ["hint1", "hint2"] } });
      const { editType } = classifyEdit(before, after, 0, 0);
      expect(editType).toBe("scaffolding_changed");
    });
  });

  describe("computeEditDiffs", () => {
    it("detects deleted activities", () => {
      const original = { pages: [{ sections: [{ activityId: "a1", title: "X", prompt: "Y" }] }] };
      const saved = { pages: [{ sections: [] }] };
      const diffs = computeEditDiffs(original, saved);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].editType).toBe("deleted");
    });

    it("detects added activities", () => {
      const original = { pages: [{ sections: [] }] };
      const saved = { pages: [{ sections: [{ activityId: "new1", title: "New", prompt: "Fresh" }] }] };
      const diffs = computeEditDiffs(original, saved);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].editType).toBe("added");
    });

    it("detects kept activities", () => {
      const content = { pages: [{ sections: [{ activityId: "a1", title: "Same", prompt: "Same" }] }] };
      const diffs = computeEditDiffs(content, content);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].editType).toBe("kept");
    });
  });

  describe("summarizeDiffs", () => {
    it("counts edit types correctly", () => {
      const diffs = [
        { editType: "kept" as const },
        { editType: "kept" as const },
        { editType: "rewritten" as const },
        { editType: "deleted" as const },
        { editType: "added" as const },
      ].map(d => ({ ...d, activityId: "", activityTitle: "", diffPercentage: 0, sourceBlockId: null, beforeSnapshot: null, afterSnapshot: null, position: { before: 0, after: 0 } }));

      const summary = summarizeDiffs(diffs);
      expect(summary.kept).toBe(2);
      expect(summary.rewritten).toBe(1);
      expect(summary.deleted).toBe(1);
      expect(summary.added).toBe(1);
      expect(summary.totalOriginal).toBe(4); // everything except added
      expect(summary.totalAfter).toBe(4); // everything except deleted
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// D2: Efficacy Computation
// ═════════════════════════════════════════════════════════════════

describe("D2: Efficacy Computation", () => {
  describe("computeEfficacyScore", () => {
    it("returns 100 for perfect signals", () => {
      const score = computeEfficacyScore({
        blockId: "b1", keptRate: 1, deletionRate: 0, editRate: 0,
        completionRate: 1, timeAccuracy: 1, paceScore: 1, evidenceCount: 50,
        signalBreakdown: { teacherInteractions: 20, studentCompletions: 20, timeObservations: 5, paceFeedbackCount: 5 },
      });
      expect(score).toBe(100);
    });

    it("returns 0 for worst signals", () => {
      const score = computeEfficacyScore({
        blockId: "b1", keptRate: 0, deletionRate: 1, editRate: 1,
        completionRate: 0, timeAccuracy: 0, paceScore: 0, evidenceCount: 50,
        signalBreakdown: { teacherInteractions: 20, studentCompletions: 20, timeObservations: 5, paceFeedbackCount: 5 },
      });
      expect(score).toBe(0);
    });

    it("returns ~50 for neutral signals", () => {
      const score = computeEfficacyScore({
        blockId: "b1", keptRate: 0.5, deletionRate: 0.5, editRate: 0.5,
        completionRate: 0.5, timeAccuracy: 0.5, paceScore: 0.5, evidenceCount: 10,
        signalBreakdown: { teacherInteractions: 4, studentCompletions: 3, timeObservations: 2, paceFeedbackCount: 1 },
      });
      expect(score).toBeGreaterThan(40);
      expect(score).toBeLessThan(60);
    });

    it("weights kept_rate highest (0.30)", () => {
      const high = computeEfficacyScore({
        blockId: "b1", keptRate: 1, deletionRate: 0, editRate: 0,
        completionRate: 0, timeAccuracy: 0, paceScore: 0, evidenceCount: 10,
        signalBreakdown: { teacherInteractions: 10, studentCompletions: 0, timeObservations: 0, paceFeedbackCount: 0 },
      });
      const low = computeEfficacyScore({
        blockId: "b1", keptRate: 0, deletionRate: 0, editRate: 0,
        completionRate: 0, timeAccuracy: 0, paceScore: 0, evidenceCount: 10,
        signalBreakdown: { teacherInteractions: 10, studentCompletions: 0, timeObservations: 0, paceFeedbackCount: 0 },
      });
      expect(high - low).toBe(30); // 0.30 * 100
    });
  });

  describe("getConfidence", () => {
    it("returns low for < 8 evidence", () => {
      expect(getConfidence(5)).toBe("low");
    });
    it("returns medium for 8-19 evidence", () => {
      expect(getConfidence(12)).toBe("medium");
    });
    it("returns high for >= 20 evidence", () => {
      expect(getConfidence(25)).toBe("high");
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// D3: Guardrails
// ═════════════════════════════════════════════════════════════════

describe("D3: Guardrails", () => {
  describe("validateEfficacyChange", () => {
    it("allows changes within bounds", () => {
      const result = validateEfficacyChange(50, 65);
      expect(result.valid).toBe(true);
      expect(result.clampedValue).toBe(65);
      expect(result.flags).toHaveLength(0);
    });

    it("clamps below floor (10)", () => {
      const result = validateEfficacyChange(20, 5);
      expect(result.valid).toBe(false);
      expect(result.clampedValue).toBe(10);
      expect(result.flags[0]).toContain("Clamped");
    });

    it("clamps above ceiling (95)", () => {
      const result = validateEfficacyChange(90, 98);
      expect(result.valid).toBe(false);
      expect(result.clampedValue).toBe(95);
    });
  });

  describe("validateTimeWeightChange", () => {
    it("allows one-step change", () => {
      expect(validateTimeWeightChange("quick", "moderate").valid).toBe(true);
      expect(validateTimeWeightChange("moderate", "extended").valid).toBe(true);
    });

    it("rejects multi-step change", () => {
      const result = validateTimeWeightChange("quick", "extended");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("2 steps");
    });

    it("rejects unknown values", () => {
      expect(validateTimeWeightChange("quick", "unknown").valid).toBe(false);
    });
  });

  describe("requiresManualApproval", () => {
    it("requires manual for bloom_level", () => {
      expect(requiresManualApproval("bloom_level")).toBe(true);
    });
    it("requires manual for phase", () => {
      expect(requiresManualApproval("phase")).toBe(true);
    });
    it("requires manual for activity_category", () => {
      expect(requiresManualApproval("activity_category")).toBe(true);
    });
    it("does NOT require manual for efficacy_score", () => {
      expect(requiresManualApproval("efficacy_score")).toBe(false);
    });
    it("does NOT require manual for time_weight", () => {
      expect(requiresManualApproval("time_weight")).toBe(false);
    });
  });

  describe("validateMetadataChangePercent", () => {
    it("allows changes under 20%", () => {
      const result = validateMetadataChangePercent(1, 10);
      expect(result.valid).toBe(true);
      expect(result.changePercent).toBe(10);
    });

    it("rejects changes over 20%", () => {
      const result = validateMetadataChangePercent(3, 10);
      expect(result.valid).toBe(false);
      expect(result.changePercent).toBe(30);
    });

    it("handles zero total", () => {
      expect(validateMetadataChangePercent(0, 0).valid).toBe(true);
    });
  });

  describe("canAutoApprove", () => {
    it("returns false when auto-approve disabled", () => {
      expect(canAutoApprove(DEFAULT_GUARDRAIL_CONFIG, "efficacy_score", 30, 5)).toBe(false);
    });

    it("returns false for manual-only fields even when enabled", () => {
      const config = { ...DEFAULT_GUARDRAIL_CONFIG, autoApproveEnabled: true };
      expect(canAutoApprove(config, "bloom_level", 30, 5)).toBe(false);
    });

    it("returns true when all criteria met", () => {
      const config = {
        autoApproveEnabled: true,
        minEvidenceForAutoApprove: 10,
        maxScoreChangeForAutoApprove: 15,
      };
      expect(canAutoApprove(config, "efficacy_score", 20, 8)).toBe(true);
    });

    it("returns false when evidence too low", () => {
      const config = {
        autoApproveEnabled: true,
        minEvidenceForAutoApprove: 20,
        maxScoreChangeForAutoApprove: 15,
      };
      expect(canAutoApprove(config, "efficacy_score", 10, 8)).toBe(false);
    });

    it("returns false when delta too large", () => {
      const config = {
        autoApproveEnabled: true,
        minEvidenceForAutoApprove: 10,
        maxScoreChangeForAutoApprove: 5,
      };
      expect(canAutoApprove(config, "efficacy_score", 30, 10)).toBe(false);
    });
  });

  describe("validateProposal", () => {
    it("validates efficacy within range", () => {
      const result = validateProposal({
        field: "efficacy_score", currentValue: 50, proposedValue: 70, evidenceCount: 15,
      });
      expect(result.valid).toBe(true);
      expect(result.requiresManual).toBe(false);
    });

    it("flags bloom_level as manual", () => {
      const result = validateProposal({
        field: "bloom_level", currentValue: "apply", proposedValue: "analyze", evidenceCount: 20,
      });
      expect(result.requiresManual).toBe(true);
    });

    it("flags out-of-bounds efficacy", () => {
      const result = validateProposal({
        field: "efficacy_score", currentValue: 50, proposedValue: 98, evidenceCount: 10,
      });
      expect(result.flags.length).toBeGreaterThan(0);
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// D4: Self-Healing
// ═════════════════════════════════════════════════════════════════

describe("D4: Self-Healing", () => {
  describe("detectTimeWeightMismatch", () => {
    it("proposes change when avg_time_spent deviates > 50%", () => {
      const result = detectTimeWeightMismatch({
        id: "b1", title: "Test Block", time_weight: "quick",
        avg_time_spent: 19, times_used: 12,
      });
      expect(result).not.toBeNull();
      expect(result!.trigger).toBe("time_weight_mismatch");
      expect(result!.proposedValue).toBe("moderate"); // one step up
    });

    it("returns null when within threshold", () => {
      const result = detectTimeWeightMismatch({
        id: "b1", title: "Test", time_weight: "moderate",
        avg_time_spent: 15, times_used: 10,
      });
      expect(result).toBeNull();
    });

    it("returns null when insufficient uses", () => {
      const result = detectTimeWeightMismatch({
        id: "b1", title: "Test", time_weight: "quick",
        avg_time_spent: 30, times_used: 3,
      });
      expect(result).toBeNull();
    });

    it("respects one-step constraint", () => {
      // quick → extended is 2 steps; should propose quick → moderate
      const result = detectTimeWeightMismatch({
        id: "b1", title: "Test", time_weight: "quick",
        avg_time_spent: 30, times_used: 15,
      });
      expect(result).not.toBeNull();
      expect(result!.proposedValue).toBe("moderate");
    });
  });

  describe("detectLowCompletion", () => {
    it("flags blocks with < 30% completion over 10+ uses", () => {
      const result = detectLowCompletion({
        id: "b1", title: "Test", avg_completion_rate: 0.2, times_used: 15,
      });
      expect(result).not.toBeNull();
      expect(result!.trigger).toBe("low_completion_rate");
    });

    it("returns null when completion rate OK", () => {
      const result = detectLowCompletion({
        id: "b1", title: "Test", avg_completion_rate: 0.5, times_used: 15,
      });
      expect(result).toBeNull();
    });

    it("returns null when insufficient uses", () => {
      const result = detectLowCompletion({
        id: "b1", title: "Test", avg_completion_rate: 0.1, times_used: 5,
      });
      expect(result).toBeNull();
    });
  });

  describe("detectHighDeletion", () => {
    it("flags blocks deleted > 70% of the time", () => {
      const result = detectHighDeletion({
        id: "b1", title: "Test", times_used: 10,
        times_edited: 1, times_skipped: 8, efficacy_score: 40,
      });
      expect(result).not.toBeNull();
      expect(result!.trigger).toBe("high_deletion_rate");
    });

    it("returns null when deletion rate OK", () => {
      const result = detectHighDeletion({
        id: "b1", title: "Test", times_used: 10,
        times_edited: 1, times_skipped: 3, efficacy_score: 60,
      });
      expect(result).toBeNull();
    });
  });

  describe("analyzeSelfHealing", () => {
    it("returns multiple proposal types for one block", () => {
      const blocks = [{
        id: "b1", title: "Bad Block", time_weight: "quick", bloom_level: "apply",
        avg_time_spent: 25, avg_completion_rate: 0.15,
        times_used: 20, times_edited: 5, times_skipped: 16, efficacy_score: 30,
      }];

      const proposals = analyzeSelfHealing(blocks);
      expect(proposals.length).toBeGreaterThanOrEqual(2); // time + completion + deletion
      const triggers = proposals.map(p => p.trigger);
      expect(triggers).toContain("time_weight_mismatch");
      expect(triggers).toContain("low_completion_rate");
      expect(triggers).toContain("high_deletion_rate");
    });

    it("returns empty for healthy blocks", () => {
      const blocks = [{
        id: "b1", title: "Good Block", time_weight: "moderate", bloom_level: "apply",
        avg_time_spent: 14, avg_completion_rate: 0.85,
        times_used: 20, times_edited: 2, times_skipped: 1, efficacy_score: 75,
      }];

      const proposals = analyzeSelfHealing(blocks);
      expect(proposals).toHaveLength(0);
    });
  });

  describe("HARD_GUARDRAILS constants", () => {
    it("has correct bounds", () => {
      expect(HARD_GUARDRAILS.minEfficacy).toBe(10);
      expect(HARD_GUARDRAILS.maxEfficacy).toBe(95);
      expect(HARD_GUARDRAILS.maxMetadataChangePercent).toBe(20);
    });

    it("lists correct always-manual fields", () => {
      expect(HARD_GUARDRAILS.alwaysManualFields).toContain("bloom_level");
      expect(HARD_GUARDRAILS.alwaysManualFields).toContain("phase");
      expect(HARD_GUARDRAILS.alwaysManualFields).toContain("activity_category");
    });

    it("has correct time weight steps", () => {
      expect(HARD_GUARDRAILS.timeWeightSteps).toEqual(["quick", "moderate", "extended", "flexible"]);
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// D2: Signal Aggregation (test getStudentSignals structure)
// ═════════════════════════════════════════════════════════════════

describe("D2: Signal Aggregation", () => {
  describe("getStudentSignals", () => {
    it("returns correct structure with student_progress data", async () => {
      const { getStudentSignals } = await import("../signals");

      // Mock Supabase client that simulates the correct query path
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "activity_blocks") {
            return {
              select: vi.fn(function () { return this; }),
              eq: vi.fn(function () { return this; }),
              maybeSingle: vi.fn(async () => ({
                data: { source_unit_id: "unit-123", source_page_id: "page-1" },
                error: null,
              })),
            };
          }

          if (table === "student_progress") {
            return {
              select: vi.fn(function () { return this; }),
              eq: vi.fn(function () { return this; }),
              // Simulate query execution returning progress rows
              [Symbol.asyncIterator]: undefined,
              then: async function (onResolve: any) {
                const progressRows = [
                  { status: "complete", time_spent: 15 },
                  { status: "complete", time_spent: 12 },
                  { status: "in_progress", time_spent: 8 },
                  { status: "not_started", time_spent: 0 },
                ];
                return onResolve({ data: progressRows, error: null });
              },
            };
          }

          return { select: () => ({}) };
        }),
      };

      const result = await getStudentSignals(mockSupabase as any, "block-123");

      // Verify the expected structure
      expect(result).toHaveProperty("completions");
      expect(result).toHaveProperty("starts");
      expect(result).toHaveProperty("avgTimeSpent");
      expect(result).toHaveProperty("timeObservations");

      // Verify correct values based on mock data
      expect(result.starts).toBe(4); // 4 student_progress rows
      expect(result.completions).toBe(2); // 2 with status === "complete"
      expect(result.avgTimeSpent).toBe((15 + 12 + 8) / 3); // avg of non-zero time_spent
      expect(result.timeObservations).toBe(3); // 3 rows with time_spent > 0
    });

    it("returns zero values when no source_unit_id found", async () => {
      const { getStudentSignals } = await import("../signals");

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "activity_blocks") {
            return {
              select: vi.fn(function () { return this; }),
              eq: vi.fn(function () { return this; }),
              maybeSingle: vi.fn(async () => ({
                data: null,
                error: null,
              })),
            };
          }
          return { select: () => ({}) };
        }),
      };

      const result = await getStudentSignals(mockSupabase as any, "block-123");

      expect(result).toEqual({
        completions: 0,
        starts: 0,
        avgTimeSpent: 0,
        timeObservations: 0,
      });
    });

    it("returns zero values when student_progress query returns no data", async () => {
      const { getStudentSignals } = await import("../signals");

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "activity_blocks") {
            return {
              select: vi.fn(function () { return this; }),
              eq: vi.fn(function () { return this; }),
              maybeSingle: vi.fn(async () => ({
                data: { source_unit_id: "unit-123", source_page_id: "page-1" },
                error: null,
              })),
            };
          }

          if (table === "student_progress") {
            return {
              select: vi.fn(function () { return this; }),
              eq: vi.fn(function () { return this; }),
              then: async function (onResolve: any) {
                return onResolve({ data: [], error: null });
              },
            };
          }

          return { select: () => ({}) };
        }),
      };

      const result = await getStudentSignals(mockSupabase as any, "block-123");

      expect(result).toEqual({
        completions: 0,
        starts: 0,
        avgTimeSpent: 0,
        timeObservations: 0,
      });
    });

  });
});
