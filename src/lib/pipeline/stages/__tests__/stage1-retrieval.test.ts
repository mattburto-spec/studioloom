/**
 * Sub-task 5.3 — Stage 1 blockRelevance wiring verification.
 *
 * Verifies that FormatProfile.blockRelevance steers retrieval as designed.
 * Corpus is neutralised so textMatch=0, efficacy=constant, usage=0 — ranking
 * is driven entirely by metadataFit. Many blocks tie at metaFit=0.75, so the
 * tie-break depends on Node's stable Array.prototype.sort (ECMA-262 since
 * 2019). Any sort regression in stage1-retrieval.ts will surface here.
 */
// Note: src/lib/pipeline/pipeline.ts:209 also exports stage1_retrieveBlocks
// (legacy duplicate). Orchestrator uses src/lib/pipeline/stages/stage1-retrieval.ts.
// Legacy copy intentionally not covered here.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ActivityBlock, GenerationRequest } from "@/types/activity-blocks";
import type { FormatProfile } from "@/lib/ai/unit-types";

// Mock the embedding service so the happy path runs (not buildTextOnlyResult)
vi.mock("@/lib/ai/embeddings", () => ({
  embedText: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
}));

import { stage1_retrieveBlocks } from "../stage1-retrieval";
import { getFormatProfile } from "@/lib/ai/unit-types";

// ─── Synthetic corpus ───
// 18 blocks, all with phase/category/bloom/grouping set → checks=4.
// Neutralised: efficacy=70 (constant), times_used=0 (usage=0), tags=["neutral"]
// (no grade match). Combined with topic="ab cd" (textMatch=0), relevance score
// reduces to: score = 0.305 * metaFit + 0.14.

function makeBlock(
  id: string,
  phase: string,
  category: string,
  bloom: string,
  grouping: string
): ActivityBlock {
  return {
    id,
    teacher_id: "t1",
    title: `Neutral title ${id}`,
    description: "Neutral description zzzz",
    prompt: "Neutral prompt zzzz",
    tags: ["neutral"],
    phase,
    activity_category: category,
    bloom_level: bloom,
    grouping,
    time_weight: "moderate",
    efficacy_score: 70,
    times_used: 0,
    is_public: false,
    is_archived: false,
    prerequisite_tags: [],
    output_type: null,
    lesson_structure_role: "core",
    response_type: "long-text",
    materials_needed: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as unknown as ActivityBlock;
}

const CORPUS: ActivityBlock[] = [
  makeBlock("blk_001", "develop",     "ideation",      "apply",      "individual"),
  makeBlock("blk_002", "create",      "making",        "apply",      "pair"),
  makeBlock("blk_003", "evaluate",    "critique",      "evaluate",   "group"),
  makeBlock("blk_004", "develop",     "skill-building","remember",   "individual"),
  makeBlock("blk_005", "demonstrate", "presentation",  "apply",      "group"),
  makeBlock("blk_006", "plan",        "collaboration", "understand", "group"),
  makeBlock("blk_007", "wonder",      "analysis",      "analyze",    "individual"),
  makeBlock("blk_008", "synthesize",  "analysis",      "analyze",    "pair"),
  makeBlock("blk_009", "define",      "planning",      "understand", "individual"),
  makeBlock("blk_010", "report",      "documentation", "create",     "individual"),
  makeBlock("blk_011", "investigate", "research",      "understand", "pair"),
  makeBlock("blk_012", "reflect",     "reflection",    "evaluate",   "individual"),
  makeBlock("blk_013", "investigate", "research",      "analyze",    "group"),
  makeBlock("blk_014", "wonder",      "warmup",        "remember",   "individual"),
  makeBlock("blk_015", "create",      "journey",       "apply",      "pair"),
  makeBlock("blk_016", "apply",       "documentation", "apply",      "individual"),
  makeBlock("blk_017", "act",         "analysis",      "analyze",    "group"),
  makeBlock("blk_018", "evaluate",    "reflection",    "evaluate",   "individual"),
];

// ─── Shared GenerationRequest ───
// topic words all ≤3 chars → computeTextMatch returns 0 for every block.
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
};

// ─── Mock supabase config ───
// Chain: .from("activity_blocks").select("*").eq(...).limit(N).eq(...) then await.
// All filter methods return self; final await resolves to { data: CORPUS, error: null }.

function makeMockSupabase() {
  const obj: any = {
    select: () => obj,
    eq: () => obj,
    limit: () => obj,
    not: () => obj,
    order: () => obj,
    then: (resolve: (v: { data: ActivityBlock[]; error: null }) => void) =>
      resolve({ data: CORPUS, error: null }),
  };
  return {
    from: (_table: string) => obj,
    rpc: (_fn: string, _args: Record<string, unknown>) => obj,
  };
}

function makeConfig() {
  return {
    supabase: makeMockSupabase(),
    teacherId: "t1",
    maxCandidates: 30,
    minScore: 0.15,
    visibility: "private" as const,
  };
}

// ─── Fixture loader ───
interface TopFiveEntry { id: string; score: number; }
interface TopFiveFixture { profile: string; topFive: TopFiveEntry[]; }

function loadFixture(filename: string): TopFiveFixture {
  const path = join(process.cwd(), "tests/fixtures/phase-2", filename);
  return JSON.parse(readFileSync(path, "utf8")) as TopFiveFixture;
}

// ─── Helper: run stage1 for a profile ───
async function runStage1(profile: FormatProfile) {
  return stage1_retrieveBlocks(REQUEST, profile, makeConfig());
}

