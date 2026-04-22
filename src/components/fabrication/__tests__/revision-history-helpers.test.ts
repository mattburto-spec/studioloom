import { describe, it, expect } from "vitest";
import {
  revisionStatusLabel,
  revisionStatusColorClass,
  formatRuleCountsCompact,
  formatRelativeTime,
  shouldShowHistoryPanel,
} from "../revision-history-helpers";
import type { RevisionSummary } from "@/lib/fabrication/orchestration";

/**
 * Phase 5-5 helper tests. Pure-function coverage following the Phase
 * 4/5 convention — no DOM render harness in the project.
 */

describe("revisionStatusLabel", () => {
  it("maps the 4 known scan_status values to student-friendly labels", () => {
    expect(revisionStatusLabel("done")).toBe("Scanned");
    expect(revisionStatusLabel("running")).toBe("Scanning");
    expect(revisionStatusLabel("pending")).toBe("Queued");
    expect(revisionStatusLabel("error")).toBe("Error");
  });
  it("falls back to 'Queued' for null / unknown", () => {
    expect(revisionStatusLabel(null)).toBe("Queued");
    expect(revisionStatusLabel("weird-state")).toBe("Queued");
  });
});

describe("revisionStatusColorClass", () => {
  it("returns green for done", () => {
    expect(revisionStatusColorClass("done")).toMatch(/green/);
  });
  it("returns red for error", () => {
    expect(revisionStatusColorClass("error")).toMatch(/red/);
  });
  it("returns blue for running", () => {
    expect(revisionStatusColorClass("running")).toMatch(/blue/);
  });
  it("returns gray for pending / null / unknown", () => {
    expect(revisionStatusColorClass("pending")).toMatch(/gray/);
    expect(revisionStatusColorClass(null)).toMatch(/gray/);
    expect(revisionStatusColorClass("weird")).toMatch(/gray/);
  });
});

describe("formatRuleCountsCompact", () => {
  it("returns null when all counts are zero (UI hides the pill)", () => {
    expect(formatRuleCountsCompact({ block: 0, warn: 0, fyi: 0 })).toBeNull();
  });
  it("renders only non-zero counts with B/W/I suffix", () => {
    expect(formatRuleCountsCompact({ block: 2, warn: 1, fyi: 3 })).toBe("2B · 1W · 3I");
    expect(formatRuleCountsCompact({ block: 2, warn: 0, fyi: 0 })).toBe("2B");
    expect(formatRuleCountsCompact({ block: 0, warn: 1, fyi: 0 })).toBe("1W");
    expect(formatRuleCountsCompact({ block: 0, warn: 0, fyi: 5 })).toBe("5I");
  });
  it("preserves severity order (block, warn, fyi)", () => {
    expect(formatRuleCountsCompact({ block: 1, warn: 1, fyi: 1 })).toBe("1B · 1W · 1I");
  });
});

describe("formatRelativeTime", () => {
  const now = Date.UTC(2026, 3, 22, 12, 0, 0); // 22 Apr 2026 12:00 UTC

  it("returns 'just now' when < 60 s old", () => {
    expect(formatRelativeTime(new Date(now - 10_000).toISOString(), now)).toBe("just now");
    expect(formatRelativeTime(new Date(now - 59_999).toISOString(), now)).toBe("just now");
  });
  it("returns 'Nm ago' for minutes", () => {
    expect(formatRelativeTime(new Date(now - 180_000).toISOString(), now)).toBe("3m ago");
    expect(formatRelativeTime(new Date(now - 59 * 60_000).toISOString(), now)).toBe("59m ago");
  });
  it("returns 'Nh ago' for hours", () => {
    expect(formatRelativeTime(new Date(now - 2 * 3_600_000).toISOString(), now)).toBe("2h ago");
  });
  it("returns 'Nd ago' for days", () => {
    expect(formatRelativeTime(new Date(now - 3 * 86_400_000).toISOString(), now)).toBe("3d ago");
  });
  it("returns the raw string if parsing fails (defensive)", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("not-a-date");
  });
  it("clamps negative diffs to 'just now' (clock skew defensive)", () => {
    expect(formatRelativeTime(new Date(now + 10_000).toISOString(), now)).toBe("just now");
  });
});

describe("shouldShowHistoryPanel", () => {
  const mk = (n: number): RevisionSummary[] =>
    Array.from({ length: n }).map((_, i) => ({
      id: `rev-${i + 1}`,
      revisionNumber: i + 1,
      scanStatus: "done",
      scanError: null,
      scanCompletedAt: "2026-04-22T00:00:00Z",
      thumbnailUrl: null,
      ruleCounts: { block: 0, warn: 0, fyi: 0 },
      createdAt: "2026-04-22T00:00:00Z",
    }));

  it("returns false when no revisions", () => {
    expect(shouldShowHistoryPanel([])).toBe(false);
  });
  it("returns false when exactly 1 revision (no history to show)", () => {
    expect(shouldShowHistoryPanel(mk(1))).toBe(false);
  });
  it("returns true when 2+ revisions", () => {
    expect(shouldShowHistoryPanel(mk(2))).toBe(true);
    expect(shouldShowHistoryPanel(mk(5))).toBe(true);
  });
});
