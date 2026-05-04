/**
 * Lever-MM sub-phase MM.0F — buildNmElementBlocks helper test.
 *
 * Asserts the BlockDefinition shape produced for the New Metrics block
 * category in the Phase 0.5 lesson editor:
 *   - One block per element
 *   - category: "new_metrics" (so the palette routes them to the right accordion)
 *   - nmElementId + nmCompetencyId set (so the click handler can persist)
 *   - create() throws (fail-loud stub — never invoked through onAddBlock)
 *
 * Brief: docs/projects/unit-editor-nm-block.md
 */

import { describe, it, expect } from "vitest";
import { buildNmElementBlocks } from "../nm-element-blocks";

const SAMPLE_ELEMENTS = [
  {
    id: "acting_with_autonomy",
    name: "Acting with Autonomy",
    definition: "Making decisions independently",
    studentDescription: "I make my own choices",
  },
  {
    id: "managing_self",
    name: "Managing Self",
    definition: "Self-regulation of effort and emotion",
    studentDescription: "I manage my own work",
  },
];

describe("Lever-MM buildNmElementBlocks", () => {
  it("returns one block per element", () => {
    const blocks = buildNmElementBlocks(SAMPLE_ELEMENTS, "agency_in_learning");
    expect(blocks).toHaveLength(2);
  });

  it("each block has category 'new_metrics' so the palette routes them correctly", () => {
    const blocks = buildNmElementBlocks(SAMPLE_ELEMENTS, "agency_in_learning");
    for (const b of blocks) {
      expect(b.category).toBe("new_metrics");
    }
  });

  it("each block has nmElementId + nmCompetencyId so the click handler can persist", () => {
    const blocks = buildNmElementBlocks(SAMPLE_ELEMENTS, "agency_in_learning");
    expect(blocks[0].nmElementId).toBe("acting_with_autonomy");
    expect(blocks[0].nmCompetencyId).toBe("agency_in_learning");
    expect(blocks[1].nmElementId).toBe("managing_self");
    expect(blocks[1].nmCompetencyId).toBe("agency_in_learning");
  });

  it("uses the element's name as the block label", () => {
    const blocks = buildNmElementBlocks(SAMPLE_ELEMENTS, "agency_in_learning");
    expect(blocks[0].label).toBe("Acting with Autonomy");
    expect(blocks[1].label).toBe("Managing Self");
  });

  it("prefers studentDescription over definition for the block description (more human)", () => {
    const blocks = buildNmElementBlocks(SAMPLE_ELEMENTS, "agency_in_learning");
    expect(blocks[0].description).toBe("I make my own choices");
    expect(blocks[1].description).toBe("I manage my own work");
  });

  it("falls back to definition when studentDescription is missing", () => {
    const blocks = buildNmElementBlocks(
      [{ id: "x", name: "X", definition: "formal def" }],
      "competency_x",
    );
    expect(blocks[0].description).toBe("formal def");
  });

  it("falls back to a generic CTA when both descriptions are missing", () => {
    const blocks = buildNmElementBlocks([{ id: "x", name: "Element X" }], "competency_x");
    expect(blocks[0].description).toBe("Add a checkpoint for Element X on this lesson.");
  });

  it("each block's id is namespaced by competencyId so the same element under different competencies wouldn't collide", () => {
    const a = buildNmElementBlocks([{ id: "x", name: "X" }], "competency_a");
    const b = buildNmElementBlocks([{ id: "x", name: "X" }], "competency_b");
    expect(a[0].id).not.toBe(b[0].id);
    expect(a[0].id).toBe("nm-element-competency_a-x");
    expect(b[0].id).toBe("nm-element-competency_b-x");
  });

  it("create() throws to prevent accidental invocation through onAddBlock (fail-loud stub)", () => {
    const blocks = buildNmElementBlocks(SAMPLE_ELEMENTS, "agency_in_learning");
    expect(() => blocks[0].create()).toThrow(
      /should route through onAddNmCheckpoint/,
    );
  });

  it("returns an empty array for empty input", () => {
    expect(buildNmElementBlocks([], "anything")).toEqual([]);
  });

  it("source is 'built-in' (these are framework-provided, not custom or imported)", () => {
    const blocks = buildNmElementBlocks(SAMPLE_ELEMENTS, "agency_in_learning");
    for (const b of blocks) {
      expect(b.source).toBe("built-in");
    }
  });
});
