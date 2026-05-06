/**
 * AG.4.1 — source-static guards for /api/teacher/student-attention.
 *
 * Locks the contract: auth helper used, class ownership verified, all 3
 * data sources queried, payload built via the pure aggregator. Mirrors
 * the read-only-route guard pattern used in earlier sub-phases.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROUTE_SRC = readFileSync(
  join(__dirname, "..", "route.ts"),
  "utf-8"
);

describe("teacher/student-attention route", () => {
  it("uses requireTeacherAuth + verifyTeacherOwnsClass auth pattern", () => {
    expect(ROUTE_SRC).toContain("requireTeacherAuth(request)");
    expect(ROUTE_SRC).toContain("verifyTeacherOwnsClass(teacherId, classId)");
  });

  it("returns 401 on missing auth", () => {
    expect(ROUTE_SRC).toMatch(/if\s*\(auth\.error\)\s*return\s+auth\.error/);
  });

  it("returns 403 when teacher doesn't own the class", () => {
    expect(ROUTE_SRC).toMatch(/Forbidden:\s*not your class/);
    expect(ROUTE_SRC).toMatch(/status:\s*403/);
  });

  it("validates unitId + classId as UUIDs (400 on bad input)", () => {
    expect(ROUTE_SRC).toContain("UUID_RE");
    expect(ROUTE_SRC).toMatch(/unitId required and must be UUID/);
    expect(ROUTE_SRC).toMatch(/classId required and must be UUID/);
    expect(ROUTE_SRC).toMatch(/status:\s*400/);
  });

  it("queries all 4 data sources (roster, portfolio, kanban, competency)", () => {
    expect(ROUTE_SRC).toContain('from("class_students")');
    expect(ROUTE_SRC).toContain('from("students")');
    expect(ROUTE_SRC).toContain('from("portfolio_entries")');
    expect(ROUTE_SRC).toContain('from("student_unit_kanban")');
    expect(ROUTE_SRC).toContain('from("competency_assessments")');
  });

  it("filters portfolio_entries to type='auto' (= journal)", () => {
    expect(ROUTE_SRC).toMatch(/\.eq\(\s*"type"\s*,\s*"auto"\s*\)/);
  });

  it("scopes all data queries by unitId + studentIds", () => {
    expect(ROUTE_SRC).toMatch(/\.eq\(\s*"unit_id"\s*,\s*unitId\s*\)/);
    expect(ROUTE_SRC).toMatch(/\.in\(\s*"student_id"\s*,\s*studentIds\s*\)/);
  });

  it("hands off to pure aggregator buildAttentionPanel", () => {
    expect(ROUTE_SRC).toContain('from "@/lib/unit-tools/attention/aggregate"');
    expect(ROUTE_SRC).toContain("buildAttentionPanel({");
  });

  it("short-circuits empty roster (no DB queries beyond roster)", () => {
    expect(ROUTE_SRC).toMatch(
      /studentIds\.length === 0[\s\S]{0,200}rows:\s*\[\]/
    );
  });

  it("uses createAdminClient for service-role queries (route is auth boundary)", () => {
    expect(ROUTE_SRC).toContain("createAdminClient");
  });

  it("wraps in withErrorHandler for consistent error shape", () => {
    expect(ROUTE_SRC).toContain('withErrorHandler(\n  "teacher/student-attention:GET"');
  });
});
