/**
 * Schema 7A Contract Tests
 *
 * Validates that src/types/admin.ts matches migrations 075/076/077 exactly.
 * DDL probes: column names + types align with TypeScript interfaces.
 * CHECK probes: enum values in SQL CHECK constraints match TS union types.
 * Seed probe: admin_settings expected keys match AdminSettingKey enum.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  type CostRollup,
  type CostCategory,
  type CostPeriod,
  type BugReport,
  type BugReportCategory,
  type BugReportStatus,
  type ReporterRole,
  type AdminSetting,
  AdminSettingKey,
} from "@/types/admin";

// ─── Helpers ───────────────────────────────────────────────

const MIGRATIONS_DIR = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "supabase",
  "migrations"
);

function readMigration(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), "utf-8");
}

/**
 * Extract column names from a CREATE TABLE statement.
 * Matches lines like:  column_name   TYPE ...
 * Skips constraints (CHECK, UNIQUE, PRIMARY KEY, REFERENCES on standalone lines).
 */
function extractColumns(sql: string, tableName: string): string[] {
  const tableRegex = new RegExp(
    `CREATE TABLE (?:IF NOT EXISTS )?${tableName}\\s*\\(([^;]+?)\\);`,
    "s"
  );
  const match = sql.match(tableRegex);
  if (!match) return [];

  const body = match[1];
  const columns: string[] = [];

  for (const line of body.split("\n")) {
    const trimmed = line.trim().replace(/,\s*$/, "");
    if (!trimmed || trimmed.startsWith("--")) continue;
    // Skip standalone constraints
    if (/^(CONSTRAINT|CHECK|UNIQUE|PRIMARY|FOREIGN)\b/i.test(trimmed))
      continue;

    const colMatch = trimmed.match(/^(\w+)\s+/);
    if (colMatch) {
      columns.push(colMatch[1]);
    }
  }
  return columns;
}

/**
 * Extract CHECK IN values for a column from SQL.
 * Matches: CHECK (column IN ('a', 'b', 'c'))
 */
function extractCheckValues(sql: string, column: string): string[] {
  const pattern = new RegExp(
    `${column}\\s+[^,]+CHECK\\s*\\(\\s*${column}\\s+IN\\s*\\(([^)]+)\\)`,
    "i"
  );
  const match = sql.match(pattern);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((v) => v.trim().replace(/^'|'$/g, ""))
    .filter(Boolean);
}

/**
 * Extract INSERT seed keys from SQL.
 * Matches: ('key_name', ...jsonb...)
 */
