/**
 * Sub-task 5.4 — stage2_assembleSequence sequenceHints consumption.
 *
 * 5 tests covering:
 *  1. Prompt emission — defaultPattern/requiredPhases/repeatablePhases appear
 *     in the prompt passed to Anthropic.
 *  2. Presence-pass — AI output covering all required phases takes the AI path.
 *  3. Presence-fail — AI output missing a required phase falls back to the
 *     algorithmic path with a console.warn.
 *  4. Empty requiredPhases — undefined short-circuits, no fallback.
 *  5. Distinctness gate + per-profile fixture lock for all 4 FormatProfiles.
 *
 * Mocks the Anthropic SDK using the 5.2.5 pattern: vi.doMock +
 * vi.resetModules + dynamic import so each test imports a fresh
 * stage2-assembly module bound to the test's mockCreate.
 *
 * AI-vs-algorithmic discriminator:
 *   result.sequenceMetrics.sequenceCost.modelId
 *     - "claude-sonnet-4-20250514" = AI happy path (default when config.modelId unset)
 *     - "simulator" = buildAlgorithmicSequence (ZERO_COST spread)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  BlockRetrievalResult,
  ActivityBlock,
  RetrievedBlock,
  GenerationRequest,
} from "@/types/activity-blocks";
import type { FormatProfile } from "@/lib/ai/unit-types";
import { getFormatProfile } from "@/lib/ai/unit-types";

// ─── Fixtures ───

function makeBlock(id: string, phase: string, category = "research"): ActivityBlock {
  return {
    id,
    teacher_id: null,
    title: `Block ${id}`,
    description: null,
    prompt: `Do the ${phase} thing`,
    source_type: "manual",
    source_upload_id: null,
    source_unit_id: null,
    source_page_id: null,
    source_activity_index: null,
    bloom_level: "understand",
    time_weight: "moderate",
    grouping: "individual",
    phase,
    activity_category: category,
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
    efficacy_score: 60,
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
  } as unknown as ActivityBlock;
}

function makeRetrievedBlock(id: string, phase: string): RetrievedBlock {
  return {
    block: makeBlock(id, phase),
    relevanceScore: 0.5,
    scoreBreakdown: {
      vectorSimilarity: 0.5,
      efficacyNormalized: 0.5,
      textMatch: 0.5,
      usageSignal: 0,
      metadataFit: 0.5,
    },
  } as unknown as RetrievedBlock;
}

// One candidate per distinct phase across all 4 profiles.
const ALL_PHASES = [
  "investigate", "develop", "create", "evaluate",
  "plan", "act", "reflect", "demonstrate",
  "define", "apply", "report",
  "wonder", "synthesize",
];

const CANDIDATES: RetrievedBlock[] = ALL_PHASES.map((p, i) =>
  makeRetrievedBlock(`blk_${String(i + 1).padStart(3, "0")}`, p)
);

const REQUEST: GenerationRequest = {
  topic: "ab cd",
  unitType: "design",
  lessonCount: 6,
  gradeLevel: "Year 9",
  framework: "IB_MYP",
  constraints: {
    availableResources: [],
    periodMinutes: 55,
    workshopAccess: false,
    softwareAvailable: [],
  },
} as unknown as GenerationRequest;

function makeRetrieval(): BlockRetrievalResult {
  return {
    request: REQUEST,
    candidates: CANDIDATES,
    retrievalMetrics: {
      totalBlocksSearched: ALL_PHASES.length,
      candidatesReturned: ALL_PHASES.length,
      avgRelevanceScore: 0.5,
      retrievalTimeMs: 0,
      retrievalCost: {
        inputTokens: 0,
        outputTokens: 0,
        modelId: "fixture",
        estimatedCostUSD: 0,
        timeMs: 0,
      },
    },
  } as unknown as BlockRetrievalResult;
}

// ─── Mock-response builders ───

// Build an AILesson JSON whose activities cover the given phases via gap
// activities (no library blocks — avoids phase-vs-blockIndex mismatch noise).
function buildAIResponseCovering(phases: string[]): string {
  return JSON.stringify({
    lessons: phases.map((phase, i) => ({
      position: i + 1,
      label: `Lesson ${i + 1}`,
      description: `Lesson on ${phase}`,
      activities: [
        {
          source: "gap",
          gapDescription: `Gap for ${phase}`,
          suggestedPhase: phase,
          suggestedBloom: "understand",
          suggestedCategory: "research",
          suggestedGrouping: "individual",
          suggestedTimeWeight: "moderate",
          suggestedLessonRole: "core",
        },
      ],
    })),
  });
}

// Response covering every phase in every profile — safe default for Test 5
// where we only care about the captured prompt.
const COVER_ALL_RESPONSE = buildAIResponseCovering(ALL_PHASES);

// ─── Fixture loader ───

interface AssemblyFixture {
  prompt: string;
}

function loadFixture(filename: string): AssemblyFixture {
  const path = join(process.cwd(), "tests/fixtures/phase-2", filename);
  return JSON.parse(readFileSync(path, "utf8")) as AssemblyFixture;
}

function fixtureFilename(unitType: string): string {
  // 5.3 precedent: personal_project → personal-project (hyphenated filename).
  const slug = unitType === "personal_project" ? "personal-project" : unitType;
  return `stage2-${slug}-assembly.json`;
}

// ─── Helper: install mocked Anthropic + load stage2-assembly ───

interface MockedStage2 {
  stage2_assembleSequence: typeof import("../stage2-assembly").stage2_assembleSequence;
  mockCreate: ReturnType<typeof vi.fn>;
}

async function setupMockedStage2(mockResponseText: string): Promise<MockedStage2> {
  const mockCreate = vi.fn().mockResolvedValue({
    content: [{ type: "text", text: mockResponseText }],
    stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 200 },
  });

  vi.doMock("@anthropic-ai/sdk", () => ({
    default: class {
      messages = { create: mockCreate };
    },
  }));

  const mod = await import("../stage2-assembly");
  return { stage2_assembleSequence: mod.stage2_assembleSequence, mockCreate };
}

// ─── Tests ───

describe("stage2_assembleSequence — sequenceHints consumption (5.4)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@anthropic-ai/sdk");
    vi.restoreAllMocks();
  });

  it("buildAssemblyPrompt emits defaultPattern, requiredPhases, repeatablePhases when present", async () => {
    const profile = getFormatProfile("design");
    const { stage2_assembleSequence, mockCreate } = await setupMockedStage2(
      buildAIResponseCovering(["investigate", "create", "evaluate"])
    );

    await stage2_assembleSequence(makeRetrieval(), profile, { apiKey: "fake" });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0] as { messages: Array<{ content: string }> };
    const prompt = callArgs.messages[0].content;

    expect(prompt).toContain("Suggested rhythm:");
    expect(prompt).toContain("Required phases (each must appear in at least one lesson):");
    expect(prompt).toContain("Phases that may repeat across non-adjacent lessons:");
    expect(prompt).toContain("investigate, create, evaluate");
  });

  it("presence-pass: AI returns all required phases → AI assembly returned, no fallback", async () => {
    const profile = getFormatProfile("design");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { stage2_assembleSequence, mockCreate } = await setupMockedStage2(
      buildAIResponseCovering(["investigate", "create", "evaluate"])
    );

    const result = await stage2_assembleSequence(makeRetrieval(), profile, { apiKey: "fake" });

    // Discriminator: AI path uses the configured model id (default sonnet),
    // algorithmic path uses "simulator" (via ZERO_COST spread).
    expect(result.sequenceMetrics.sequenceCost.modelId).toBe("claude-sonnet-4-20250514");
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const warnCalls = warnSpy.mock.calls.map(c => String(c[0]));
    expect(warnCalls.some(m => m.includes("Required phases missing"))).toBe(false);
  });

  it("presence-fail: AI omits a required phase → fallback to algorithmic + console.warn", async () => {
    const profile = getFormatProfile("design");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // design requiredPhases = [investigate, create, evaluate]. Omit "evaluate".
    const { stage2_assembleSequence, mockCreate } = await setupMockedStage2(
      buildAIResponseCovering(["investigate", "create"])
    );

    const result = await stage2_assembleSequence(makeRetrieval(), profile, { apiKey: "fake" });

    // Algorithmic fallback discriminator.
    expect(result.sequenceMetrics.sequenceCost.modelId).toBe("simulator");
    // AI call was still attempted exactly once — we fell back, didn't retry.
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const warnCalls = warnSpy.mock.calls.map(c => String(c[0]));
    const match = warnCalls.find(m => m.includes("Required phases missing"));
    expect(match).toBeDefined();
    expect(match).toContain("evaluate");
    expect(match).toContain("profile=design");
  });

  it("empty requiredPhases is a no-op: no fallback fires regardless of AI output", async () => {
    const designBase = getFormatProfile("design");
    const profile: FormatProfile = {
      ...designBase,
      sequenceHints: {
        ...designBase.sequenceHints,
        requiredPhases: undefined,
      },
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // AI response covers no recognised phases — would fail the presence check
    // if requiredPhases were populated.
    const { stage2_assembleSequence, mockCreate } = await setupMockedStage2(
      buildAIResponseCovering(["nonexistent-phase"])
    );

    const result = await stage2_assembleSequence(makeRetrieval(), profile, { apiKey: "fake" });

    expect(result.sequenceMetrics.sequenceCost.modelId).toBe("claude-sonnet-4-20250514");
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const warnCalls = warnSpy.mock.calls.map(c => String(c[0]));
    expect(warnCalls.some(m => m.includes("Required phases missing"))).toBe(false);
  });

  it("distinctness gate: all 4 profile prompts are pairwise distinct + match per-profile fixtures", async () => {
    const unitTypes = ["design", "service", "personal_project", "inquiry"] as const;

    // Set up the mock once; capture prompts across 4 calls with mockClear in between.
    const { stage2_assembleSequence, mockCreate } = await setupMockedStage2(COVER_ALL_RESPONSE);

    const capturedPrompts: Record<string, string> = {};

    for (const unitType of unitTypes) {
      mockCreate.mockClear();
      const profile = getFormatProfile(unitType);
      await stage2_assembleSequence(makeRetrieval(), profile, { apiKey: "fake" });
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0] as { messages: Array<{ content: string }> };
      capturedPrompts[unitType] = callArgs.messages[0].content;
    }

    // Pairwise distinctness.
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < unitTypes.length; i++) {
      for (let j = i + 1; j < unitTypes.length; j++) {
        pairs.push([unitTypes[i], unitTypes[j]]);
      }
    }
    for (const [a, b] of pairs) {
      expect(capturedPrompts[a]).not.toEqual(capturedPrompts[b]);
    }

    // Per-profile signature presence + fixture lock.
    for (const unitType of unitTypes) {
      const profile = getFormatProfile(unitType);
      const prompt = capturedPrompts[unitType];

      expect(prompt).toContain(profile.cycleName);
      expect(prompt).toContain(profile.sequenceHints.defaultPattern!);
      expect(prompt).toContain(profile.sequenceHints.requiredPhases!.join(", "));
      expect(prompt).toContain(profile.sequenceHints.repeatablePhases!.join(", "));

      const fixture = loadFixture(fixtureFilename(unitType));
      expect(fixture.prompt).toEqual(prompt);
    }
  });
});
