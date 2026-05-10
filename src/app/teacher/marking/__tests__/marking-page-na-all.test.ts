/**
 * PR-C (10 May 2026) — source-static guards for "NA all" bulk action.
 *
 * Surfaced during TFL.1 Checkpoint 1.1 round 2 smoke: Matt asked for a
 * bulk way to mark a tile NA across the cohort instead of clicking NA
 * on each student row individually. Common case: non-gradable tiles
 * (reflection prompts, attendance markers) that have submissions but
 * aren't part of the calibrate flow.
 *
 * What this PR adds:
 *   - `naAllForActiveTile()`: chunked-parallel save loop that calls
 *     `saveTile(studentId, null, true, { score_na: true })` for every
 *     student in the cohort. Wrapped in `window.confirm` for safety.
 *   - `naAllRunning` state gate.
 *   - "NA all (N)" outline button next to "AI suggest" in the active-
 *     tile header.
 *   - Threading: both the function and the running flag flow through
 *     CalibrateInner props so the inner button can fire it.
 *
 * Lesson #71: source-static asserts. e2e against the bulk save path
 * lands when a runtime test harness exists.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");

describe("marking page — NA-all bulk action (PR-C)", () => {
  it("declares naAllRunning state + naAllForActiveTile fn", () => {
    expect(src).toMatch(/const \[naAllRunning,\s*setNaAllRunning\]\s*=\s*useState/);
    expect(src).toMatch(/async function naAllForActiveTile\(\)/);
  });

  it("guards with window.confirm before running", () => {
    // A bulk action that confirms across cohort needs SOME safety. v1
    // uses window.confirm; future polish could swap to inline two-step
    // button, but the explicit confirm is fine for v1.
    expect(src).toMatch(
      /const proceed\s*=\s*window\.confirm\(/,
    );
    // Confirm copy must mention the cohort size + the NA semantic
    // (so a teacher who clicks accidentally has signal to abort).
    expect(src).toMatch(
      /Mark this tile NA for all \$\{students\.length\} students/,
    );
  });

  it("calls saveTile with score=null, confirmed=true, score_na=true for each student", () => {
    // The exact saveTile shape — score=null + score_na=true + confirmed=
    // true — tells the chip counter (PR-A) to count this as a graded
    // cell even though there's no numeric score. Drift from this shape
    // would silently leave NA-all rows uncounted.
    expect(src).toMatch(
      /saveTile\(s\.id,\s*null,\s*true,\s*\{\s*score_na:\s*true\s*\}\)/,
    );
  });

  it("chunks parallel saves at CHUNK = 8 (route is not hammered)", () => {
    // Without chunking, 24+ students fire 24+ simultaneous PUTs. A
    // chunk size of 8 finishes a class-of-24 in ~3 round-trips while
    // keeping concurrency bounded.
    expect(src).toMatch(/const\s+CHUNK\s*=\s*8/);
    expect(src).toMatch(
      /Promise\.all\([\s\S]*?saveTile\(s\.id,\s*null,\s*true,\s*\{\s*score_na:\s*true\s*\}\)/,
    );
  });

  it("renders the NA-all button with data-testid + cohort count", () => {
    expect(src).toContain('data-testid="marking-na-all-button"');
    expect(src).toMatch(/NA all \(\$\{students\.length\}\)/);
  });

  it("button is disabled while running OR when cohort is empty", () => {
    expect(src).toMatch(
      /disabled=\{naAllRunning\s*\|\|\s*students\.length\s*===\s*0\}/,
    );
  });

  it("threads naAllRunning + naAllForActiveTile into CalibrateInner", () => {
    // Both must be on the prop interface AND threaded into the
    // destructured render fn so the inner button can fire the action.
    expect(src).toMatch(/naAllRunning:\s*boolean/);
    expect(src).toMatch(/naAllForActiveTile:\s*\(\)\s*=>\s*Promise<void>/);
    expect(src).toMatch(/naAllRunning,\s*\n\s*naAllForActiveTile,/);
  });
});
