import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Unit tests for POST /api/student/word-lookup — Phase 1A.
 *
 * Sandbox-mode only (RUN_E2E unset). Live Anthropic path is exercised
 * by the gated tests/e2e suite that lands in Phase 5.
 *
 * Asserts:
 *  - auth gate (401 on unauthenticated)
 *  - body validation (400 on missing/short/long word)
 *  - cache hit returns cached row, does NOT touch sandbox
 *  - cache miss routes through sandbox and upserts to cache
 *  - response includes Cache-Control: private header (Lesson #4 family)
 */

let mockStudentId: string | null = "student-1";

// Mutable cache state per test.
let cachedRow: { definition: string; example_sentence: string | null } | null = null;
let upsertSpy: ReturnType<typeof vi.fn<(payload: Record<string, unknown>) => void>>;
let sandboxSpy: ReturnType<typeof vi.fn<(word: string) => void>>;

vi.mock("@/lib/auth/student", () => ({
  requireStudentAuth: async () => {
    if (!mockStudentId) {
      return {
        error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      };
    }
    return { studentId: mockStudentId };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== "word_definitions") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        // SELECT chain: select(...).eq().eq().eq().eq().maybeSingle()
        select: (_cols: string) => {
          const chain = {
            eq: (_col: string, _val: unknown) => chain,
            maybeSingle: async () => ({ data: cachedRow, error: null }),
          };
          return chain;
        },
        // UPSERT: upsert(payload) — record + return ok
        upsert: async (payload: Record<string, unknown>) => {
          upsertSpy(payload);
          return { error: null };
        },
      };
    },
  }),
}));

vi.mock("@/lib/ai/sandbox/word-lookup-sandbox", () => ({
  lookupSandbox: (word: string) => {
    sandboxSpy(word);
    if (word === "design") {
      return {
        definition: "A plan or drawing for making something on purpose.",
        example: "The chair started as a design on a piece of paper.",
      };
    }
    return {
      definition: `[sandbox] definition of "${word}"`,
      example: `[sandbox] example using "${word}".`,
    };
  },
}));

import { POST } from "../route";
import { NextRequest } from "next/server";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/student/word-lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/student/word-lookup — Phase 1A sandbox path", () => {
  beforeEach(() => {
    mockStudentId = "student-1";
    cachedRow = null;
    upsertSpy = vi.fn();
    sandboxSpy = vi.fn();
    delete process.env.RUN_E2E;
  });

  it("returns 401 when student is not authenticated", async () => {
    mockStudentId = null;
    const res = await POST(makeRequest({ word: "design" }));
    expect(res.status).toBe(401);
    expect(sandboxSpy).not.toHaveBeenCalled();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when word is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/word/);
    expect(sandboxSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when word is 1 char", async () => {
    const res = await POST(makeRequest({ word: "a" }));
    expect(res.status).toBe(400);
    expect(sandboxSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when word is over 50 chars", async () => {
    const res = await POST(makeRequest({ word: "a".repeat(51) }));
    expect(res.status).toBe(400);
    expect(sandboxSpy).not.toHaveBeenCalled();
  });

  it("on cache miss: routes through sandbox, upserts cache, returns sandbox values", async () => {
    cachedRow = null;
    const res = await POST(makeRequest({ word: "design" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.definition).toBe("A plan or drawing for making something on purpose.");
    expect(body.exampleSentence).toBe("The chair started as a design on a piece of paper.");
    expect(sandboxSpy).toHaveBeenCalledTimes(1);
    expect(sandboxSpy).toHaveBeenCalledWith("design");
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy.mock.calls[0][0]).toEqual({
      word: "design",
      language: "en",
      context_hash: "",
      l1_target: "en",
      definition: "A plan or drawing for making something on purpose.",
      example_sentence: "The chair started as a design on a piece of paper.",
    });
  });

  it("on cache hit: returns cached row, does NOT call sandbox, does NOT upsert", async () => {
    cachedRow = {
      definition: "Cached definition.",
      example_sentence: "Cached example.",
    };
    const res = await POST(makeRequest({ word: "ergonomics" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.definition).toBe("Cached definition.");
    expect(body.exampleSentence).toBe("Cached example.");
    expect(sandboxSpy).not.toHaveBeenCalled();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("normalizes the word: trims + lowercases before cache lookup", async () => {
    cachedRow = null;
    const res = await POST(makeRequest({ word: "  DESIGN  " }));
    expect(res.status).toBe(200);
    expect(sandboxSpy).toHaveBeenCalledWith("design");
    expect(upsertSpy.mock.calls[0][0].word).toBe("design");
  });

  it("response carries Cache-Control: private header (Lesson #4 family)", async () => {
    cachedRow = null;
    const res = await POST(makeRequest({ word: "sketch" }));
    expect(res.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, must-revalidate"
    );
  });

  it("on cache hit with NULL example_sentence: returns exampleSentence: null (not undefined)", async () => {
    cachedRow = { definition: "A word.", example_sentence: null };
    const res = await POST(makeRequest({ word: "x" }));
    // x is 1 char so 400 — change word
    const res2 = await POST(makeRequest({ word: "abc" }));
    expect(res2.status).toBe(200);
    const body = await res2.json();
    expect(body.exampleSentence).toBeNull();
    // Sanity on the first call
    expect(res.status).toBe(400);
  });
});
