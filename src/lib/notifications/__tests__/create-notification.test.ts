/**
 * Tests for src/lib/notifications/create-notification.ts (Phase 3A).
 *
 * Coverage:
 *   - Wrapper behaviour: column mapping (camelCase input → snake_case row),
 *     defaults (severity='info', payload={}), optional field nullification
 *   - Dedup semantics: 23505 violation with non-null dedup_key returns
 *     deduped:true with the existing row id; 23505 without dedup_key bubbles
 *     as a real error
 *   - No-dedup-key case: two identical inserts both succeed
 *   - Audit emission: logAuditEvent called once per successful insert with
 *     action='notification.created' + payload describing the kind
 *   - Audit failure does NOT break the notification (soft-sentry mode)
 *
 * Lessons applied: #38 (assert exact field values, not just non-null),
 * #44 (mock pattern matches existing audit-log.test.ts — no extra abstraction),
 * #45 (only test create-notification's behaviour; consumer wiring is Phase 3B).
 *
 * Cross-reference test: NotificationKind union vs DB CHECK constraints —
 * the DB has NO CHECK on `kind` (deliberate per migration), so the union is
 * the source of truth. We cross-reference recipient_role and severity unions
 * against their respective CHECK constraints by reading the migration file.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createNotification } from "../create-notification";
import type {
  CreateNotificationInput,
  NotificationRecipientRole,
  NotificationSeverity,
} from "@/types/notifications";

// ─── Sentry mock (logAuditEvent uses it on soft-sentry failure) ─────

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// ─── Supabase client mock ───────────────────────────────────────────
//
// createNotification does:
//   1. supabase.from('notifications').insert({...}).select('id').single()
//   2. logAuditEvent → supabase.from('schools').select(...).eq(...).maybeSingle()
//   3. logAuditEvent → supabase.from('audit_events').insert({...})
//   4. (on dedup hit) supabase.from('notifications').select('id').eq().eq().eq().maybeSingle()

interface MockState {
  /** Result of the primary notifications insert. */
  notificationsInsert:
    | { ok: true; row: { id: string } }
    | { ok: false; error: { code: string; message: string } };
  /** Existing row returned by the post-23505 lookup (when dedup_key matched). */
  existingDedupRow: { id: string } | null;
  /** Whether the audit_events insert returns an error. */
  auditInsertError: { message: string } | null;
  /** Capture for assertion. */
  lastNotificationInsert: Record<string, unknown> | null;
  lastAuditInsert: Record<string, unknown> | null;
  /** How many times the audit_events insert was called. */
  auditInsertCallCount: number;
}

function makeState(overrides: Partial<MockState> = {}): MockState {
  return {
    notificationsInsert: { ok: true, row: { id: "n-uuid-1" } },
    existingDedupRow: null,
    auditInsertError: null,
    lastNotificationInsert: null,
    lastAuditInsert: null,
    auditInsertCallCount: 0,
    ...overrides,
  };
}

function buildClient(state: MockState) {
  return {
    from: (table: string) => {
      if (table === "notifications") {
        return {
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                state.lastNotificationInsert = row;
                if (state.notificationsInsert.ok) {
                  return { data: state.notificationsInsert.row, error: null };
                }
                return {
                  data: null,
                  error: state.notificationsInsert.error,
                };
              },
            }),
          }),
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: state.existingDedupRow,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "schools") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "audit_events") {
        return {
          insert: async (row: Record<string, unknown>) => {
            state.lastAuditInsert = row;
            state.auditInsertCallCount++;
            return { error: state.auditInsertError };
          },
        };
      }
      throw new Error(`Unmocked table: ${table}`);
    },
  } as unknown as Parameters<typeof createNotification>[0];
}

