/**
 * Sub-task 5.5 — stage3_fillGaps gapGenerationRules consumption.
 *
 * 6 tests covering:
 *  1-4. Per-profile wiring (design, service, personal_project, inquiry):
 *       aiPersona reaches the system prompt, teachingPrinciples reaches the
 *       user prompt via a unique marker phrase, happy path uses Sonnet
 *       (modelUsed === "claude-sonnet-4-20250514", not "fallback").
 *  5.   PP forbiddenPattern negative — AI output containing the banned
 *       "Teacher-directed workshop demo (PP is student-directed)" phrase
 *       triggers the validator, logs console.warn, routes to per-gap
 *       fallback (modelUsed === "fallback").
 *  6.   Distinctness gate — all 4 captured systemPrompts, mockResponses,
 *       and markerPhrases are pairwise !== each other. Locks per-profile
 *       divergence — if anyone collapses two profiles' rules to share
 *       text, this gate fires.
 *
 * Mocks the Anthropic SDK using the 5.2.5/5.4 pattern: vi.doMock +
 * vi.resetModules + dynamic import so each test imports a fresh
 * stage3-generation module bound to the test's mockCreate.
 *
 * Happy-vs-fallback discriminator:
 *   result.generationMetrics.perGapMetrics[0].modelUsed
 *     - "claude-sonnet-4-20250514" = AI happy path (default modelId)
 *     - "fallback" = catch-block fallback construction (plain Error route)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type {
  AssembledSequence,
  GenerationRequest,
} from "@/types/activity-blocks";
import type { FormatProfile } from "@/lib/ai/unit-types";
import { getFormatProfile } from "@/lib/ai/unit-types";

// ─── Fixtures ───

interface Stage3Fixture {
  systemPrompt: string;
  mockResponse: string;
  markerPhrase: string;
}

const FIXTURE_DIR = path.join(process.cwd(), "tests/fixtures/phase-2");

function loadFixture(filename: string): Stage3Fixture {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, filename), "utf8")) as Stage3Fixture;
}

function fixtureFilename(unitType: string): string {
  // 5.3/5.4 precedent: personal_project → personal-project (hyphenated filename).
  const slug = unitType === "personal_project" ? "personal-project" : unitType;
  return `stage3-${slug}-gapfill.json`;
}

const PROFILE_CASES = [
  { unitType: "design", fixture: "stage3-design-gapfill.json" },
  { unitType: "service", fixture: "stage3-service-gapfill.json" },
  { unitType: "personal_project", fixture: "stage3-personal-project-gapfill.json" },
  { unitType: "inquiry", fixture: "stage3-inquiry-gapfill.json" },
] as const;

// ─── Request / AssembledSequence builders ───

const REQUEST: GenerationRequest = {
  topic: "Sustainable packaging",
  unitType: "design",
  lessonCount: 1,
  gradeLevel: "Year 9",
  framework: "IB_MYP",
  constraints: {
    availableResources: [],
    periodMinutes: 55,
    workshopAccess: false,
    softwareAvailable: [],
  },
} as unknown as GenerationRequest;

function buildAssembledWithOneGap(): AssembledSequence {
  return {
    request: REQUEST,
    lessons: [
      {
        position: 1,
        label: "Intro lesson",
        description: "Kick off the unit",
        activities: [
          {
            slotIndex: 0,
            source: "gap",
            gapDescription: "Intro activity",
            gapContext: {
              suggestedBloom: "apply",
              suggestedGrouping: "individual",
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
  } as unknown as AssembledSequence;
}

// ─── Mock installer ───

interface MockedStage3 {
  stage3_fillGaps: typeof import("../stage3-generation").stage3_fillGaps;
  mockCreate: ReturnType<typeof vi.fn>;
}

async function setupMockedStage3(mockResponseText: string): Promise<MockedStage3> {
  const mockCreate = vi.fn().mockResolvedValue({
    content: [{ type: "text", text: mockResponseText }],
    stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 50 },
  });

  vi.doMock("@anthropic-ai/sdk", () => ({
    default: class {
      messages = { create: mockCreate };
    },
  }));

  const mod = await import("../stage3-generation");
  return { stage3_fillGaps: mod.stage3_fillGaps, mockCreate };
}

// ─── Tests ───

describe("stage3_fillGaps — gapGenerationRules consumption (5.5)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@anthropic-ai/sdk");
    vi.restoreAllMocks();
  });

  for (const pc of PROFILE_CASES) {
    it(`${pc.unitType} profile injects aiPersona into system prompt and teachingPrinciples marker into user prompt`, async () => {
      const fx = loadFixture(pc.fixture);
      const profile: FormatProfile = getFormatProfile(pc.unitType);

      const { stage3_fillGaps, mockCreate } = await setupMockedStage3(fx.mockResponse);

      const result = await stage3_fillGaps(
        buildAssembledWithOneGap(),
        profile,
        { apiKey: "fake" }
      );

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const call = mockCreate.mock.calls[0][0] as {
        system: string;
        messages: Array<{ role: string; content: string }>;
      };

      // aiPersona in system prompt — slice a distinctive 40-char prefix to avoid
      // cross-profile prefix collisions on "You are an expert ...".
      const nestedPersona = profile.gapGenerationRules?.aiPersona ?? profile.aiPersona;
      expect(typeof call.system).toBe("string");
      expect(call.system).toContain(nestedPersona.slice(0, 40));

      // teachingPrinciples marker in user prompt.
      const userMsg = call.messages[0].content;
      expect(userMsg).toContain(fx.markerPhrase);

      // Happy path — not fallback.
      const metrics = result.generationMetrics.perGapMetrics;
      expect(metrics.length).toBe(1);
      expect(metrics[0].modelUsed).toBe("claude-sonnet-4-20250514");
    });
  }

  it("PP forbiddenPattern in AI output triggers warn + per-gap fallback", async () => {
    const profile: FormatProfile = getFormatProfile("personal_project");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Polluted AI response — PP forbiddenPatterns[0] embedded verbatim (case-preserving).
    const pollutedActivity = {
      title: "Demo session",
      prompt: "The teacher leads a Teacher-directed workshop demo (PP is student-directed) where the teacher walks students through the technique step by step.",
      bloom_level: "apply",
      time_weight: "moderate",
      grouping: "individual",
      phase: "apply",
      activity_category: "skill-building",
      lesson_structure_role: "core",
      response_type: "long-text",
      materials_needed: [],
      scaffolding: { hints: ["Watch carefully."], sentence_starters: ["I observed..."] },
    };

    const { stage3_fillGaps, mockCreate } = await setupMockedStage3(JSON.stringify(pollutedActivity));

    const result = await stage3_fillGaps(
      buildAssembledWithOneGap(),
      profile,
      { apiKey: "fake" }
    );

    // Mock was still called once — we fell back AFTER receiving the polluted response.
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Discriminator: per-gap modelUsed === "fallback" (not sonnet).
    const metrics = result.generationMetrics.perGapMetrics;
    expect(metrics.length).toBe(1);
    expect(metrics[0].modelUsed).toBe("fallback");

    // console.warn fired with a message naming either "forbidden" (flexible match) or the profile.
    const warnCalls = warnSpy.mock.calls.map(c => String(c[0]));
    const match = warnCalls.find(m =>
      m.toLowerCase().includes("forbidden") || m.includes("profile=personal_project")
    );
    expect(match).toBeDefined();
  });

  it("fixture distinctness gate — all 4 systemPrompts / mockResponses / markerPhrases pairwise !== each other", () => {
    // Locks per-profile divergence — if anyone collapses two profiles' rules to share text, this gate fires.
    const fixtures = PROFILE_CASES.map(pc => ({
      unitType: pc.unitType,
      fx: loadFixture(pc.fixture),
    }));

    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < fixtures.length; i++) {
      for (let j = i + 1; j < fixtures.length; j++) {
        pairs.push([i, j]);
      }
    }

    for (const [i, j] of pairs) {
      const a = fixtures[i];
      const b = fixtures[j];
      expect(a.fx.systemPrompt, `systemPrompt collision ${a.unitType} vs ${b.unitType}`).not.toEqual(b.fx.systemPrompt);
      expect(a.fx.mockResponse, `mockResponse collision ${a.unitType} vs ${b.unitType}`).not.toEqual(b.fx.mockResponse);
      expect(a.fx.markerPhrase, `markerPhrase collision ${a.unitType} vs ${b.unitType}`).not.toEqual(b.fx.markerPhrase);
    }

    // Helper reference — keep TS happy about the filename helper import pattern.
    expect(fixtureFilename("personal_project")).toBe("stage3-personal-project-gapfill.json");
  });
});
