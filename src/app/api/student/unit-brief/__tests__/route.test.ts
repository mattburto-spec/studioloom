/**
 * Source-static guards for /api/student/unit-brief (GET).
 *
 * Mirrors the project's source-static testing convention. Read the
 * route file, assert load-bearing patterns appear.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/student/unit-brief — module-level guards", () => {
  it("uses requireStudentSession (Lesson #4 — token-session, not Supabase Auth)", () => {
    expect(src).toMatch(
      /import \{ requireStudentSession \} from "@\/lib\/access-v2\/actor-session"/,
    );
  });

  it("uses createAdminClient (service-role) so RLS doesn't gate the student read", () => {
    expect(src).toMatch(
      /import \{ createAdminClient \} from "@\/lib\/supabase\/admin"/,
    );
  });

  it("only exports GET (read-only — no mutation routes here)", () => {
    expect(src).toMatch(/export async function GET/);
    expect(src).not.toMatch(/export async function POST/);
    expect(src).not.toMatch(/export async function DELETE/);
    expect(src).not.toMatch(/export async function PATCH/);
  });

  it("returns 400 when unitId query param is missing", () => {
    expect(src).toContain("unitId query parameter required");
    expect(src).toMatch(/status:\s*400/);
  });

  it("performs an enrollment check via class_students + class_units", () => {
    // Junction table read first
    expect(src).toMatch(
      /\.from\("class_students"\)[\s\S]*?\.eq\("student_id", studentId\)[\s\S]*?\.eq\("is_active", true\)/,
    );
    // class_units intersection
    expect(src).toMatch(
      /\.from\("class_units"\)[\s\S]*?\.eq\("unit_id", unitId\)[\s\S]*?\.eq\("is_active", true\)/,
    );
  });

  it("falls back to legacy students.class_id for pre-junction enrolments", () => {
    expect(src).toMatch(
      /\.from\("students"\)[\s\S]*?\.select\("class_id"\)/,
    );
    expect(src).toContain("activeClassIds.add(student.class_id");
  });

  it("returns 403 when no active enrolments + 403 when unit isn't assigned", () => {
    expect(src).toContain("Not enrolled in any active class");
    expect(src).toContain("Unit not assigned to your class");
    // Two distinct 403 branches
    expect(src.match(/status:\s*403/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("returns brief: null (not 404) when the teacher hasn't authored anything", () => {
    expect(src).toMatch(/brief:\s*briefRow\s*\?\s*rowToBrief\(briefRow\)\s*:\s*null/);
    expect(src).toContain(".maybeSingle()");
  });

  it("orders amendments oldest-first (Phase C spec: evolution-story rendering)", () => {
    expect(src).toMatch(
      /\.from\("unit_brief_amendments"\)[\s\S]*?\.order\("created_at",\s*\{\s*ascending:\s*true\s*\}\)/,
    );
  });

  it("selects the diagram_url column (Phase B.5)", () => {
    expect(src).toContain("diagram_url");
  });

  it("reads brief + amendments in parallel via Promise.all", () => {
    expect(src).toContain("Promise.all([");
  });

  it("coerceConstraints handles missing / malformed / generic / design archetypes", () => {
    expect(src).toContain("function coerceConstraints");
    expect(src).toContain('archetype === "design"');
    expect(src).toContain("GENERIC_CONSTRAINTS");
  });
});
