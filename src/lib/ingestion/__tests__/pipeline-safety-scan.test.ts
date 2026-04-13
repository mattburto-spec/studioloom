import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IngestionPipelineResult } from "../types";

// Mock content safety moderation
const mockModerateContent = vi.fn();
vi.mock("@/lib/content-safety/server-moderation", () => ({
  moderateContent: (...args: unknown[]) => mockModerateContent(...args),
}));

// Mock anthropic SDK (used by pass-a, pass-b, moderate)
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

// Mock dedup to return non-duplicate
vi.mock("../dedup", () => ({
  dedupCheck: vi.fn().mockResolvedValue({
    fileHash: "abc123",
    isDuplicate: false,
    cost: { inputTokens: 0, outputTokens: 0, modelId: "none", estimatedCostUSD: 0, timeMs: 0 },
  }),
}));

// Mock parse
vi.mock("../parse", () => ({
  parseDocument: vi.fn().mockReturnValue({
    title: "Test Document",
    sections: [{ index: 0, heading: "Intro", content: "Safe content", level: 1, wordCount: 2, hasListItems: false, hasDuration: false }],
    totalWordCount: 2,
    headingCount: 1,
    cost: { inputTokens: 0, outputTokens: 0, modelId: "none", estimatedCostUSD: 0, timeMs: 0 },
  }),
}));

// Mock passA, passB, extract, copyright, moderate — not reached if safety scan blocks
vi.mock("../pass-a", () => ({
  passA: {
    id: "pass-a-classify", label: "Pass A", model: "test",
    run: vi.fn().mockResolvedValue({
      documentType: "lesson_plan", confidence: 0.9,
      confidences: { documentType: 0.9 }, topic: "Test", sections: [],
      cost: { inputTokens: 10, outputTokens: 5, modelId: "test", estimatedCostUSD: 0, timeMs: 10 },
    }),
  },
}));

vi.mock("../pass-b", () => ({
  passB: {
    id: "pass-b-analyse", label: "Pass B", model: "test",
    run: vi.fn().mockResolvedValue({
      classification: { documentType: "lesson_plan", confidence: 0.9, confidences: { documentType: 0.9 }, topic: "Test", sections: [], cost: { inputTokens: 0, outputTokens: 0, modelId: "test", estimatedCostUSD: 0, timeMs: 0 } },
      enrichedSections: [],
      cost: { inputTokens: 10, outputTokens: 5, modelId: "test", estimatedCostUSD: 0, timeMs: 10 },
    }),
  },
}));

vi.mock("../extract", () => ({
  extractBlocks: vi.fn().mockReturnValue({
    blocks: [], totalSectionsProcessed: 0, activitySectionsFound: 0,
    piiDetected: false,
    cost: { inputTokens: 0, outputTokens: 0, modelId: "none", estimatedCostUSD: 0, timeMs: 0 },
  }),
}));

vi.mock("../copyright-check", () => ({
  checkBlocksForCopyright: vi.fn().mockResolvedValue({
    blocks: [],
    cost: { inputTokens: 0, outputTokens: 0, modelId: "none", estimatedCostUSD: 0, timeMs: 0 },
  }),
}));

vi.mock("../moderate", () => ({
  moderateExtractedBlocks: vi.fn().mockResolvedValue({
    blocks: [],
    cost: { inputTokens: 0, outputTokens: 0, modelId: "none", estimatedCostUSD: 0, timeMs: 0 },
  }),
}));

describe("Phase 6C: Ingestion pipeline safety pre-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clean text → pipeline proceeds normally", async () => {
    mockModerateContent.mockResolvedValue({
      moderation: { ok: true, status: "clean", flags: [], layer: "server_haiku" },
      cost: { inputTokens: 50, outputTokens: 10, modelId: "haiku", estimatedCostUSD: 0.0001, timeMs: 200 },
    });

    const { runIngestionPipeline } = await import("../pipeline");
    const result = await runIngestionPipeline(
      { rawText: "This is safe educational content about design thinking." },
      { apiKey: "test-key", teacherId: "teacher-1" }
    );

    expect(result.moderationHold).toBeUndefined();
    // Pipeline should have proceeded to classification
    expect(result.classification.documentType).toBe("lesson_plan");
  });

  it("flagged text → sets moderationHold and returns early", async () => {
    mockModerateContent.mockResolvedValue({
      moderation: {
        ok: false,
        status: "flagged",
        flags: [{ type: "violence", severity: "warning", confidence: 0.85 }],
        layer: "server_haiku",
      },
      cost: { inputTokens: 50, outputTokens: 10, modelId: "haiku", estimatedCostUSD: 0.0001, timeMs: 200 },
    });

    const { runIngestionPipeline } = await import("../pipeline");
    const result = await runIngestionPipeline(
      { rawText: "Content with problematic material." },
      { apiKey: "test-key", teacherId: "teacher-1" }
    );

    expect(result.moderationHold).toBe(true);
    expect(result.moderationHoldReason).toContain("flagged");
    expect(result.moderationHoldReason).toContain("violence");
    // Should NOT have proceeded to classification (stays at "unknown")
    expect(result.classification.documentType).toBe("unknown");
  });

  it("blocked text → sets moderationHold and returns early", async () => {
    mockModerateContent.mockResolvedValue({
      moderation: {
        ok: false,
        status: "blocked",
        flags: [{ type: "sexual", severity: "critical", confidence: 0.95 }],
        layer: "server_haiku",
      },
      cost: { inputTokens: 50, outputTokens: 10, modelId: "haiku", estimatedCostUSD: 0.0001, timeMs: 200 },
    });

    const { runIngestionPipeline } = await import("../pipeline");
    const result = await runIngestionPipeline(
      { rawText: "Blocked content." },
      { apiKey: "test-key", teacherId: "teacher-1" }
    );

    expect(result.moderationHold).toBe(true);
    expect(result.moderationHoldReason).toContain("blocked");
  });

  it("API failure (status=pending) → pipeline proceeds (benefit of doubt)", async () => {
    mockModerateContent.mockResolvedValue({
      moderation: { ok: false, status: "pending", flags: [], layer: "server_haiku" },
      cost: { inputTokens: 0, outputTokens: 0, modelId: "haiku", estimatedCostUSD: 0, timeMs: 100 },
    });

    const { runIngestionPipeline } = await import("../pipeline");
    const result = await runIngestionPipeline(
      { rawText: "Content when API is down." },
      { apiKey: "test-key", teacherId: "teacher-1" }
    );

    expect(result.moderationHold).toBeUndefined();
    expect(result.classification.documentType).toBe("lesson_plan");
  });

  it("moderateContent throws → pipeline proceeds (benefit of doubt)", async () => {
    mockModerateContent.mockRejectedValue(new Error("Network timeout"));

    const { runIngestionPipeline } = await import("../pipeline");
    const result = await runIngestionPipeline(
      { rawText: "Content when moderation errors." },
      { apiKey: "test-key", teacherId: "teacher-1" }
    );

    expect(result.moderationHold).toBeUndefined();
    expect(result.classification.documentType).toBe("lesson_plan");
  });

  it("sandbox mode → skips safety scan entirely", async () => {
    const { runIngestionPipeline } = await import("../pipeline");
    const result = await runIngestionPipeline(
      { rawText: "Any content in sandbox." },
      { apiKey: "test-key", teacherId: "teacher-1", sandboxMode: true }
    );

    // moderateContent should not have been called
    expect(mockModerateContent).not.toHaveBeenCalled();
    expect(result.moderationHold).toBeUndefined();
  });
});
