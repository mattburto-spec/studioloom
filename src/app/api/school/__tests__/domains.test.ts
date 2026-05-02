/**
 * Tests for /api/school/[id]/domains — Phase 4.2.
 *
 * GET   list domains (RLS via app-layer school_id check)
 * POST  add domain — auto-verify path only in Phase 4.2
 *                    Non-matching domain returns 501 (deferred to §4.3 governance)
 *
 * Auth pattern: SSR client + admin client lookup of teachers.school_id
 * (school_id not on TeacherSession alone). Tests mock both surfaces.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

interface ChainResult {
  data: unknown;
  error: unknown;
}

function buildChain(result: ChainResult = { data: null, error: null }) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "insert", "update", "delete", "eq", "order"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(result).then(resolve);
  return chain as Record<string, ReturnType<typeof vi.fn>> & {
    then: (r: (v: unknown) => void) => Promise<unknown>;
  };
}

const mockRpc = vi.fn();
let teacherChain: ReturnType<typeof buildChain>;
let domainsChain: ReturnType<typeof buildChain>;
const mockFrom = vi.fn((table: string) => {
  if (table === "teachers") return teacherChain;
  if (table === "school_domains") return domainsChain;
  return buildChain();
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom, rpc: mockRpc }),
}));

let domainsGET: typeof import("../[id]/domains/route").GET;
let domainsPOST: typeof import("../[id]/domains/route").POST;

const SCHOOL_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_SCHOOL = "22222222-2222-2222-2222-222222222222";
const TEACHER_ID = "33333333-3333-3333-3333-333333333333";

beforeEach(async () => {
  vi.clearAllMocks();
  teacherChain = buildChain({ data: { school_id: SCHOOL_ID }, error: null });
  domainsChain = buildChain();
  mockFrom.mockImplementation((table: string) => {
    if (table === "teachers") return teacherChain;
    if (table === "school_domains") return domainsChain;
    return buildChain();
  });
  mockGetUser.mockResolvedValue({
    data: { user: { id: TEACHER_ID, email: "matt@nis.org.cn" } },
  });
  mockRpc.mockResolvedValue({ data: false, error: null }); // not free-email by default

  const mod = await import("../[id]/domains/route");
  domainsGET = mod.GET;
  domainsPOST = mod.POST;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mkReq(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest;
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ─── GET ─────────────────────────────────────────────────────────────

describe("GET /api/school/[id]/domains", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await domainsGET(
      mkReq(`http://x/api/school/${SCHOOL_ID}/domains`),
      ctx(SCHOOL_ID)
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when user has no email (orphaned auth row)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: TEACHER_ID, email: null } },
    });
    const res = await domainsGET(
      mkReq(`http://x/api/school/${SCHOOL_ID}/domains`),
      ctx(SCHOOL_ID)
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid UUID school id", async () => {
    const res = await domainsGET(
      mkReq("http://x/api/school/not-a-uuid/domains"),
      ctx("not-a-uuid")
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for cross-school request (don't leak existence)", async () => {
    teacherChain = buildChain({
      data: { school_id: OTHER_SCHOOL },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "teachers") return teacherChain;
      if (table === "school_domains") return domainsChain;
      return buildChain();
    });
    const res = await domainsGET(
      mkReq(`http://x/api/school/${SCHOOL_ID}/domains`),
      ctx(SCHOOL_ID)
    );
    expect(res.status).toBe(404);
  });

  it("returns domain list for own school", async () => {
    domainsChain = buildChain({
      data: [
        {
          id: "d1",
          domain: "nis.org.cn",
          verified: true,
          added_by: TEACHER_ID,
          created_at: "2026-05-02T00:00:00Z",
        },
      ],
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "teachers") return teacherChain;
      if (table === "school_domains") return domainsChain;
      return buildChain();
    });
    const res = await domainsGET(
      mkReq(`http://x/api/school/${SCHOOL_ID}/domains`),
      ctx(SCHOOL_ID)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.domains).toHaveLength(1);
    expect(body.domains[0].domain).toBe("nis.org.cn");
  });

  it("sets Cache-Control: private, no-store", async () => {
    domainsChain = buildChain({ data: [], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "teachers") return teacherChain;
      if (table === "school_domains") return domainsChain;
      return buildChain();
    });
    const res = await domainsGET(
      mkReq(`http://x/api/school/${SCHOOL_ID}/domains`),
      ctx(SCHOOL_ID)
    );
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

// ─── POST ────────────────────────────────────────────────────────────

describe("POST /api/school/[id]/domains", () => {
  function postReq(body: unknown): NextRequest {
    return mkReq(`http://x/api/school/${SCHOOL_ID}/domains`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await domainsPOST(postReq({ domain: "nis.org.cn" }), ctx(SCHOOL_ID));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = mkReq(`http://x/api/school/${SCHOOL_ID}/domains`, {
      method: "POST",
      body: "not json",
    });
    const res = await domainsPOST(req, ctx(SCHOOL_ID));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing/invalid domain", async () => {
    const res = await domainsPOST(postReq({ domain: "not a domain" }), ctx(SCHOOL_ID));
    expect(res.status).toBe(400);
  });

  it("returns 404 for cross-school school_id", async () => {
    teacherChain = buildChain({
      data: { school_id: OTHER_SCHOOL },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "teachers") return teacherChain;
      if (table === "school_domains") return domainsChain;
      return buildChain();
    });
    const res = await domainsPOST(postReq({ domain: "nis.org.cn" }), ctx(SCHOOL_ID));
    expect(res.status).toBe(404);
  });

  it("returns 501 when teacher email domain doesn't match domain being added (Phase 4.3 deferred path)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: TEACHER_ID, email: "matt@gmail.com" } },
    });
    const res = await domainsPOST(postReq({ domain: "nis.org.cn" }), ctx(SCHOOL_ID));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.requires).toBe("phase_4_3_governance_engine");
  });

  it("returns 400 when requester tries to claim a free-email domain", async () => {
    // Teacher email is matt@gmail.com → domain is gmail.com → matches → falls
    // through to free-email check
    mockGetUser.mockResolvedValue({
      data: { user: { id: TEACHER_ID, email: "matt@gmail.com" } },
    });
    mockRpc.mockResolvedValue({ data: true, error: null }); // is_free_email_domain → true
    const res = await domainsPOST(postReq({ domain: "gmail.com" }), ctx(SCHOOL_ID));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.requires).toBe("use_school_owned_domain");
  });

  it("auto-verifies + inserts when teacher email matches the domain", async () => {
    domainsChain = buildChain({
      data: {
        id: "d1",
        domain: "nis.org.cn",
        verified: true,
        added_by: TEACHER_ID,
        created_at: "2026-05-02T00:00:00Z",
      },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "teachers") return teacherChain;
      if (table === "school_domains") return domainsChain;
      return buildChain();
    });

    const res = await domainsPOST(postReq({ domain: "nis.org.cn" }), ctx(SCHOOL_ID));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.autoVerified).toBe(true);
    expect(body.domain.verified).toBe(true);
    expect(domainsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        school_id: SCHOOL_ID,
        domain: "nis.org.cn",
        verified: true,
        added_by: TEACHER_ID,
      })
    );
  });

  it("returns 409 on unique violation (domain already claimed)", async () => {
    domainsChain = buildChain({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "teachers") return teacherChain;
      if (table === "school_domains") return domainsChain;
      return buildChain();
    });
    const res = await domainsPOST(postReq({ domain: "nis.org.cn" }), ctx(SCHOOL_ID));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("domain_already_claimed");
  });

  it("normalises domain to lowercase before insert", async () => {
    domainsChain = buildChain({
      data: {
        id: "d1",
        domain: "nis.org.cn",
        verified: true,
        added_by: TEACHER_ID,
        created_at: "2026-05-02T00:00:00Z",
      },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "teachers") return teacherChain;
      if (table === "school_domains") return domainsChain;
      return buildChain();
    });
    await domainsPOST(postReq({ domain: "NIS.ORG.CN" }), ctx(SCHOOL_ID));
    expect(domainsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "nis.org.cn" })
    );
  });
});
