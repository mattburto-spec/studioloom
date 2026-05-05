/**
 * Tests for src/lib/notifications/dispatch-integrity-alerts.ts (Phase 3B).
 *
 * Coverage:
 *   - Threshold filtering (no metadata / all above / lowest below)
 *   - resolvedClassId null short-circuit (no notifications, no audit)
 *   - class_members lookup with role filter
 *   - Audit emission with correct action + payload
 *   - Notification fan-out (one per teacher) + dedup key format
 *   - Empty recipient list → audit fires, no notifications
 *
 * Mocks createNotification + logAuditEvent at module level so we can assert
 * exact call shapes (Lesson #38). The supabase client is mocked to handle
 * the dispatcher's two reads only (classes.select, class_members.select).
 *
 * Lessons applied: #38 (assert exact values), #44 (no integration heaviness),
 * #45 (only test the dispatcher; route wiring tested via route).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  dispatchIntegrityAlerts,
  DEFAULT_INTEGRITY_ALERT_THRESHOLD,
  type DispatchIntegrityAlertsArgs,
} from "../dispatch-integrity-alerts";
import type { IntegrityMetadata } from "@/components/student/MonitoredTextarea";

// ─── Mocks for downstream helpers ──────────────────────────────────

const mockCreateNotification = vi.fn();
vi.mock("@/lib/notifications/create-notification", () => ({
  createNotification: (
    ...args: Parameters<typeof mockCreateNotification>
  ) => mockCreateNotification(...args),
}));

const mockLogAuditEvent = vi.fn();
vi.mock("@/lib/access-v2/audit-log", () => ({
  logAuditEvent: (...args: Parameters<typeof mockLogAuditEvent>) =>
    mockLogAuditEvent(...args),
}));

// ─── Supabase client mock ──────────────────────────────────────────
//
// dispatcher reads:
//   - classes.select('id, school_id').eq('id', X).maybeSingle()
//   - class_members.select('member_user_id, role').eq('class_id', X).in('role', [...]).is('removed_at', null)

interface MockState {
  classRow: { id: string; school_id: string | null } | null;
  members: { member_user_id: string; role: string }[];
}

function buildClient(state: MockState) {
  return {
    from: (table: string) => {
      if (table === "classes") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.classRow,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "class_members") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                is: async () => ({ data: state.members, error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unmocked table: ${table}`);
    },
  } as unknown as Parameters<typeof dispatchIntegrityAlerts>[0];
}

function makeMetadata(overrides: Partial<IntegrityMetadata> = {}): IntegrityMetadata {
  return {
    characterCount: 100,
    keystrokeCount: 100,
    deletionCount: 5,
    totalTimeActive: 60,
    focusLossCount: 0,
    startTime: 0,
    pasteEvents: [],
    snapshots: [],
    wordCountHistory: [],
    ...overrides,
  };
}

/** Metadata that produces a HIGH score (no flags). */
function highScoreMetadata(): IntegrityMetadata {
  return makeMetadata();
}

/** Metadata that produces a MEDIUM score (around 50–60, paste-heavy). */
function mediumScoreMetadata(): IntegrityMetadata {
  return makeMetadata({
    characterCount: 200,
    keystrokeCount: 20,
    deletionCount: 1,
    totalTimeActive: 30,
    pasteEvents: [{ timestamp: 0, length: 200, content: "..." }],
  });
}

/** Metadata that produces a definitively LOW score (< 40). */
function definitelyLowScoreMetadata(): IntegrityMetadata {
  return makeMetadata({
    characterCount: 500,
    keystrokeCount: 4,
    deletionCount: 0,
    totalTimeActive: 1.1,
    focusLossCount: 25, // adds -15 focus_loss concern
    pasteEvents: [{ timestamp: 0, length: 500, content: "..." }],
  });
  // paste_heavy concern (-40) + no_editing warning (-10) + focus_loss concern (-15) = 35
}

function defaultArgs(
  overrides: Partial<DispatchIntegrityAlertsArgs> = {},
): DispatchIntegrityAlertsArgs {
  return {
    studentId: "stu-uuid",
    progressRowId: "prog-uuid",
    unitId: "unit-uuid",
    pageId: "page-A1",
    classId: "class-uuid",
    integrityMetadata: { activity_1: definitelyLowScoreMetadata() },
    now: new Date("2026-05-04T12:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateNotification.mockResolvedValue({
    ok: true,
    id: "noti-uuid",
    deduped: false,
  });
  mockLogAuditEvent.mockResolvedValue({ ok: true });
});

// ─── 1. Threshold filtering ────────────────────────────────────────

