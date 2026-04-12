import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runWeeklyHygiene, type WeeklyHygieneSummary } from "../library-hygiene-weekly";
import { runMonthlyHygiene, type MonthlyHygieneSummary } from "../library-hygiene-monthly";

/**
 * Test suite for hygiene jobs (weekly and monthly library maintenance)
 *
 * Strategy: Mock the Supabase client to verify correct behavior
 * without hitting the database. We mock successful responses and verify
 * the returned summary objects have the expected structure and values.
 */

function createMockSupabaseClient(options: { emptyResults?: boolean } = {}): SupabaseClient {
  const chainedFunctions = {
    select: vi.fn(function () {
      return this;
    }),
    update: vi.fn(function () {
      return this;
    }),
    insert: vi.fn(function () {
      return this;
    }),
    eq: vi.fn(function () {
      return this;
    }),
    lt: vi.fn(function () {
      return this;
    }),
    lte: vi.fn(function () {
      return this;
    }),
    gte: vi.fn(function () {
      return this;
    }),
    gt: vi.fn(function () {
      return this;
    }),
    or: vi.fn(function () {
      return this;
    }),
    not: vi.fn(function () {
      return this;
    }),
    is: vi.fn(function () {
      return this;
    }),
    limit: vi.fn(function () {
      return this;
    }),
    single: vi.fn(function () {
      return Promise.resolve({ data: null, error: null });
    }),
  };

  const mockClient = {
    from: vi.fn(() => ({
      ...chainedFunctions,
      then: () => Promise.resolve({ data: options.emptyResults ? [] : [], error: null }),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
  };

  return mockClient as unknown as SupabaseClient;
}

describe("Weekly Hygiene Job", () => {
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a summary with all required weekly fields", async () => {
    (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn(function () {
        return this;
      }),
      or: vi.fn(function () {
        return this;
      }),
      eq: vi.fn(function () {
        return this;
      }),
      lt: vi.fn(function () {
        return this;
      }),
      gte: vi.fn(function () {
        return this;
      }),
      update: vi.fn(function () {
        return this;
      }),
      insert: vi.fn(function () {
        return this;
      }),
      not: vi.fn(function () {
        return this;
      }),
      is: vi.fn(function () {
        return this;
      }),
      gt: vi.fn(function () {
        return this;
      }),
      limit: vi.fn(function () {
        return this;
      }),
      then: (resolve: (val: { data: unknown; error: null }) => void) => {
        resolve({ data: [], error: null });
        return Promise.resolve();
      },
    });

    (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await runWeeklyHygiene(mockSupabase);

    expect(result).toHaveProperty("alertId");
    expect(result).toHaveProperty("summary");
    expect(result.summary).toHaveProperty("decayed");
    expect(result.summary).toHaveProperty("flagged_duplicates");
    expect(result.summary).toHaveProperty("flagged_low_efficacy");
    expect(result.summary).toHaveProperty("stale_embeddings");
    expect(typeof result.summary.decayed).toBe("number");
    expect(typeof result.summary.flagged_duplicates).toBe("number");
    expect(typeof result.summary.flagged_low_efficacy).toBe("number");
    expect(typeof result.summary.stale_embeddings).toBe("number");
  });

  it("calls RPC function find_duplicate_blocks with correct parameters", async () => {
    (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn(function () {
        return this;
      }),
      or: vi.fn(function () {
        return this;
      }),
      eq: vi.fn(function () {
        return this;
      }),
      lt: vi.fn(function () {
        return this;
      }),
      gte: vi.fn(function () {
        return this;
      }),
      update: vi.fn(function () {
        return this;
      }),
      insert: vi.fn(function () {
        return this;
      }),
      not: vi.fn(function () {
        return this;
      }),
      is: vi.fn(function () {
        return this;
      }),
      gt: vi.fn(function () {
        return this;
      }),
      limit: vi.fn(function () {
        return this;
      }),
      then: (resolve: (val: { data: unknown; error: null }) => void) => {
        resolve({ data: [], error: null });
        return Promise.resolve();
      },
    });

    (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      error: null,
    });

    await runWeeklyHygiene(mockSupabase);

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "find_duplicate_blocks",
      expect.objectContaining({
        min_similarity: 0.88,
        max_similarity: 0.92,
      })
    );
  });

  it("writes alert to system_alerts table", async () => {
    const fromMock = vi.fn(() => ({
      select: vi.fn(function () {
        return this;
      }),
      or: vi.fn(function () {
        return this;
      }),
      eq: vi.fn(function () {
        return this;
      }),
      lt: vi.fn(function () {
        return this;
      }),
      gte: vi.fn(function () {
        return this;
      }),
      update: vi.fn(function () {
        return this;
      }),
      insert: vi.fn(function () {
        return {
          select: vi.fn(() => ({
            data: [{ id: "alert-weekly-123" }],
            error: null,
          })),
        };
      }),
      not: vi.fn(function () {
        return this;
      }),
      is: vi.fn(function () {
        return this;
      }),
      gt: vi.fn(function () {
        return this;
      }),
      limit: vi.fn(function () {
        return this;
      }),
      then: (resolve: (val: { data: unknown; error: null }) => void) => {
        resolve({ data: [], error: null });
        return Promise.resolve();
      },
    }));

    (mockSupabase.from as ReturnType<typeof vi.fn>) = fromMock;

    (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await runWeeklyHygiene(mockSupabase);

    expect(result.alertId).toBeTruthy();
    expect(typeof result.alertId).toBe("string");
  });
});

