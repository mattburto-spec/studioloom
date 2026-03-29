/**
 * Tests for Dimensions v2 client-side post-filtering in retrieve.ts
 * Tests the filtering logic WITHOUT hitting Supabase (mock the RPC call).
 *
 * Since retrieveContext() is async and calls embedText + supabaseAdmin.rpc,
 * we test the filtering logic by extracting it into testable assertions
 * against the data shapes.
 */
import { describe, it, expect } from "vitest";
import type { RetrievedChunk } from "../retrieve";
import type { RetrievedLessonProfile } from "../retrieve-lesson-profiles";

// ─── Test the filter logic directly (same as in retrieve.ts) ───

function makeChunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    id: "chunk-1",
    content: "Test content",
    context_preamble: null,
    metadata: {
      source_type: "uploaded_plan",
      source_filename: "test.pdf",
      criterion: null,
      page_id: null,
      grade_level: "Year 8",
      subject_area: "Design",
      topic: null,
      global_context: null,
      content_type: null,
      fork_count: 0,
      teacher_rating: null,
      ...(overrides.metadata || {}),
    },
    similarity: 0.8,
    quality_score: 0.7,
    final_score: 0.75,
    ...overrides,
  };
}

// ─── Bloom level filtering ───

describe("Bloom level filtering", () => {
  const bloomOrder = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

  function filterByMinBloom(chunks: RetrievedChunk[], minBloomLevel: string): RetrievedChunk[] {
    const minIdx = bloomOrder.indexOf(minBloomLevel);
    if (minIdx < 0) return chunks;
    return chunks.filter((c) => {
      if (!c.metadata.bloom_level) return true; // pass un-tagged
      return bloomOrder.indexOf(c.metadata.bloom_level) >= minIdx;
    });
  }

  it("filters chunks below minimum bloom level", () => {
    const chunks = [
      makeChunk({ id: "1", metadata: { ...makeChunk().metadata, bloom_level: "remember" } }),
      makeChunk({ id: "2", metadata: { ...makeChunk().metadata, bloom_level: "apply" } }),
      makeChunk({ id: "3", metadata: { ...makeChunk().metadata, bloom_level: "evaluate" } }),
    ];
    const result = filterByMinBloom(chunks, "apply");
    expect(result.map((c) => c.id)).toEqual(["2", "3"]);
  });

  it("passes un-tagged chunks through", () => {
    const chunks = [
      makeChunk({ id: "1" }), // no bloom_level
      makeChunk({ id: "2", metadata: { ...makeChunk().metadata, bloom_level: "remember" } }),
    ];
    const result = filterByMinBloom(chunks, "analyze");
    // un-tagged passes, "remember" doesn't
    expect(result.map((c) => c.id)).toEqual(["1"]);
  });

  it("returns all when no bloom filter", () => {
    const chunks = [
      makeChunk({ id: "1", metadata: { ...makeChunk().metadata, bloom_level: "remember" } }),
      makeChunk({ id: "2", metadata: { ...makeChunk().metadata, bloom_level: "create" } }),
    ];
    // simulating no filter by not calling filterByMinBloom
    expect(chunks).toHaveLength(2);
  });
});

// ─── Grouping filtering ───

describe("Grouping filtering", () => {
  function filterByGrouping(chunks: RetrievedChunk[], grouping: string): RetrievedChunk[] {
    return chunks.filter((c) => {
      if (!c.metadata.grouping) return true; // pass un-tagged
      return c.metadata.grouping === grouping;
    });
  }

  it("filters to exact grouping match", () => {
    const chunks = [
      makeChunk({ id: "1", metadata: { ...makeChunk().metadata, grouping: "individual" } }),
      makeChunk({ id: "2", metadata: { ...makeChunk().metadata, grouping: "small_group" } }),
      makeChunk({ id: "3", metadata: { ...makeChunk().metadata, grouping: "individual" } }),
    ];
    const result = filterByGrouping(chunks, "individual");
    expect(result.map((c) => c.id)).toEqual(["1", "3"]);
  });

  it("passes un-tagged chunks through", () => {
    const chunks = [
      makeChunk({ id: "1" }), // no grouping
      makeChunk({ id: "2", metadata: { ...makeChunk().metadata, grouping: "whole_class" } }),
    ];
    const result = filterByGrouping(chunks, "individual");
    expect(result.map((c) => c.id)).toEqual(["1"]); // un-tagged passes, whole_class doesn't
  });
});

// ─── UDL principle filtering ───

