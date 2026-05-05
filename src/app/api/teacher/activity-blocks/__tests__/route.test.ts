/**
 * Lever 1 sub-phase 1D — POST + PATCH activity-blocks routes.
 *
 * Brief: docs/projects/lesson-quality-lever-1-slot-fields.md
 *
 * Verifies the slot-field write path end-to-end:
 *   - Three-field write returns 201, no deprecation header
 *   - Legacy prompt-only write returns 201, deprecation header set
 *   - Mixed write (prompt + slots) returns 201, no deprecation header
 *   - Oversize framing → 400 with details
 *   - Missing title → 400
 *   - Missing both prompt and slots → 400
 *
 * Scope: contract layer (validator wiring + header). Helper internals
 * (insertActivityBlock) covered by store-level tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

let mockTeacherId: string | null = "teacher-1";
let insertSpy: ReturnType<typeof vi.fn>;
let updateSpy: ReturnType<typeof vi.fn>;

vi.mock("@/lib/auth/verify-teacher-unit", () => ({
  requireTeacherAuth: vi.fn(async () => {
    if (!mockTeacherId) {
      const { NextResponse } = await import("next/server");
      return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    return { teacherId: mockTeacherId };
  }),
}));

// Build the supabase mock so that PATCH's chain returns `data: { id }` —
// the chain ends in .maybeSingle() per the route.
function buildPatchChain(returnedId: string | null) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: returnedId ? { id: returnedId } : null,
      error: null,
    }),
  };
  return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => buildPatchChain("block-1"),
  }),
}));

vi.mock("@/lib/activity-blocks", () => ({
  insertActivityBlock: (...args: unknown[]) => insertSpy(...args),
  listActivityBlocks: vi.fn(),
}));

import { POST as createPost } from "../route";
import { PATCH as updatePatch } from "../[id]/route";
import { NextRequest } from "next/server";
import {
  LEVER_1_DEPRECATED_HEADER,
  LEVER_1_DEPRECATED_VALUE_PROMPT_ONLY,
} from "@/lib/lever-1/validate-slot-fields";

beforeEach(() => {
  mockTeacherId = "teacher-1";
  insertSpy = vi.fn().mockResolvedValue("block-1");
  updateSpy = vi.fn();
});

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/teacher/activity-blocks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/teacher/activity-blocks/block-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

const PARAMS = { params: Promise.resolve({ id: "block-1" }) };

describe("POST /api/teacher/activity-blocks — slot field acceptance", () => {
  it("accepts a pure three-field write and returns 201 with no deprecation header", async () => {
    const res = await createPost(
      makeRequest({
        title: "Blind Swap",
        framing: "You'll develop an idea, swap it blindly with a peer, then improve theirs.",
        task: "Work for 5 minutes. Pass to someone you weren't looking at. Improve their idea.",
        success_signal: "Submit the improved version with one note about what you added.",
      })
    );
    expect(res.status).toBe(201);
    expect(res.headers.get(LEVER_1_DEPRECATED_HEADER)).toBeNull();

    const body = await res.json();
    expect(body.id).toBe("block-1");
    expect(body.warnings).toBeUndefined();

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const passedParams = insertSpy.mock.calls[0][2];
    expect(passedParams.framing).toContain("blindly");
    expect(passedParams.task).toContain("5 minutes");
    expect(passedParams.success_signal).toContain("Submit");
    // Composed prompt fallback should be set
    expect(passedParams.prompt).toContain("blindly");
    expect(passedParams.prompt).toContain("Submit");
  });

  it("accepts a legacy prompt-only write and SETS the deprecation header", async () => {
    const res = await createPost(
      makeRequest({
        title: "Legacy Move",
        prompt: "This is a single-blob prompt with no v2 slots set.",
      })
    );
    expect(res.status).toBe(201);
    expect(res.headers.get(LEVER_1_DEPRECATED_HEADER)).toBe(
      LEVER_1_DEPRECATED_VALUE_PROMPT_ONLY
    );

    const passedParams = insertSpy.mock.calls[0][2];
    expect(passedParams.prompt).toContain("single-blob");
    expect(passedParams.framing).toBeUndefined();
    expect(passedParams.task).toBeUndefined();
    expect(passedParams.success_signal).toBeUndefined();
  });

  it("accepts a mixed write (prompt + slots) and does NOT set deprecation header", async () => {
    const res = await createPost(
      makeRequest({
        title: "Mixed Move",
        prompt: "Composed legacy prompt body.",
        framing: "Lead paragraph",
        task: "The body",
        success_signal: "Submit it.",
      })
    );
    expect(res.status).toBe(201);
    expect(res.headers.get(LEVER_1_DEPRECATED_HEADER)).toBeNull();
  });

  it("rejects oversize framing with 400 + details (exact-value error)", async () => {
    const oversize = "x".repeat(250);
    const res = await createPost(
      makeRequest({
        title: "Bad",
        framing: oversize,
        task: "T",
        success_signal: "S",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Slot field validation failed");
    expect(body.details).toEqual([
      "framing exceeds 200-char cap (250 chars)",
    ]);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("rejects when title is missing", async () => {
    const res = await createPost(
      makeRequest({
        framing: "F",
        task: "T",
        success_signal: "S",
      })
    );
    expect(res.status).toBe(400);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("rejects when both prompt and all slots are missing", async () => {
    const res = await createPost(
      makeRequest({
        title: "Empty",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("title and (prompt OR at least one of");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("returns warnings (non-blocking) when task exceeds soft cap", async () => {
    const res = await createPost(
      makeRequest({
        title: "Long task",
        framing: "F",
        task: "T".repeat(900),
        success_signal: "S",
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.warnings).toEqual([
      "task exceeds 800-char soft cap (900 chars) — Lever 2 lint will surface this",
    ]);
  });
});

describe("PATCH /api/teacher/activity-blocks/[id] — slot field acceptance", () => {
  it("accepts a three-field update with no deprecation header", async () => {
    const res = await updatePatch(
      makePatchRequest({
        framing: "Updated framing",
        task: "Updated task body",
        success_signal: "Submit the new version.",
      }),
      PARAMS
    );
    expect(res.status).toBe(200);
    expect(res.headers.get(LEVER_1_DEPRECATED_HEADER)).toBeNull();

    const body = await res.json();
    expect(body.id).toBe("block-1");
    expect(body.updated).toContain("framing");
    expect(body.updated).toContain("task");
    expect(body.updated).toContain("success_signal");
  });

  it("sets deprecation header on legacy prompt-only update", async () => {
    const res = await updatePatch(
      makePatchRequest({
        prompt: "Updated single-blob prompt with no slot fields.",
      }),
      PARAMS
    );
    expect(res.status).toBe(200);
    expect(res.headers.get(LEVER_1_DEPRECATED_HEADER)).toBe(
      LEVER_1_DEPRECATED_VALUE_PROMPT_ONLY
    );
  });

  it("does NOT set deprecation header on update that doesn't touch prompt", async () => {
    // Updating a non-prompt field (e.g. tags) shouldn't flag the deprecation
    const res = await updatePatch(
      makePatchRequest({
        tags: ["t1", "t2"],
      }),
      PARAMS
    );
    expect(res.status).toBe(200);
    expect(res.headers.get(LEVER_1_DEPRECATED_HEADER)).toBeNull();
  });

  it("rejects oversize success_signal with 400", async () => {
    const oversize = "x".repeat(300);
    const res = await updatePatch(
      makePatchRequest({
        success_signal: oversize,
      }),
      PARAMS
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details).toEqual([
      "success_signal exceeds 200-char cap (300 chars)",
    ]);
  });

  it("strips disallowed fields from update", async () => {
    const res = await updatePatch(
      makePatchRequest({
        framing: "Allowed",
        teacher_id: "stolen-teacher-id", // disallowed
        id: "stolen-id", // disallowed
      }),
      PARAMS
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toContain("framing");
    expect(body.updated).not.toContain("teacher_id");
    expect(body.updated).not.toContain("id");
  });
});

describe("auth gate", () => {
  it("POST returns 401 when teacher session is missing", async () => {
    mockTeacherId = null;
    const res = await createPost(
      makeRequest({ title: "X", framing: "F", task: "T", success_signal: "S" })
    );
    expect(res.status).toBe(401);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
