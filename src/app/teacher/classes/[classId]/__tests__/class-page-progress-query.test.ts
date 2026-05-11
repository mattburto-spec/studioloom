/**
 * Class hub progress-bar query — schema alignment.
 *
 * Bug Matt caught: the class page (/teacher/classes/[id]) fired a GET
 * to Supabase REST for student_progress with select=completed_pages,
 * total_pages. Those columns don't exist on the table — the schema is
 * per-(student, unit, page) with a status column. Supabase responded
 * 400 Bad Request; the per-student progress bars in the class hub
 * silently disappeared because progressRes.data was null.
 *
 * Fix: select the schema-correct columns (student_id, status) and
 * aggregate to "X complete of Y touched" in the loop below.
 *
 * Source-static — locks the column names selected against the schema.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const CLASS_PAGE_SRC = readFileSync(
  join(__dirname, "..", "page.tsx"),
  "utf-8",
);

describe("Class hub — student_progress query schema alignment", () => {
  it("queries select('student_id, status') — NOT the missing completed_pages/total_pages columns", () => {
    expect(CLASS_PAGE_SRC).toMatch(
      /from\("student_progress"\)\.select\("student_id, status"\)/,
    );
    // The pre-fix call asked for columns that 400-ed.
    expect(CLASS_PAGE_SRC).not.toContain("completed_pages, total_pages");
  });

  it("StudentProgressRow type matches the schema (no hallucinated columns)", () => {
    // Pre-fix the local interface claimed completed_pages and total_pages
    // existed on the table. Post-fix the interface mirrors the per-row
    // shape Supabase actually returns.
    expect(CLASS_PAGE_SRC).toMatch(
      /interface StudentProgressRow[\s\S]{0,200}student_id:\s*string;[\s\S]{0,200}status:/,
    );
    expect(CLASS_PAGE_SRC).not.toMatch(
      /interface StudentProgress\s*\{[\s\S]{0,200}completed_pages:/,
    );
  });

  it("aggregates progress in the loop: completed counts status==='complete', total counts every row", () => {
    // The progress map is computed client-side from the per-page rows
    // since student_progress is keyed (student, unit, page). Aggregate
    // is "X complete of Y touched."
    expect(CLASS_PAGE_SRC).toMatch(/existing\.total \+= 1/);
    expect(CLASS_PAGE_SRC).toMatch(
      /p\.status === "complete"[\s\S]{0,100}existing\.completed \+= 1/,
    );
  });
});
