import { describe, it, expect } from "vitest";
import {
  PASSED_STATUSES,
  FAILURE_SEVERITIES,
  countPassed,
  computePassRate,
  computeAvgRevisions,
  computeMedianRevisions,
  computeTopFailureRule,
  buildHistorySummary,
  extractFailingRuleIds,
  formatPassRate,
  formatAvgRevisions,
  type HistoryJob,
} from "../fabrication-history-helpers";

/**
 * Phase 6-4 aggregation tests. Pure functions; the orchestration +
 * API route will call these directly on query results.
 */

function job(partial: Partial<HistoryJob> & { status: string }): HistoryJob {
  return {
    jobId: "j-" + Math.random().toString(36).slice(2, 8),
    currentRevision: 1,
    createdAt: "2026-04-22T12:00:00Z",
    currentRevisionFailingRuleIds: [],
    ...partial,
  };
}

describe("PASSED_STATUSES + FAILURE_SEVERITIES", () => {
  it("treats approved / picked_up / completed as passed", () => {
    expect(PASSED_STATUSES).toContain("approved");
    expect(PASSED_STATUSES).toContain("picked_up");
    expect(PASSED_STATUSES).toContain("completed");
  });
  it("does NOT treat rejected / cancelled / pending as passed", () => {
    expect(PASSED_STATUSES).not.toContain("rejected");
    expect(PASSED_STATUSES).not.toContain("cancelled");
    expect(PASSED_STATUSES).not.toContain("pending_approval");
    expect(PASSED_STATUSES).not.toContain("needs_revision");
  });
  it("fyi is not a failure severity (informational only)", () => {
    expect(FAILURE_SEVERITIES).toEqual(["block", "warn"]);
  });
});

describe("countPassed + computePassRate", () => {
  it("counts passed jobs correctly", () => {
    const jobs = [
      job({ status: "approved" }),
      job({ status: "completed" }),
      job({ status: "picked_up" }),
      job({ status: "rejected" }),
      job({ status: "pending_approval" }),
    ];
    expect(countPassed(jobs)).toBe(3);
    expect(computePassRate(jobs)).toBeCloseTo(3 / 5);
  });
  it("returns 0 for empty list (not NaN)", () => {
    expect(countPassed([])).toBe(0);
    expect(computePassRate([])).toBe(0);
  });
  it("handles all-fail list without crashing", () => {
    const jobs = [
      job({ status: "rejected" }),
      job({ status: "needs_revision" }),
    ];
    expect(computePassRate(jobs)).toBe(0);
  });
  it("handles all-pass list", () => {
    const jobs = [
      job({ status: "approved" }),
      job({ status: "completed" }),
    ];
    expect(computePassRate(jobs)).toBe(1);
  });
});

describe("computeAvgRevisions + computeMedianRevisions", () => {
  it("mean of [1, 2, 3, 4, 10] = 4", () => {
    const jobs = [1, 2, 3, 4, 10].map((n) =>
      job({ status: "approved", currentRevision: n })
    );
    expect(computeAvgRevisions(jobs)).toBe(4);
  });
  it("median of [1, 2, 3, 4, 10] = 3 (not skewed by outlier)", () => {
    const jobs = [1, 2, 3, 4, 10].map((n) =>
      job({ status: "approved", currentRevision: n })
    );
    expect(computeMedianRevisions(jobs)).toBe(3);
  });
  it("median of even-length list = mean of two middles", () => {
    const jobs = [1, 2, 3, 4].map((n) =>
      job({ status: "approved", currentRevision: n })
    );
    expect(computeMedianRevisions(jobs)).toBe(2.5);
  });
  it("both return 0 for empty", () => {
    expect(computeAvgRevisions([])).toBe(0);
    expect(computeMedianRevisions([])).toBe(0);
  });
});

