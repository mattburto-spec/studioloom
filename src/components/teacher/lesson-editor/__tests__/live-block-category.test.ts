/**
 * BlockPalette — "Live" category source-static guards.
 *
 * Verifies the 3-edit wiring that moves Class DJ (and future live blocks)
 * out of the "Custom" bucket into a dedicated "Live" category.
 *
 * Brief: docs/specs/live-blocks-pattern.md (canonical pattern).
 * Maps from DB column activity_category="social-environment".
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const TYPES_SRC = readFileSync(
  join(__dirname, "..", "BlockPalette.types.ts"),
  "utf-8",
);
const PALETTE_SRC = readFileSync(
  join(__dirname, "..", "BlockPalette.tsx"),
  "utf-8",
);

describe("BlockCategory — Live category", () => {
  it("'live' is in the BlockCategory union", () => {
    expect(TYPES_SRC).toMatch(/\|\s*"live"/);
  });

  it("CATEGORIES.live entry uses violet palette", () => {
    expect(PALETTE_SRC).toMatch(/\blive:\s*\{[\s\S]{0,200}dotColor:\s*"bg-violet-500"/);
    expect(PALETTE_SRC).toMatch(/\blive:\s*\{[\s\S]{0,200}color:\s*"text-violet-600"/);
  });

  it("CATEGORIES.live label is 'Live'", () => {
    expect(PALETTE_SRC).toMatch(/\blive:\s*\{[\s\S]{0,100}label:\s*"Live"/);
  });

  it("mapActivityCategory maps 'social-environment' → 'live'", () => {
    expect(PALETTE_SRC).toMatch(
      /case\s+"social-environment":\s*return\s+"live"/,
    );
  });

  it("Live category sits between Toolkit and Assessment in the CATEGORIES map", () => {
    // Source order determines accordion render order. Validate the three
    // entries' position relative to each other.
    const toolkitIdx = PALETTE_SRC.indexOf("toolkit: {");
    const liveIdx = PALETTE_SRC.indexOf("live: {");
    const assessmentIdx = PALETTE_SRC.indexOf("assessment: {");
    expect(toolkitIdx).toBeGreaterThan(-1);
    expect(liveIdx).toBeGreaterThan(toolkitIdx);
    expect(assessmentIdx).toBeGreaterThan(liveIdx);
  });
});
