/**
 * Source-static guards for /api/teacher/unit-brief/student-briefs (GET).
 *
 * Phase F.E — teacher review of per-student authoring. Read-only.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/teacher/unit-brief/student-briefs (Phase F.E)", () => {
  it("requireTeacher + verifyTeacherHasUnit gate (hasAccess, not isAuthor)", () => {
    expect(src).toMatch(
      /import \{ requireTeacher \} from "@\/lib\/auth\/require-teacher"/,
    );
    expect(src).toMatch(
      /import \{ verifyTeacherHasUnit \} from "@\/lib\/auth\/verify-teacher-unit"/,
    );
    expect(src).toMatch(/if \(!access\.hasAccess\)/);
    expect(src).not.toMatch(/if \(!access\.isAuthor\)/);
  });

  it("GET-only (no mutation surface)", () => {
    expect(src).toMatch(/export const GET = withErrorHandler/);
    expect(src).not.toMatch(/export const POST/);
    expect(src).not.toMatch(/export const PATCH/);
    expect(src).not.toMatch(/export const DELETE/);
  });

  it("returns 400 when unitId is missing", () => {
    expect(src).toContain("unitId query parameter required");
    expect(src).toMatch(/status:\s*400/);
  });

  it("returns 403 when teacher lacks access", () => {
    expect(src).toContain('"Forbidden"');
    expect(src).toMatch(/status:\s*403/);
  });

  it("queries student_briefs filtered by unit_id, ordered DESC by updated_at", () => {
    expect(src).toMatch(/\.from\("student_briefs"\)/);
    expect(src).toMatch(/\.eq\("unit_id", unitId\)/);
    expect(src).toMatch(
      /\.order\("updated_at",\s*\{\s*ascending:\s*false\s*\}\)/,
    );
  });

  it("enriches with student display names via a single students lookup", () => {
    expect(src).toMatch(/\.from\("students"\)/);
    expect(src).toMatch(/\.in\("id", studentIds\)/);
  });

  it("enriches with choice card picks for context (latest pick per student)", () => {
    expect(src).toMatch(/\.from\("choice_card_selections"\)/);
    expect(src).toMatch(/\.eq\("unit_id", unitId\)/);
    // Latest-pick-wins via DESC order + first-row-per-student dedupe.
    expect(src).toMatch(/\.order\("picked_at",\s*\{\s*ascending:\s*false\s*\}\)/);
    expect(src).toContain("pickByStudent.has(sid)");
  });

  it("excludes _pitch-your-own from the choice_cards label lookup (no real card)", () => {
    expect(src).toContain('id !== "_pitch-your-own"');
    // But the response still surfaces a synthetic label for pitch-yo
    expect(src).toContain('cardLabelById.set("_pitch-your-own"');
  });

  it("uses shared coerceConstraints from the validators module", () => {
    expect(src).toMatch(
      /import \{ coerceConstraints \} from "@\/lib\/unit-brief\/validators"/,
    );
  });

  it("returns { studentBriefs: [...] } (NOT { briefs }) — distinguishes from other surfaces", () => {
    expect(src).toMatch(/studentBriefs:/);
  });

  it("empty result returns { studentBriefs: [] } early (not null)", () => {
    expect(src).toMatch(/return NextResponse\.json\(\{ studentBriefs: \[\] \}\)/);
  });
});