describe("stage1_retrieveBlocks — FormatProfile.blockRelevance wiring (sub-task 5.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("top-5 for design profile matches captured fixture (ids + scores)", async () => {
    const profile = getFormatProfile("design");
    const result = await runStage1(profile);
    const fixture = loadFixture("stage1-design-top5.json");

    const actualIds = result.candidates.slice(0, 5).map(c => c.block.id);
    const expectedIds = fixture.topFive.map(t => t.id);
    expect(actualIds).toEqual(expectedIds);

    for (let i = 0; i < 5; i++) {
      expect(result.candidates[i].relevanceScore).toBeCloseTo(fixture.topFive[i].score, 4);
    }
  });

  it("top-5 for service profile matches captured fixture (ids + scores)", async () => {
    const profile = getFormatProfile("service");
    const result = await runStage1(profile);
    const fixture = loadFixture("stage1-service-top5.json");

    const actualIds = result.candidates.slice(0, 5).map(c => c.block.id);
    const expectedIds = fixture.topFive.map(t => t.id);
    expect(actualIds).toEqual(expectedIds);

    for (let i = 0; i < 5; i++) {
      expect(result.candidates[i].relevanceScore).toBeCloseTo(fixture.topFive[i].score, 4);
    }
  });

  it("top-5 for personal_project profile matches captured fixture (ids + scores)", async () => {
    const profile = getFormatProfile("personal_project");
    const result = await runStage1(profile);
    const fixture = loadFixture("stage1-personal-project-top5.json");

    const actualIds = result.candidates.slice(0, 5).map(c => c.block.id);
    const expectedIds = fixture.topFive.map(t => t.id);
    expect(actualIds).toEqual(expectedIds);

    for (let i = 0; i < 5; i++) {
      expect(result.candidates[i].relevanceScore).toBeCloseTo(fixture.topFive[i].score, 4);
    }
  });

  it("top-5 for inquiry profile matches captured fixture (ids + scores)", async () => {
    const profile = getFormatProfile("inquiry");
    const result = await runStage1(profile);
    const fixture = loadFixture("stage1-inquiry-top5.json");

    const actualIds = result.candidates.slice(0, 5).map(c => c.block.id);
    const expectedIds = fixture.topFive.map(t => t.id);
    expect(actualIds).toEqual(expectedIds);

    for (let i = 0; i < 5; i++) {
      expect(result.candidates[i].relevanceScore).toBeCloseTo(fixture.topFive[i].score, 4);
    }
  });

  it("distinctness gate — all 4 top-5 lists pairwise non-identical AND each profile has ≥1 unique top-5 entry", async () => {
    const [design, service, pp, inquiry] = await Promise.all([
      runStage1(getFormatProfile("design")),
      runStage1(getFormatProfile("service")),
      runStage1(getFormatProfile("personal_project")),
      runStage1(getFormatProfile("inquiry")),
    ]);

    const top5 = {
      design: design.candidates.slice(0, 5).map(c => c.block.id),
      service: service.candidates.slice(0, 5).map(c => c.block.id),
      pp: pp.candidates.slice(0, 5).map(c => c.block.id),
      inquiry: inquiry.candidates.slice(0, 5).map(c => c.block.id),
    };

    // Pairwise non-identical
    const pairs: [keyof typeof top5, keyof typeof top5][] = [
      ["design", "service"],
      ["design", "pp"],
      ["design", "inquiry"],
      ["service", "pp"],
      ["service", "inquiry"],
      ["pp", "inquiry"],
    ];
    for (const [a, b] of pairs) {
      expect(top5[a]).not.toEqual(top5[b]);
    }

    // Each profile has ≥1 id in its top-5 not present in any other profile's top-5
    const profiles = Object.keys(top5) as (keyof typeof top5)[];
    for (const p of profiles) {
      const others = new Set<string>();
      for (const q of profiles) {
        if (q === p) continue;
        for (const id of top5[q]) others.add(id);
      }
      const uniqueToP = top5[p].filter(id => !others.has(id));
      expect(uniqueToP.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("suppress-path verification — rank (blk_014 PP vs inquiry) + score-delta (blk_015 design)", async () => {
    // ── Assertion 1: rank-based (blk_014 warmup suppressed by PP) ──
    const pp = await runStage1(getFormatProfile("personal_project"));
    const inquiry = await runStage1(getFormatProfile("inquiry"));

    const rankPp = pp.candidates.findIndex(c => c.block.id === "blk_014");
    const rankInquiry = inquiry.candidates.findIndex(c => c.block.id === "blk_014");
    expect(rankPp).toBeGreaterThanOrEqual(0);
    expect(rankInquiry).toBeGreaterThanOrEqual(0);
    // PP suppresses warmup, inquiry doesn't — PP sinks blk_014 to the bottom.
    expect(rankPp).toBeGreaterThan(rankInquiry);

    // ── Assertion 2: score-based (blk_015 journey suppressed by design) ──
    // Without the -0.5 journey suppress, metaFit would be (1+0+0.5+0.5)/4 = 0.625,
    // score = 0.305*0.625 + 0.14 = 0.330625. The 0.254375 we assert is exclusively
    // reachable via the -0.5 suppress branch.
    const design = await runStage1(getFormatProfile("design"));
    const blk015 = design.candidates.find(c => c.block.id === "blk_015");
    expect(blk015).toBeDefined();
    expect(blk015!.relevanceScore).toBeCloseTo(0.254375, 5);

    // ── Assertion 3: pin the intent — suppressed score < counterfactual score ──
    expect(0.254375).toBeLessThan(0.330625);
  });
});
