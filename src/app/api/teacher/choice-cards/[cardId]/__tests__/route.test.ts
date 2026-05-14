/**
 * Source-static guards for /api/teacher/choice-cards/[cardId] (GET + PATCH).
 *
 * Phase F.C — new GET handler + brief template fields on PATCH.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/teacher/choice-cards/[cardId] — module-level", () => {
  it("imports validateConstraints + validateLocks from the shared validators module", () => {
    expect(src).toMatch(
      /import \{[\s\S]*?validateConstraints[\s\S]*?validateLocks[\s\S]*?\} from "@\/lib\/unit-brief\/validators"/,
    );
  });

  it("FULL_COLUMNS includes the Phase F.C brief template fields", () => {
    expect(src).toContain("brief_text");
    expect(src).toContain("brief_constraints");
    expect(src).toContain("brief_locks");
  });
});

describe("GET handler — Phase F.C", () => {
  it("exports GET (new in F.C — needed by the brief template editor modal)", () => {
    expect(src).toMatch(/export async function GET/);
  });

  it("requires teacher auth + returns 400 on missing cardId + 404 on miss", () => {
    expect(src).toContain("requireTeacher(request)");
    expect(src).toContain("cardId required");
    expect(src).toContain("Card not found");
  });

  it("returns the full card row (FULL_COLUMNS) including brief template fields", () => {
    expect(src).toMatch(/\.select\(FULL_COLUMNS\)/);
    expect(src).toMatch(/return NextResponse\.json\(\{ card: data \}\)/);
  });
});

describe("PATCH handler — Phase F.C brief template fields", () => {
  it("accepts brief_text (string or null)", () => {
    expect(src).toMatch(/if \("brief_text" in b\)/);
    expect(src).toContain("brief_text must be a string or null");
  });

  it("validates brief_constraints via shared validateConstraints", () => {
    expect(src).toMatch(
      /if \("brief_constraints" in b\)[\s\S]*?validateConstraints\(b\.brief_constraints\)/,
    );
    expect(src).toMatch(/brief_constraints: \$\{validated\.error\}/);
  });

  it("validates brief_locks via shared validateLocks", () => {
    expect(src).toMatch(
      /if \("brief_locks" in b\)[\s\S]*?validateLocks\(b\.brief_locks\)/,
    );
    expect(src).toMatch(/brief_locks: \$\{validated\.error\}/);
  });

  it("only creator OR platform admin can patch (existing auth gate, unchanged)", () => {
    expect(src).toContain("created_by !== teacherId");
    expect(src).toContain("is_platform_admin");
  });
});
