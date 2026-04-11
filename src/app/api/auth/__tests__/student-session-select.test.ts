/**
 * Source-static guard test for /api/auth/student-session select shapes.
 *
 * Purpose: lock the exact shape of both .select() calls so a future refactor
 * cannot silently drop `framework` (or rename/drop other required fields)
 * without a loud test failure.
 *
 * Why source-static: the route depends on Supabase + request cookies + admin
 * client; a pure string read of the source file is the cheapest way to prove
 * the select shape is correct without mocking the world. Lesson #38 — assert
 * expected exact values, not `expect(...).toContain("framework")` which would
 * match any occurrence.
 *
 * Sub-step 5.10.0 of Dimensions3 v2 Phase 2 — prereq for wiring
 * StudentContext.classInfo.framework into 5.10.3 (student lesson) and
 * 5.10.4 (student grades) via FrameworkAdapter.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const routePath = join(
  process.cwd(),
  "src/app/api/auth/student-session/route.ts"
);
const source = readFileSync(routePath, "utf8");

describe("student-session route select() shapes", () => {
  it("first select (class_students junction) includes framework field", () => {
    // Locks the PostgREST-embedded select on the class_students → classes join.
    expect(source).toContain(
      '.select("class_id, classes(id, name, code, framework)")'
    );
  });

  it("second select (legacy classes fallback) includes framework field", () => {
    // Locks the fallback select on the classes table (when students.class_id
    // is used instead of the junction).
    expect(source).toContain('.select("id, name, code, framework")');
  });
});