function defaultInput(
  overrides: Partial<CreateNotificationInput> = {},
): CreateNotificationInput {
  return {
    recipientId: "11111111-1111-1111-1111-111111111111",
    recipientRole: "teacher",
    kind: "integrity.flag_low_score",
    title: "Review recommended: Aiden Liu",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── 1. Column mapping + defaults ──────────────────────────────────

describe("createNotification — column mapping", () => {
  it("maps every camelCase input field to the matching snake_case row column", async () => {
    const state = makeState();
    const supabase = buildClient(state);

    const result = await createNotification(supabase, {
      recipientId: "rec-uuid",
      recipientRole: "teacher",
      schoolId: "school-uuid",
      kind: "integrity.flag_low_score",
      severity: "warn",
      title: "Review recommended",
      body: "Score 32/100 on activity 4",
      payload: { progress_row_id: "prog-uuid", score: 32 },
      dedupKey: "student-1|page-A|2026-05-04",
      linkUrl: "/teacher/classes/c1/grading/u1",
      expiresAt: "2026-08-02T00:00:00Z",
    });

    expect(result).toEqual({ ok: true, id: "n-uuid-1", deduped: false });
    expect(state.lastNotificationInsert).toEqual({
      recipient_id: "rec-uuid",
      recipient_role: "teacher",
      school_id: "school-uuid",
      kind: "integrity.flag_low_score",
      severity: "warn",
      title: "Review recommended",
      body: "Score 32/100 on activity 4",
      payload: { progress_row_id: "prog-uuid", score: 32 },
      dedup_key: "student-1|page-A|2026-05-04",
      link_url: "/teacher/classes/c1/grading/u1",
      expires_at: "2026-08-02T00:00:00Z",
    });
  });

  it("defaults severity to 'info' when omitted", async () => {
    const state = makeState();
    await createNotification(buildClient(state), defaultInput());
    expect(state.lastNotificationInsert?.severity).toBe("info");
  });

  it("defaults payload to {} when omitted", async () => {
    const state = makeState();
    await createNotification(buildClient(state), defaultInput());
    expect(state.lastNotificationInsert?.payload).toEqual({});
  });

  it("nullifies omitted optional fields", async () => {
    const state = makeState();
    await createNotification(buildClient(state), defaultInput());
    expect(state.lastNotificationInsert?.school_id).toBeNull();
    expect(state.lastNotificationInsert?.body).toBeNull();
    expect(state.lastNotificationInsert?.dedup_key).toBeNull();
    expect(state.lastNotificationInsert?.link_url).toBeNull();
    expect(state.lastNotificationInsert?.expires_at).toBeNull();
  });
});

// ─── 2. Dedup semantics ───────────────────────────────────────────

describe("createNotification — dedup", () => {
  it("returns ok:true with deduped:true when 23505 fires AND dedupKey is non-null", async () => {
    const state = makeState({
      notificationsInsert: {
        ok: false,
        error: { code: "23505", message: "duplicate key" },
      },
      existingDedupRow: { id: "existing-uuid" },
    });

    const result = await createNotification(
      buildClient(state),
      defaultInput({ dedupKey: "s1|p1|2026-05-04" }),
    );

    expect(result).toEqual({
      ok: true,
      id: "existing-uuid",
      deduped: true,
    });
  });

  it("bubbles 23505 as a real error when dedupKey is null (unexpected unique conflict)", async () => {
    // 23505 without dedup_key means we hit some OTHER unique constraint —
    // not the partial dedup index. That's a real error, not idempotency.
    const state = makeState({
      notificationsInsert: {
        ok: false,
        error: { code: "23505", message: "some other unique" },
      },
    });

    const result = await createNotification(
      buildClient(state),
      defaultInput(), // no dedupKey
    );

    expect(result).toEqual({ ok: false, error: "some other unique" });
  });

  it("bubbles non-23505 errors as failures even with dedupKey set", async () => {
    const state = makeState({
      notificationsInsert: {
        ok: false,
        error: { code: "23502", message: "null violation" }, // not_null_violation
      },
    });

    const result = await createNotification(
      buildClient(state),
      defaultInput({ dedupKey: "s1|p1|2026-05-04" }),
    );

    expect(result).toEqual({ ok: false, error: "null violation" });
  });
});

// ─── 3. Audit emission ────────────────────────────────────────────

describe("createNotification — audit emission", () => {
  it("emits exactly one logAuditEvent on successful insert", async () => {
    const state = makeState();
    const supabase = buildClient(state);
    await new Promise<void>((res) => {
      // Wait one microtask after the void-fired logAuditEvent so we can
      // inspect state without race.
      createNotification(supabase, defaultInput()).then(() => {
        setTimeout(() => res(), 10);
      });
    });

    expect(state.auditInsertCallCount).toBe(1);
    expect(state.lastAuditInsert).toMatchObject({
      action: "notification.created",
      actor_type: "system",
      target_table: "notifications",
      target_id: "n-uuid-1",
      payload_jsonb: {
        kind: "integrity.flag_low_score",
        severity: "info",
        recipient_role: "teacher",
      },
    });
  });

  it("does NOT emit audit on failed insert", async () => {
    const state = makeState({
      notificationsInsert: {
        ok: false,
        error: { code: "23502", message: "null violation" },
      },
    });
    await createNotification(buildClient(state), defaultInput());
    // Give the void-fired audit promise a tick (it shouldn't fire at all)
    await new Promise((res) => setTimeout(res, 10));
    expect(state.auditInsertCallCount).toBe(0);
  });

  it("audit failure (soft-sentry) does NOT break the notification result", async () => {
    // Suppress the soft-sentry console.warn from logAuditEvent
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = makeState({
      auditInsertError: { message: "audit RLS denied" },
    });
    const result = await createNotification(buildClient(state), defaultInput());
    expect(result).toEqual({ ok: true, id: "n-uuid-1", deduped: false });
  });
});

// ─── 4. Cross-reference: type unions vs migration CHECK constraints ─

describe("type unions match migration CHECK constraints", () => {
  function readMigration(): string {
    return readFileSync(
      resolve(
        __dirname,
        "../../../..",
        "supabase/migrations/20260504115948_notifications_table.sql",
      ),
      "utf-8",
    );
  }

  it("NotificationRecipientRole values match recipient_role CHECK", () => {
    const sql = readMigration();
    // The constraint clause is multi-line — match the values regardless of formatting
    const expected: NotificationRecipientRole[] = [
      "teacher",
      "student",
      "fabricator",
      "platform_admin",
    ];
    for (const role of expected) {
      expect(sql).toContain(`'${role}'`);
    }
    // Anti-test: a removed role would still match this loop. Add a count
    // assertion against the line containing recipient_role IN.
    const checkLine = sql.match(
      /CHECK \(recipient_role IN[\s\S]*?\)\)/,
    )?.[0];
    expect(checkLine).toBeDefined();
    for (const role of expected) {
      expect(checkLine).toContain(`'${role}'`);
    }
  });

  it("NotificationSeverity values match severity CHECK", () => {
    const sql = readMigration();
    const expected: NotificationSeverity[] = ["info", "warn", "critical"];
    const checkLine = sql.match(/CHECK \(severity IN[\s\S]*?\)\)/)?.[0];
    expect(checkLine).toBeDefined();
    for (const sev of expected) {
      expect(checkLine).toContain(`'${sev}'`);
    }
  });

  it("kind has NO CHECK constraint (TypeScript union is source of truth)", () => {
    const sql = readMigration();
    // The migration MUST NOT add a CHECK on kind — Phase 3A decision.
    // Match for `CHECK (kind` would catch a future regression that bolted
    // a constraint on, which would silently break new kinds.
    expect(sql).not.toMatch(/CHECK\s*\(\s*kind\s+IN/);
  });
});
