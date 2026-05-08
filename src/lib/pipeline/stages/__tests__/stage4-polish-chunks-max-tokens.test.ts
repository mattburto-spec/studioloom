/**
 * Sub-task 5.2.5 commit 4 — stage4-polish CHUNKS call site max_tokens guard tests.
 *
 * 3 tests:
 *  (1) throws MaxTokensError when mocked Anthropic returns stop_reason="max_tokens"
 *      on the chunks-branch call
 *  (2) does NOT throw MaxTokensError on stop_reason="end_turn"
 *  (3) Lesson #38 pin — STAGE4_CHUNKS_MAX_TOKENS (2048) appears in source
 *
 * Scope: CHUNKS call site only (filled.lessons.length > 8 triggers the
 * polishInChunks branch). Main-site guard was added in commit 3 and is
 * tested separately. Inputs here keep lessons.length = 10 to force the
 * chunks branch (chunk size = 4 → 3 chunks).
 *
 * Propagation note: polishInChunks is awaited inside stage4_polish's outer
 * try. A MaxTokensError thrown out of the chunks local catch bubbles up
 * through the await → into the outer catch (which commit 3 taught to
 * re-throw MaxTokensError first) → out of stage4_polish to the caller.
 * No Promise.allSettled swallow-path here (unlike stage3).
 *
 * Uses vi.doMock + vi.resetModules + cross-realm-safe .name match.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FilledSequence, FilledLesson } from "@/types/activity-blocks";
import type { FormatProfile } from "@/lib/ai/unit-types";

// ─── Lesson #38 pin ───
const STAGE4_CHUNKS_MAX_TOKENS = 2048;

// ─── Minimal fixtures ───

function makeLesson(position: number): FilledLesson {
  return {
    position,
    label: `Lesson ${position}`,
    description: `Lesson ${position} description`,
    learningGoal: `Goal ${position}`,
    activities: [
      {
        source: "generated",
        title: `Activity ${position}`,
        prompt: "Do the thing",
        bloom_level: "apply",
        time_weight: "moderate",
        grouping: "individual",
        phase: "investigate",
        activity_category: "research",
        lesson_structure_role: "core",
        response_type: "long-text",
        materials_needed: [],
      },
    ],
  };
}

function makeLongFilledSequence(): FilledSequence {
  // 10 lessons → polishInChunks branch (threshold is > 8, chunkSize = 4 → 3 chunks)
  return {
    request: {
      topic: "Designing a community garden",
      unitType: "design",
      lessonCount: 10,
      gradeLevel: "13-14",
      framework: "IB_MYP",
      constraints: {
        availableResources: [],
        periodMinutes: 55,
        workshopAccess: false,
        softwareAvailable: [],
      },
    },
    lessons: Array.from({ length: 10 }, (_, i) => makeLesson(i + 1)),
    generationMetrics: {
      gapsFilled: 0,
      totalTokensUsed: 0,
      totalCost: {
        inputTokens: 0,
        outputTokens: 0,
        modelId: "fixture",
        estimatedCostUSD: 0,
        timeMs: 0,
      },
      generationTimeMs: 0,
      perGapMetrics: [],
    },
  };
}

// Minimal FormatProfile — stage4 reads cycleName + connectiveTissue in the prompt.
// Stub values are sufficient because this test exercises the max_tokens path, not prompt content.
function makeMinimalProfile(): FormatProfile {
  return {
    cycleName: "Design",
    connectiveTissue: {
      transitionVocabulary: [],
      reflectionStyle: "end-only",
      audienceLanguage: "your audience",
    },
  } as unknown as FormatProfile;
}

// ─── Tests ───

describe("stage4-polish max_tokens guard — CHUNKS site (sub-task 5.2.5 commit 4)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@anthropic-ai/sdk");
  });

  it("throws MaxTokensError when stop_reason='max_tokens' on chunks site", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"activities":[' }],
      stop_reason: "max_tokens",
      usage: { input_tokens: 100, output_tokens: 2048 },
    });

    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: mockCreate };
      },
    }));

    const { stage4_polish } = await import("../stage4-polish");

    let caught: unknown;
    try {
      await stage4_polish(
        makeLongFilledSequence(),
        makeMinimalProfile(),
        { apiKey: "fake" }
      );
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeDefined();
    expect((caught as Error).name).toBe("MaxTokensError");
    expect((caught as Error).message).toContain("stage4_polishInChunks");
    expect((caught as Error).message).toContain("max_tokens=2048");
    expect((caught as Error).message).toContain("Lesson #39");
  });

  it("does NOT throw MaxTokensError when stop_reason='end_turn'", async () => {
    const validPolish = JSON.stringify({
      activities: [],
      interactionMap: [],
      scaffoldingNotes: {},
    });

    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: validPolish }],
      stop_reason: "end_turn",
      usage: { input_tokens: 100, output_tokens: 200 },
    });

    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: mockCreate };
      },
    }));

    const { stage4_polish } = await import("../stage4-polish");

    let caught: unknown;
    let result: unknown;
    try {
      result = await stage4_polish(
        makeLongFilledSequence(),
        makeMinimalProfile(),
        { apiKey: "fake" }
      );
    } catch (e) {
      caught = e;
    }

    if (caught) {
      expect((caught as Error).name).not.toBe("MaxTokensError");
    } else {
      expect(result).toBeDefined();
    }
  });

  it("STAGE4_CHUNKS_MAX_TOKENS constant (2048) appears in source (Lesson #38 pin)", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/pipeline/stages/stage4-polish.ts"),
      "utf8"
    );
    const matches = source.match(/maxTokens:\s*2048\b/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(STAGE4_CHUNKS_MAX_TOKENS).toBe(2048);
  });
});
