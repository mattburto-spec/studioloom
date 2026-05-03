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

  it("post-Phase-6.4 baseline: missing must be 0 (gate is now active)", () => {
    // Phase 6.4 (4 May 2026) closed the original 224-route audit-coverage
    // gap via bulk-skip + 3 inline-wires (admin/teachers DELETE+invite POST,
    // admin/teacher-requests PATCH). The nightly workflow now runs the
    // scanner with --fail-on-missing — every new mutation route from now
    // on must call logAuditEvent OR carry an `// audit-skip:` annotation.
    // If this test fails, you've added a route without either; fix it
    // before the next nightly build.
    runScanner();
    const report = readReport();
    expect(report.stats.missing).toBe(0);
  });

  it("--fail-on-missing exits 0 when missing == 0 (post-Phase-6.4 baseline)", () => {
    // The clean baseline path: scanner runs, finds nothing missing,
    // exits 0. Invariant the nightly job now relies on.
    const { exitCode } = runScanner(["--fail-on-missing"]);
    expect(exitCode).toBe(0);
  });

  it("--fail-on-missing exits 1 when a synthetic missing route is injected", () => {
    // Verifies the gate MECHANISM independent of the current numerical
    // state. Drops a temporary route.ts that exports POST without
    // logAuditEvent + without an audit-skip annotation, runs the scanner,
    // asserts exit=1, then cleans up.
    const tempDir = resolve(REPO_ROOT, "src/app/api/__phase64_test_synthetic__");
    const tempFile = resolve(tempDir, "route.ts");
    const fs = require("node:fs") as typeof import("node:fs");
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(
      tempFile,
      "export async function POST() { return new Response('synthetic missing route'); }\n",
    );
    try {
      const { exitCode } = runScanner(["--fail-on-missing"]);
      expect(exitCode).toBe(1);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
      // Restore the report so other tests in the same file see clean state.
      runScanner();
    }
  });

  it("--check-audit-coverage WITHOUT --fail-on-missing exits 0 regardless of missing count", () => {
    // Visibility-only mode: useful for human auditors invoking the scanner
    // ad-hoc. CI uses --fail-on-missing.
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
