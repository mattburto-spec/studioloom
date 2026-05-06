/**
 * Smoke-fix round 7 (6 May 2026) — NM checkpoint strip restored to
 * visibility in the lesson editor. Matt: "now that the top NM yellow
 * area is removed there is no evidence that they [NM blocks] are
 * there." Strip flipped back on with redesigned styling (less garish
 * than the original yellow box).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const EDITOR_SRC = readFileSync(
  join(__dirname, "..", "LessonEditor.tsx"),
  "utf-8"
);

describe("NM checkpoint strip visibility (round 7)", () => {
  it("SHOW_NM_CHECKPOINT_STRIP flag flipped back to true", () => {
    expect(EDITOR_SRC).toMatch(
      /const SHOW_NM_CHECKPOINT_STRIP:\s*boolean\s*=\s*true/
    );
  });

  it("strip render block has its own data-testid for smoke selectors", () => {
    expect(EDITOR_SRC).toContain('data-testid="nm-checkpoint-strip"');
  });

  it("each chip carries a stable data-testid keyed by elementId", () => {
    expect(EDITOR_SRC).toMatch(
      /data-testid=\{`nm-checkpoint-chip-\$\{elementId\}`\}/
    );
  });

  it("strip is gated on useNewMetrics + activeNmElementIds.length > 0", () => {
    expect(EDITOR_SRC).toMatch(
      /SHOW_NM_CHECKPOINT_STRIP\s*&&\s*useNewMetrics\s*&&\s*activeNmElementIds\.length\s*>\s*0/
    );
  });

  it("strip header explains what Three Cs checkpoints are for", () => {
    expect(EDITOR_SRC).toContain("Three Cs checkpoints on this lesson");
    expect(EDITOR_SRC).toContain("Students rate themselves against these elements");
  });

  it("retired the yellow color palette (round 7 redesign)", () => {
    // The strip render block specifically — anchor on the data-testid
    // so we don't false-match yellow elsewhere in the file.
    const idx = EDITOR_SRC.indexOf('data-testid="nm-checkpoint-strip"');
    expect(idx).toBeGreaterThan(0);
    const block = EDITOR_SRC.slice(idx, idx + 2500);
    // No bg-yellow-50 / border-yellow-200 / text-yellow-* in the strip
    // body any more.
    expect(block).not.toContain("bg-yellow-50");
    expect(block).not.toContain("border-yellow-200");
    expect(block).not.toContain("text-yellow-700");
  });

  it("× remove button still wired to handleRemoveNmCheckpoint", () => {
    const idx = EDITOR_SRC.indexOf('data-testid="nm-checkpoint-strip"');
    const block = EDITOR_SRC.slice(idx, idx + 2500);
    expect(block).toContain("handleRemoveNmCheckpoint(elementId)");
  });
});
