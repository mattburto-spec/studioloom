/**
 * Sub-task 5.2.5 commit 3 — stage4-polish MAIN call site max_tokens guard tests.
 *
 * 3 tests:
 *  (1) throws MaxTokensError when mocked Anthropic returns stop_reason="max_tokens"
 *  (2) does NOT throw MaxTokensError on stop_reason="end_turn"
 *  (3) Lesson #38 pin — STAGE4_POLISH_MAX_TOKENS (4096) matches the main-site
 *      value hard-coded in stage4-polish.ts
 *
 * Scope: MAIN call site only (filled.lessons.length ≤ 8). The polishInChunks
 * branch (length > 8, max_tokens=2048) is guarded in commit 4. Inputs here
 * keep lessons.length = 2 to stay on the main branch.
 *
 * Uses vi.doMock + vi.resetModules for scoped per-test module isolation.
 * Cross-realm class identity: match by error.name + message.toContain, not
 * instanceof, per the same pattern used in commits 1 and 2.
 *
 * If these fire, read docs/lessons-learned.md Lesson #39 +
 * docs/projects/dimensions3-phase-2-brief.md §5 row 5.2.5 BEFORE "fixing".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FilledSequence } from "@/types/activity-blocks";
import type { FormatProfile } from "@/lib/ai/unit-types";

// ─── Lesson #38 pin: main-site constant must match source ───
const STAGE4_POLISH_MAX_TOKENS = 4096;

// ─── Minimal fixtures ───

function makeFilledSequence(): FilledSequence {
  return {
    request: {
      topic: "Designing a community garden",
      unitType: "design",
      lessonCount: 2,
      gradeLevel: "13-14",
      framework: "IB_MYP",
      constraints: {
        availableResources: [],
        periodMinutes: 55,
        workshopAccess: false,
        softwareAvailable: [],
      },
    },
    // 2 lessons → stays on MAIN branch (≤8 lesson threshold for polishInChunks)
    lessons: [
      {
        position: 1,
        label: "Lesson 1",
        description: "Investigate users",
        learningGoal: "Students gather research",
        activities: [
          {
            source: "generated",
            title: "User interviews",
            prompt: "Interview 3 community members",
            bloom_level: "understand",
            time_weight: "moderate",
            grouping: "pair",
            phase: "investigate",
            activity_category: "research",
            lesson_structure_role: "core",
            response_type: "long-text",
            materials_needed: [],
          },
        ],
      },
      {
        position: 2,
        label: "Lesson 2",
        description: "Generate solutions",
        learningGoal: "Students sketch garden layouts",
        activities: [
          {
            source: "generated",
            title: "Concept sketching",
            prompt: "Sketch 3 garden layouts",
            bloom_level: "create",
            time_weight: "extended",
            grouping: "individual",
            phase: "ideate",
            activity_category: "ideation",
            lesson_structure_role: "core",
            response_type: "drawing",
            materials_needed: [],
          },
        ],
      },
    ],
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

describe("stage4-polish max_tokens guard — MAIN site (sub-task 5.2.5 commit 3)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@anthropic-ai/sdk");
  });

  it("throws MaxTokensError when stop_reason='max_tokens' on main site", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"activities":[' }],
      stop_reason: "max_tokens",
      usage: { input_tokens: 100, output_tokens: 4096 },
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
        makeFilledSequence(),
        makeMinimalProfile(),
        { apiKey: "fake" }
      );
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeDefined();
    expect((caught as Error).name).toBe("MaxTokensError");
    expect((caught as Error).message).toContain("stage4_polish");
    expect((caught as Error).message).toContain("max_tokens=4096");
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
        makeFilledSequence(),
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

  it("STAGE4_POLISH_MAX_TOKENS constant (4096) appears in source (Lesson #38 pin)", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/pipeline/stages/stage4-polish.ts"),
      "utf8"
    );
    // Main site uses max_tokens: 4096; polishInChunks uses 2048 (commit 4
    // will pin that separately). Assert 4096 appears at least once.
    const matches = source.match(/max_tokens:\s*4096\b/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(STAGE4_POLISH_MAX_TOKENS).toBe(4096);
  });
});
