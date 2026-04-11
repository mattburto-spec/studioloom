/**
 * Sub-task 5.2.5 commit 1 — stage2-assembly max_tokens guard tests.
 *
 * 3 tests:
 *  (1) throws MaxTokensError when mocked Anthropic returns stop_reason="max_tokens"
 *  (2) does NOT throw MaxTokensError on stop_reason="end_turn" (happy path)
 *  (3) Lesson #38 pin — STAGE2_MAX_TOKENS constant (4096) matches the value
 *      hard-coded in stage2-assembly.ts
 *
 * Uses vi.doMock + vi.resetModules for scoped per-test module isolation.
 * Cross-realm class identity: after resetModules, the MaxTokensError class
 * the stage sees is a different identity from the top-of-file import — so
 * Test 1 matches by error.name + .message.toContain, not instanceof.
 *
 * If these fire, read docs/lessons-learned.md Lesson #39 +
 * docs/projects/dimensions3-phase-2-brief.md §5 row 5.2.5 BEFORE "fixing".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  BlockRetrievalResult,
  ActivityBlock,
} from "@/types/activity-blocks";
import type { FormatProfile } from "@/lib/ai/unit-types";

// ─── Lesson #38 pin: constant must match source ───
const STAGE2_MAX_TOKENS = 4096;

// ─── Minimal fixtures ───

function makeBlock(): ActivityBlock {
  return {
    id: "block-1",
    teacher_id: null,
    title: "Sample block",
    description: null,
    prompt: "Do the thing",
    source_type: "manual",
    source_upload_id: null,
    source_unit_id: null,
    source_page_id: null,
    source_activity_index: null,
    bloom_level: "understand",
    time_weight: "moderate",
    grouping: "individual",
    phase: "investigate",
    activity_category: "research",
    ai_rules: null,
    udl_checkpoints: [],
    success_look_fors: [],
    output_type: null,
    prerequisite_tags: [],
    lesson_structure_role: "core",
    response_type: null,
    toolkit_tool_id: null,
    materials_needed: [],
    tech_requirements: [],
    scaffolding: null,
    example_response: null,
    efficacy_score: 50,
    times_used: 0,
    times_skipped: 0,
    times_edited: 0,
    avg_time_spent: null,
    avg_completion_rate: null,
    source_format_hint: null,
    tags: [],
    is_assessable: false,
    assessment_config: null,
    interactive_config: null,
    supports_visual_assessment: false,
    pii_scanned: true,
    pii_flags: null,
    copyright_flag: "own",
    teacher_verified: true,
    module: "studioloom",
    media_asset_ids: [],
    is_public: false,
    is_archived: false,
    created_at: "2026-04-11T00:00:00Z",
    updated_at: "2026-04-11T00:00:00Z",
  };
}

function makeRetrieval(): BlockRetrievalResult {
  return {
    request: {
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
    },
    candidates: [
      {
        block: makeBlock(),
        relevanceScore: 0.9,
        scoreBreakdown: {
          vectorSimilarity: 0.9,
          efficacyNormalized: 0.5,
          textMatch: 0.5,
          usageSignal: 0,
          metadataFit: 0.5,
        },
      },
    ],
    retrievalMetrics: {
      totalBlocksSearched: 1,
      candidatesReturned: 1,
      avgRelevanceScore: 0.9,
      retrievalTimeMs: 0,
      retrievalCost: {
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
    cycleName: "Design",
    phases: [
      { id: "investigate", label: "Investigate", description: "research" },
      { id: "ideate", label: "Ideate", description: "generate" },
    ],
    sequenceHints: {
      openingPhase: "investigate",
      closingPhase: "ideate",
      phaseWeights: { investigate: 0.5, ideate: 0.5 },
    },
    blockRelevance: { boost: ["research"], suppress: [] },
  } as unknown as FormatProfile;
}

// ─── Tests ───

describe("stage2-assembly max_tokens guard (sub-task 5.2.5 commit 1)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@anthropic-ai/sdk");
  });

  it("throws MaxTokensError when stop_reason='max_tokens'", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"lessons":[]}' }],
      stop_reason: "max_tokens",
      usage: { input_tokens: 100, output_tokens: 4096 },
    });

    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: mockCreate };
      },
    }));

    const { stage2_assembleSequence } = await import("../stage2-assembly");

    let caught: unknown;
    try {
      await stage2_assembleSequence(
        makeRetrieval(),
        makeMinimalProfile(),
        { apiKey: "fake" }
      );
    } catch (e) {
      caught = e;
    }

    // Cross-realm: match by name + message, not instanceof.
    expect(caught).toBeDefined();
    expect((caught as Error).name).toBe("MaxTokensError");
    expect((caught as Error).message).toContain("stage2_assembleSequence");
    expect((caught as Error).message).toContain("max_tokens=4096");
    expect((caught as Error).message).toContain("Lesson #39");
  });

  it("does NOT throw MaxTokensError when stop_reason='end_turn'", async () => {
    const validLessons = JSON.stringify({
      lessons: [
        {
          position: 1,
          label: "Lesson 1",
          description: "Investigate users",
          activities: [
            { source: "library", blockIndex: 0 },
          ],
        },
      ],
    });

    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: validLessons }],
      stop_reason: "end_turn",
      usage: { input_tokens: 100, output_tokens: 200 },
    });

    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: mockCreate };
      },
    }));

    const { stage2_assembleSequence } = await import("../stage2-assembly");

    let caught: unknown;
    let result: unknown;
    try {
      result = await stage2_assembleSequence(
        makeRetrieval(),
        makeMinimalProfile(),
        { apiKey: "fake" }
      );
    } catch (e) {
      caught = e;
    }

    // Either the happy path succeeded, or it fell back to algorithmic
    // (neither is a MaxTokensError). Both are acceptable — we are only
    // asserting that the guard did NOT fire on end_turn.
    if (caught) {
      expect((caught as Error).name).not.toBe("MaxTokensError");
    } else {
      expect(result).toBeDefined();
    }
  });

  it("STAGE2_MAX_TOKENS constant (4096) matches hard-coded value in source (Lesson #38 pin)", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/pipeline/stages/stage2-assembly.ts"),
      "utf8"
    );
    // Expect exactly one `max_tokens: 4096,` in the file.
    const matches = source.match(/max_tokens:\s*4096\b/g) || [];
    expect(matches.length).toBe(1);
    expect(STAGE2_MAX_TOKENS).toBe(4096);
  });
});
