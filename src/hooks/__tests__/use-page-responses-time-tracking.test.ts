/**
 * Round 20 (6 May 2026 PM) — usePageResponses active-tab time tracking.
 *
 * Source-static guards lock the contract that the Hours stat in the
 * teacher's per-student view depends on: each saveProgress drains the
 * accumulated active-tab seconds and sends them as `timeSpentDelta`,
 * tab-visibility gates the timer, and a failed save restores the delta.
 *
 * Render-tests would need a full timer mock + fake Supabase round-trip
 * harness for this; source-static is the cheaper, more durable guard.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SRC = readFileSync(
  join(__dirname, "..", "usePageResponses.ts"),
  "utf-8"
);

describe("usePageResponses — active-tab time tracking", () => {
  it("declares pendingDeltaRef for accumulated seconds", () => {
    expect(SRC).toContain("pendingDeltaRef");
    expect(SRC).toMatch(/pendingDeltaRef\s*=\s*useRef\(0\)/);
  });

  it("only counts seconds when the tab is visible", () => {
    expect(SRC).toContain('document.visibilityState === "visible"');
  });

  it("uses a 1-second ticker", () => {
    expect(SRC).toMatch(/setInterval\(tick,\s*1000\)/);
  });

  it("listens for visibilitychange to reset the timer base", () => {
    expect(SRC).toContain('addEventListener("visibilitychange"');
    expect(SRC).toContain('removeEventListener("visibilitychange"');
  });

  it("caps each tick at 5s to defend against laptop-sleep / clock skew", () => {
    expect(SRC).toMatch(/Math\.min\(Math\.round\(elapsedMs\s*\/\s*1000\),\s*5\)/);
  });

  it("drains pendingDeltaRef into the saveProgress payload", () => {
    expect(SRC).toContain("payload.timeSpentDelta = deltaToSend");
  });

  it("resets pendingDeltaRef BEFORE the await so concurrent ticks aren't lost", () => {
    const drainIdx = SRC.indexOf("pendingDeltaRef.current = 0");
    const awaitIdx = SRC.indexOf('await fetch("/api/student/progress"');
    expect(drainIdx).toBeGreaterThan(0);
    expect(awaitIdx).toBeGreaterThan(0);
    expect(drainIdx).toBeLessThan(awaitIdx);
  });

  it("restores the delta when the save fails so it retries on the next save", () => {
    expect(SRC).toMatch(
      /!res\.ok\s*&&\s*deltaToSend\s*>\s*0[\s\S]{0,200}pendingDeltaRef\.current\s*\+=\s*deltaToSend/
    );
  });
});
