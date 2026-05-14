/**
 * /api/teacher/grading/tile-grades/ai-prescore — source-static guards.
 *
 * Focus: TFL.3 C.7.3 (13 May 2026 — Matt smoke: "AI suggest took over
 * a minute to develop comments for 24 students"). Pre-fix the loop
 * was serial `for...await`; ~24 × 2-3s = ~60s. Now: chunked
 * Promise.all with CHUNK_SIZE=6 → ~4 chunks × 3s ≈ 12-15s for 24
 * students.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("ai-prescore batch — parallelisation (C.7.3)", () => {
  it("declares CHUNK_SIZE = 6", () => {
    expect(src).toMatch(/const CHUNK_SIZE\s*=\s*6/);
  });

  it("processes students via chunked Promise.all (NOT serial for-await)", () => {
    expect(src).toMatch(
      /for\s*\(\s*let i\s*=\s*0;\s*i\s*<\s*student_ids\.length;\s*i\s*\+=\s*CHUNK_SIZE/,
    );
    expect(src).toMatch(/await Promise\.all\(slice\.map\(processOne\)\)/);
  });

  it("each chunk's results are pushed in order (preserves response shape)", () => {
    expect(src).toMatch(/results\.push\(\.\.\.sliceResults\)/);
  });

  it("processOne is a self-contained async helper (try/catch per-student)", () => {
    // Per-student error isolation: a single Haiku failure can't poison
    // the batch. Mirrors the inbox warm-up loop's safety pattern.
    expect(src).toMatch(
      /const processOne\s*=\s*async\s*\(studentId:\s*string\)[\s\S]*?try\s*\{[\s\S]*?\}\s*catch\s*\(err\)/,
    );
  });

  it("error path returns the same { ok: false, error } shape", () => {
    expect(src).toMatch(
      /return\s*\{\s*student_id:\s*studentId,\s*ok:\s*false,\s*error:[\s\S]*?\}/,
    );
  });
});

describe("ai-prescore batch — Inspiration Board normalization (C.7.1)", () => {
  it("flattens Inspiration Board JSON for AI input via summariseInspirationBoardForAI", () => {
    expect(src).toMatch(
      /summariseInspirationBoardForAI\(rawResponse\)/,
    );
    expect(src).toMatch(
      /const studentResponse\s*=\s*inspirationSummary\s*\?\?\s*rawResponse/,
    );
  });

  it("imports the summariser from parse-inspiration-board", () => {
    expect(src).toMatch(
      /import\s*\{\s*summariseInspirationBoardForAI\s*\}\s*from\s*"@\/lib\/integrity\/parse-inspiration-board"/,
    );
  });
});
