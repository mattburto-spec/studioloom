import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getBlocksBySourceType,
  getCategoryDistribution,
  getStaleBlocks,
  getDuplicateSuspects,
  getLowEfficacyBlocks,
  getOrphanBlocks,
  getEmbeddingHealth,
  getCoverageHeatmap,
  type SourceTypeCount,
  type CategoryCount,
  type StaleBlock,
  type DuplicateSuspect,
  type LowEfficacyBlock,
  type OrphanBlock,
  type EmbeddingHealth,
  type CoverageCell,
} from "../library-health-queries";

// ─── Helper to create mock SupabaseClient ───────────────────────────────

function createMockSupabase(): SupabaseClient {
  return {
    from: vi.fn(),
    rpc: vi.fn(),
  } as unknown as SupabaseClient;
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe("library-health-queries", () => {
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getBlocksBySourceType", () => {
    it("should aggregate blocks by source type", async () => {
      const mockData = [
        { source_type: "teaching_moves" },
        { source_type: "teaching_moves" },
        { source_type: "knowledge_upload" },
        { source_type: null },
      ];

      const mockSelect = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
      const mockNot = vi.fn().mockReturnValue({ select: mockSelect });

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({ not: mockNot }),
      });

      // Set up proper chain
      const from = (mockSupabase.from as ReturnType<typeof vi.fn>)("activity_blocks");
      const select = from.select("source_type");
      select.not.mockReturnValue({ data: mockData, error: null });

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementationOnce((table) => ({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }));

      const result = await getBlocksBySourceType(mockSupabase);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ source_type: "teaching_moves", count: 2 });
      expect(result[1]).toEqual({ source_type: "knowledge_upload", count: 1 });
      expect(result[2]).toEqual({ source_type: "unknown", count: 1 });
    });

    it("should return empty array when no blocks exist", async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await getBlocksBySourceType(mockSupabase);
      expect(result).toEqual([]);
    });

    it("should throw on database error", async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi
            .fn()
            .mockResolvedValue({
              data: null,
              error: new Error("DB error"),
            }),
        }),
      });

      await expect(getBlocksBySourceType(mockSupabase)).rejects.toThrow(
        "Failed to fetch blocks by source type"
      );
    });
  });

  describe("getCategoryDistribution", () => {
    it("should aggregate blocks by activity category", async () => {
      const mockData = [
        { activity_category: "investigate" },
        { activity_category: "investigate" },
        { activity_category: "ideate" },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      });

      const result = await getCategoryDistribution(mockSupabase);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ activity_category: "investigate", count: 2 });
      expect(result[1]).toEqual({ activity_category: "ideate", count: 1 });
    });

    it("should throw on database error", async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi
            .fn()
            .mockResolvedValue({
              data: null,
              error: new Error("DB error"),
            }),
        }),
      });

      await expect(getCategoryDistribution(mockSupabase)).rejects.toThrow(
        "Failed to fetch category distribution"
      );
    });
  });

  describe("getStaleBlocks", () => {
    it("should return blocks older than threshold days", async () => {
      const mockData: StaleBlock[] = [
        {
          id: "block-1",
          title: "Old Block",
          last_used_at: "2025-01-01T00:00:00Z",
          times_used: 5,
        },
      ];

      const mockQueryBuilder = {
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue(mockQueryBuilder),
      });

      const result = await getStaleBlocks(mockSupabase, 90);

      expect(result).toEqual(mockData);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith("is_archived", false);
      expect(mockQueryBuilder.lt).toHaveBeenCalled();
    });

    it("should use default 90 days when days parameter not provided", async () => {
      const mockQueryBuilder = {
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue(mockQueryBuilder),
      });

      await getStaleBlocks(mockSupabase);

      expect(mockQueryBuilder.lt).toHaveBeenCalled();
    });
  });

  describe("getDuplicateSuspects", () => {
    it("should call RPC function and return results", async () => {
      const mockData: DuplicateSuspect[] = [
        {
          block_a_id: "block-1",
          block_b_id: "block-2",
          similarity: 0.90,
          title_a: "Design Process",
          title_b: "Design Steps",
        },
      ];

      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await getDuplicateSuspects(mockSupabase, 0.88, 0.92);

      expect(result).toEqual(mockData);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("find_duplicate_blocks", {
        min_similarity: 0.88,
        max_similarity: 0.92,
        max_results: 50,
      });
    });

    it("should use default similarity thresholds", async () => {
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [],
        error: null,
      });

      await getDuplicateSuspects(mockSupabase);

      expect(mockSupabase.rpc).toHaveBeenCalledWith("find_duplicate_blocks", {
        min_similarity: 0.88,
        max_similarity: 0.92,
        max_results: 50,
      });
    });

    it("should throw on RPC error", async () => {
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: new Error("RPC failed"),
      });

      await expect(getDuplicateSuspects(mockSupabase)).rejects.toThrow(
        "Failed to fetch duplicate suspects"
      );
    });
  });

  describe("getLowEfficacyBlocks", () => {
    it("should return blocks below efficacy threshold with minimum usage", async () => {
      const mockData: LowEfficacyBlock[] = [
        {
          id: "block-1",
          title: "Low Quality Block",
          efficacy_score: 35,
          times_used: 5,
        },
      ];

      const mockQueryBuilder = {
        lt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue(mockQueryBuilder),
      });

      const result = await getLowEfficacyBlocks(mockSupabase, 40, 3);

      expect(result).toEqual(mockData);
      expect(mockQueryBuilder.lt).toHaveBeenCalledWith("efficacy_score", 40);
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith("times_used", 3);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith("is_archived", false);
    });

    it("should use default thresholds", async () => {
      const mockQueryBuilder = {
        lt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue(mockQueryBuilder),
      });

      await getLowEfficacyBlocks(mockSupabase);

      expect(mockQueryBuilder.lt).toHaveBeenCalledWith("efficacy_score", 40);
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith("times_used", 3);
    });
  });

  describe("getOrphanBlocks", () => {
    it("should identify blocks with missing fields", async () => {
      const mockData = [
        {
          id: "block-1",
          title: "Missing Category",
          activity_category: null,
          phase: "defined",
          embedding: "vector",
        },
        {
          id: "block-2",
          title: "Missing Phase",
          activity_category: "ideate",
          phase: null,
          embedding: "vector",
        },
        {
          id: "block-3",
          title: "Missing Embedding",
          activity_category: "design",
          phase: "ideate",
          embedding: null,
        },
        {
          id: "block-4",
          title: "Complete Block",
          activity_category: "create",
          phase: "make",
          embedding: "vector",
        },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      });

      const result = await getOrphanBlocks(mockSupabase);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: "block-1",
        title: "Missing Category",
        missing_fields: ["activity_category"],
      });
      expect(result[1]).toEqual({
        id: "block-2",
        title: "Missing Phase",
        missing_fields: ["phase"],
      });
      expect(result[2]).toEqual({
        id: "block-3",
        title: "Missing Embedding",
        missing_fields: ["embedding"],
      });
    });

    it("should return empty array when all blocks are healthy", async () => {
      const mockData = [
        {
          id: "block-1",
          title: "Complete Block",
          activity_category: "ideate",
          phase: "defined",
          embedding: "vector",
        },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      });

      const result = await getOrphanBlocks(mockSupabase);

      expect(result).toEqual([]);
    });
  });

  describe("getEmbeddingHealth", () => {
    it("should return embedding health metrics", async () => {
      const mockFromBuilder = {
        select: vi
          .fn()
          .mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 100, error: null }),
          }),
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
        mockFromBuilder
      );

      // First call returns total count
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 100, error: null }),
        }),
      });

      // Second call returns missing count
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ count: 15, error: null }),
          }),
        }),
      });

      const result = await getEmbeddingHealth(mockSupabase);

      expect(result.total).toBe(100);
      expect(result.missing_embedding).toBe(15);
      expect(result.healthy).toBe(85);
    });

    it("should handle zero missing embeddings", async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 50, error: null }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        });

      const result = await getEmbeddingHealth(mockSupabase);

      expect(result.total).toBe(50);
      expect(result.missing_embedding).toBe(0);
      expect(result.healthy).toBe(50);
    });
  });

  describe("getCoverageHeatmap", () => {
    it("should aggregate blocks into phase × category grid", async () => {
      const mockData = [
        { phase: "defined", activity_category: "investigate" },
        { phase: "defined", activity_category: "investigate" },
        { phase: "defined", activity_category: "ideate" },
        { phase: "developed", activity_category: "ideate" },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      });

      const result = await getCoverageHeatmap(mockSupabase);

      expect(result).toHaveLength(3);
      const definedInvestigate = result.find(
        (c) => c.phase === "defined" && c.activity_category === "investigate"
      );
      expect(definedInvestigate?.count).toBe(2);

      const definedIdeate = result.find(
        (c) => c.phase === "defined" && c.activity_category === "ideate"
      );
      expect(definedIdeate?.count).toBe(1);

      const developedIdeate = result.find(
        (c) => c.phase === "developed" && c.activity_category === "ideate"
      );
      expect(developedIdeate?.count).toBe(1);
    });

    it("should handle unassigned phase and category values", async () => {
      const mockData = [
        { phase: null, activity_category: "investigate" },
        { phase: "ideate", activity_category: null },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      });

      const result = await getCoverageHeatmap(mockSupabase);

      expect(result).toHaveLength(2);
      expect(result.some((c) => c.phase === "unassigned")).toBe(true);
      expect(result.some((c) => c.activity_category === "unassigned")).toBe(
        true
      );
    });

    it("should return results sorted by phase then category", async () => {
      const mockData = [
        { phase: "z-phase", activity_category: "investigate" },
        { phase: "a-phase", activity_category: "z-category" },
        { phase: "a-phase", activity_category: "a-category" },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      });

      const result = await getCoverageHeatmap(mockSupabase);

      expect(result[0].phase).toBe("a-phase");
      expect(result[0].activity_category).toBe("a-category");
      expect(result[1].phase).toBe("a-phase");
      expect(result[1].activity_category).toBe("z-category");
      expect(result[2].phase).toBe("z-phase");
    });
  });
});
