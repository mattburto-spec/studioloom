/**
 * Tests for GET /api/schools/lookup-by-domain — Phase 4.2.
 *
 * Public, unauthenticated route. Calls the SECURITY DEFINER RPC
 * `lookup_school_by_domain` which has the free-email blocklist baked in
 * at the DB level. App layer adds shape validation + Cache-Control header.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
}));

let lookupGET: typeof import("../lookup-by-domain/route").GET;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import("../lookup-by-domain/route");
  lookupGET = mod.GET;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mkReq(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest;
}

describe("GET /api/schools/lookup-by-domain", () => {
  it("returns match for a verified school domain", async () => {
    mockRpc.mockResolvedValue({
      data: [{ school_id: "sch-uuid-1", school_name: "Nanjing International School" }],
      error: null,
    });
    const res = await lookupGET(
      mkReq("http://x/api/schools/lookup-by-domain?domain=nis.org.cn")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.match).toEqual({
      id: "sch-uuid-1",
      name: "Nanjing International School",
    });
    expect(mockRpc).toHaveBeenCalledWith("lookup_school_by_domain", {
      _domain: "nis.org.cn",
    });
  });

  it("returns null match when RPC returns empty array (free-email blocklist hit at DB level)", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const res = await lookupGET(
      mkReq("http://x/api/schools/lookup-by-domain?domain=gmail.com")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.match).toBeNull();
  });

  it("returns null match when RPC returns null (no row)", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const res = await lookupGET(
      mkReq("http://x/api/schools/lookup-by-domain?domain=unknown-school.org")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.match).toBeNull();
  });

  it("returns null match without calling RPC for empty domain", async () => {
    const res = await lookupGET(
      mkReq("http://x/api/schools/lookup-by-domain?domain=")
    );
    expect(res.status).toBe(200);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns null match without calling RPC for malformed domain", async () => {
    const res = await lookupGET(
      mkReq("http://x/api/schools/lookup-by-domain?domain=not-a-domain")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.match).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns null match without calling RPC for missing domain param", async () => {
    const res = await lookupGET(
      mkReq("http://x/api/schools/lookup-by-domain")
    );
    expect(res.status).toBe(200);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects domains over 253 chars (DNS max)", async () => {
    const tooLong = "a".repeat(64) + "." + "b".repeat(64) + "." + "c".repeat(64) + "." + "d".repeat(64) + ".org";
    const res = await lookupGET(
      mkReq(`http://x/api/schools/lookup-by-domain?domain=${tooLong}`)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.match).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("normalises domain to lowercase before calling RPC", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await lookupGET(
      mkReq("http://x/api/schools/lookup-by-domain?domain=NIS.ORG.CN")
    );
    expect(mockRpc).toHaveBeenCalledWith("lookup_school_by_domain", {
      _domain: "nis.org.cn",
    });
  });

  it("trims whitespace from domain param", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await lookupGET(
      mkReq("http://x/api/schools/lookup-by-domain?domain=%20nis.org.cn%20")
    );
    expect(mockRpc).toHaveBeenCalledWith("lookup_school_by_domain", {
      _domain: "nis.org.cn",
    });
  });

  it("returns null on RPC error (graceful degradation)", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "function not found" },
    });
    const res = await lookupGET(
      mkReq("http://x/api/schools/lookup-by-domain?domain=nis.org.cn")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.match).toBeNull();
  });

  it("sets Cache-Control: no-store on every response", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const res = await lookupGET(
      mkReq("http://x/api/schools/lookup-by-domain?domain=nis.org.cn")
    );
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
