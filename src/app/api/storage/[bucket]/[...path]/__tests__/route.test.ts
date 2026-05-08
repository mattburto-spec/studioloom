/**
 * Tests for the storage proxy endpoint (security-plan.md P-3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ──────────────────────────────────────────────────────────────

let mockUserId: string | null = "u-1";
let signedUrlResult: {
  data: { signedUrl: string } | null;
  error: { message: string } | null;
} = { data: { signedUrl: "https://signed.example.com/x" }, error: null };

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockUserId ? { id: mockUserId } : null },
      })),
    },
  }),
}));

const createSignedUrl = vi.fn(async () => signedUrlResult);
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({ createSignedUrl }),
    },
  }),
}));

import { GET } from "../route";

beforeEach(() => {
  mockUserId = "u-1";
  signedUrlResult = {
    data: { signedUrl: "https://signed.example.com/x" },
    error: null,
  };
  createSignedUrl.mockClear();
});

function makeRequest(url = "http://localhost/api/storage/responses/abc/x.jpg") {
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
    const res = await call(makeRequest(), "responses", []);
    expect(res.status).toBe(400);
  });

  it("401s when unauthenticated", async () => {
    mockUserId = null;
    const res = await call(makeRequest(), "responses", ["abc", "x.jpg"]);
    expect(res.status).toBe(401);
  });

  it("302-redirects authenticated requests to a fresh signed URL", async () => {
    const res = await call(makeRequest(), "responses", ["abc", "x.jpg"]);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://signed.example.com/x");
    expect(createSignedUrl).toHaveBeenCalledWith("abc/x.jpg", 300);
  });

  it("decodes path segments before signing", async () => {
    await call(makeRequest(), "responses", ["abc", "foo%20bar", "x.jpg"]);
    expect(createSignedUrl).toHaveBeenCalledWith("abc/foo bar/x.jpg", 300);
  });

  it("sets a private Cache-Control header", async () => {
    const res = await call(makeRequest(), "responses", ["abc", "x.jpg"]);
    const cacheControl = res.headers.get("cache-control") || "";
    expect(cacheControl).toContain("private");
    expect(cacheControl).toContain("max-age=240");
  });

  it("404s when the storage backend returns an error", async () => {
    signedUrlResult = { data: null, error: { message: "object not found" } };
    const res = await call(makeRequest(), "responses", ["abc", "missing.jpg"]);
    expect(res.status).toBe(404);
    // Error detail is NOT leaked to the client.
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
