/**
 * Tests for schools API routes — migration 085 sub-phase B.
 *
 * Covers:
 *   - GET  /api/schools/search      (typeahead)
 *   - POST /api/schools              (user_submitted insert)
 *   - PATCH /api/teacher/school      (set teachers.school_id)
 *
 * Focus: auth gates, input validation, shape of the supabase query chain,
 * and the specific 23505 duplicate-unique-violation path on POST.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Supabase SSR mock (for requireTeacherAuth) ───────────────────────────

const mockGetUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

// ─── Admin client mock ────────────────────────────────────────────────────
// We build a flexible query chain so select/insert/update/eq/ilike/limit/
// maybeSingle/single all chain and ultimately resolve to whatever we set.

interface ChainResult {
  data: unknown;
  error: unknown;
}

function buildChain(result: ChainResult = { data: null, error: null }) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "upsert",
    "eq",
    "neq",
    "ilike",
    "like",
    "in",
    "limit",
    "order",
    "or",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  // Make the chain itself awaitable (for `await query` without .single())
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(result).then(resolve);
  return chain as Record<string, ReturnType<typeof vi.fn>> & {
    then: (r: (v: unknown) => void) => Promise<unknown>;
  };
}

let currentChain: ReturnType<typeof buildChain>;
const mockFrom = vi.fn(() => currentChain);
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

// ─── Route handlers (dynamic import after mocks) ──────────────────────────

let searchGET: typeof import("../search/route").GET;
let schoolsPOST: typeof import("../route").POST;
let teacherSchoolPATCH: typeof import("../../teacher/school/route").PATCH;

beforeEach(async () => {
  vi.clearAllMocks();
  // Reset mockFrom's implementation — vi.clearAllMocks clears call history
  // but preserves any .mockImplementation()/.mockReturnValue() set in previous
  // tests. Without this, earlier multi-call tests leak across to the next.
  mockFrom.mockReset();
  currentChain = buildChain();
  mockFrom.mockImplementation(() => currentChain);
  mockGetUser.mockResolvedValue({
    data: { user: { id: "teacher-uuid-1" } },
  });

  const searchMod = await import("../search/route");
  searchGET = searchMod.GET;
  const schoolsMod = await import("../route");
  schoolsPOST = schoolsMod.POST;
  const teacherSchoolMod = await import("../../teacher/school/route");
  teacherSchoolPATCH = teacherSchoolMod.PATCH;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Helpers
function mkReq(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest;
}

// ─── GET /api/schools/search ──────────────────────────────────────────────

describe("GET /api/schools/search", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await searchGET(mkReq("http://x/api/schools/search?q=nanjing"));
    expect(res.status).toBe(401);
  });

  it("returns empty array for q shorter than 2 chars", async () => {
    const res = await searchGET(mkReq("http://x/api/schools/search?q=n"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.schools).toEqual([]);
    // Should not have even hit the DB
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns empty array for missing q", async () => {
    const res = await searchGET(mkReq("http://x/api/schools/search"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.schools).toEqual([]);
  });

  it("queries schools table with ilike and limit 20", async () => {
    currentChain = buildChain({
      data: [
        {
          id: "s1",
          name: "Nanjing International School",
          city: "Nanjing",
          country: "CN",
          ib_programmes: ["MYP", "DP", "PYP"],
          verified: true,
          source: "ibo",
        },
      ],
      error: null,
    });
    const res = await searchGET(
      mkReq("http://x/api/schools/search?q=nanjing")
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.schools).toHaveLength(1);
    expect(body.schools[0].name).toBe("Nanjing International School");
    expect(mockFrom).toHaveBeenCalledWith("schools");
    expect(currentChain.ilike).toHaveBeenCalledWith("name", "%nanjing%");
    expect(currentChain.limit).toHaveBeenCalledWith(20);
  });

  it("applies country filter when provided (uppercased)", async () => {
    currentChain = buildChain({ data: [], error: null });
    await searchGET(mkReq("http://x/api/schools/search?q=nanjing&country=cn"));
    expect(currentChain.eq).toHaveBeenCalledWith("country", "CN");
  });

  it("ranks prefix matches before substring matches", async () => {
    currentChain = buildChain({
      data: [
        { id: "s1", name: "Abbey Nanjing School", city: null, country: "CN", ib_programmes: [], verified: true, source: "ibo" },
        { id: "s2", name: "Nanjing International School", city: null, country: "CN", ib_programmes: [], verified: true, source: "ibo" },
      ],
      error: null,
    });
    const res = await searchGET(
      mkReq("http://x/api/schools/search?q=nanjing")
    );
    const body = await res.json();
    // s2 (prefix match) should come before s1 (substring only)
    expect(body.schools[0].id).toBe("s2");
    expect(body.schools[1].id).toBe("s1");
  });

  it("ranks verified schools before user_submitted within the same tier", async () => {
    currentChain = buildChain({
      data: [
        { id: "s1", name: "Nanjing International School", city: null, country: "CN", ib_programmes: [], verified: false, source: "user_submitted" },
        { id: "s2", name: "Nanjing Foreign Language School", city: null, country: "CN", ib_programmes: [], verified: true, source: "ibo" },
      ],
      error: null,
    });
    const res = await searchGET(
      mkReq("http://x/api/schools/search?q=nanjing")
    );
    const body = await res.json();
    // Both are prefix matches; verified (s2) wins over user_submitted (s1)
    expect(body.schools[0].verified).toBe(true);
  });

  it("escapes % and _ wildcards in user input", async () => {
    currentChain = buildChain({ data: [], error: null });
    await searchGET(mkReq("http://x/api/schools/search?q=foo%25bar"));
    // URLSearchParams decodes %25 → %; our code escapes it to \%
    expect(currentChain.ilike).toHaveBeenCalledWith("name", "%foo\\%bar%");
  });

  it("returns 500 on DB error", async () => {
    currentChain = buildChain({
      data: null,
      error: { message: "boom" },
    });
    const res = await searchGET(mkReq("http://x/api/schools/search?q=nanjing"));
    expect(res.status).toBe(500);
  });
});

// ─── POST /api/schools ────────────────────────────────────────────────────

describe("POST /api/schools", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await schoolsPOST(
      mkReq("http://x/api/schools", {
        method: "POST",
        body: JSON.stringify({ name: "Test School", country: "CN" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid JSON body", async () => {
    const res = await schoolsPOST(
      mkReq("http://x/api/schools", { method: "POST", body: "not json" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is too short", async () => {
    const res = await schoolsPOST(
      mkReq("http://x/api/schools", {
        method: "POST",
        body: JSON.stringify({ name: "AB", country: "CN" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when country is missing", async () => {
    const res = await schoolsPOST(
      mkReq("http://x/api/schools", {
        method: "POST",
        body: JSON.stringify({ name: "My School" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("inserts user_submitted row with teacherId as created_by", async () => {
    currentChain = buildChain({
      data: {
        id: "new-uuid",
        name: "My School",
        city: "Testtown",
        country: "CN",
        ib_programmes: [],
        verified: false,
        source: "user_submitted",
      },
      error: null,
    });
    const res = await schoolsPOST(
      mkReq("http://x/api/schools", {
        method: "POST",
        body: JSON.stringify({
          name: "  My School  ",
          city: " Testtown ",
          country: "cn",
        }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.school.id).toBe("new-uuid");
    // Verify the insert payload was normalised
    expect(currentChain.insert).toHaveBeenCalledWith({
      name: "My School",
      city: "Testtown",
      country: "CN",
      ib_programmes: [],
      source: "user_submitted",
      verified: false,
      created_by: "teacher-uuid-1",
    });
  });

  it("on 23505 unique-violation, returns existing row with duplicate:true", async () => {
    // First insert fails with unique violation; second query returns existing
    const insertChain = buildChain({
      data: null,
      error: { code: "23505", message: "duplicate" },
    });
    const lookupChain = buildChain({
      data: {
        id: "existing-uuid",
        name: "Existing School",
        city: "Nanjing",
        country: "CN",
        ib_programmes: ["MYP"],
        verified: true,
        source: "ibo",
      },
      error: null,
    });
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount += 1;
      return callCount === 1 ? insertChain : lookupChain;
    });

    const res = await schoolsPOST(
      mkReq("http://x/api/schools", {
        method: "POST",
        body: JSON.stringify({ name: "Existing School", country: "CN" }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(body.school.id).toBe("existing-uuid");
  });
});

// ─── PATCH /api/teacher/school ───────────────────────────────────────────

describe("PATCH /api/teacher/school", () => {
  const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await teacherSchoolPATCH(
      mkReq("http://x/api/teacher/school", {
        method: "PATCH",
        body: JSON.stringify({ schoolId: VALID_UUID }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when schoolId is not a string or null", async () => {
    const res = await teacherSchoolPATCH(
      mkReq("http://x/api/teacher/school", {
        method: "PATCH",
        body: JSON.stringify({ schoolId: 42 }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when schoolId is not a valid UUID", async () => {
    const res = await teacherSchoolPATCH(
      mkReq("http://x/api/teacher/school", {
        method: "PATCH",
        body: JSON.stringify({ schoolId: "not-a-uuid" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when schoolId does not exist", async () => {
    currentChain = buildChain({ data: null, error: null });
    const res = await teacherSchoolPATCH(
      mkReq("http://x/api/teacher/school", {
        method: "PATCH",
        body: JSON.stringify({ schoolId: VALID_UUID }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("updates teachers.school_id when school exists", async () => {
    // First: school lookup returns the row
    const lookupChain = buildChain({
      data: { id: VALID_UUID },
      error: null,
    });
    // Second: teachers.update resolves without error
    const updateChain = buildChain({ data: null, error: null });
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      callCount += 1;
      if (callCount === 1) {
        expect(table).toBe("schools");
        return lookupChain;
      }
      expect(table).toBe("teachers");
      return updateChain;
    });

    const res = await teacherSchoolPATCH(
      mkReq("http://x/api/teacher/school", {
        method: "PATCH",
        body: JSON.stringify({ schoolId: VALID_UUID }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.schoolId).toBe(VALID_UUID);
    expect(updateChain.update).toHaveBeenCalledWith({ school_id: VALID_UUID });
    expect(updateChain.eq).toHaveBeenCalledWith("id", "teacher-uuid-1");
  });

  it("allows clearing school_id by passing null (no school lookup)", async () => {
    const updateChain = buildChain({ data: null, error: null });
    mockFrom.mockReturnValue(updateChain);

    const res = await teacherSchoolPATCH(
      mkReq("http://x/api/teacher/school", {
        method: "PATCH",
        body: JSON.stringify({ schoolId: null }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.schoolId).toBe(null);
    expect(updateChain.update).toHaveBeenCalledWith({ school_id: null });
    // Only one call (teachers.update) — no school lookup for null
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("teachers");
  });
});