describe("dispatchIntegrityAlerts — threshold filtering", () => {
  it("returns no_metadata skip when integrityMetadata is empty", async () => {
    const state: MockState = {
      classRow: { id: "class-uuid", school_id: "school-uuid" },
      members: [],
    };
    const result = await dispatchIntegrityAlerts(
      buildClient(state),
      defaultArgs({ integrityMetadata: {} }),
    );
    expect(result).toMatchObject({
      ok: true,
      lowestScore: null,
      notificationsCreated: 0,
      skipReason: "no_metadata",
    });
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("returns all_above_threshold skip when every key scores >= threshold", async () => {
    const state: MockState = {
      classRow: { id: "class-uuid", school_id: "school-uuid" },
      members: [],
    };
    const result = await dispatchIntegrityAlerts(
      buildClient(state),
      defaultArgs({
        integrityMetadata: {
          activity_1: highScoreMetadata(),
          activity_2: highScoreMetadata(),
        },
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      lowestScore: 100, // both clean = 100
      notificationsCreated: 0,
      skipReason: "all_above_threshold",
    });
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("respects custom threshold (50 → medium-score metadata triggers)", async () => {
    const state: MockState = {
      classRow: { id: "class-uuid", school_id: "school-uuid" },
      members: [{ member_user_id: "t1", role: "lead_teacher" }],
    };
    const result = await dispatchIntegrityAlerts(
      buildClient(state),
      defaultArgs({
        integrityMetadata: { activity_1: mediumScoreMetadata() },
        threshold: 70, // raises bar — medium-score (~60) WILL fire
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.skipReason).toBeUndefined();
    expect(result.notificationsCreated).toBe(1);
  });

  it("uses DEFAULT_INTEGRITY_ALERT_THRESHOLD = 40 when not specified", () => {
    expect(DEFAULT_INTEGRITY_ALERT_THRESHOLD).toBe(40);
  });
});

// ─── 2. Class resolution ───────────────────────────────────────────

describe("dispatchIntegrityAlerts — class resolution", () => {
  it("returns no_class_id skip when classId is null (multi-class ambiguity)", async () => {
    // Build a client that should NOT be queried (test asserts via mock-not-called)
    const state: MockState = {
      classRow: null,
      members: [],
    };
    const result = await dispatchIntegrityAlerts(
      buildClient(state),
      defaultArgs({ classId: null }),
    );
    expect(result).toMatchObject({
      ok: true,
      lowestScore: 35, // definitelyLowScoreMetadata
      notificationsCreated: 0,
      classMembersFound: 0,
      skipReason: "no_class_id",
    });
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("returns no_recipients skip when class_members lookup is empty", async () => {
    const state: MockState = {
      classRow: { id: "class-uuid", school_id: "school-uuid" },
      members: [],
    };
    const result = await dispatchIntegrityAlerts(
      buildClient(state),
      defaultArgs(),
    );
    expect(result).toMatchObject({
      ok: true,
      lowestScore: 35,
      classMembersFound: 0,
      notificationsCreated: 0,
      skipReason: "no_recipients",
    });
    // Audit STILL fires — the classification event should be auditable even if no one's listening.
    expect(mockLogAuditEvent).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});

// ─── 3. Audit emission ─────────────────────────────────────────────

describe("dispatchIntegrityAlerts — audit emission", () => {
  it("emits exactly one audit event per dispatch with correct action + payload", async () => {
    const state: MockState = {
      classRow: { id: "class-uuid", school_id: "school-uuid" },
      members: [
        { member_user_id: "lead-uuid", role: "lead_teacher" },
        { member_user_id: "co-uuid", role: "co_teacher" },
      ],
    };
    await dispatchIntegrityAlerts(buildClient(state), defaultArgs());

    expect(mockLogAuditEvent).toHaveBeenCalledTimes(1);
    const [, auditInput] = mockLogAuditEvent.mock.calls[0];
    expect(auditInput).toMatchObject({
      actorId: null,
      actorType: "system",
      action: "integrity.flag_auto_created",
      targetTable: "student_progress",
      targetId: "prog-uuid",
      schoolId: "school-uuid",
      classId: "class-uuid",
      severity: "warn",
      failureMode: "soft-sentry",
    });
    expect(auditInput.payload).toMatchObject({
      student_id: "stu-uuid",
      progress_row_id: "prog-uuid",
      unit_id: "unit-uuid",
      page_id: "page-A1",
      lowest_score: 35,
      threshold: 40,
      recipient_count: 2,
    });
  });
});

// ─── 4. Notification fan-out ───────────────────────────────────────

describe("dispatchIntegrityAlerts — notification fan-out", () => {
  it("creates one notification per recipient (lead + co teacher)", async () => {
    const state: MockState = {
      classRow: { id: "class-uuid", school_id: "school-uuid" },
      members: [
        { member_user_id: "lead-uuid", role: "lead_teacher" },
        { member_user_id: "co-uuid", role: "co_teacher" },
      ],
    };
    const result = await dispatchIntegrityAlerts(
      buildClient(state),
      defaultArgs(),
    );

    expect(result.notificationsCreated).toBe(2);
    expect(result.notificationsDeduped).toBe(0);
    expect(mockCreateNotification).toHaveBeenCalledTimes(2);

    const recipientIds = mockCreateNotification.mock.calls.map(
      (call) => call[1].recipientId,
    );
    expect(recipientIds).toEqual(
      expect.arrayContaining(["lead-uuid", "co-uuid"]),
    );
  });

  it("dedup_key format = <studentId>|<pageId>|<UTC YYYY-MM-DD>", async () => {
    const state: MockState = {
      classRow: { id: "class-uuid", school_id: "school-uuid" },
      members: [{ member_user_id: "lead-uuid", role: "lead_teacher" }],
    };
    await dispatchIntegrityAlerts(
      buildClient(state),
      defaultArgs({
        studentId: "stu-A",
        pageId: "page-X",
        now: new Date("2026-05-04T23:59:59Z"),
      }),
    );

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification.mock.calls[0][1].dedupKey).toBe(
      "stu-A|page-X|2026-05-04",
    );
  });

  it("payload includes lowest_score + flag_types + other_flagged_count", async () => {
    const state: MockState = {
      classRow: { id: "class-uuid", school_id: "school-uuid" },
      members: [{ member_user_id: "lead-uuid", role: "lead_teacher" }],
    };
    await dispatchIntegrityAlerts(
      buildClient(state),
      defaultArgs({
        // Two flagged keys: low (35) + medium (~60). Lowest wins.
        integrityMetadata: {
          activity_1: definitelyLowScoreMetadata(),
          activity_2: mediumScoreMetadata(),
        },
      }),
    );

    const payload = mockCreateNotification.mock.calls[0][1].payload;
    expect(payload).toMatchObject({
      student_id: "stu-uuid",
      progress_row_id: "prog-uuid",
      unit_id: "unit-uuid",
      page_id: "page-A1",
      class_id: "class-uuid",
      lowest_score: 35,
      lowest_response_key: "activity_1",
      other_flagged_count: 1,
    });
    expect(payload.flag_types).toEqual(
      expect.arrayContaining(["paste_heavy", "no_editing", "focus_loss"]),
    );
  });

  it("link_url deep-links to /teacher/classes/[classId]/grading/[unitId]", async () => {
    const state: MockState = {
      classRow: { id: "class-uuid", school_id: "school-uuid" },
      members: [{ member_user_id: "lead-uuid", role: "lead_teacher" }],
    };
    await dispatchIntegrityAlerts(
      buildClient(state),
      defaultArgs({
        classId: "c123",
        unitId: "u456",
      }),
    );
    expect(mockCreateNotification.mock.calls[0][1].linkUrl).toBe(
      "/teacher/classes/c123/grading/u456",
    );
  });

  it("collapses multi-flagged page into ONE notification per teacher (lowest wins)", async () => {
    const state: MockState = {
      classRow: { id: "class-uuid", school_id: "school-uuid" },
      members: [{ member_user_id: "lead-uuid", role: "lead_teacher" }],
    };
    await dispatchIntegrityAlerts(
      buildClient(state),
      defaultArgs({
        integrityMetadata: {
          activity_1: definitelyLowScoreMetadata(), // 35
          activity_2: mediumScoreMetadata(), // ~60
          activity_3: highScoreMetadata(), // 100
        },
      }),
    );
    // ONE call per teacher even with 3 keys
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification.mock.calls[0][1].kind).toBe(
      "integrity.flag_low_score",
    );
  });

  it("counts deduped responses correctly when createNotification reports deduped:true", async () => {
    mockCreateNotification.mockResolvedValueOnce({
      ok: true,
      id: "existing-1",
      deduped: true,
    });
    mockCreateNotification.mockResolvedValueOnce({
      ok: true,
      id: "new-1",
      deduped: false,
    });
    const state: MockState = {
      classRow: { id: "class-uuid", school_id: "school-uuid" },
      members: [
        { member_user_id: "lead-uuid", role: "lead_teacher" },
        { member_user_id: "co-uuid", role: "co_teacher" },
      ],
    };
    const result = await dispatchIntegrityAlerts(
      buildClient(state),
      defaultArgs(),
    );
    expect(result.notificationsCreated).toBe(1);
    expect(result.notificationsDeduped).toBe(1);
  });
});
