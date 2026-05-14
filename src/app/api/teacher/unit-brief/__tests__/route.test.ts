/**
 * Source-static guards for /api/teacher/unit-brief (GET + POST).
 *
 * Mirrors the project convention from
 * src/app/api/teacher/tasks/__tests__/route.test.ts: read the route
 * file, assert specific patterns appear. Avoids the Supabase JS mock
 * thicket while still catching regressions in the load-bearing parts
 * (auth chain, validation, status codes, RLS deviation).
 *
 * Per Lesson #38: assertions check expected values, not just presence.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

function sliceMethodBody(method: "GET" | "POST"): string {
  const start = src.indexOf(`export const ${method} = withErrorHandler`);
  if (start < 0) throw new Error(`Could not find ${method} export`);
  const remainder = src.slice(start);
  // End body at the matching closing `);` of withErrorHandler — for this
  // file each method is the final export, so slicing to next method or EOF
  // is safe. There are only 2 methods.
  const nextStart =
    method === "GET"
      ? src.indexOf("export const POST = withErrorHandler", start + 1)
      : src.length;
  return method === "GET" ? src.slice(start, nextStart) : remainder;
}

describe("/api/teacher/unit-brief — module-level guards", () => {
  it("imports requireTeacher (P-1 hard rule, not bare auth.getUser)", () => {
    expect(src).toMatch(
      /import \{ requireTeacher \} from "@\/lib\/auth\/require-teacher"/,
    );
  });

  it("imports verifyTeacherHasUnit for per-unit authz", () => {
    expect(src).toMatch(
      /import \{ verifyTeacherHasUnit \} from "@\/lib\/auth\/verify-teacher-unit"/,
    );
  });

  it("uses createAdminClient (service-role) — no RLS write path needed", () => {
    expect(src).toMatch(
      /import \{ createAdminClient \} from "@\/lib\/supabase\/admin"/,
    );
  });

  it("returns shape via NextResponse.json — no raw Response", () => {
    expect(src).toContain("NextResponse.json");
    expect(src).not.toContain("return new Response(");
  });

  it("targets the unit_briefs table (no typos on the table name)", () => {
    expect(src).toMatch(/\.from\("unit_briefs"\)/);
  });

  it("treats stored {} constraints as the generic-archetype fallback", () => {
    expect(src).toContain("coerceConstraints");
    expect(src).toMatch(/archetype:\s*"generic"/);
  });
});

describe("/api/teacher/unit-brief — GET", () => {
  const body = sliceMethodBody("GET");

  it("auth gate: requireTeacher then short-circuit on .error", () => {
    expect(body).toContain("requireTeacher(request)");
    expect(body).toMatch(/if \(teacher\.error\) return teacher\.error/);
  });

  it("returns 400 when unitId query param is missing", () => {
    expect(body).toContain("unitId query parameter required");
    expect(body).toMatch(/status:\s*400/);
  });

  it("calls verifyTeacherHasUnit then short-circuits 403 when hasAccess is false", () => {
    const verifyIdx = body.indexOf("verifyTeacherHasUnit");
    const queryIdx = body.indexOf('.from("unit_briefs")');
    expect(verifyIdx).toBeGreaterThan(0);
    expect(queryIdx).toBeGreaterThan(verifyIdx);
    expect(body).toMatch(/if \(!access\.hasAccess\)/);
    expect(body).toMatch(/status:\s*403/);
  });

  it("uses maybeSingle so a missing brief returns brief: null (not 500)", () => {
    expect(body).toContain(".maybeSingle()");
    expect(body).toMatch(/brief:\s*data\s*\?\s*rowToBrief\(data\)\s*:\s*null/);
  });
});

describe("/api/teacher/unit-brief — POST", () => {
  const body = sliceMethodBody("POST");

  it("auth gate: requireTeacher then short-circuit on .error", () => {
    expect(body).toContain("requireTeacher(request)");
    expect(body).toMatch(/if \(teacher\.error\) return teacher\.error/);
  });

  it("returns 400 on invalid JSON", () => {
    expect(body).toContain("Invalid JSON");
    expect(body).toMatch(/status:\s*400/);
  });

  it("returns 400 on missing unitId", () => {
    expect(body).toContain("unitId required (string)");
  });

  it("rejects with 403 when teacher is NOT the author (only authors edit)", () => {
    // The brief specifies "only the unit author can edit the brief".
    // verifyTeacherHasUnit returns isAuthor — POST checks isAuthor, not hasAccess.
    expect(body).toMatch(/if \(!access\.isAuthor\)/);
    expect(body).toContain("Only the unit author can edit the brief");
    expect(body).toMatch(/status:\s*403/);
  });

  it("validates brief_text is string or null", () => {
    expect(body).toContain("brief_text must be a string or null");
  });

  it("validates constraints via validateConstraints (strict shape)", () => {
    expect(body).toContain("validateConstraints");
  });

  it("validates locks via validateLocks (Phase F.B)", () => {
    expect(body).toContain("validateLocks");
    expect(body).toMatch(/"locks" in b/);
  });

  it("rejects an empty patch (must include brief_text, constraints, or locks)", () => {
    expect(body).toContain(
      "body must include at least one of: brief_text, constraints, locks",
    );
  });

  it("upserts on conflict by unit_id (one row per unit)", () => {
    expect(body).toMatch(/onConflict:\s*"unit_id"/);
  });

  it("partial-patch merges existing row with patch (server-side merge)", () => {
    // The merge spread { ...existing, ...patch } is what makes save-on-blur
    // safe when only one field changes — others stay put.
    expect(body).toMatch(/\.\.\.existing,\s*\.\.\.patch/);
  });
});

describe("validateConstraints — module-level invariants (read via source)", () => {
  it("rejects unknown archetype values to fail loudly on drift", () => {
    expect(src).toContain(
      "constraints.archetype must be 'design' or 'generic'",
    );
  });

  it("rejects unknown keys inside constraints.data (Lesson #38 specificity)", () => {
    expect(src).toMatch(/Unknown constraints\.data key/);
  });

  it("validates string fields are strings", () => {
    expect(src).toMatch(/must be a string/);
  });

  it("validates array fields are arrays of strings", () => {
    expect(src).toMatch(/must be an array of strings/);
  });
});

describe("validateLocks — module-level invariants (Phase F.B)", () => {
  it("declares a validateLocks helper alongside validateConstraints", () => {
    expect(src).toMatch(/function validateLocks/);
  });

  it("rejects non-object payloads", () => {
    expect(src).toContain("locks must be an object");
  });

  it("rejects unknown lock keys (Lesson #38 specificity — fail on typos)", () => {
    expect(src).toContain("Unknown locks key:");
    // The allowed set is built from the canonical LOCKABLE_FIELDS export
    expect(src).toMatch(/new Set<string>\(LOCKABLE_FIELDS\)/);
  });

  it("rejects non-boolean values per key", () => {
    expect(src).toMatch(/locks\.\$\{key\} must be a boolean/);
  });

  it("canonicalises — only `true` values are stored (false / absent both = unlocked)", () => {
    // Storing absent keys instead of explicit `false` keeps the JSONB
    // tight + makes "is this locked?" === true everywhere.
    expect(src).toMatch(/if \(r\[key\] === true\)/);
  });
});
