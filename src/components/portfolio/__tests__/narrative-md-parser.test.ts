/**
 * Round 11 (6 May 2026) — narrative markdown rendering.
 *
 * NarrativeView used to dump composed structured-prompts content as
 * raw text, so the PDF showed "## What did you DO?" as literal
 * markdown. parseStructuredPromptsResponse parses the saved text back
 * into headings + bodies for the structured journal renderer.
 *
 * Source-static guards lock the parser shape + the wiring that calls
 * it from ResponseDisplay.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const VIEW_SRC = readFileSync(
  join(__dirname, "..", "NarrativeView.tsx"),
  "utf-8"
);

describe("NarrativeView — structured-prompts markdown parser (round 11)", () => {
  it("defines parseStructuredPromptsResponse helper at the bottom of the file", () => {
    expect(VIEW_SRC).toMatch(
      /function parseStructuredPromptsResponse\(\s*input:\s*string\s*\)/
    );
  });

  it("returns null when the input has no '## ' lines", () => {
    expect(VIEW_SRC).toMatch(/if\s*\(!input\.includes\("##\s"\)\)\s*return null/);
  });

  it("splits on \\r?\\n and walks lines, flushing into label+body pairs", () => {
    expect(VIEW_SRC).toMatch(/input\.split\(\/\\r\?\\n\/\)/);
    expect(VIEW_SRC).toMatch(/line\.startsWith\("##\s"\)/);
  });

  it("filters empty-body entries before returning (defensive)", () => {
    expect(VIEW_SRC).toMatch(
      /out\.filter\(\(e\)\s*=>\s*e\.body\.length\s*>\s*0\)/
    );
  });

  it("ResponseDisplay calls the parser AS THE FIRST RENDER PATH (before JSON / rich-text / plain branches)", () => {
    const idx = VIEW_SRC.indexOf("function ResponseDisplay");
    expect(idx).toBeGreaterThan(0);
    const fn = VIEW_SRC.slice(idx, idx + 2000);
    // Parser call must come before the JSON.parse attempt
    const parseCallIdx = fn.indexOf("parseStructuredPromptsResponse");
    const jsonParseIdx = fn.indexOf('str.startsWith("{"');
    expect(parseCallIdx).toBeGreaterThan(0);
    expect(parseCallIdx).toBeLessThan(jsonParseIdx);
  });

  it("renders structured journal as <h4> headings + <p> bodies (replaces raw markdown)", () => {
    // The conditional render block uses h4 + uppercase tracking-wide
    // headings which is the narrative-friendly form.
    const idx = VIEW_SRC.indexOf("data-narrative-structured-prompts");
    expect(idx).toBeGreaterThan(0);
    const block = VIEW_SRC.slice(idx, idx + 800);
    expect(block).toContain("<h4");
    expect(block).toContain("uppercase tracking-wide");
    expect(block).toContain("entry.label");
    expect(block).toContain("entry.body");
  });
});