describe("computeTopFailureRule", () => {
  it("returns null for empty / no-failure list", () => {
    expect(computeTopFailureRule([])).toBeNull();
    expect(
      computeTopFailureRule([
        job({ status: "approved", currentRevisionFailingRuleIds: [] }),
      ])
    ).toBeNull();
  });
  it("picks the single most common rule id across jobs", () => {
    const jobs = [
      job({
        status: "approved",
        currentRevisionFailingRuleIds: ["R-STL-01", "R-STL-02"],
      }),
      job({
        status: "approved",
        currentRevisionFailingRuleIds: ["R-STL-01"],
      }),
      job({
        status: "rejected",
        currentRevisionFailingRuleIds: ["R-STL-01", "R-SVG-03"],
      }),
    ];
    const top = computeTopFailureRule(jobs);
    expect(top).not.toBeNull();
    expect(top!.ruleId).toBe("R-STL-01");
    expect(top!.count).toBe(3);
  });
  it("counts a rule once per job when it fires only once on that job's current revision", () => {
    // Rule appears in 2 of 3 jobs' current revisions → count=2.
    const jobs = [
      job({ currentRevisionFailingRuleIds: ["R-X"], status: "approved" }),
      job({ currentRevisionFailingRuleIds: ["R-X"], status: "approved" }),
      job({ currentRevisionFailingRuleIds: ["R-Y"], status: "approved" }),
    ];
    const top = computeTopFailureRule(jobs);
    expect(top).toEqual({ ruleId: "R-X", count: 2 });
  });
});

describe("buildHistorySummary", () => {
  it("aggregates the full metric shape in one call", () => {
    const jobs = [
      job({
        status: "approved",
        currentRevision: 1,
        currentRevisionFailingRuleIds: [],
      }),
      job({
        status: "rejected",
        currentRevision: 3,
        currentRevisionFailingRuleIds: ["R-STL-01", "R-STL-02"],
      }),
      job({
        status: "needs_revision",
        currentRevision: 2,
        currentRevisionFailingRuleIds: ["R-STL-01"],
      }),
    ];
    const summary = buildHistorySummary(jobs);
    expect(summary.totalSubmissions).toBe(3);
    expect(summary.passed).toBe(1);
    expect(summary.passRate).toBeCloseTo(1 / 3);
    expect(summary.avgRevisions).toBeCloseTo(2);
    expect(summary.medianRevisions).toBe(2);
    expect(summary.topFailureRule).toEqual({ ruleId: "R-STL-01", count: 2 });
  });
  it("returns zeroed shape for empty list", () => {
    const summary = buildHistorySummary([]);
    expect(summary).toEqual({
      totalSubmissions: 0,
      passed: 0,
      passRate: 0,
      avgRevisions: 0,
      medianRevisions: 0,
      topFailureRule: null,
    });
  });
});

describe("extractFailingRuleIds", () => {
  it("keeps block + warn, drops fyi", () => {
    const out = extractFailingRuleIds({
      rules: [
        { id: "R-A", severity: "block" },
        { id: "R-B", severity: "warn" },
        { id: "R-C", severity: "fyi" },
      ],
    });
    expect(out).toEqual(["R-A", "R-B"]);
  });
  it("handles null / missing scanResults / missing rules", () => {
    expect(extractFailingRuleIds(null)).toEqual([]);
    expect(extractFailingRuleIds(undefined)).toEqual([]);
    expect(extractFailingRuleIds({ rules: null })).toEqual([]);
    expect(extractFailingRuleIds({ rules: [] })).toEqual([]);
  });
  it("drops rule entries missing id or severity", () => {
    const out = extractFailingRuleIds({
      rules: [
        { id: "R-A", severity: "block" },
        { severity: "block" }, // no id
        { id: "R-C" }, // no severity
      ],
    });
    expect(out).toEqual(["R-A"]);
  });
});

describe("formatPassRate + formatAvgRevisions", () => {
  it("formats a normal pass rate", () => {
    expect(formatPassRate(0.75, 4)).toBe("75%");
    expect(formatPassRate(1, 1)).toBe("100%");
    expect(formatPassRate(0, 3)).toBe("0%");
  });
  it("returns em-dash when no submissions", () => {
    expect(formatPassRate(0, 0)).toBe("—");
  });
  it("formats avg revisions to one decimal", () => {
    expect(formatAvgRevisions(2.333, 3)).toBe("2.3");
    expect(formatAvgRevisions(1, 1)).toBe("1.0");
  });
  it("returns em-dash when no submissions (avg)", () => {
    expect(formatAvgRevisions(0, 0)).toBe("—");
  });
});
