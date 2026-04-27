/**
 * Live E2E test for /api/student/word-lookup against the real Anthropic API.
 *
 * GATED: only runs when RUN_E2E=1 is set. Default test runs skip this file
 * via describe.skipIf. Running this consumes the API key (~$0.0005 per test).
 *
 * Phase 5 in the master spec scopes the full E2E suite (word-lookup +
 * response-starters); this file lands early in Phase 1C because Matt
 * Checkpoint 1.1 explicitly requires "RUN_E2E=1 vitest run … against live
 * Anthropic returns a definition for 'ergonomics' in <2s".
 *
 * Mocks: requireStudentAuth + createAdminClient (no DB dependency, no auth
 * cookie). Live: @anthropic-ai/sdk — the route's third dependency. This
 * isolates the AI failure mode (max_tokens truncation, network 5xx, schema
 * drift) from the auth/DB integration which has its own sandbox tests.
 *
 * Usage:
 *   RUN_E2E=1 npx vitest run tests/e2e/word-lookup-live.test.ts
 *
 * Required env:
 *   RUN_E2E=1
 *   ANTHROPIC_API_KEY
 *
 * Expected results:
 *   - 200 OK with definition for "ergonomics"
 *   - definition is a non-empty string > 5 chars
 *   - exampleSentence is non-empty
 *   - wall time < 5s (network + Anthropic round-trip)
 *   - cache UPSERT was called once with the live definition
 *   - Cache-Control: private header present
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const liveMode = process.env.RUN_E2E === "1";

// Mock auth + DB; do NOT mock Anthropic SDK.
let upsertSpy: ReturnType<typeof vi.fn<(payload: Record<string, unknown>) => void>>;

vi.mock("@/lib/auth/student", () => ({
  requireStudentAuth: async () => ({ studentId: "live-e2e-student" }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== "word_definitions") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        // Force cache MISS so we always exercise the live Anthropic path.
        select: () => {
          const chain = {
            eq: () => chain,
            maybeSingle: async () => ({ data: null, error: null }),
          };
          return chain;
        },
        upsert: async (payload: Record<string, unknown>) => {
          upsertSpy(payload);
          return { error: null };
        },
      };
    },
  }),
}));

import { POST } from "@/app/api/student/word-lookup/route";
import { NextRequest } from "next/server";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/student/word-lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!liveMode)("[live E2E] POST /api/student/word-lookup against real Anthropic", () => {
  beforeEach(() => {
    upsertSpy = vi.fn();
    process.env.RUN_E2E = "1";
  });

  it(
    'returns a real definition for "ergonomics" in under 5s',
    async () => {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY must be set when RUN_E2E=1");
      }

      const start = Date.now();
      const res = await POST(makeRequest({ word: "ergonomics" }));
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      expect(elapsed).toBeLessThan(5000);

      const body = (await res.json()) as { definition?: string; exampleSentence?: string | null };
      expect(typeof body.definition).toBe("string");
      expect((body.definition ?? "").length).toBeGreaterThan(5);
      expect(typeof body.exampleSentence === "string" || body.exampleSentence === null).toBe(true);

      // Cache header
      expect(res.headers.get("cache-control")).toBe(
        "private, no-cache, no-store, must-revalidate"
      );

      // Live cache write
      expect(upsertSpy).toHaveBeenCalledTimes(1);
      const upserted = upsertSpy.mock.calls[0][0];
      expect(upserted.word).toBe("ergonomics");
      expect(upserted.language).toBe("en");
      expect(upserted.context_hash).toBe("");
      expect(upserted.l1_target).toBe("en");
      expect(typeof upserted.definition).toBe("string");

      // For Checkpoint 1.1 cost report: log the timing
      console.log(`[live E2E] ergonomics: ${elapsed}ms — "${body.definition}"`);
    },
    10_000
  );
});

// ---------------------------------------------------------------------------
// When RUN_E2E is unset: this describe block reports "skipped" via
// describe.skipIf. The default `npm test` run thus stays free of API calls.
// Phase 5 will add response-starters-live.test.ts alongside this file.
// ---------------------------------------------------------------------------
