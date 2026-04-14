/**
 * Bug report count on admin landing — source-static + unit tests.
 * Verifies bugReportCount field added to usage analytics and surfaced on landing page.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const usageSrc = readFileSync(
  join(__dirname, "..", "monitors", "usage-analytics.ts"),
  "utf-8"
);

const healthSrc = readFileSync(
  join(__dirname, "..", "health-checks.ts"),
  "utf-8"
);

const pageSrc = readFileSync(
  join(__dirname, "..", "..", "..", "app", "admin", "page.tsx"),
  "utf-8"
);

describe("bug report count — source-static", () => {
  it("UsageAnalyticsResult includes bugReportCount field", () => {
    expect(usageSrc).toContain("bugReportCount: number | null");
  });

  it("queries bug_reports with status filter", () => {
    expect(usageSrc).toContain('from("bug_reports")');
    expect(usageSrc).toContain('.in("status", ["new", "investigating"])');
  });

  it("returns bugReportCount in result object", () => {
    expect(usageSrc).toContain("bugReportCount,");
  });

  it("health-checks fallback includes bugReportCount: null", () => {
    expect(healthSrc).toContain("bugReportCount: null");
  });

  it("admin landing page surfaces Bug Reports stat", () => {
    expect(pageSrc).toContain("Bug Reports");
    expect(pageSrc).toContain("bugReportCount");
  });
});
