/**
 * Source-static guards for /api/teacher/unit-brief/amendments (GET + POST).
 *
 * Mirrors the project convention from
 * src/app/api/teacher/tasks/__tests__/route.test.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

function sliceMethodBody(method: "GET" | "POST"): string {
  const start = src.indexOf(`export const ${method} = withErrorHandler`);
  if (start < 0) throw new Error(`Could not find ${method} export`);
  const nextStart =
    method === "GET"
      ? src.indexOf("export const POST = withErrorHandler", start + 1)
      : src.length;
  return method === "GET" ? src.slice(start, nextStart) : src.slice(start);
}

describe("/api/teacher/unit-brief/amendments — module-level guards", () => {
  it("imports requireTeacher (P-1 hard rule)", () => {
    expect(src).toMatch(
      /import \{ requireTeacher \} from "@\/lib\/auth\/require-teacher"/,
    );
  });

  it("imports verifyTeacherHasUnit for per-unit authz", () => {
    expect(src).toMatch(
      /import \{ verifyTeacherHasUnit \} from "@\/lib\/auth\/verify-teacher-unit"/,
    );
  });

  it("uses createAdminClient (service-role)", () => {
    expect(src).toMatch(
      /import \{ createAdminClient \} from "@\/lib\/supabase\/admin"/,
    );
  });

  it("targets unit_brief_amendments table (no typos)", () => {
    expect(src).toMatch(/\.from\("unit_brief_amendments"\)/);
  });

  it("caps version_label at 20 chars matching the migration CHECK", () => {
    expect(src).toContain("VERSION_LABEL_MAX = 20");
  });
});

describe("/api/teacher/unit-brief/amendments — GET", () => {
  const body = sliceMethodBody("GET");

  it("auth gate: requireTeacher then short-circuit on .error", () => {
    expect(body).toContain("requireTeacher(request)");
    expect(body).toMatch(/if \(teacher\.error\) return teacher\.error/);
  });

  it("returns 400 when unitId query param is missing", () => {
    expect(body).toContain("unitId query parameter required");
    expect(body).toMatch(/status:\s*400/);
  });

  it("verifies teacher access (read = hasAccess, not isAuthor)", () => {
    const verifyIdx = body.indexOf("verifyTeacherHasUnit");
    const queryIdx = body.indexOf('.from("unit_brief_amendments")');
    expect(verifyIdx).toBeGreaterThan(0);
    expect(queryIdx).toBeGreaterThan(verifyIdx);
    expect(body).toMatch(/if \(!access\.hasAccess\)/);
  });

  it("orders amendments DESC by created_at (latest first for teacher review)", () => {
    expect(body).toMatch(
      /\.order\("created_at",\s*\{\s*ascending:\s*false\s*\}\)/,
    );
  });
});

describe("/api/teacher/unit-brief/amendments — POST", () => {
  const body = sliceMethodBody("POST");

  it("auth gate: requireTeacher then short-circuit on .error", () => {
    expect(body).toContain("requireTeacher(request)");
  });

  it("returns 400 on invalid JSON", () => {
    expect(body).toContain("Invalid JSON");
  });

  it("returns 400 on missing unitId", () => {
    expect(body).toContain("unitId required (string)");
  });

  it("validates version_label is non-empty", () => {
    expect(body).toContain("version_label required (non-empty string)");
  });

  it("validates version_label length cap (DB CHECK mirror)", () => {
    // Source uses template literal interpolation: `${VERSION_LABEL_MAX} characters or fewer`.
    expect(body).toMatch(
      /version_label must be \$\{VERSION_LABEL_MAX\} characters or fewer/,
    );
    // Defence in depth: the constant is 20 (matches the migration CHECK).
    expect(src).toContain("VERSION_LABEL_MAX = 20");
  });

  it("validates title is non-empty", () => {
    expect(body).toContain("title required (non-empty string)");
  });

  it("validates body is non-empty", () => {
    expect(body).toContain("body required (non-empty string)");
  });

  it("rejects with 403 when teacher is NOT the author", () => {
    expect(body).toMatch(/if \(!access\.isAuthor\)/);
    expect(body).toContain("Only the unit author can add amendments");
    expect(body).toMatch(/status:\s*403/);
  });

  it("inserts the new row (not upsert — append-only)", () => {
    expect(body).toMatch(/\.insert\(\{/);
    expect(body).not.toMatch(/\.upsert\(/);
  });

  it("returns the new amendment under the `amendment` key (singular)", () => {
    expect(body).toMatch(/amendment:\s*rowToAmendment/);
  });
});
