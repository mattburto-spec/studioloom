/**
 * Source-static guards for /api/teacher/choice-cards (POST).
 *
 * Phase F.C — focused on the brief template fields. The rest of the
 * card-create surface was unchanged.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/teacher/choice-cards POST — Phase F.C brief template fields", () => {
  it("imports validateConstraints + validateLocks from the shared validators module", () => {
    expect(src).toMatch(
      /import \{[\s\S]*?validateConstraints[\s\S]*?validateLocks[\s\S]*?\} from "@\/lib\/unit-brief\/validators"/,
    );
  });

  it("accepts optional brief_text (string or null) on create", () => {
    expect(src).toMatch(/if \("brief_text" in b\)/);
    expect(src).toContain("brief_text must be a string or null");
  });

  it("validates brief_constraints via shared validateConstraints helper", () => {
    expect(src).toMatch(
      /if \("brief_constraints" in b\)[\s\S]*?validateConstraints\(b\.brief_constraints\)/,
    );
    // Error message prefixed with the field path so the API caller knows
    // *which* validator complained (vs. the unit-brief upsert that has
    // only one `constraints` field).
    expect(src).toMatch(/brief_constraints: \$\{validated\.error\}/);
  });

  it("validates brief_locks via shared validateLocks helper", () => {
    expect(src).toMatch(
      /if \("brief_locks" in b\)[\s\S]*?validateLocks\(b\.brief_locks\)/,
    );
    expect(src).toMatch(/brief_locks: \$\{validated\.error\}/);
  });

  it("inserts all 3 brief template fields into the row (when present)", () => {
    expect(src).toContain("insertRow.brief_text");
    expect(src).toContain("insertRow.brief_constraints");
    expect(src).toContain("insertRow.brief_locks");
  });
});
