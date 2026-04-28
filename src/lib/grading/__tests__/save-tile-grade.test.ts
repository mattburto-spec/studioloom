import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  NEUTRAL_CRITERION_KEYS,
  SaveTileGradeValidationError,
  classifyEventSource,
  saveTileGrade,
  validateCriterionKeys,
  type GradeStateSnapshot,
  type SaveTileGradeInput,
} from "../save-tile-grade";

/**
 * Pure-helper tests + mocked-Supabase service tests. The codebase has no
 * DOM render harness, but vi.fn-style mocking of the admin client follows
 * the existing pattern in src/lib/content-safety/__tests__/moderate-and-log.test.ts.
 *
 * Lesson #38: assert exact values on the upsert + event payloads, not just
 * that calls happened.
 */

// ─── classifyEventSource (pure) ────────────────────────────────────────────

describe("classifyEventSource", () => {
  it("returns 'ai_pre_score' on a fresh row when AI populates a suggestion", () => {
    const next: GradeStateSnapshot = { score: 6, confirmed: false, ai_pre_score: 6 };
    expect(classifyEventSource(null, next)).toBe("ai_pre_score");
  });

  it("returns 'teacher_confirm' when teacher accepts the AI suggestion as-is", () => {
    const prev: GradeStateSnapshot = { score: 6, confirmed: false, ai_pre_score: 6 };
    const next: GradeStateSnapshot = { score: 6, confirmed: true, ai_pre_score: 6 };
    expect(classifyEventSource(prev, next)).toBe("teacher_confirm");
  });

  it("returns 'teacher_override' when teacher confirms a different score from AI", () => {
    const prev: GradeStateSnapshot = { score: 6, confirmed: false, ai_pre_score: 6 };
    const next: GradeStateSnapshot = { score: 7, confirmed: true, ai_pre_score: 6 };
    expect(classifyEventSource(prev, next)).toBe("teacher_override");
  });

  it("returns 'teacher_override' on a fresh row when teacher confirms with no AI baseline", () => {
    const next: GradeStateSnapshot = { score: 5, confirmed: true, ai_pre_score: null };
    expect(classifyEventSource(null, next)).toBe("teacher_override");
  });

  it("returns 'teacher_revise' when an already-confirmed row is touched again", () => {
    const prev: GradeStateSnapshot = { score: 6, confirmed: true, ai_pre_score: 6 };
    const next: GradeStateSnapshot = { score: 7, confirmed: true, ai_pre_score: 6 };
    expect(classifyEventSource(prev, next)).toBe("teacher_revise");
  });

  it("returns 'teacher_revise' even when confirmed flag stays true and only score changes", () => {
    const prev: GradeStateSnapshot = { score: 5, confirmed: true, ai_pre_score: null };
    const next: GradeStateSnapshot = { score: 6, confirmed: true, ai_pre_score: null };
    expect(classifyEventSource(prev, next)).toBe("teacher_revise");
  });

  it("treats AI re-running on an unconfirmed row as a fresh ai_pre_score event", () => {
    const prev: GradeStateSnapshot = { score: 5, confirmed: false, ai_pre_score: 5 };
    const next: GradeStateSnapshot = { score: 7, confirmed: false, ai_pre_score: 7 };
    expect(classifyEventSource(prev, next)).toBe("ai_pre_score");
  });
});

// ─── validateCriterionKeys ─────────────────────────────────────────────────

describe("validateCriterionKeys", () => {
  it("accepts every key in the 8-key neutral taxonomy", () => {
    expect(() => validateCriterionKeys([...NEUTRAL_CRITERION_KEYS])).not.toThrow();
  });

  it("accepts an empty array (default for a fresh row)", () => {
    expect(() => validateCriterionKeys([])).not.toThrow();
  });

  it("accepts a subset of valid keys", () => {
    expect(() => validateCriterionKeys(["designing", "evaluating"])).not.toThrow();
  });

  it("rejects framework-specific labels (would slip past the type system)", () => {
    expect(() => validateCriterionKeys(["A"])).toThrow(SaveTileGradeValidationError);
    expect(() => validateCriterionKeys(["AO2"])).toThrow(SaveTileGradeValidationError);
  });

  it("rejects typos in neutral keys", () => {
    expect(() => validateCriterionKeys(["analyzing"])).toThrow(/Invalid criterion key/);
    expect(() => validateCriterionKeys(["design"])).toThrow(/Invalid criterion key/);
  });

  it("error message lists the allowed vocabulary so caller can surface it", () => {
    try {
      validateCriterionKeys(["bogus"]);
      expect.fail("expected throw");
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain("bogus");
      for (const k of NEUTRAL_CRITERION_KEYS) {
        expect(msg).toContain(k);
      }
    }
  });
});

