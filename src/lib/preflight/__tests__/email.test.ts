import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendFabricationEmail } from "../email";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Unit tests for sendFabricationEmail (1B-2-1).
 *
 * Each test asserts SPECIFIC expected values (Lesson #38) — not just
 * `.ok` or "something happened." The Supabase mock receives a concrete
 * update payload and we check its shape field-by-field.
 */

type MockRow = { notifications_sent: Record<string, unknown> | null } | null;

interface MockSupabaseState {
  row: MockRow;
  updateCapture: { notifications_sent: Record<string, unknown> } | null;
  readError: { message: string } | null;
  updateError: { message: string } | null;
}

function buildMockSupabase(state: MockSupabaseState): SupabaseClient {
  // Chainable select().eq().maybeSingle() returning {data, error}
  const selectChain = {
    eq: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: state.row,
        error: state.readError,
      })),
    })),
  };

  // Chainable update().eq() returning {error}
  const updateChain = {
    eq: vi.fn(async () => ({ error: state.updateError })),
  };

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => selectChain),
      update: vi.fn((payload: { notifications_sent: Record<string, unknown> }) => {
        state.updateCapture = payload;
        return updateChain;
      }),
    })),
  } as unknown as SupabaseClient;
}

describe("sendFabricationEmail", () => {
  let state: MockSupabaseState;
  let supabase: SupabaseClient;

  beforeEach(() => {
    state = {
      row: { notifications_sent: null },
      updateCapture: null,
      readError: null,
      updateError: null,
    };
    supabase = buildMockSupabase(state);

    process.env.RESEND_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.RESEND_API_KEY;
  });

  it("invite kind with jobId=null dispatches via Resend, returns sent=true", async () => {
    const result = await sendFabricationEmail({
      jobId: null,
      kind: "invite",
      to: "fab@example.com",
      subject: "Invite",
      html: "<p>hi</p>",
      supabase,
    });

    expect(result).toEqual({ sent: true, skipped: false });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("https://api.resend.com/emails");
    const body = JSON.parse(call[1].body);
    expect(body.from).toBe("Preflight <hello@loominary.org>");
    expect(body.to).toEqual(["fab@example.com"]);
    expect(body.subject).toBe("Invite");
    expect(state.updateCapture).toBeNull(); // no idempotency write for identity kinds
  });

  it("invite kind with non-null jobId throws", async () => {
    await expect(
      sendFabricationEmail({
        jobId: "job-123",
        kind: "invite",
        to: "fab@example.com",
        subject: "x",
        html: "<p>x</p>",
        supabase,
      })
    ).rejects.toThrow(/jobId=null/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("submitted kind with jobId=null throws", async () => {
    await expect(
      sendFabricationEmail({
        jobId: null,
        kind: "submitted",
        to: "s@example.com",
        subject: "x",
        html: "<p>x</p>",
        supabase,
      })
    ).rejects.toThrow(/requires a non-null jobId/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("submitted kind dispatches when notifications_sent is null", async () => {
    state.row = { notifications_sent: null };

    const result = await sendFabricationEmail({
      jobId: "job-abc",
      kind: "submitted",
      to: "s@example.com",
      subject: "Submitted",
      html: "<p>ok</p>",
      supabase,
    });

    expect(result).toEqual({ sent: true, skipped: false });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(state.updateCapture).not.toBeNull();
    expect(state.updateCapture!.notifications_sent).toHaveProperty("submitted_at");
    const ts = state.updateCapture!.notifications_sent.submitted_at as string;
    expect(typeof ts).toBe("string");
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO-8601 start
  });

  it("submitted kind SKIPS when notifications_sent.submitted_at already set", async () => {
    state.row = {
      notifications_sent: { submitted_at: "2026-04-20T10:00:00.000Z" },
    };

    const result = await sendFabricationEmail({
      jobId: "job-abc",
      kind: "submitted",
      to: "s@example.com",
      subject: "x",
      html: "<p>x</p>",
      supabase,
    });

    expect(result.sent).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toMatch(/Already sent/);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(state.updateCapture).toBeNull();
  });

  it("submitted kind SUCCESS writes notifications_sent via JSONB merge preserving other keys", async () => {
    state.row = {
      notifications_sent: { approved_at: "2026-04-20T08:00:00.000Z" },
    };

    await sendFabricationEmail({
      jobId: "job-abc",
      kind: "submitted",
      to: "s@example.com",
      subject: "x",
      html: "<p>x</p>",
      supabase,
    });

    expect(state.updateCapture).not.toBeNull();
    const merged = state.updateCapture!.notifications_sent;
    // Preserves pre-existing key (Lesson #42):
    expect(merged.approved_at).toBe("2026-04-20T08:00:00.000Z");
    // Adds new key:
    expect(merged).toHaveProperty("submitted_at");
    expect(typeof merged.submitted_at).toBe("string");
  });

  it("missing RESEND_API_KEY returns console-fallback reason and does NOT hit Resend", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendFabricationEmail({
      jobId: null,
      kind: "invite",
      to: "x@example.com",
      subject: "x",
      html: "<p>x</p>",
      supabase,
    });

    expect(result).toEqual({
      sent: false,
      skipped: false,
      reason: "RESEND_API_KEY not set — logged to console",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("Resend 500 returns sent=false skipped=false, does NOT write notifications_sent", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Resend server error",
    });

    const result = await sendFabricationEmail({
      jobId: "job-abc",
      kind: "submitted",
      to: "s@example.com",
      subject: "x",
      html: "<p>x</p>",
      supabase,
    });

    expect(result.sent).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.reason).toMatch(/Resend API error: 500/);
    expect(state.updateCapture).toBeNull();
  });
});
