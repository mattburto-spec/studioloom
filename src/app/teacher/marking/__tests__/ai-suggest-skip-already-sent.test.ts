/**
 * /teacher/marking — AI suggest skips already-sent students (14 May 2026).
 *
 * Matt smoke: re-running AI suggest on a fully-graded tile silently
 * regenerated drafts for every student, putting all 47 back into the
 * inbox as "AI drafted" (the prescore route resets confirmed=false +
 * the new draft differs from the old sent comment → drafted state).
 *
 * Fix: AI suggest defaults to UNGRADED submitters only. Button label
 * surfaces a 3-way breakdown so the teacher knows what's skipped.
 * Per-row Shorter/Warmer/Sharper is the right surface for regenerating
 * a single sent student (explicit opt-in).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");

describe("/teacher/marking AI suggest — ungraded filter", () => {
  it("declares ungradedSubmitterIdsForActiveTile useMemo at parent level", () => {
    expect(src).toMatch(
      /const ungradedSubmitterIdsForActiveTile\s*=\s*useMemo<Set<string>>/,
    );
  });

  it("filter requires student_facing_comment is empty (trim'd)", () => {
    expect(src).toMatch(
      /const sent\s*=\s*\(g\?\.student_facing_comment\s*\?\?\s*""\)\.trim\(\);[\s\S]*?if\s*\(!sent\)\s*ungraded\.add\(studentId\)/,
    );
  });

  it("derives from submitterIdsForActiveTile (not all students) so non-submitters stay out", () => {
    expect(src).toMatch(
      /for\s*\(const studentId of submitterIdsForActiveTile\)/,
    );
  });

  it("runAiPrescoreBatch uses ungradedSubmitterIdsForActiveTile (NOT the wider submitter set)", () => {
    expect(src).toMatch(
      /const targetIds\s*=\s*students[\s\S]*?\.filter\(\(id\)\s*=>\s*ungradedSubmitterIdsForActiveTile\.has\(id\)\)/,
    );
  });

  it("button disables when ungraded === 0 (everyone's done OR nobody submitted)", () => {
    expect(src).toMatch(
      /disabled=\{aiBatchRunning\s*\|\|\s*ungradedSubmitterIdsForActiveTile\.size\s*===\s*0\}/,
    );
  });

  it("button label shows 3-way breakdown when some are already sent", () => {
    // "AI suggest (3 ungraded · 21 sent)" or similar.
    expect(src).toMatch(/AI suggest \(\$\{ungraded\} ungraded · \$\{alreadySent\} sent\)/);
  });

  it("button label flips to 'all N sent' when ungraded === 0 + at least one was sent", () => {
    expect(src).toMatch(/AI suggest — all \$\{alreadySent\} sent/);
  });

  it("title hint explains regeneration path via per-row tweak when all already sent", () => {
    expect(src).toMatch(/use the per-row Shorter \/ Warmer \/ Sharper/i);
  });

  it("CalibrateInnerProps declares the new ungradedSubmitterIdsForActiveTile prop", () => {
    expect(src).toMatch(
      /ungradedSubmitterIdsForActiveTile:\s*Set<string>/,
    );
  });

  it("carries data-testid on the AI suggest button for e2e", () => {
    expect(src).toContain('data-testid="marking-ai-suggest-button"');
  });
});

describe("/teacher/marking AI suggest — non-submitter still gated", () => {
  it("non-submitters remain skipped (already in submitterIdsForActiveTile filter)", () => {
    // The original submitter filter is preserved; ungraded layers ON
    // TOP of it. Pin both filters exist.
    expect(src).toMatch(
      /tiles\[activeTile\.tileId\]\s*&&\s*tiles\[activeTile\.tileId\]\.trim\(\)\.length\s*>\s*0/,
    );
  });
});