describe("Monthly Hygiene Job", () => {
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a summary with all required monthly fields", async () => {
    (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn(function () {
        return this;
      }),
      or: vi.fn(function () {
        return this;
      }),
      eq: vi.fn(function () {
        return this;
      }),
      lt: vi.fn(function () {
        return this;
      }),
      gte: vi.fn(function () {
        return this;
      }),
      update: vi.fn(function () {
        return this;
      }),
      insert: vi.fn(function () {
        return this;
      }),
      not: vi.fn(function () {
        return this;
      }),
      is: vi.fn(function () {
        return this;
      }),
      gt: vi.fn(function () {
        return this;
      }),
      limit: vi.fn(function () {
        return this;
      }),
      single: vi.fn(function () {
        return Promise.resolve({ data: null, error: null });
      }),
      then: (resolve: (val: { data: unknown; error: null }) => void) => {
        resolve({ data: [], error: null });
        return Promise.resolve();
      },
    });

    (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await runMonthlyHygiene(mockSupabase);

    expect(result).toHaveProperty("alertId");
    expect(result).toHaveProperty("summary");
    expect(result.summary).toHaveProperty("merge_proposals");
    expect(result.summary).toHaveProperty("archived");
    expect(typeof result.summary.merge_proposals).toBe("number");
    expect(typeof result.summary.archived).toBe("number");
  });

  it("calls RPC with high similarity threshold for merge detection", async () => {
    (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn(function () {
        return this;
      }),
      or: vi.fn(function () {
        return this;
      }),
      eq: vi.fn(function () {
        return this;
      }),
      lt: vi.fn(function () {
        return this;
      }),
      gte: vi.fn(function () {
        return this;
      }),
      update: vi.fn(function () {
        return this;
      }),
      insert: vi.fn(function () {
        return this;
      }),
      not: vi.fn(function () {
        return this;
      }),
      is: vi.fn(function () {
        return this;
      }),
      gt: vi.fn(function () {
        return this;
      }),
      limit: vi.fn(function () {
        return this;
      }),
      single: vi.fn(function () {
        return Promise.resolve({ data: null, error: null });
      }),
      then: (resolve: (val: { data: unknown; error: null }) => void) => {
        resolve({ data: [], error: null });
        return Promise.resolve();
      },
    });

    (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      error: null,
    });

    await runMonthlyHygiene(mockSupabase);

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "find_duplicate_blocks",
      expect.objectContaining({
        min_similarity: 0.95,
        max_similarity: 1.0,
      })
    );
  });

  it("writes summary to system_alerts", async () => {
    (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn(function () {
        return this;
      }),
      or: vi.fn(function () {
        return this;
      }),
      eq: vi.fn(function () {
        return this;
      }),
      lt: vi.fn(function () {
        return this;
      }),
      gte: vi.fn(function () {
        return this;
      }),
      update: vi.fn(function () {
        return this;
      }),
      insert: vi.fn(function () {
        return {
          select: vi.fn(() => ({
            data: [{ id: "alert-monthly-456" }],
            error: null,
          })),
        };
      }),
      not: vi.fn(function () {
        return this;
      }),
      is: vi.fn(function () {
        return this;
      }),
      gt: vi.fn(function () {
        return this;
      }),
      limit: vi.fn(function () {
        return this;
      }),
      single: vi.fn(function () {
        return Promise.resolve({ data: null, error: null });
      }),
      then: (resolve: (val: { data: unknown; error: null }) => void) => {
        resolve({ data: [], error: null });
        return Promise.resolve();
      },
    });

    (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await runMonthlyHygiene(mockSupabase);

    expect(result.alertId).toBeTruthy();
    expect(typeof result.alertId).toBe("string");
  });
});

describe("Type safety", () => {
  it("WeeklyHygieneSummary has correct shape", () => {
    const summary: WeeklyHygieneSummary = {
      decayed: 0,
      flagged_duplicates: 0,
      flagged_low_efficacy: 0,
      stale_embeddings: 0,
    };

    expect(summary).toBeDefined();
    expect(typeof summary.decayed).toBe("number");
    expect(typeof summary.flagged_duplicates).toBe("number");
    expect(typeof summary.flagged_low_efficacy).toBe("number");
    expect(typeof summary.stale_embeddings).toBe("number");
  });

  it("MonthlyHygieneSummary has correct shape", () => {
    const summary: MonthlyHygieneSummary = {
      merge_proposals: 0,
      archived: 0,
    };

    expect(summary).toBeDefined();
    expect(typeof summary.merge_proposals).toBe("number");
    expect(typeof summary.archived).toBe("number");
  });
});
