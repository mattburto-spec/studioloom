import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Unit tests for POST /api/student/word-lookup — Phase 1A + Phase 2A.
 *
 * Sandbox-mode only (RUN_E2E unset). Live Anthropic path is exercised
 * by the gated tests/e2e suite.
 *
 * Asserts:
 *  - auth gate (401 on unauthenticated)
 *  - body validation (400 on missing/short/long word)
 *  - cache hit returns cached row (with l1_translation), does NOT touch sandbox
 *  - cache miss routes through sandbox, does NOT upsert (Lesson #57)
 *  - response includes Cache-Control: private header (Lesson #4 family)
 *  - response shape includes l1Translation + l1Target (Phase 2A)
 *  - L1 derivation: server-side from learning_profile.languages_at_home[0]
 *  - cache key includes the resolved l1_target (different students see different rows)
 */

let mockStudentId: string | null = "student-1";

// Mutable per-test state.
let cachedRow:
  | {
      definition: string;
      example_sentence: string | null;
      l1_translation: string | null;
    }
  | null = null;
let mockLearningProfile: { languages_at_home?: string[] } | null = null;
let upsertSpy: ReturnType<typeof vi.fn<(payload: Record<string, unknown>) => void>>;
let sandboxSpy: ReturnType<typeof vi.fn<(word: string, l1Target?: string) => void>>;
// Captures every cache-lookup eq() call so tests can assert l1_target was used as key.
let cacheLookupCalls: Array<{ table: string; eqs: Array<[string, unknown]> }>;

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
      if (table === "students") {
        // SELECT learning_profile chain: select(...).eq().maybeSingle()
        return {
          select: (_cols: string) => {
            const chain = {
              eq: (_col: string, _val: unknown) => chain,
              maybeSingle: async () => ({
                data: { learning_profile: mockLearningProfile },
                error: null,
              }),
            };
            return chain;
          },
        };
      }
      if (table === "word_definitions") {
        return {
          select: (_cols: string) => {
            const eqs: Array<[string, unknown]> = [];
            const chain = {
              eq: (col: string, val: unknown) => {
                eqs.push([col, val]);
                return chain;
              },
              maybeSingle: async () => {
                cacheLookupCalls.push({ table, eqs: [...eqs] });
                return { data: cachedRow, error: null };
              },
            };
            return chain;
          },
          upsert: async (payload: Record<string, unknown>) => {
            upsertSpy(payload);
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

vi.mock("@/lib/ai/sandbox/word-lookup-sandbox", () => ({
  lookupSandbox: (word: string, l1Target?: string) => {
    sandboxSpy(word, l1Target);
    if (word === "design") {
      const translations: Record<string, string> = {
        zh: "设计",
        ko: "디자인",
        ja: "デザイン",
      };
      return {
        definition: "A plan or drawing for making something on purpose.",
        example: "The chair started as a design on a piece of paper.",
        l1Translation: l1Target && l1Target !== "en" ? translations[l1Target] ?? null : null,
      };
    }
    return {
      definition: `[sandbox] definition of "${word}"`,
      example: `[sandbox] example using "${word}".`,
      l1Translation: null,
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

describe("POST /api/student/word-lookup — Phase 1A + 2A sandbox path", () => {
  beforeEach(() => {
    mockStudentId = "student-1";
    cachedRow = null;
    mockLearningProfile = null; // Default: no L1 set → resolves to 'en'
    upsertSpy = vi.fn();
    sandboxSpy = vi.fn();
    cacheLookupCalls = [];
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

  it("on cache miss with no L1: returns sandbox values, l1Translation=null, l1Target='en', does NOT upsert (Lesson #57)", async () => {
    cachedRow = null;
    mockLearningProfile = null;
    const res = await POST(makeRequest({ word: "design" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.definition).toBe("A plan or drawing for making something on purpose.");
    expect(body.exampleSentence).toBe("The chair started as a design on a piece of paper.");
    expect(body.l1Translation).toBeNull();
    expect(body.l1Target).toBe("en");
    expect(sandboxSpy).toHaveBeenCalledWith("design", "en");
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("on cache hit: returns cached row including l1_translation, does NOT call sandbox", async () => {
    cachedRow = {
      definition: "Cached definition.",
      example_sentence: "Cached example.",
      l1_translation: null,
    };
    const res = await POST(makeRequest({ word: "ergonomics" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.definition).toBe("Cached definition.");
    expect(body.exampleSentence).toBe("Cached example.");
    expect(body.l1Translation).toBeNull();
    expect(body.l1Target).toBe("en");
    expect(sandboxSpy).not.toHaveBeenCalled();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("normalizes the word: trims + lowercases before cache lookup", async () => {
    cachedRow = null;
    const res = await POST(makeRequest({ word: "  DESIGN  " }));
    expect(res.status).toBe(200);
    expect(sandboxSpy).toHaveBeenCalledWith("design", "en");
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("response carries Cache-Control: private header (Lesson #4 family)", async () => {
    cachedRow = null;
    const res = await POST(makeRequest({ word: "sketch" }));
    expect(res.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, must-revalidate"
    );
  });

  // ────────────────────────────────────────────────────────────────────────
  // Phase 2A — L1 translation path
  // ────────────────────────────────────────────────────────────────────────

  it("derives l1Target='zh' from learning_profile.languages_at_home=['Mandarin']", async () => {
    cachedRow = null;
    mockLearningProfile = { languages_at_home: ["Mandarin", "English"] };
    const res = await POST(makeRequest({ word: "design" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.l1Target).toBe("zh");
    expect(body.l1Translation).toBe("设计");
    expect(sandboxSpy).toHaveBeenCalledWith("design", "zh");
  });

  it("derives l1Target='ko' from learning_profile.languages_at_home=['Korean']", async () => {
    cachedRow = null;
    mockLearningProfile = { languages_at_home: ["Korean"] };
    const res = await POST(makeRequest({ word: "design" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.l1Target).toBe("ko");
    expect(body.l1Translation).toBe("디자인");
  });

  it("falls back to l1Target='en' for unmapped languages (e.g. Tagalog)", async () => {
    cachedRow = null;
    mockLearningProfile = { languages_at_home: ["Tagalog", "Mandarin"] };
    const res = await POST(makeRequest({ word: "design" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.l1Target).toBe("en");
    expect(body.l1Translation).toBeNull();
  });

  it("falls back to l1Target='en' when learning_profile is null", async () => {
    cachedRow = null;
    mockLearningProfile = null;
    const res = await POST(makeRequest({ word: "design" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.l1Target).toBe("en");
    expect(body.l1Translation).toBeNull();
  });

  it("cache key uses the RESOLVED l1_target (different students get different rows)", async () => {
    cachedRow = null;
    mockLearningProfile = { languages_at_home: ["Japanese"] };
    await POST(makeRequest({ word: "design" }));
    // Cache lookup chain: word, language, context_hash, l1_target
    expect(cacheLookupCalls.length).toBe(1);
    const eqs = cacheLookupCalls[0].eqs;
    expect(eqs).toContainEqual(["word", "design"]);
    expect(eqs).toContainEqual(["language", "en"]);
    expect(eqs).toContainEqual(["context_hash", ""]);
    expect(eqs).toContainEqual(["l1_target", "ja"]);
  });

  it("L1 cache hit returns the row's l1_translation (not null)", async () => {
    mockLearningProfile = { languages_at_home: ["Spanish"] };
    cachedRow = {
      definition: "A plan for making something.",
      example_sentence: "Sketch a design.",
      l1_translation: "diseño",
    };
    const res = await POST(makeRequest({ word: "design" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.l1Translation).toBe("diseño");
    expect(body.l1Target).toBe("es");
    expect(sandboxSpy).not.toHaveBeenCalled();
  });
});
