/**
 * Tests for the storage proxy endpoint (security-plan.md P-3).
 *
 * Most tests here use the unit-images bucket for the happy-path checks
 * because its auth rule is "any authenticated user" — keeps the test
 * setup simple. Per-bucket authorization logic for the responses bucket
 * is covered comprehensively in ./authorize.test.ts; only the wiring
 * (route gates on authorize(); 403s when authorize fails) is verified
 * here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ──────────────────────────────────────────────────────────────

let mockUser: { id: string; app_metadata?: Record<string, unknown> } | null = {
  id: "u-1",
  app_metadata: { user_type: "teacher" },
};
let signedUrlResult: {
  data: { signedUrl: string } | null;
  error: { message: string } | null;
} = { data: { signedUrl: "https://signed.example.com/x" }, error: null };

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
    },
  }),
}));

const createSignedUrl = vi.fn(async () => signedUrlResult);
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ createSignedUrl }) },
  }),
}));

// authorize() is unit-tested separately. Here we just stub it to ok by
// default; specific tests below override to assert the route gates.
const authorizeMock = vi.fn(async () => ({ ok: true }) as { ok: true });
vi.mock("../authorize", () => ({
  authorizeBucketAccess: (...args: unknown[]) => authorizeMock(...args),
}));

import { GET } from "../route";

beforeEach(() => {
  mockUser = { id: "u-1", app_metadata: { user_type: "teacher" } };
  signedUrlResult = {
    data: { signedUrl: "https://signed.example.com/x" },
    error: null,
  };
  createSignedUrl.mockClear();
  authorizeMock.mockReset();
  authorizeMock.mockResolvedValue({ ok: true });
});

function makeRequest(url = "http://localhost/api/storage/unit-images/abc/x.jpg") {
  return new NextRequest(url);
}

async function call(
  request: NextRequest,
  bucket: string,
  pathSegments: string[],
) {
  return GET(request, {
    params: Promise.resolve({ bucket, path: pathSegments }),
  });
}

describe("GET /api/storage/[bucket]/[...path]", () => {
  it("404s for buckets not in allowlist", async () => {
    const res = await call(makeRequest(), "evil-bucket", ["x.jpg"]);
    expect(res.status).toBe(404);
  });

  it("400s on missing path", async () => {
    const res = await call(makeRequest(), "unit-images", []);
    expect(res.status).toBe(400);
  });

  it("401s when unauthenticated", async () => {
    mockUser = null;
    const res = await call(makeRequest(), "unit-images", ["abc", "x.jpg"]);
    expect(res.status).toBe(401);
  });

  it("403s when authorization fails", async () => {
    authorizeMock.mockResolvedValue({ ok: false, reason: "forbidden" });
    const res = await call(makeRequest(), "responses", ["abc", "x.jpg"]);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("403s on malformed responses path", async () => {
    authorizeMock.mockResolvedValue({ ok: false, reason: "malformed_path" });
    const res = await call(makeRequest(), "responses", ["not-uuid", "x.jpg"]);
    expect(res.status).toBe(403);
  });

  it("calls authorize with the correct args", async () => {
    await call(makeRequest(), "unit-images", ["abc", "x.jpg"]);
    expect(authorizeMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u-1" }),
      "unit-images",
      "abc/x.jpg",
    );
  });

  it("302-redirects authorized requests to a fresh signed URL", async () => {
    const res = await call(makeRequest(), "unit-images", ["abc", "x.jpg"]);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://signed.example.com/x");
    expect(createSignedUrl).toHaveBeenCalledWith("abc/x.jpg", 3600);
  });

  it("decodes path segments before signing", async () => {
    await call(makeRequest(), "unit-images", ["abc", "foo%20bar", "x.jpg"]);
    expect(createSignedUrl).toHaveBeenCalledWith("abc/foo bar/x.jpg", 3600);
  });

  it("sets a private Cache-Control header", async () => {
    const res = await call(makeRequest(), "unit-images", ["abc", "x.jpg"]);
    const cacheControl = res.headers.get("cache-control") || "";
    expect(cacheControl).toContain("private");
    expect(cacheControl).toContain("max-age=3540");
  });

  it("404s when the storage backend returns an error", async () => {
    signedUrlResult = { data: null, error: { message: "object not found" } };
    const res = await call(makeRequest(), "unit-images", ["abc", "missing.jpg"]);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
  });

  it("works for unit-images and knowledge-media buckets", async () => {
    const r1 = await call(makeRequest(), "unit-images", ["x.jpg"]);
    expect(r1.status).toBe(302);
    const r2 = await call(makeRequest(), "knowledge-media", ["x.jpg"]);
    expect(r2.status).toBe(302);
  });
});
