import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Anthropic SDK — must be a class (used with `new`)
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

import { moderateContent } from "../server-moderation";
import type { ModerationContext } from "../types";

const CTX: ModerationContext = {
  classId: "class-1",
  studentId: "student-1",
  source: "student_progress",
  lang: "en",
};

function makeResponse(
  flags: Array<{
    type: string;
    severity: string;
    confidence: number;
    lang: string;
  }>,
  overall: string,
  overrides?: {
    stop_reason?: string;
    input_tokens?: number;
    output_tokens?: number;
  }
) {
  return {
    content: [
      {
        type: "tool_use",
        id: "tool_1",
        name: "moderate_content",
        input: { flags, overall },
      },
    ],
    stop_reason: overrides?.stop_reason ?? "end_turn",
    usage: {
      input_tokens: overrides?.input_tokens ?? 100,
      output_tokens: overrides?.output_tokens ?? 50,
    },
  };
}

describe("server-moderation", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Clean text ---
  it("returns clean for text with no flags", async () => {
    mockCreate.mockResolvedValue(makeResponse([], "clean"));
    const result = await moderateContent("Hello teacher!", CTX, "sk-test");
    expect(result.moderation.ok).toBe(true);
    expect(result.moderation.status).toBe("clean");
    expect(result.moderation.flags).toHaveLength(0);
    expect(result.moderation.layer).toBe("server_haiku");
  });

  // --- Flagged text (warning) ---
  it("returns flagged for text with warning-severity flags", async () => {
    mockCreate.mockResolvedValue(
      makeResponse(
        [
          {
            type: "profanity",
            severity: "warning",
            confidence: 0.85,
            lang: "en",
          },
        ],
        "flagged"
      )
    );
    const result = await moderateContent("mild bad word", CTX, "sk-test");
    expect(result.moderation.ok).toBe(false);
    expect(result.moderation.status).toBe("flagged");
    expect(result.moderation.flags).toHaveLength(1);
    expect(result.moderation.flags[0].type).toBe("profanity");
    expect(result.moderation.flags[0].severity).toBe("warning");
  });

  // --- Blocked text (critical) ---
  it("returns blocked for text with critical-severity flags", async () => {
    mockCreate.mockResolvedValue(
      makeResponse(
        [
          {
            type: "self_harm_risk",
            severity: "critical",
            confidence: 0.95,
            lang: "en",
          },
        ],
        "blocked"
      )
    );
    const result = await moderateContent("dangerous content", CTX, "sk-test");
    expect(result.moderation.ok).toBe(false);
    expect(result.moderation.status).toBe("blocked");
    expect(result.moderation.flags[0].severity).toBe("critical");
  });

  // --- Lesson #39: max_tokens truncation → pending, not clean ---
  it("returns pending on max_tokens truncation (Lesson #39)", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "t1",
          name: "moderate_content",
          input: { flags: [], overall: "clean" },
        },
      ],
      stop_reason: "max_tokens",
      usage: { input_tokens: 100, output_tokens: 1024 },
    });
    const result = await moderateContent("text", CTX, "sk-test");
    expect(result.moderation.ok).toBe(false);
    expect(result.moderation.status).toBe("pending");
    expect(result.moderation.flags[0].detail).toContain("max_tokens");
  });

  // --- Missing tool_use block → pending ---
  it("returns pending when no tool_use block in response", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "I cannot moderate this." }],
      stop_reason: "end_turn",
      usage: { input_tokens: 50, output_tokens: 20 },
    });
    const result = await moderateContent("text", CTX, "sk-test");
    expect(result.moderation.status).toBe("pending");
  });

  // --- No API key → pending ---
  it("returns pending when no API key provided", async () => {
    const result = await moderateContent("text", CTX, "");
    expect(result.moderation.status).toBe("pending");
    expect(result.moderation.flags[0].detail).toContain("No API key");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // --- API call throws → pending (NEVER clean) ---
  it("returns pending on API failure — NEVER clean (spec §7.3)", async () => {
    mockCreate.mockRejectedValue(new Error("Connection refused"));
    const result = await moderateContent("text", CTX, "sk-test");
    expect(result.moderation.ok).toBe(false);
    expect(result.moderation.status).toBe("pending");
    expect(result.moderation.status).not.toBe("clean");
  });

  // --- Image input builds correct content ---
  it("sends image as base64 content block", async () => {
    mockCreate.mockResolvedValue(makeResponse([], "clean"));
    const imgBuffer = Buffer.from("fake-image-bytes");
    await moderateContent(imgBuffer, CTX, "sk-test", "image/png");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    const msgContent = callArgs.messages[0].content;
    expect(msgContent[0].type).toBe("image");
    expect(msgContent[0].source.type).toBe("base64");
    expect(msgContent[0].source.media_type).toBe("image/png");
    expect(msgContent[1].type).toBe("text");
    expect(msgContent[1].text).toContain("student_progress");
  });

  // --- Unknown flag type mapped to 'other' ---
  it("maps unknown flag types to 'other'", async () => {
    mockCreate.mockResolvedValue(
      makeResponse(
        [
          {
            type: "made_up_flag",
            severity: "warning",
            confidence: 0.7,
            lang: "en",
          },
        ],
        "flagged"
      )
    );
    const result = await moderateContent("text", CTX, "sk-test");
    expect(result.moderation.flags[0].type).toBe("other");
  });

  // --- Unknown severity mapped to 'warning' ---
  it("maps unknown severity to 'warning'", async () => {
    mockCreate.mockResolvedValue(
      makeResponse(
        [
          {
            type: "profanity",
            severity: "extreme",
            confidence: 0.9,
            lang: "en",
          },
        ],
        "flagged"
      )
    );
    const result = await moderateContent("text", CTX, "sk-test");
    expect(result.moderation.flags[0].severity).toBe("warning");
  });

  // --- Status derived from flags, not Haiku's 'overall' ---
  it("derives status from flags even if Haiku says clean", async () => {
    mockCreate.mockResolvedValue(
      makeResponse(
        [
          {
            type: "pii",
            severity: "critical",
            confidence: 0.99,
            lang: "en",
          },
        ],
        "clean" // Haiku hallucinated "clean" despite critical flag
      )
    );
    const result = await moderateContent("text", CTX, "sk-test");
    expect(result.moderation.status).toBe("blocked"); // We override Haiku
  });

  // --- Cost tracking ---
  it("tracks input/output tokens and cost", async () => {
    mockCreate.mockResolvedValue(
      makeResponse([], "clean", { input_tokens: 200, output_tokens: 80 })
    );
    const result = await moderateContent("text", CTX, "sk-test");
    expect(result.cost.inputTokens).toBe(200);
    expect(result.cost.outputTokens).toBe(80);
    expect(result.cost.estimatedCostUSD).toBeGreaterThan(0);
    expect(result.cost.modelId).toBe("claude-haiku-4-5-20251001");
  });

  // --- Defensive: flags field missing entirely (Lesson #39) ---
  it("handles missing flags field defensively", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "t1",
          name: "moderate_content",
          input: { overall: "clean" }, // flags missing entirely
        },
      ],
      stop_reason: "end_turn",
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    const result = await moderateContent("text", CTX, "sk-test");
    expect(result.moderation.status).toBe("clean");
    expect(result.moderation.flags).toHaveLength(0);
  });

  // --- Confidence clamped to 0-1 ---
  it("clamps confidence to 0-1 range", async () => {
    mockCreate.mockResolvedValue(
      makeResponse(
        [
          {
            type: "violence",
            severity: "warning",
            confidence: 1.5,
            lang: "en",
          },
        ],
        "flagged"
      )
    );
    const result = await moderateContent("text", CTX, "sk-test");
    expect(result.moderation.flags[0].confidence).toBe(1);
  });

  // --- Uses MODELS.HAIKU, not hardcoded string ---
  it("passes correct model to Anthropic", async () => {
    mockCreate.mockResolvedValue(makeResponse([], "clean"));
    await moderateContent("text", CTX, "sk-test");
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-haiku-4-5-20251001");
  });

  // --- tool_choice is set (not thinking) ---
  it("uses tool_choice without thinking config", async () => {
    mockCreate.mockResolvedValue(makeResponse([], "clean"));
    await moderateContent("text", CTX, "sk-test");
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.tool_choice).toEqual({
      type: "tool",
      name: "moderate_content",
    });
    expect(callArgs).not.toHaveProperty("thinking");
  });

  // --- ZH content includes lang hint ---
  it("includes detected language in text content", async () => {
    mockCreate.mockResolvedValue(makeResponse([], "clean"));
    const zhCtx: ModerationContext = { ...CTX, lang: "zh" };
    await moderateContent("你好老师", zhCtx, "sk-test");
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].content[0].text).toContain(
      "detected language: zh"
    );
  });

  // --- rawResponse included for audit trail ---
  it("includes raw response for audit logging", async () => {
    const rawFlags = [
      { type: "profanity", severity: "warning", confidence: 0.8, lang: "en" },
    ];
    mockCreate.mockResolvedValue(makeResponse(rawFlags, "flagged"));
    const result = await moderateContent("text", CTX, "sk-test");
    expect(result.rawResponse).toBeDefined();
  });
});
