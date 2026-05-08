import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mockMessagesCreate = vi.fn();
const mockMessagesStream = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: mockMessagesCreate, stream: mockMessagesStream };
  }
  return { default: MockAnthropic };
});

const mockWithAIBudget = vi.fn();
vi.mock("@/lib/access-v2/ai-budget/middleware", () => ({
  withAIBudget: (...args: unknown[]) => mockWithAIBudget(...args),
}));

const mockLogUsage = vi.fn();
vi.mock("@/lib/usage-tracking", () => ({
  logUsage: (...args: unknown[]) => mockLogUsage(...args),
}));

const mockResolveCredentials = vi.fn();
vi.mock("../resolve-credentials", () => ({
  resolveCredentials: (...args: unknown[]) => mockResolveCredentials(...args),
}));

import { callAnthropicMessages, streamAnthropicMessages } from "../call";

const fakeSupabase = {} as SupabaseClient;

const baseOpts = {
  model: "claude-haiku-4-5-20251001",
  messages: [{ role: "user" as const, content: "hi" }],
  maxTokens: 100,
  endpoint: "/api/test",
  supabase: fakeSupabase,
};

function buildResponse(overrides: { stop_reason?: string; input_tokens?: number; output_tokens?: number } = {}) {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: "ok" }],
    model: "claude-haiku-4-5-20251001",
    stop_reason: overrides.stop_reason ?? "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: overrides.input_tokens ?? 100,
      output_tokens: overrides.output_tokens ?? 50,
    },
  };
}

describe("callAnthropicMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "sk-test";
    mockResolveCredentials.mockResolvedValue(null);
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("happy path: returns ok with response and usage", async () => {
    mockMessagesCreate.mockResolvedValueOnce(buildResponse({ stop_reason: "end_turn", input_tokens: 100, output_tokens: 50 }));

    const result = await callAnthropicMessages({ ...baseOpts });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.usage.input_tokens).toBe(100);
    expect(result.usage.output_tokens).toBe(50);
    expect(result.usage.stop_reason).toBe("end_turn");
    expect(result.response.id).toBe("msg_1");
  });

  it("truncation: stop_reason=max_tokens returns ok:false reason:truncated", async () => {
    mockMessagesCreate.mockResolvedValueOnce(buildResponse({ stop_reason: "max_tokens" }));

    const result = await callAnthropicMessages({ ...baseOpts });

    expect(result).toEqual({ ok: false, reason: "truncated" });
    expect(mockLogUsage).not.toHaveBeenCalled();
  });

  it("no credentials: missing env key without teacherId returns no_credentials, SDK not called", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const result = await callAnthropicMessages({ ...baseOpts });

    expect(result).toEqual({ ok: false, reason: "no_credentials" });
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("api error: SDK throws, returns api_error with the error, no logUsage", async () => {
    const err = new Error("network");
    mockMessagesCreate.mockRejectedValueOnce(err);

    const result = await callAnthropicMessages({ ...baseOpts });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toBe("api_error");
    if (result.reason !== "api_error") throw new Error("expected api_error");
    expect(result.error).toBe(err);
    expect(mockLogUsage).not.toHaveBeenCalled();
  });

  it("logUsage on success: called with correct shape, NOT called on truncation", async () => {
    mockMessagesCreate.mockResolvedValueOnce(buildResponse({ stop_reason: "end_turn", input_tokens: 100, output_tokens: 50 }));

    await callAnthropicMessages({ ...baseOpts, teacherId: "T1" });

    expect(mockLogUsage).toHaveBeenCalledTimes(1);
    expect(mockLogUsage).toHaveBeenCalledWith({
      userId: "T1",
      studentId: undefined,
      endpoint: "/api/test",
      model: "claude-haiku-4-5-20251001",
      inputTokens: 100,
      outputTokens: 50,
    });

    mockLogUsage.mockClear();
    mockMessagesCreate.mockResolvedValueOnce(buildResponse({ stop_reason: "max_tokens" }));
    await callAnthropicMessages({ ...baseOpts, teacherId: "T1" });
    expect(mockLogUsage).not.toHaveBeenCalled();
  });

  it("withAIBudget over_cap: relays cap/used/resetAt, SDK not invoked, no logUsage", async () => {
    mockWithAIBudget.mockResolvedValueOnce({
      ok: false,
      reason: "over_cap",
      cap: 50000,
      used: 50000,
      resetAt: "2026-05-09T16:00:00.000Z",
    });

    const result = await callAnthropicMessages({ ...baseOpts, studentId: "S1" });

    expect(result).toEqual({
      ok: false,
      reason: "over_cap",
      cap: 50000,
      used: 50000,
      resetAt: "2026-05-09T16:00:00.000Z",
    });
    expect(mockMessagesCreate).not.toHaveBeenCalled();
    expect(mockLogUsage).not.toHaveBeenCalled();
  });

  it("withAIBudget truncated: relays as truncated, no logUsage", async () => {
    mockWithAIBudget.mockResolvedValueOnce({
      ok: false,
      reason: "truncated",
      cap: 50000,
      used: 12000,
      resetAt: "2026-05-09T16:00:00.000Z",
    });

    const result = await callAnthropicMessages({ ...baseOpts, studentId: "S1" });

    expect(result).toEqual({
      ok: false,
      reason: "truncated",
      cap: 50000,
      used: 12000,
      resetAt: "2026-05-09T16:00:00.000Z",
    });
    expect(mockLogUsage).not.toHaveBeenCalled();
  });

  it("withAIBudget success: returns ok with relayed result, fires logUsage with studentId", async () => {
    const response = buildResponse({ stop_reason: "end_turn", input_tokens: 80, output_tokens: 20 });
    mockWithAIBudget.mockImplementationOnce(async (_supabase: unknown, _studentId: unknown, fn: () => Promise<{ result: unknown; usage: unknown }>) => {
      const inner = await fn();
      return {
        ok: true,
        result: inner.result,
        cap: 50000,
        used: 12100,
        remaining: 37900,
        source: "tier_default",
        resetAt: "2026-05-09T16:00:00.000Z",
      };
    });
    mockMessagesCreate.mockResolvedValueOnce(response);

    const result = await callAnthropicMessages({ ...baseOpts, studentId: "S1" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.usage.input_tokens).toBe(80);
    expect(result.usage.output_tokens).toBe(20);
    expect(mockLogUsage).toHaveBeenCalledTimes(1);
    expect(mockLogUsage).toHaveBeenCalledWith({
      userId: undefined,
      studentId: "S1",
      endpoint: "/api/test",
      model: "claude-haiku-4-5-20251001",
      inputTokens: 80,
      outputTokens: 20,
    });
  });
});

