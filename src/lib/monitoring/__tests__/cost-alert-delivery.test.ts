import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendCostAlert } from "../cost-alert-delivery";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("sendCostAlert", () => {
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    // Mock Supabase client with method chaining
    mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi
            .fn()
            .mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [] }),
                }),
              }),
            }),
          gte: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [] }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    } as unknown as SupabaseClient;

    // Mock environment variables
    process.env.COST_ALERT_EMAIL = "test@example.com";

    // Mock console
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.RESEND_API_KEY;
  });

  it("should debounce when recent alert exists", async () => {
    // Setup: return a recent alert
    mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi
            .fn()
            .mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ id: "alert-123" }],
                  }),
                }),
              }),
            }),
          gte: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: "alert-123" }],
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({}),
      }),
    } as unknown as SupabaseClient;

    const result = await sendCostAlert(mockSupabase, {
      period: "daily",
      currentCost: 15.0,
      threshold: 10.0,
      thresholdName: "Daily",
    });

    expect(result.debounced).toBe(true);
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("Alert sent within last 6 hours");
  });

  it("should log to console when RESEND_API_KEY is not set", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendCostAlert(mockSupabase, {
      period: "weekly",
      currentCost: 75.0,
      threshold: 50.0,
      thresholdName: "Weekly",
    });

    expect(result.sent).toBe(false);
    expect(result.debounced).toBe(false);
    expect(result.reason).toContain("RESEND_API_KEY not set");
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Cost Alert")
    );
  });

  it("should send email successfully when API key exists", async () => {
    process.env.RESEND_API_KEY = "test-api-key";

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(""),
    });

    const result = await sendCostAlert(mockSupabase, {
      period: "monthly",
      currentCost: 250.0,
      threshold: 200.0,
      thresholdName: "Monthly",
    });

    expect(result.sent).toBe(true);
    expect(result.debounced).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-api-key",
        "Content-Type": "application/json",
      },
      body: expect.stringContaining("Monthly"),
    });
  });

  it("should handle Resend API errors gracefully", async () => {
    process.env.RESEND_API_KEY = "test-api-key";

    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue("Unauthorized"),
    });

    const result = await sendCostAlert(mockSupabase, {
      period: "daily",
      currentCost: 15.0,
      threshold: 10.0,
      thresholdName: "Daily",
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toContain("Resend API error: 401");
    expect(console.error).toHaveBeenCalled();
  });

  it("should handle fetch network errors gracefully", async () => {
    process.env.RESEND_API_KEY = "test-api-key";

    (global.fetch as any).mockRejectedValue(
      new Error("Network timeout")
    );

    const result = await sendCostAlert(mockSupabase, {
      period: "daily",
      currentCost: 15.0,
      threshold: 10.0,
      thresholdName: "Daily",
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("Network timeout");
    expect(console.error).toHaveBeenCalledWith(
      "[Cost Alert] Email send failed:",
      "Network timeout"
    );
  });

  it("should write to system_alerts before sending email", async () => {
    process.env.RESEND_API_KEY = "test-api-key";

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(""),
    });

    await sendCostAlert(mockSupabase, {
      period: "daily",
      currentCost: 15.0,
      threshold: 10.0,
      thresholdName: "Daily",
    });

    // Verify insert was called
    expect(mockSupabase.from).toHaveBeenCalled();
  });

  it("should include cost details in email HTML", async () => {
    process.env.RESEND_API_KEY = "test-api-key";

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(""),
    });

    await sendCostAlert(mockSupabase, {
      period: "daily",
      currentCost: 15.5,
      threshold: 10.0,
      thresholdName: "Daily",
    });

    const callArgs = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.html).toContain("$15.50");
    expect(body.html).toContain("$10.00");
    expect(body.html).toContain("Daily");
  });

  it("should use custom COST_ALERT_EMAIL environment variable", async () => {
    process.env.RESEND_API_KEY = "test-api-key";
    process.env.COST_ALERT_EMAIL = "custom@example.com";

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(""),
    });

    await sendCostAlert(mockSupabase, {
      period: "daily",
      currentCost: 15.0,
      threshold: 10.0,
      thresholdName: "Daily",
    });

    const callArgs = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.to).toEqual(["custom@example.com"]);
  });

  it("should fall back to default email when COST_ALERT_EMAIL is not set", async () => {
    delete process.env.COST_ALERT_EMAIL;
    process.env.RESEND_API_KEY = "test-api-key";

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(""),
    });

    await sendCostAlert(mockSupabase, {
      period: "daily",
      currentCost: 15.0,
      threshold: 10.0,
      thresholdName: "Daily",
    });

    const callArgs = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.to).toEqual(["mattburto@gmail.com"]);
  });
});