function extractSeedKeys(sql: string): string[] {
  const keys: string[] = [];
  const pattern = /\('(pipeline\.\w+)'/g;
  let m;
  while ((m = pattern.exec(sql)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

// ─── Migration 075: cost_rollups ───────────────────────────

describe("Migration 075 — cost_rollups", () => {
  const sql = readMigration("075_cost_rollups_and_rls_fix.sql");

  it("creates cost_rollups table", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS cost_rollups");
  });

  it("has all columns matching CostRollup interface", () => {
    const sqlCols = extractColumns(sql, "cost_rollups");
    const tsCols: (keyof CostRollup)[] = [
      "id",
      "teacher_id",
      "category",
      "period",
      "period_start",
      "cost_usd",
      "call_count",
      "token_count",
      "rolled_up_at",
    ];
    for (const col of tsCols) {
      expect(sqlCols).toContain(col);
    }
    // No extra columns in SQL that aren't in TS
    for (const col of sqlCols) {
      expect(tsCols).toContain(col as keyof CostRollup);
    }
  });

  it("category CHECK matches CostCategory type", () => {
    const sqlValues = extractCheckValues(sql, "category");
    const tsValues: CostCategory[] = [
      "ingestion",
      "generation",
      "student_api",
      "teacher_api",
    ];
    expect(sqlValues.sort()).toEqual(tsValues.sort());
  });

  it("period CHECK matches CostPeriod type", () => {
    const sqlValues = extractCheckValues(sql, "period");
    const tsValues: CostPeriod[] = ["day", "week", "month"];
    expect(sqlValues.sort()).toEqual(tsValues.sort());
  });

  it("has UNIQUE constraint on (teacher_id, category, period, period_start)", () => {
    expect(sql).toMatch(
      /UNIQUE\s*\(\s*teacher_id\s*,\s*category\s*,\s*period\s*,\s*period_start\s*\)/i
    );
  });

  it("enables RLS on cost_rollups", () => {
    expect(sql).toMatch(
      /ALTER TABLE cost_rollups ENABLE ROW LEVEL SECURITY/i
    );
  });

  it("has teacher SELECT policy", () => {
    expect(sql).toContain("teacher_id = auth.uid()");
  });

  it("has service_role full access policy", () => {
    expect(sql).toContain(
      'Service role full access cost_rollups'
    );
  });
});

// ─── Migration 075: FU-X RLS fixes ────────────────────────

describe("Migration 075 — FU-X RLS fixes", () => {
  const sql = readMigration("075_cost_rollups_and_rls_fix.sql");

  it("enables RLS on usage_rollups", () => {
    expect(sql).toMatch(
      /ALTER TABLE usage_rollups ENABLE ROW LEVEL SECURITY/i
    );
  });

  it("enables RLS on system_alerts", () => {
    expect(sql).toMatch(
      /ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY/i
    );
  });

  it("enables RLS on library_health_flags", () => {
    expect(sql).toMatch(
      /ALTER TABLE library_health_flags ENABLE ROW LEVEL SECURITY/i
    );
  });

  it("usage_rollups has teacher SELECT + service_role policies", () => {
    expect(sql).toContain("Teachers read own usage rollups");
    expect(sql).toContain("Service role full access usage_rollups");
  });

  it("system_alerts is service_role only (no teacher access)", () => {
    expect(sql).toContain("Service role full access system_alerts");
    // Extract just the system_alerts section (between its header and the next section)
    const alertsSection = sql.slice(
      sql.indexOf("ALTER TABLE system_alerts"),
      sql.indexOf("ALTER TABLE library_health_flags")
    );
    // Should NOT have auth.uid() in the system_alerts policies
    expect(alertsSection).not.toContain("auth.uid()");
  });

  it("library_health_flags is service_role only (no teacher access)", () => {
    expect(sql).toContain("Service role full access library_health_flags");
    // Extract just the library_health_flags section (from its ALTER to end)
    const flagsSection = sql.slice(
      sql.indexOf("ALTER TABLE library_health_flags")
    );
    // Should NOT have auth.uid() in the library_health_flags policies
    expect(flagsSection).not.toContain("auth.uid()");
  });
});

// ─── Migration 076: bug_reports ────────────────────────────

describe("Migration 076 — bug_reports", () => {
  const sql = readMigration("076_bug_reports.sql");

  it("creates bug_reports table", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS bug_reports");
  });

  it("has all columns matching BugReport interface", () => {
    const sqlCols = extractColumns(sql, "bug_reports");
    const tsCols: (keyof BugReport)[] = [
      "id",
      "reporter_id",
      "reporter_role",
      "class_id",
      "category",
      "description",
      "screenshot_url",
      "page_url",
      "console_errors",
      "status",
      "admin_notes",
      "response",
      "created_at",
      "updated_at",
    ];
    for (const col of tsCols) {
      expect(sqlCols).toContain(col);
    }
    for (const col of sqlCols) {
      expect(tsCols).toContain(col as keyof BugReport);
    }
  });

  it("reporter_role CHECK matches ReporterRole type", () => {
    const sqlValues = extractCheckValues(sql, "reporter_role");
    const tsValues: ReporterRole[] = ["teacher", "student", "admin"];
    expect(sqlValues.sort()).toEqual(tsValues.sort());
  });

  it("category CHECK matches BugReportCategory type", () => {
    const sqlValues = extractCheckValues(sql, "category");
    const tsValues: BugReportCategory[] = [
      "broken",
      "visual",
      "confused",
      "feature_request",
    ];
    expect(sqlValues.sort()).toEqual(tsValues.sort());
  });

  it("status CHECK matches BugReportStatus type", () => {
    const sqlValues = extractCheckValues(sql, "status");
    const tsValues: BugReportStatus[] = [
      "new",
      "investigating",
      "fixed",
      "closed",
    ];
    expect(sqlValues.sort()).toEqual(tsValues.sort());
  });

  it("reporter_id has NO FK constraint", () => {
    // reporter_id should NOT reference any table
    expect(sql).not.toMatch(/reporter_id\s+UUID[^,]*REFERENCES/i);
  });

  it("class_id references classes with ON DELETE SET NULL", () => {
    expect(sql).toMatch(
      /class_id\s+UUID\s+REFERENCES\s+classes\s*\(\s*id\s*\)\s+ON DELETE SET NULL/i
    );
  });

  it("enables RLS on bug_reports", () => {
    expect(sql).toMatch(
      /ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY/i
    );
  });

  it("adds bug_reporting_enabled to classes (Lesson #24 pattern)", () => {
    expect(sql).toContain("bug_reporting_enabled");
    expect(sql).toContain("BOOLEAN NOT NULL DEFAULT false");
    expect(sql).toContain("EXCEPTION");
    expect(sql).toContain("duplicate_column");
  });
});

// ─── Migration 077: admin_settings ─────────────────────────

describe("Migration 077 — admin_settings", () => {
  const sql = readMigration("077_admin_settings.sql");

  it("creates admin_settings table", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS admin_settings");
  });

  it("has all columns matching AdminSetting interface", () => {
    const sqlCols = extractColumns(sql, "admin_settings");
    const tsCols: (keyof AdminSetting)[] = [
      "id",
      "key",
      "value",
      "updated_by",
      "updated_at",
    ];
    for (const col of tsCols) {
      expect(sqlCols).toContain(col);
    }
    for (const col of sqlCols) {
      expect(tsCols).toContain(col as keyof AdminSetting);
    }
  });

  it("uses UUID primary key (D2 — not SERIAL)", () => {
    expect(sql).toMatch(/id\s+UUID\s+PRIMARY KEY/i);
    // The CREATE TABLE body should not use SERIAL (comments may mention it)
    const tableBody = sql.match(
      /CREATE TABLE[^(]+\(([^;]+)\);/s
    );
    expect(tableBody).not.toBeNull();
    expect(tableBody![1]).not.toMatch(/SERIAL/i);
  });

  it("key is UNIQUE NOT NULL", () => {
    expect(sql).toMatch(/key\s+TEXT\s+UNIQUE\s+NOT NULL/i);
  });

  it("enables RLS on admin_settings", () => {
    expect(sql).toMatch(
      /ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY/i
    );
  });

  it("is service_role only (no teacher access)", () => {
    expect(sql).toContain("Service role full access admin_settings");
    expect(sql).not.toMatch(/admin_settings.*auth\.uid\(\)/s);
  });

  it("seeds 5 expected keys matching AdminSettingKey enum", () => {
    const seedKeys = extractSeedKeys(sql);
    const enumValues = Object.values(AdminSettingKey);
    expect(seedKeys.sort()).toEqual(enumValues.sort());
  });

  it("uses ON CONFLICT DO NOTHING (idempotent seed)", () => {
    expect(sql).toContain("ON CONFLICT (key) DO NOTHING");
  });
});
