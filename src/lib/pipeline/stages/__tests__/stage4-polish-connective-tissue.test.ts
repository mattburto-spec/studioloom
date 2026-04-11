/**
 * Sub-task 5.6 — stage4_polish connectiveTissue consumption.
 *
 * 5 tests covering:
 *  1-4. Per-profile wiring (design, service, personal_project, inquiry):
 *       audienceLanguage reaches the user prompt (marker phrase), reflectionStyle
 *       label reaches the user prompt, at least one transitionVocabulary entry
 *       reaches the user prompt, happy path uses Sonnet
 *       (polishMetrics.totalCost.modelId === "claude-sonnet-4-20250514",
 *       not "simulator" which is the algorithmic fallback path).
 *  5.   Distinctness gate — all 4 captured userPrompts and markerPhrases
 *       pairwise !== each other. Locks per-profile divergence — if anyone
 *       collapses two profiles' connectiveTissue to share text, this gate fires.
 *
 * Mocks the Anthropic SDK using the 5.2.5/5.4/5.5 pattern: vi.doMock +
 * vi.resetModules + dynamic import so each test imports a fresh stage4-polish
 * module bound to the test's mockCreate.
 *
 * Happy-vs-fallback discriminator:
 *   result.polishMetrics.totalCost.modelId
 *     - "claude-sonnet-4-20250514" = AI happy path (default modelId)
 *     - "simulator" = catch-block fallback (ZERO_COST spread)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { FilledSequence } from "@/types/activity-blocks";
import type { FormatProfile, UnitType } from "@/lib/ai/unit-types";
import { getFormatProfile } from "@/lib/ai/unit-types";

// ─── Fixtures ───

interface Stage4Fixture {
  userPrompt: string;
  mockResponse: string;
  markerPhrase: string;
}

const FIXTURE_DIR = path.join(process.cwd(), "tests/fixtures/phase-2");

function loadFixture(filename: string): Stage4Fixture {
  return JSON.parse(
    fs.readFileSync(path.join(FIXTURE_DIR, filename), "utf8")
  ) as Stage4Fixture;
}

const PROFILE_CASES: Array<{
  unitType: UnitType;
  fixture: string;
  reflectionLabel: string;
  transitionSubstring: string;
}> = [
  {
    unitType: "design",
    fixture: "stage4-design-polish.json",
    reflectionLabel: "end-only",
    transitionSubstring: "Now that you've investigated the problem",
  },
  {
    unitType: "service",
    fixture: "stage4-service-polish.json",
    reflectionLabel: "continuous",
    transitionSubstring: "Now that you've listened to your community",
  },
  {
    unitType: "personal_project",
    fixture: "stage4-personal-project-polish.json",
    reflectionLabel: "milestone",
    transitionSubstring: "You've defined your goal",
  },
  {
    unitType: "inquiry",
    fixture: "stage4-inquiry-polish.json",
    reflectionLabel: "end-only",
    transitionSubstring: "The provocation sparked questions",
  },
];

// ─── FilledSequence builder ───

function buildMinimalFilledSequence(): FilledSequence {
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
  } as unknown as FilledSequence;
}

// ─── Mock installer ───

interface MockedStage4 {
  stage4_polish: typeof import("../stage4-polish").stage4_polish;
  mockCreate: ReturnType<typeof vi.fn>;
}

async function setupMockedStage4(mockResponseText: string): Promise<MockedStage4> {
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

  const mod = await import("../stage4-polish");
  return { stage4_polish: mod.stage4_polish, mockCreate };
}

// ─── Tests ───

describe("stage4_polish — connectiveTissue consumption (5.6)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@anthropic-ai/sdk");
    vi.restoreAllMocks();
  });

  for (const pc of PROFILE_CASES) {
    it(`${pc.unitType} profile injects audienceLanguage + reflectionStyle + transitionVocabulary into user prompt`, async () => {
      const fx = loadFixture(pc.fixture);
      const profile: FormatProfile = getFormatProfile(pc.unitType);

      const { stage4_polish, mockCreate } = await setupMockedStage4(fx.mockResponse);

      const result = await stage4_polish(
        buildMinimalFilledSequence(),
        profile,
        { apiKey: "fake" }
      );

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const call = mockCreate.mock.calls[0][0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const userMsg = call.messages[0].content;

      // audienceLanguage marker in user prompt.
      expect(userMsg).toContain(fx.markerPhrase);

      // reflectionStyle label present.
      expect(userMsg).toContain(pc.reflectionLabel);

      // At least one transitionVocabulary entry leaked through.
      expect(userMsg).toContain(pc.transitionSubstring);

      // Happy path — not the simulator fallback.
      expect(result.polishMetrics.totalCost.modelId).toBe("claude-sonnet-4-20250514");
    });
  }

  it("fixture distinctness gate — all 4 userPrompts and markerPhrases pairwise !== each other", () => {
    // Locks per-profile divergence — if anyone collapses two profiles' connectiveTissue
    // to share text, this gate fires.
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
      expect(
        a.fx.userPrompt,
        `userPrompt collision ${a.unitType} vs ${b.unitType}`
      ).not.toEqual(b.fx.userPrompt);
      expect(
        a.fx.markerPhrase,
        `markerPhrase collision ${a.unitType} vs ${b.unitType}`
      ).not.toEqual(b.fx.markerPhrase);
    }
  });
});
