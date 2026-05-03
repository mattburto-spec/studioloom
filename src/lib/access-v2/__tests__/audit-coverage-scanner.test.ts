/**
 * Integration tests for the Phase 5.1d audit-coverage scanner.
 *
 * Invokes scripts/registry/scan-api-routes.py --check-audit-coverage as a
 * subprocess and asserts:
 *   - Well-shaped JSON report at docs/scanner-reports/audit-coverage.json
 *   - The 4 Phase 5.1 retrofit route.ts files appear in `covered`
 *   - Total = covered + skipped + missing (sanity)
 *   - --fail-on-missing exits non-zero when missing > 0
 *
 * Run with:
 *   npx vitest run src/lib/access-v2/__tests__/audit-coverage-scanner.test.ts
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../..");
const SCANNER = resolve(
  REPO_ROOT,
  "scripts/registry/scan-api-routes.py",
);
const REPORT = resolve(
  REPO_ROOT,
  "docs/scanner-reports/audit-coverage.json",
);

interface CoverageEntry {
  file: string;
  methods: string[];
  reason?: string;
}

interface CoverageReport {
  registry: string;
  version: number;
  timestamp: string;
  stats: {
    total_mutation_routes: number;
    covered: number;
    skipped: number;
    missing: number;
  };
  covered: CoverageEntry[];
  skipped: CoverageEntry[];
  missing: CoverageEntry[];
}

function runScanner(extraArgs: string[] = []): {
  exitCode: number;
  stdout: string;
} {
  try {
    const stdout = execFileSync(
      "python3",
      [SCANNER, "--check-audit-coverage", ...extraArgs],
      { cwd: REPO_ROOT, encoding: "utf-8" },
    );
    return { exitCode: 0, stdout };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: Buffer | string };
    return {
      exitCode: e.status ?? 1,
      stdout: e.stdout ? String(e.stdout) : "",
    };
  }
}

function readReport(): CoverageReport {
  return JSON.parse(readFileSync(REPORT, "utf-8")) as CoverageReport;
}

describe("Phase 5.1d audit-coverage scanner", () => {
  it("emits a well-shaped JSON report", () => {
    const { exitCode } = runScanner();
    expect(exitCode).toBe(0);

    const report = readReport();
    expect(report.registry).toBe("audit-coverage");
    expect(report.version).toBe(1);
    expect(report.timestamp).toMatch(/^2\d{3}-\d{2}-\d{2}T/);
    expect(report.stats.total_mutation_routes).toBe(
      report.stats.covered +
        report.stats.skipped +
        report.stats.missing,
    );
  });

  it("classifies all 4 Phase 5.1 route.ts retrofits as covered", () => {
    runScanner();
    const report = readReport();
    const covered = new Set(report.covered.map((e) => e.file));

    // The 4 retrofitted route.ts files (school-merge etc. live in lib/, not
    // under src/app/api, so they're outside the scanner's scope).
    const expected = [
      "src/app/api/auth/student-classcode-login/route.ts",
      "src/app/api/admin/school/[id]/impersonate/route.ts",
      "src/app/api/school/[id]/invitations/[inviteId]/revoke/route.ts",
      "src/app/api/teacher/welcome/request-school-access/route.ts",
    ];
    for (const file of expected) {
      expect(covered.has(file)).toBe(true);
    }
  });

  it("--fail-on-missing exits non-zero when missing > 0", () => {
    runScanner(); // populate report
    const report = readReport();

    // Phase 5.1d ships with missing > 0 (228 mutation routes inherited
    // from Phase 4 and earlier; triage is FU-AV2-AUDIT-MISSING-PHASE-6-CATCHUP).
    // This test asserts the gate WOULD fire — proving the CI mechanism works.
    expect(report.stats.missing).toBeGreaterThan(0);

    const { exitCode } = runScanner(["--fail-on-missing"]);
    expect(exitCode).toBe(1);
  });

  it("--check-audit-coverage WITHOUT --fail-on-missing exits 0 even with missing > 0", () => {
    // This is the visibility-only mode used by nightly.yml today (per
    // §5.1d triage decision: ship scanner, don't break CI on Phase 4 debt).
    const { exitCode } = runScanner();
    expect(exitCode).toBe(0);
  });

  it("missing list never includes Phase 5.1 retrofitted files", () => {
    runScanner();
    const report = readReport();
    const missing = new Set(report.missing.map((e) => e.file));
    const retrofitted = [
      "src/app/api/auth/student-classcode-login/route.ts",
      "src/app/api/admin/school/[id]/impersonate/route.ts",
      "src/app/api/school/[id]/invitations/[inviteId]/revoke/route.ts",
      "src/app/api/teacher/welcome/request-school-access/route.ts",
    ];
    for (const file of retrofitted) {
      expect(missing.has(file)).toBe(false);
    }
  });

  it("skipped entries each carry a non-empty reason", () => {
    runScanner();
    const report = readReport();
    for (const entry of report.skipped) {
      expect(entry.reason).toBeTruthy();
      expect((entry.reason as string).length).toBeGreaterThan(0);
    }
  });
});