describe("streamAnthropicMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "sk-test";
    mockResolveCredentials.mockResolvedValue(null);
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  function fakeStream(deltas: string[], finalStopReason: string) {
    const events = deltas.map((json) => ({
      type: "content_block_delta",
      delta: { type: "input_json_delta", partial_json: json },
    }));
    return {
      [Symbol.asyncIterator]: async function* () {
        for (const e of events) yield e;
      },
      finalMessage: vi.fn().mockResolvedValue(buildResponse({ stop_reason: finalStopReason, input_tokens: 200, output_tokens: 60 })),
    };
  }

  it("streaming happy path: yields partial_json events then complete", async () => {
    mockMessagesStream.mockReturnValueOnce(fakeStream(['{"a":', "1}"], "end_turn"));

    const events: unknown[] = [];
    for await (const event of streamAnthropicMessages({ ...baseOpts })) events.push(event);

    expect(events).toEqual([
      { type: "partial_json", json: '{"a":' },
      { type: "partial_json", json: "1}" },
      expect.objectContaining({ type: "complete", usage: expect.objectContaining({ input_tokens: 200, output_tokens: 60, stop_reason: "end_turn" }) }),
    ]);
    expect(mockLogUsage).toHaveBeenCalledTimes(1);
    expect(mockLogUsage).toHaveBeenCalledWith(expect.objectContaining({ inputTokens: 200, outputTokens: 60 }));
  });

  it("streaming truncation: yields error event on max_tokens, no logUsage", async () => {
    mockMessagesStream.mockReturnValueOnce(fakeStream(["{", "}"], "max_tokens"));

    const events: unknown[] = [];
    for await (const event of streamAnthropicMessages({ ...baseOpts })) events.push(event);

    expect(events).toEqual([
      { type: "partial_json", json: "{" },
      { type: "partial_json", json: "}" },
      { type: "error", reason: "truncated" },
    ]);
    expect(mockLogUsage).not.toHaveBeenCalled();
  });
});
