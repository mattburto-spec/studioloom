/**
 * loadTileFeedbackThreads — source-static guards.
 *
 * The loader is the bridge between the B.1 schema (tile_feedback_turns
 * + student_tile_grades) and the Pass A `<TeacherFeedback />`
 * component's `Turn` discriminated union. Drift on either side breaks
 * the lesson-page render silently. Tests pin:
 *
 *   - Two-step query shape (grades then turns) — the explicit join
 *     avoids PostgREST embed gotchas with auth.users FK targets.
 *   - Filters by (student_id, unit_id, page_id) so a route bug can't
 *     leak threads across students.
 *   - Turns ordered by sent_at ASC (the component renders linearly).
 *   - Teacher-name resolution prefers display_name → name → email-prefix
 *     → "Teacher". The teachers table has `name` (not `full_name`) per
 *     schema-registry.yaml; pinning the column list guards against the
 *     loader reading a non-existent column at runtime.
 *   - Discriminated-union mapping rejects rows that violate the B.1
 *     CHECK constraint (defensive — should be impossible given the DB
 *     guarantee).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "..", "tile-feedback-loader.ts"),
  "utf-8",
);

describe("loadTileFeedbackThreads — query shape", () => {
  it("queries student_tile_grades first, scoped by (student_id, unit_id, page_id)", () => {
    expect(src).toMatch(
      /\.from\("student_tile_grades"\)[\s\S]*?\.select\("id, tile_id"\)/,
    );
    expect(src).toMatch(/\.eq\("student_id",\s*studentId\)/);
    expect(src).toMatch(/\.eq\("unit_id",\s*unitId\)/);
    expect(src).toMatch(/\.eq\("page_id",\s*pageId\)/);
  });

  it("queries tile_feedback_turns second, filtered by gradeIds + ordered by sent_at ASC", () => {
    expect(src).toMatch(/\.from\("tile_feedback_turns"\)/);
    expect(src).toMatch(/\.in\("grade_id",\s*gradeIds\)/);
    expect(src).toMatch(/\.order\("sent_at",\s*\{\s*ascending:\s*true\s*\}\)/);
  });

  it("selects every column the Turn discriminator needs (no implicit columns)", () => {
    // Drift on this list would silently render undefined fields in the
    // component. Pin the exact select string.
    expect(src).toMatch(
      /"id, grade_id, role, author_id, body_html, edited_at, sentiment, reply_text, sent_at"/,
    );
  });

  it("returns empty maps when no grades match the (student, unit, page) filter (early return)", () => {
    // Updated B.3: return shape is { threadsByTileId, gradeIdByTileId }
    // — both maps. Empty means no threads AND no grade rows yet.
    expect(src).toMatch(
      /if\s*\(!grades\s*\|\|\s*grades\.length\s*===\s*0\)\s*\{[\s\S]*?return\s*\{\s*threadsByTileId:\s*\{\}\s*,\s*gradeIdByTileId:\s*\{\}\s*\}/,
    );
  });

  it("returns gradeIdByTileId even when no turns exist (B.3 — reply endpoint needs the grade id to insert the first turn)", () => {
    // Tile has a grade row but no turns yet → empty turns map but
    // populated gradeId map. Without this, the first reply would
    // 404 because the lesson page wouldn't know which gradeId to
    // POST to.
    expect(src).toMatch(
      /if\s*\(!turns\s*\|\|\s*turns\.length\s*===\s*0\)\s*\{[\s\S]*?return\s*\{\s*threadsByTileId:\s*\{\}\s*,\s*gradeIdByTileId\s*\}/,
    );
  });
});

describe("loadTileFeedbackThreads — teacher name resolution", () => {
  it("batches teacher name lookups (single .in() query, not N+1)", () => {
    expect(src).toMatch(/\.from\("teachers"\)/);
    expect(src).toMatch(/\.in\("id",\s*teacherIds\)/);
    // Set construction to dedupe author_ids before the query.
    expect(src).toMatch(/Array\.from\(\s*new Set\(/);
  });

  it("selects `id, name, display_name, email` from teachers (matches schema-registry.yaml)", () => {
    // The teachers table has `name` (NOT `full_name`) and `display_name`
    // per the schema registry. A typo here would fail at runtime with
    // a Postgres error.
    expect(src).toMatch(/"id, name, display_name, email"/);
  });

  it("name fallback chain: display_name → name → email-prefix → 'Teacher'", () => {
    // Pinning the priority order: display_name (teacher's chosen
    // public alias) wins over name (legal/full from signup). Email
    // prefix is the last-resort identifier; "Teacher" is the
    // generic fallback for missing rows.
    const block = src.match(
      /const name\s*=[\s\S]*?"Teacher";/,
    )?.[0] ?? "";
    expect(block).toMatch(/t\.display_name/);
    expect(block).toMatch(/t\.name/);
    expect(block).toMatch(/t\.email/);
    expect(block).toMatch(/"Teacher"/);
    // display_name comes BEFORE name (priority order).
    expect(block.indexOf("t.display_name")).toBeLessThan(
      block.indexOf("t.name &&"),
    );
  });
});

describe("loadTileFeedbackThreads — Turn discriminator mapping", () => {
  it("teacher row maps to TeacherTurn with bodyHTML + authorId + authorName", () => {
    const block = src.match(
      /if\s*\(raw\.role\s*===\s*"teacher"\)\s*\{[\s\S]*?return\s+teacher;/,
    )?.[0] ?? "";
    expect(block).toMatch(/role:\s*"teacher"/);
    expect(block).toMatch(/authorId:\s*raw\.author_id/);
    expect(block).toMatch(/authorName:/);
    expect(block).toMatch(/bodyHTML:\s*raw\.body_html/);
  });

  it("student row maps to StudentTurn with sentiment + text", () => {
    expect(src).toMatch(/role:\s*"student"/);
    expect(src).toMatch(/sentiment:\s*raw\.sentiment/);
    expect(src).toMatch(/text:\s*raw\.reply_text\s*\?\?\s*""/);
  });

  it("rejects malformed rows (defensive — DB CHECK should make this impossible)", () => {
    // The mapper returns null when a discriminator's required
    // fields are missing. This catches runtime DB drift before it
    // reaches the component.
    expect(src).toMatch(
      /if\s*\(!raw\.author_id\s*\|\|\s*!raw\.body_html\)\s*return\s+null/,
    );
    expect(src).toMatch(
      /if\s*\(!raw\.sentiment\)\s*return\s+null/,
    );
  });

  it("groups output by tile_id (resolved via grade_id → tile_id mapping)", () => {
    expect(src).toMatch(/const tileByGradeId\s*=\s*new Map<string,\s*string>\(\)/);
    expect(src).toMatch(/tileByGradeId\.get\(raw\.grade_id\)/);
    // Skip rows where grade_id no longer maps (deleted between
    // queries) — defensive against eventual consistency.
    expect(src).toMatch(/if\s*\(!tileId\)\s*continue/);
  });
});

describe("loadTileFeedbackThreads — validTileIds filter (orphan grades, 14 May 2026)", () => {
  it("accepts an optional validTileIds: Set<string> | null parameter", () => {
    expect(src).toMatch(/validTileIds\?\:\s*Set<string>\s*\|\s*null/);
  });

  it("filters grades through the whitelist when supplied", () => {
    // The filter is a no-op when validTileIds is null/undefined
    // (backwards compat); otherwise drops grades whose tile_id
    // isn't in the set.
    expect(src).toMatch(
      /filteredGrades\s*=\s*\(grades[\s\S]*?\)\.filter\(\s*\(g\)\s*=>\s*!validTileIds\s*\|\|\s*validTileIds\.has\(g\.tile_id\)/,
    );
  });

  it("uses filteredGrades to build the gradeIds + map (not the raw grades array)", () => {
    expect(src).toMatch(/const gradeIds\s*=\s*filteredGrades\.map/);
    expect(src).toMatch(/for\s*\(const g of filteredGrades\)/);
  });

  it("returns empty result when filter drops everything (don't query turns unnecessarily)", () => {
    expect(src).toMatch(
      /if\s*\(filteredGrades\.length\s*===\s*0\)\s*\{[\s\S]*?return\s*\{\s*threadsByTileId:\s*\{\},\s*gradeIdByTileId:\s*\{\}\s*\}/,
    );
  });
});
