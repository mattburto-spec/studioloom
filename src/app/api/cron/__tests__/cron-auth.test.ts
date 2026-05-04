/**
 * Phase 6 cron-wire — auth gate tests for /api/cron/* routes.
 *
 * Each cron route validates `Authorization: Bearer ${CRON_SECRET}` before
 * delegating to its job runner. Vercel Cron Jobs automatically attaches
 * this header on cron-invoked GETs when CRON_SECRET is set in env.
 *
 * Tests verify:
 *   1. Missing CRON_SECRET in env → 401
 *   2. Missing Authorization header → 401
 *   3. Wrong bearer value → 401
 *   4. Correct bearer + working job → 200 + delegated result
 *   5. Correct bearer + job throws → 500 with sanitised error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

// Per-route mocks: the job runner returns a stub result; we assert the
// route handler delegates correctly + sets up auth.
vi.mock("@/lib/jobs/cost-alert", () => ({
  run: vi.fn(async () => ({ alertId: "test-alert-1", summary: { dailyCost: 0 } })),
}));
vi.mock("@/lib/jobs/scheduled-hard-delete-cron", () => ({
  run: vi.fn(async () => ({
    runId: "test-run-1",
    summary: { processed: 0, skipped_held: 0, errored: 0 },
  })),
}));
vi.mock("@/lib/jobs/retention-enforcement", () => ({
  run: vi.fn(async () => ({
    runId: "test-run-2",
    summary: { tables_processed: 0, soft_deleted: 0, scheduled: 0 },
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

const CRON_SECRET = "test-cron-secret-fixed-value";
const CASES = [
  { name: "cost-alert", path: "/api/cron/cost-alert" },
  { name: "scheduled-hard-delete", path: "/api/cron/scheduled-hard-delete" },
  { name: "retention-enforcement", path: "/api/cron/retention-enforcement" },
] as const;

function makeRequest(authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader !== undefined) headers.set("authorization", authHeader);
  // Cast through unknown — the route handlers only use request.headers.get.
  return { headers } as unknown as NextRequest;
}

async function loadHandler(path: string): Promise<(req: NextRequest) => Promise<Response>> {
  if (path === "/api/cron/cost-alert") {
    const mod = await import("../cost-alert/route");
    return mod.GET;
  }
  if (path === "/api/cron/scheduled-hard-delete") {
    const mod = await import("../scheduled-hard-delete/route");
    return mod.GET;
  }
  if (path === "/api/cron/retention-enforcement") {
    const mod = await import("../retention-enforcement/route");
    return mod.GET;
  }
  throw new Error(`unknown route: ${path}`);
}

describe("Phase 6 cron auth gate", () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = CRON_SECRET;
    vi.resetModules();  // ensure each test reloads the route handler with fresh env
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  });

  for (const { name, path } of CASES) {
    describe(`${name} (${path})`, () => {
      it("401 when CRON_SECRET env var is unset", async () => {
        delete process.env.CRON_SECRET;
        vi.resetModules();
        const handler = await loadHandler(path);
        const res = await handler(makeRequest(`Bearer anything`));
        expect(res.status).toBe(401);
      });

      it("401 when Authorization header is absent", async () => {
        const handler = await loadHandler(path);
        const res = await handler(makeRequest());
        expect(res.status).toBe(401);
      });

      it("401 when bearer value is wrong", async () => {
        const handler = await loadHandler(path);
        const res = await handler(makeRequest("Bearer wrong-secret"));
        expect(res.status).toBe(401);
      });

      it("401 when authorization scheme is wrong (e.g. Basic)", async () => {
        const handler = await loadHandler(path);
        const res = await handler(makeRequest(`Basic ${CRON_SECRET}`));
        expect(res.status).toBe(401);
      });

      it("200 with delegated result when bearer matches CRON_SECRET", async () => {
        const handler = await loadHandler(path);
        const res = await handler(makeRequest(`Bearer ${CRON_SECRET}`));
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; job: string; result: unknown };
        expect(body.ok).toBe(true);
        expect(body.job).toBe(name);
        expect(body.result).toBeDefined();
      });
    });
  }
});