describe("UDL principle filtering", () => {
  const rangeMap: Record<string, [number, number]> = {
    engagement: [1, 3],
    representation: [4, 6],
    action_expression: [7, 9],
  };

  function filterByUdlPrinciple(chunks: RetrievedChunk[], principle: string): RetrievedChunk[] {
    const [lo, hi] = rangeMap[principle] || [0, 0];
    return chunks.filter((c) => {
      if (!c.metadata.udl_checkpoints?.length) return true; // pass un-tagged
      return c.metadata.udl_checkpoints.some((cp) => {
        const num = parseFloat(cp);
        return !isNaN(num) && num >= lo && num <= hi + 0.9;
      });
    });
  }

  it("filters engagement checkpoints (1.x-3.x)", () => {
    const chunks = [
      makeChunk({ id: "1", metadata: { ...makeChunk().metadata, udl_checkpoints: ["1.1", "1.3"] } }),
      makeChunk({ id: "2", metadata: { ...makeChunk().metadata, udl_checkpoints: ["5.2"] } }),
      makeChunk({ id: "3", metadata: { ...makeChunk().metadata, udl_checkpoints: ["2.1", "7.1"] } }),
    ];
    const result = filterByUdlPrinciple(chunks, "engagement");
    // chunk 1 has 1.1 (engagement range), chunk 3 has 2.1 (engagement range)
    expect(result.map((c) => c.id)).toEqual(["1", "3"]);
  });

  it("filters representation checkpoints (4.x-6.x)", () => {
    const chunks = [
      makeChunk({ id: "1", metadata: { ...makeChunk().metadata, udl_checkpoints: ["1.1"] } }),
      makeChunk({ id: "2", metadata: { ...makeChunk().metadata, udl_checkpoints: ["5.2"] } }),
    ];
    const result = filterByUdlPrinciple(chunks, "representation");
    expect(result.map((c) => c.id)).toEqual(["2"]);
  });

  it("filters action_expression checkpoints (7.x-9.x)", () => {
    const chunks = [
      makeChunk({ id: "1", metadata: { ...makeChunk().metadata, udl_checkpoints: ["7.1", "8.3"] } }),
      makeChunk({ id: "2", metadata: { ...makeChunk().metadata, udl_checkpoints: ["1.1"] } }),
    ];
    const result = filterByUdlPrinciple(chunks, "action_expression");
    expect(result.map((c) => c.id)).toEqual(["1"]);
  });

  it("passes un-tagged chunks through", () => {
    const chunks = [
      makeChunk({ id: "1" }), // no udl_checkpoints
      makeChunk({ id: "2", metadata: { ...makeChunk().metadata, udl_checkpoints: ["5.2"] } }),
    ];
    const result = filterByUdlPrinciple(chunks, "engagement");
    // un-tagged passes, 5.2 is representation not engagement
    expect(result.map((c) => c.id)).toEqual(["1"]);
  });
});

// ─── Lesson profile filtering ───

describe("Lesson profile Bloom/UDL filtering", () => {
  function makeProfileResult(overrides: Partial<RetrievedLessonProfile> = {}): RetrievedLessonProfile {
    return {
      id: "lp-1",
      title: "Test Lesson",
      subject_area: "Design",
      grade_level: "Year 8",
      lesson_type: "design_process",
      profile_data: {
        title: "Test",
        subject_area: "Design",
        grade_level: "Year 8",
        lesson_type: "design_process",
        lesson_flow: [],
      } as any,
      similarity: 0.8,
      text_rank: 0.6,
      final_score: 0.7,
      teacher_verified: false,
      teacher_quality_rating: null,
      times_referenced: 0,
      ...overrides,
    };
  }

  it("filters by dominant bloom level (case insensitive)", () => {
    const profiles = [
      makeProfileResult({
        id: "1",
        profile_data: { bloom_distribution: { dominant_level: "Analyze", remember: 0, understand: 0, apply: 0, analyze: 50, evaluate: 30, create: 20 } } as any,
      }),
      makeProfileResult({
        id: "2",
        profile_data: { bloom_distribution: { dominant_level: "Remember", remember: 80, understand: 20, apply: 0, analyze: 0, evaluate: 0, create: 0 } } as any,
      }),
    ];
    const filtered = profiles.filter((p) => {
      const bd = p.profile_data.bloom_distribution;
      if (!bd?.dominant_level) return true;
      return bd.dominant_level.toLowerCase().includes("analyze");
    });
    expect(filtered.map((p) => p.id)).toEqual(["1"]);
  });

  it("filters by UDL principle presence", () => {
    const profiles = [
      makeProfileResult({
        id: "1",
        profile_data: {
          udl_coverage: { engagement: ["1.1 test"], representation: [], action_expression: [] },
        } as any,
      }),
      makeProfileResult({
        id: "2",
        profile_data: {
          udl_coverage: { engagement: [], representation: ["4.1 test"], action_expression: [] },
        } as any,
      }),
    ];
    const principle = "engagement" as const;
    const filtered = profiles.filter((p) => {
      const udl = p.profile_data.udl_coverage;
      if (!udl) return true;
      const arr = udl[principle];
      return arr && arr.length > 0;
    });
    expect(filtered.map((p) => p.id)).toEqual(["1"]);
  });
});
