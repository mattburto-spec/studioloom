import { describe, it, expect } from "vitest";
import { analyzeIntegrity, getScoreColor, getScoreLabel } from "../analyze-integrity";
import type { IntegrityMetadata } from "@/components/student/MonitoredTextarea";

function makeMetadata(overrides: Partial<IntegrityMetadata> = {}): IntegrityMetadata {
  return {
    characterCount: 500,
    keystrokeCount: 600,
    deletionCount: 50,
    totalTimeActive: 300,
    focusLossCount: 2,
    startTime: Date.now() - 300_000,
    pasteEvents: [],
    snapshots: [],
    wordCountHistory: [],
    ...overrides,
  };
}

describe("analyzeIntegrity", () => {
  it("returns high confidence for normal writing behavior", () => {
    const result = analyzeIntegrity(makeMetadata());
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.level).toBe("high");
    expect(result.flags).toHaveLength(0);
    expect(result.summary).toContain("independent work");
  });

  it("flags heavy paste ratio (>70%)", () => {
    const result = analyzeIntegrity(
      makeMetadata({
        characterCount: 1000,
        pasteEvents: [
          { timestamp: Date.now(), length: 800, content: "pasted text..." },
        ],
      })
    );
    expect(result.score).toBeLessThan(70);
    expect(result.flags.some((f) => f.type === "paste_heavy")).toBe(true);
    expect(result.flags.find((f) => f.type === "paste_heavy")?.severity).toBe(
      "concern"
    );
  });

  it("flags moderate paste ratio (40-70%) as warning", () => {
    const result = analyzeIntegrity(
      makeMetadata({
        characterCount: 1000,
        pasteEvents: [
          { timestamp: Date.now(), length: 500, content: "pasted text..." },
        ],
      })
    );
    expect(result.flags.some((f) => f.type === "paste_heavy")).toBe(true);
    expect(result.flags.find((f) => f.type === "paste_heavy")?.severity).toBe(
      "warning"
    );
  });

  it("flags bulk entry from snapshots", () => {
    const now = Date.now();
    const result = analyzeIntegrity(
      makeMetadata({
        snapshots: [
          { text: "Hello", timestamp: now },
          { text: "Hello".padEnd(600, " world"), timestamp: now + 10_000 },
        ],
      })
    );
    expect(result.flags.some((f) => f.type === "bulk_entry")).toBe(true);
  });

  it("flags typing speed >150 WPM as concern", () => {
    // 1000 chars in 20 seconds = 50 chars/sec = 600 WPM
    const result = analyzeIntegrity(
      makeMetadata({
        characterCount: 1000,
        totalTimeActive: 20,
        keystrokeCount: 1000,
        deletionCount: 50,
      })
    );
    expect(result.flags.some((f) => f.type === "speed_anomaly")).toBe(true);
    expect(result.flags.find((f) => f.type === "speed_anomaly")?.severity).toBe(
      "concern"
    );
  });

  it("flags very low editing rate", () => {
    const result = analyzeIntegrity(
      makeMetadata({
        characterCount: 500,
        keystrokeCount: 500,
        deletionCount: 2, // 0.4% deletion rate
      })
    );
    expect(result.flags.some((f) => f.type === "no_editing")).toBe(true);
  });

  it("flags excessive focus loss (>20)", () => {
    const result = analyzeIntegrity(
      makeMetadata({ focusLossCount: 25 })
    );
    expect(result.flags.some((f) => f.type === "focus_loss")).toBe(true);
    expect(result.flags.find((f) => f.type === "focus_loss")?.severity).toBe(
      "concern"
    );
  });

  it("flags minimal time with large content", () => {
    const result = analyzeIntegrity(
      makeMetadata({
        characterCount: 500,
        totalTimeActive: 10,
        keystrokeCount: 500,
        deletionCount: 25,
      })
    );
    expect(result.flags.some((f) => f.type === "minimal_time")).toBe(true);
  });

  it("clamps score to 0-100 range", () => {
    // Stack ALL flags at once
    const now = Date.now();
    const result = analyzeIntegrity({
      characterCount: 1000,
      keystrokeCount: 1000,
      deletionCount: 0,
      totalTimeActive: 5,
      focusLossCount: 30,
      startTime: now - 5000,
      pasteEvents: [
        { timestamp: now, length: 900, content: "huge paste..." },
      ],
      snapshots: [
        { text: "", timestamp: now },
        { text: "x".repeat(600), timestamp: now + 3000 },
      ],
      wordCountHistory: [],
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.level).toBe("low");
  });

  it("handles empty metadata gracefully", () => {
    const result = analyzeIntegrity(
      makeMetadata({
        characterCount: 0,
        keystrokeCount: 0,
        deletionCount: 0,
        totalTimeActive: 0,
        focusLossCount: 0,
        pasteEvents: [],
        snapshots: [],
      })
    );
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe("getScoreColor", () => {
  it("returns green for high scores", () => {
    expect(getScoreColor(85)).toContain("green");
  });
  it("returns amber for medium scores", () => {
    expect(getScoreColor(55)).toContain("amber");
  });
  it("returns red for low scores", () => {
    expect(getScoreColor(25)).toContain("red");
  });
});

describe("getScoreLabel", () => {
  it("returns correct labels", () => {
    expect(getScoreLabel("high")).toBe("Likely Independent");
    expect(getScoreLabel("medium")).toBe("Review Recommended");
    expect(getScoreLabel("low")).toBe("Flagged for Review");
  });
});
