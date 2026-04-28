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

  // ──────────────────────────────────────────────────────────────────────
  // Phase 1 bug fixes — verify rule 3 + rule 6 guards prevent paste from
  // double/triple-counting on the same underlying signal, and verify rule 3
  // doesn't compute absurd WPM on tiny totalTimeActive.
  // ──────────────────────────────────────────────────────────────────────

  it("paste-heavy short response does NOT triple-count (rule 3 + 6 guards)", () => {
    // Reproduces the production screenshot: 424 chars in 1.1s, 4 keystrokes,
    // 1 paste of 424 chars. Before the fix this produced "4592 WPM" speed_anomaly
    // PLUS minimal_time PLUS paste_heavy (and pre-fix rule 2 if snapshots had worked).
    // With the fix, only rule 1 (paste_heavy) and rule 4 (no_editing) fire — both
    // are independent signals about distinct evidence.
    const now = Date.now();
    const result = analyzeIntegrity(
      makeMetadata({
        characterCount: 424,
        keystrokeCount: 4,
        deletionCount: 0,
        totalTimeActive: 1.1,
        focusLossCount: 0,
        pasteEvents: [{ timestamp: now, length: 424, content: "..." }],
        snapshots: [],
      })
    );
    // Should fire: paste_heavy (concern, -40) + no_editing (warning, -10)
    // Should NOT fire: speed_anomaly (rule 3 guard: time < 10s)
    // Should NOT fire: minimal_time (rule 6 guard: pasteRatio >= 0.4)
    const types = result.flags.map((f) => f.type).sort();
    expect(types).toEqual(["no_editing", "paste_heavy"]);
    expect(result.flags.find((f) => f.type === "paste_heavy")?.severity).toBe("concern");
    expect(result.flags.find((f) => f.type === "no_editing")?.severity).toBe("warning");
    expect(result.score).toBe(50);
    expect(result.level).toBe("medium");
  });

  it("short genuine typing does NOT fire speed_anomaly (rule 3 time guard)", () => {
    // Before the fix: 80 chars in 8s = 120 WPM → speed_anomaly warning.
    // With the fix: totalTimeActive < 10 → rule 3 skipped entirely (too little
    // signal to make a confident speed claim).
    const result = analyzeIntegrity(
      makeMetadata({
        characterCount: 80,
        keystrokeCount: 80,
        deletionCount: 4,
        totalTimeActive: 8,
        focusLossCount: 0,
        pasteEvents: [],
        snapshots: [],
      })
    );
    expect(result.flags.find((f) => f.type === "speed_anomaly")).toBeUndefined();
    expect(result.score).toBe(100);
    expect(result.level).toBe("high");
  });

  it("long genuine typing still fires speed_anomaly at correct thresholds", () => {
    // Verifies the guards don't break the rule when conditions are right.
    // 2000 chars over varying durations, 10% deletion rate (no rule 4), no paste.
    const base = {
      characterCount: 2000,
      keystrokeCount: 2000,
      deletionCount: 200,
      focusLossCount: 0,
      pasteEvents: [],
      snapshots: [],
    };

    // 2000 chars / 600s / 5 * 60 = 40 WPM — below threshold, no flag
    const slow = analyzeIntegrity(makeMetadata({ ...base, totalTimeActive: 600 }));
    expect(slow.flags.find((f) => f.type === "speed_anomaly")).toBeUndefined();

    // 2000 chars / 200s / 5 * 60 = 120 WPM — warning (100-150)
    const medium = analyzeIntegrity(makeMetadata({ ...base, totalTimeActive: 200 }));
    expect(medium.flags.find((f) => f.type === "speed_anomaly")?.severity).toBe("warning");
    expect(medium.score).toBe(90);

    // 2000 chars / 100s / 5 * 60 = 240 WPM — concern (>150)
    const fast = analyzeIntegrity(makeMetadata({ ...base, totalTimeActive: 100 }));
    expect(fast.flags.find((f) => f.type === "speed_anomaly")?.severity).toBe("concern");
    expect(fast.score).toBe(75);
  });

  it("paste + focus_loss fires both flags independently (no over-suppression)", () => {
    // Verifies the rule 3 + 6 guards don't accidentally suppress UNRELATED rules.
    // characterCount=80 keeps us under rule 4's >100 threshold so no_editing
    // doesn't muddy the assertion.
    const now = Date.now();
    const result = analyzeIntegrity(
      makeMetadata({
        characterCount: 80,
        keystrokeCount: 4,
        deletionCount: 0,
        totalTimeActive: 2,
        focusLossCount: 25,
        pasteEvents: [{ timestamp: now, length: 80, content: "..." }],
        snapshots: [],
      })
    );
    // Should fire: paste_heavy (concern, -40) + focus_loss (concern, -15)
    // Should NOT fire: speed_anomaly, minimal_time, no_editing (chars < 100)
    const types = result.flags.map((f) => f.type).sort();
    expect(types).toEqual(["focus_loss", "paste_heavy"]);
    expect(result.flags.find((f) => f.type === "paste_heavy")?.severity).toBe("concern");
    expect(result.flags.find((f) => f.type === "focus_loss")?.severity).toBe("concern");
    expect(result.score).toBe(45);
    expect(result.level).toBe("medium");
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