// ─── saveTileGrade (mocked Supabase) ──────────────────────────────────────

interface MockClient {
  client: {
    from: ReturnType<typeof vi.fn>;
  };
  upsert: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  capturedUpsert: { args: unknown[] };
  capturedEventInsert: { args: unknown[] };
}

function buildMockClient(opts: {
  prevRow?: { id: string; score: number | null; confirmed: boolean; ai_pre_score: number | null } | null;
  upsertResult?: { id: string; [k: string]: unknown };
  upsertError?: { message: string } | null;
  eventInsertError?: { message: string } | null;
}): MockClient {
  const prevRow = opts.prevRow ?? null;
  const upsertResult = opts.upsertResult ?? { id: "grade-123" };
  const upsertError = opts.upsertError ?? null;
  const eventInsertError = opts.eventInsertError ?? null;

  const captured = {
    upsert: { args: [] as unknown[] },
    eventInsert: { args: [] as unknown[] },
  };

  // Chain stubs for the SELECT path on student_tile_grades
  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: prevRow, error: null }),
  };

  const upsertChain = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: upsertError ? null : upsertResult,
      error: upsertError,
    }),
  };

  const eventInsertChain = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: eventInsertError ? null : { id: "event-1" },
      error: eventInsertError,
    }),
  };

  const upsertFn = vi.fn((payload, _opts) => {
    captured.upsert.args.push(payload);
    return upsertChain;
  });
  const insertFn = vi.fn((payload) => {
    captured.eventInsert.args.push(payload);
    return eventInsertChain;
  });

  const fromFn = vi.fn((table: string) => {
    if (table === "student_tile_grades") {
      return {
        select: vi.fn(() => selectChain),
        upsert: upsertFn,
      };
    }
    if (table === "student_tile_grade_events") {
      return {
        insert: insertFn,
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    // Cast to SupabaseClient at call site — the mock implements only the surface saveTileGrade uses.
    client: { from: fromFn } as { from: ReturnType<typeof vi.fn> },
    upsert: upsertFn,
    insert: insertFn,
    capturedUpsert: captured.upsert,
    capturedEventInsert: captured.eventInsert,
  };
}

const baseInput: SaveTileGradeInput = {
  student_id: "stu-1",
  unit_id: "u-1",
  page_id: "A1",
  tile_id: "activity_abc12345",
  class_id: "cls-1",
  teacher_id: "teach-1",
  score: 6,
  confirmed: true,
  criterion_keys: ["designing"],
};

describe("saveTileGrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes both grade upsert and event insert (happy path)", async () => {
    const m = buildMockClient({ prevRow: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await saveTileGrade(m.client as any, { ...baseInput, ai_pre_score: 6 });

    expect(result.grade.id).toBe("grade-123");
    expect(m.capturedUpsert.args).toHaveLength(1);
    expect(m.capturedEventInsert.args).toHaveLength(1);
  });

  it("classifies as teacher_confirm when teacher accepts AI score", async () => {
    const m = buildMockClient({
      prevRow: { id: "g-prev", score: 6, confirmed: false, ai_pre_score: 6 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await saveTileGrade(m.client as any, baseInput);

    const eventPayload = m.capturedEventInsert.args[0] as { source: string };
    expect(eventPayload.source).toBe("teacher_confirm");
  });

  it("classifies as teacher_override when teacher confirms a different score from AI", async () => {
    const m = buildMockClient({
      prevRow: { id: "g-prev", score: 6, confirmed: false, ai_pre_score: 6 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await saveTileGrade(m.client as any, { ...baseInput, score: 7 });

    const eventPayload = m.capturedEventInsert.args[0] as { source: string; new_score: number };
    expect(eventPayload.source).toBe("teacher_override");
    expect(eventPayload.new_score).toBe(7);
  });

  it("classifies as teacher_revise when an already-confirmed row is changed", async () => {
    const m = buildMockClient({
      prevRow: { id: "g-prev", score: 6, confirmed: true, ai_pre_score: 6 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await saveTileGrade(m.client as any, { ...baseInput, score: 7 });

    const eventPayload = m.capturedEventInsert.args[0] as { source: string };
    expect(eventPayload.source).toBe("teacher_revise");
  });

  it("captures prev/new score + confirmed in the event payload (audit trail)", async () => {
    const m = buildMockClient({
      prevRow: { id: "g-prev", score: 5, confirmed: false, ai_pre_score: 5 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await saveTileGrade(m.client as any, { ...baseInput, score: 7 });

    const ev = m.capturedEventInsert.args[0] as {
      prev_score: number | null;
      new_score: number | null;
      prev_confirmed: boolean | null;
      new_confirmed: boolean;
    };
    expect(ev.prev_score).toBe(5);
    expect(ev.new_score).toBe(7);
    expect(ev.prev_confirmed).toBe(false);
    expect(ev.new_confirmed).toBe(true);
  });

  it("defaults graded_by to teacher_id when not provided", async () => {
    const m = buildMockClient({ prevRow: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await saveTileGrade(m.client as any, baseInput);

    const upsertPayload = m.capturedUpsert.args[0] as { graded_by: string };
    expect(upsertPayload.graded_by).toBe("teach-1");
  });

  it("uses graded_by from input when provided (co-teacher attribution)", async () => {
    const m = buildMockClient({ prevRow: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await saveTileGrade(m.client as any, { ...baseInput, graded_by: "co-teacher-99" });

    const upsertPayload = m.capturedUpsert.args[0] as { graded_by: string };
    expect(upsertPayload.graded_by).toBe("co-teacher-99");
  });

  it("only forwards AI fields when the caller passed them (G1.1 leaves AI dormant)", async () => {
    const m = buildMockClient({ prevRow: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await saveTileGrade(m.client as any, baseInput); // no AI fields

    const upsertPayload = m.capturedUpsert.args[0] as Record<string, unknown>;
    expect(upsertPayload).not.toHaveProperty("ai_pre_score");
    expect(upsertPayload).not.toHaveProperty("ai_quote");
    expect(upsertPayload).not.toHaveProperty("ai_confidence");
  });

  it("forwards AI fields when the caller passes them (G1.3+ wiring)", async () => {
    const m = buildMockClient({ prevRow: null });
    await saveTileGrade(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      m.client as any,
      {
        ...baseInput,
        ai_pre_score: 6,
        ai_confidence: 0.85,
        ai_model_version: "claude-haiku-4-5-20251001",
        prompt_version: "grading.v1.0.0",
      },
    );

    const upsertPayload = m.capturedUpsert.args[0] as Record<string, unknown>;
    expect(upsertPayload.ai_pre_score).toBe(6);
    expect(upsertPayload.ai_confidence).toBe(0.85);
    expect(upsertPayload.ai_model_version).toBe("claude-haiku-4-5-20251001");
    expect(upsertPayload.prompt_version).toBe("grading.v1.0.0");
  });

  it("sets graded_at when confirming, leaves null when not confirming", async () => {
    const m1 = buildMockClient({ prevRow: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await saveTileGrade(m1.client as any, { ...baseInput, confirmed: true });
    const p1 = m1.capturedUpsert.args[0] as { graded_at: string | null };
    expect(p1.graded_at).toBeTruthy();

    const m2 = buildMockClient({ prevRow: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await saveTileGrade(m2.client as any, { ...baseInput, confirmed: false });
    const p2 = m2.capturedUpsert.args[0] as { graded_at: string | null };
    expect(p2.graded_at).toBeNull();
  });

  it("rejects invalid criterion_keys before hitting Supabase (validation surface)", async () => {
    const m = buildMockClient({ prevRow: null });
    await expect(
      saveTileGrade(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        m.client as any,
        { ...baseInput, criterion_keys: ["A"] }, // framework label — rejected
      ),
    ).rejects.toThrow(SaveTileGradeValidationError);

    // Neither write should have fired.
    expect(m.capturedUpsert.args).toHaveLength(0);
    expect(m.capturedEventInsert.args).toHaveLength(0);
  });

  it("surfaces upsert errors and does not write the audit event", async () => {
    const m = buildMockClient({
      prevRow: null,
      upsertError: { message: "violates check constraint" },
    });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      saveTileGrade(m.client as any, baseInput),
    ).rejects.toThrow(/upsert failed/);

    expect(m.capturedEventInsert.args).toHaveLength(0);
  });

  it("surfaces event-insert errors with grade id in the message (atomicity gap)", async () => {
    const m = buildMockClient({
      prevRow: null,
      upsertResult: { id: "g-456" },
      eventInsertError: { message: "FK violation" },
    });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      saveTileGrade(m.client as any, baseInput),
    ).rejects.toThrow(/g-456/);
  });
});
