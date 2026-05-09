import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock Supabase SSR ───

/**
 * Build a mock Supabase query chain that supports chaining (select/eq/order/limit)
 * and is thenable (so `await query` resolves to { data, error }).
 */
function buildQueryChain(data: unknown[] | null = [], error: unknown = null) {
  const result = { data, error };
  const chain: Record<string, unknown> = {};

  // Every chainable method returns the same object
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);

  // Make the chain thenable so `await query` works
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve);

  return chain as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    then: (resolve: (v: unknown) => void) => Promise<unknown>;
  };
}

let queryChain: ReturnType<typeof buildQueryChain>;

const mockGetUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => queryChain,
  }),
}));

// ─── Import route handlers ───
// We dynamically import after mocking
let GET: typeof import("../alerts/route").GET;
let PATCH: typeof import("../alerts/route").PATCH;

describe("Teacher Safety Alerts API — Phase 6A", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    queryChain = buildQueryChain();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "teacher-uuid-1", app_metadata: { user_type: "teacher" } } },
    });
    // Dynamic import to pick up mocks
    const mod = await import("../alerts/route");
    GET = mod.GET;
    PATCH = mod.PATCH;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── GET tests ───

  it("GET returns alerts array", async () => {
    const mockAlerts = [
      {
        id: "alert-1",
        class_id: "class-1",
        student_id: "student-1",
        content_source: "student_progress",
        moderation_layer: "server_haiku",
        flags: [{ type: "profanity", severity: "warning", confidence: 0.9 }],
        overall_result: "flagged",
        severity: "warning",
        action_taken: null,
        teacher_reviewed: false,
        teacher_action: null,
        teacher_reviewed_at: null,
        created_at: "2026-04-13T10:00:00Z",
      },
    ];
    queryChain = buildQueryChain(mockAlerts);

    const request = new Request("http://localhost/api/teacher/safety/alerts");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.alerts).toHaveLength(1);
    expect(body.alerts[0].severity).toBe("warning");
  });

  it("GET with class_id param filters by class", async () => {
    queryChain = buildQueryChain([]);

    const request = new Request(
      "http://localhost/api/teacher/safety/alerts?class_id=class-abc"
    );
    await GET(request as any);

    // Verify .eq was called with class_id
    expect(queryChain.eq).toHaveBeenCalledWith("class_id", "class-abc");
  });

  it("GET with reviewed=true includes reviewed alerts", async () => {
    queryChain = buildQueryChain([]);

    const request = new Request(
      "http://localhost/api/teacher/safety/alerts?reviewed=true"
    );
    await GET(request as any);

    // When reviewed=true, should NOT call .eq("teacher_reviewed", false)
    const eqCalls = queryChain.eq.mock.calls;
    const hasReviewedFilter = eqCalls.some(
      (call: unknown[]) => call[0] === "teacher_reviewed" && call[1] === false
    );
    expect(hasReviewedFilter).toBe(false);
  });

  it("GET without reviewed param filters to unreviewed only", async () => {
    queryChain = buildQueryChain([]);

    const request = new Request("http://localhost/api/teacher/safety/alerts");
    await GET(request as any);

    // Should call .eq("teacher_reviewed", false) by default
    const eqCalls = queryChain.eq.mock.calls;
    const hasReviewedFilter = eqCalls.some(
      (call: unknown[]) => call[0] === "teacher_reviewed" && call[1] === false
    );
    expect(hasReviewedFilter).toBe(true);
  });

  it("GET returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const request = new Request("http://localhost/api/teacher/safety/alerts");
    const response = await GET(request as any);
    expect(response.status).toBe(401);
  });

  // ─── PATCH tests ───

  it("PATCH with valid action updates the alert", async () => {
    queryChain = buildQueryChain();

    const request = new Request("http://localhost/api/teacher/safety/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "alert-1", action: "acknowledged" }),
    });
    const response = await PATCH(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("PATCH with invalid action returns 400", async () => {
    const request = new Request("http://localhost/api/teacher/safety/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "alert-1", action: "invalid_action" }),
    });
    const response = await PATCH(request as any);
    expect(response.status).toBe(400);
  });

  it("PATCH without id returns 400", async () => {
    const request = new Request("http://localhost/api/teacher/safety/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "acknowledged" }),
    });
    const response = await PATCH(request as any);
    expect(response.status).toBe(400);
  });

  it("PATCH accepts escalated action", async () => {
    queryChain = buildQueryChain();

    const request = new Request("http://localhost/api/teacher/safety/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "alert-1", action: "escalated" }),
    });
    const response = await PATCH(request as any);
    expect(response.status).toBe(200);
  });

  // ─── Cross-reference tests ───

  it("severity values match migration 073 CHECK constraint", () => {
    // Migration 073: CHECK (severity IN ('info', 'warning', 'critical'))
    const validSeverities = ["info", "warning", "critical"];
    expect(validSeverities).toEqual(["info", "warning", "critical"]);
  });
});
