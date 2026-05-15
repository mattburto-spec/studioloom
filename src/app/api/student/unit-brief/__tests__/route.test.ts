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

  it("exports GET + POST (Phase F.D adds student authoring of unlocked fields)", () => {
    expect(src).toMatch(/export async function GET/);
    expect(src).toMatch(/export async function POST/);
    expect(src).not.toMatch(/export async function DELETE/);
    expect(src).not.toMatch(/export async function PATCH/);
  });

  it("audit-skip annotation present (Phase F.D POST)", () => {
    expect(src.slice(0, 300)).toContain("audit-skip:");
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

  it("coerceConstraints + coerceLocks imported from the shared validators module", () => {
    // Phase F.C moved these to src/lib/unit-brief/validators.ts. The
    // student route imports them now instead of duplicating.
    expect(src).toMatch(
      /import \{[\s\S]*?coerceConstraints[\s\S]*?coerceLocks[\s\S]*?\} from "@\/lib\/unit-brief\/validators"/,
    );
  });

  it("Phase F.D — resolves choice card pick + fetches card's brief template", () => {
    expect(src).toMatch(
      /import \{ resolveChoiceCardPickForUnit \} from "@\/lib\/choice-cards\/resolve-for-unit"/,
    );
    expect(src).toContain("resolveChoiceCardPickForUnit(db, studentId, unitId)");
    // _pitch-your-own carries no template — explicitly filtered out
    expect(src).toContain('pick.cardId !== "_pitch-your-own"');
    expect(src).toMatch(/\.from\("choice_cards"\)/);
  });

  it("Phase F.D — fetches the student's per-unit override row (student_briefs)", () => {
    expect(src).toMatch(/\.from\("student_briefs"\)/);
    expect(src).toMatch(/\.eq\("student_id", studentId\)/);
    expect(src).toMatch(/\.eq\("unit_id", unitId\)/);
  });

  it("Phase F.D — GET response includes cardTemplate + studentBrief alongside brief + amendments", () => {
    expect(src).toMatch(/cardTemplate[,:]/);
    expect(src).toMatch(/studentBrief[,:]/);
  });
});

describe("POST /api/student/unit-brief — Phase F.D", () => {
  it("requires the same enrollment chain as GET (DRY via helper)", () => {
    // verifyEnrollment helper is called from both GET + POST.
    expect(src).toMatch(/async function verifyEnrollment/);
    expect(src.match(/verifyEnrollment\(db, studentId, unitId\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("validates brief_text is string or null", () => {
    expect(src).toContain("brief_text must be a string or null");
  });

  it("validates constraints via shared validateConstraints", () => {
    expect(src).toMatch(
      /import \{[\s\S]*?validateConstraints[\s\S]*?\} from "@\/lib\/unit-brief\/validators"/,
    );
    expect(src).toMatch(/validateConstraints\(b\.constraints\)/);
  });

  it("rejects empty patches (must include brief_text or constraints)", () => {
    expect(src).toContain(
      "body must include at least one of: brief_text, constraints",
    );
  });

  it("upserts student_briefs onConflict student_id,unit_id (UNIQUE pair)", () => {
    expect(src).toMatch(/onConflict:\s*"student_id,unit_id"/);
  });

  it("partial-patch merges with existing row (server-side {...existing, ...patch})", () => {
    expect(src).toMatch(/\.\.\.existing,\s*\.\.\.patch/);
  });

  it("returns studentBrief (NOT brief) — distinguishes from teacher endpoint", () => {
    expect(src).toMatch(/studentBrief:\s*rowToStudentBrief/);
  });
});
