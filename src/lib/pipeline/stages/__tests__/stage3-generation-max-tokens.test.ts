/**
 * Sub-task 5.2.5 commit 2 — stage3-generation max_tokens guard tests.
 *
 * 3 tests:
 *  (1) throws MaxTokensError when mocked Anthropic returns stop_reason="max_tokens"
 *  (2) does NOT throw MaxTokensError on stop_reason="end_turn"
 *  (3) Lesson #38 pin — STAGE3_MAX_TOKENS (2048) matches the value hard-coded
 *      in stage3-generation.ts
 *
 * CRITICAL: the site sits inside Promise.allSettled + a local catch that
 * swallows exceptions. Two guards are needed and tested end-to-end:
 *   (a) local catch re-throws MaxTokensError instead of falling back
 *   (b) Promise.allSettled consumer re-throws on rejected MaxTokensError
 *       instead of silently dropping it
 *
 * If test 1 fails, one of those guards has been removed/weakened — read
 * docs/lessons-learned.md Lesson #39 before "fixing".
 *
 * Uses vi.doMock + vi.resetModules for scoped per-test module isolation.
 * Cross-realm class identity: after resetModules the stage-local
 * MaxTokensError is a different class identity from the top-of-file import,
 * so we match by error.name + message.toContain rather than instanceof.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AssembledSequence,
  GenerationRequest,
} from "@/types/activity-blocks";
import type { FormatProfile } from "@/lib/ai/unit-types";

// ─── Lesson #38 pin: constant must match source ───
const STAGE3_MAX_TOKENS = 2048;

// ─── Minimal fixtures ───

function makeRequest(): GenerationRequest {
  return {
    topic: "Designing a community garden",
    unitType: "design",
    lessonCount: 1,
    gradeLevel: "13-14",
    framework: "IB_MYP",
    constraints: {
      availableResources: [],
      periodMinutes: 55,
      workshopAccess: false,
      softwareAvailable: [],
    },
  };
}

function makeAssembledWithOneGap(): AssembledSequence {
  return {
    request: makeRequest(),
    lessons: [
      {
        position: 1,
        label: "Lesson 1",
        description: "Investigate users",
        activities: [
          {
            slotIndex: 0,
            source: "gap",
            gapDescription: "Interview 3 community members",
            gapContext: {
              suggestedBloom: "understand",
              suggestedGrouping: "pair",
              suggestedTimeWeight: "moderate",
              suggestedCategory: "research",
              suggestedPhase: "investigate",
              suggestedLessonRole: "core",
            },
          },
        ],
      },
    ],
    sequenceMetrics: {
      totalSlots: 1,
      filledFromLibrary: 0,
      gapsToGenerate: 1,
      fillRate: 0,
      prerequisiteViolations: [],
      sequenceTimeMs: 0,
      sequenceCost: {
        inputTokens: 0,
        outputTokens: 0,
        modelId: "fixture",
        estimatedCostUSD: 0,
        timeMs: 0,
      },
    },
  };
}

function makeMinimalProfile(): FormatProfile {
  return {
    type: "design",
    cycleName: "Design",
    teachingPrinciples: "Students learn by making, reflecting, and iterating.",
    phases: [
      { id: "investigate", label: "Investigate", description: "research" },
    ],
    sequenceHints: {
      openingPhase: "investigate",
      closingPhase: "investigate",
      phaseWeights: { investigate: 1 },
    },
    blockRelevance: { boost: ["research"], suppress: [] },
  } as unknown as FormatProfile;
}

// ─── Tests ───

describe("stage3-generation max_tokens guard (sub-task 5.2.5 commit 2)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@anthropic-ai/sdk");
  });

  it("throws MaxTokensError when stop_reason='max_tokens' (propagates through Promise.allSettled)", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"title":"Partial' }],
      stop_reason: "max_tokens",
      usage: { input_tokens: 100, output_tokens: 2048 },
    });

    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: mockCreate };
      },
    }));

    const { stage3_fillGaps } = await import("../stage3-generation");

    let caught: unknown;
    try {
      await stage3_fillGaps(
        makeAssembledWithOneGap(),
        makeMinimalProfile(),
        { apiKey: "fake", maxConcurrency: 4 }
      );
    } catch (e) {
      caught = e;
    }

    // End-to-end: both the local catch and the Promise.allSettled consumer
    // must re-throw for this to work. Match by name + message (cross-realm).
    expect(caught).toBeDefined();
    expect((caught as Error).name).toBe("MaxTokensError");
    expect((caught as Error).message).toContain("stage3_fillGaps");
    expect((caught as Error).message).toContain("max_tokens=2048");
    expect((caught as Error).message).toContain("Lesson #39");
  });

  it("does NOT throw MaxTokensError when stop_reason='end_turn'", async () => {
    const validActivity = JSON.stringify({
      title: "User interviews",
      prompt: "Interview 3 community members about garden needs",
      bloom_level: "understand",
      time_weight: "moderate",
      grouping: "pair",
      phase: "investigate",
      activity_category: "research",
      lesson_structure_role: "core",
      response_type: "long-text",
      materials_needed: [],
      scaffolding: { hints: ["Start simple"], sentence_starters: ["I noticed..."] },
      ai_rules: { phase: "divergent", tone: "supportive", rules: ["Ask open questions"] },
    });

    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: validActivity }],
      stop_reason: "end_turn",
      usage: { input_tokens: 100, output_tokens: 400 },
    });

    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: mockCreate };
      },
    }));

    const { stage3_fillGaps } = await import("../stage3-generation");

    let caught: unknown;
    let result: unknown;
    try {
      result = await stage3_fillGaps(
        makeAssembledWithOneGap(),
        makeMinimalProfile(),
        { apiKey: "fake", maxConcurrency: 4 }
      );
    } catch (e) {
      caught = e;
    }

    // Either the happy path succeeded or something unrelated failed — we
    // are only asserting that the guard did NOT fire on end_turn.
    if (caught) {
      expect((caught as Error).name).not.toBe("MaxTokensError");
    } else {
      expect(result).toBeDefined();
    }
  });

  it("STAGE3_MAX_TOKENS constant (2048) matches hard-coded value in source (Lesson #38 pin)", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/pipeline/stages/stage3-generation.ts"),
      "utf8"
    );
    // Expect exactly one `max_tokens: 2048,` in the file.
    const matches = source.match(/max_tokens:\s*2048\b/g) || [];
    expect(matches.length).toBe(1);
    expect(STAGE3_MAX_TOKENS).toBe(2048);
  });
});
