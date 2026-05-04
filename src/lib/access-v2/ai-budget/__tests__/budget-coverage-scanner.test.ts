/**
 * Integration tests for the Phase 5.3d AI budget-coverage scanner.
 *
 * Mirrors the §5.1d audit-coverage scanner test pattern: invoke the Python
 * scanner as a subprocess + assert against the JSON output.
 *
 * Run with:
 *   npx vitest run src/lib/access-v2/ai-budget/__tests__/budget-coverage-scanner.test.ts
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");
const SCANNER = resolve(
  REPO_ROOT,
  "scripts/registry/scan-api-routes.py",
);
const REPORT = resolve(
  REPO_ROOT,
  "docs/scanner-reports/ai-budget-coverage.json",
);

interface CoverageEntry {
  file: string;
  reason?: string;
}

interface CoverageReport {
  registry: string;
  version: number;
  timestamp: string;
  stats: {
    total_student_ai_routes: number;
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
      [SCANNER, "--check-budget-coverage", ...extraArgs],
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

describe("Phase 5.3d AI budget-coverage scanner", () => {
  it("emits a well-shaped JSON report with the registry name", () => {
    const { exitCode } = runScanner();
    expect(exitCode).toBe(0);
    const report = readReport();
    expect(report.registry).toBe("ai-budget-coverage");
    expect(report.version).toBe(1);
    expect(report.timestamp).toMatch(/^2\d{3}-\d{2}-\d{2}T/);
    expect(report.stats.total_student_ai_routes).toBe(
      report.stats.covered + report.stats.skipped + report.stats.missing,
    );
  });

  it("classifies all 3 §5.3 wired routes as covered", () => {
    runScanner();
    const report = readReport();
    const covered = new Set(report.covered.map((e) => e.file));

    const expected = [
      "src/app/api/student/word-lookup/route.ts",
      "src/app/api/student/quest/mentor/route.ts",
      "src/app/api/student/design-assistant/route.ts",
    ];
    for (const file of expected) {
      expect(covered.has(file)).toBe(true);
    }
  });

  it("design-assistant is detected via generateResponse helper (not direct Anthropic)", () => {
    // The route file does NOT import @anthropic-ai/sdk directly — its AI
    // call goes through generateResponse() in the lib. The scanner detects
    // this via the AI_BEARING_HELPER_RE pattern. This test guards against
    // a future regression where helper detection breaks.
    runScanner();
    const report = readReport();
    const designAssistant = report.covered.find((e) =>
      e.file.endsWith("design-assistant/route.ts"),
    );
    expect(designAssistant).toBeDefined();
  });

  it("--fail-on-missing exits 0 when missing == 0 (current state)", () => {
    runScanner(); // populate report
    const report = readReport();
    expect(report.stats.missing).toBe(0);

    const { exitCode } = runScanner(["--fail-on-missing"]);
    expect(exitCode).toBe(0);
  });

  it("does NOT scan routes outside src/app/api/student/", () => {
    // Sanity check — teacher routes etc. are out of scope. The total
    // matches the 3 student AI routes; everything else is filtered.
    runScanner();
    const report = readReport();
    for (const entry of [
      ...report.covered,
      ...report.skipped,
      ...report.missing,
    ]) {
      expect(entry.file).toMatch(/^src\/app\/api\/student\//);
    }
  });

  it("missing list never includes Phase 5.3 wired routes (defensive)", () => {
    runScanner();
    const report = readReport();
    const missing = new Set(report.missing.map((e) => e.file));
    const wired = [
      "src/app/api/student/word-lookup/route.ts",
      "src/app/api/student/quest/mentor/route.ts",
      "src/app/api/student/design-assistant/route.ts",
    ];
    for (const file of wired) {
      expect(missing.has(file)).toBe(false);
    }
  });
});
