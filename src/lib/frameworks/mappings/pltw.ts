/**
 * PLTW (Project Lead The Way) mapping — 4 rubric dimensions → 8 neutral keys.
 * Source: docs/specs/neutral-criterion-taxonomy.md §3.6 — the only framework
 * with all 8 neutral keys explicitly covered. No gaps.
 */
import type { FrameworkMapping } from "../adapter";

const DESIGN = { short: "Design", full: "Design", name: "Design Process" };
const BUILD = { short: "Build", full: "Build", name: "Build & Prototype" };
const TEST = { short: "Test", full: "Test", name: "Test & Evaluate" };
const PRESENT = { short: "Present", full: "Present", name: "Present & Defend" };

export const PLTW_MAPPING: FrameworkMapping = {
  frameworkId: "PLTW",
  criteria: [
    { ...DESIGN, neutralKeys: ["researching", "analysing", "designing"] },
    { ...BUILD, neutralKeys: ["creating", "planning"] },
    { ...TEST, neutralKeys: ["evaluating", "analysing"] },
    { ...PRESENT, neutralKeys: ["communicating", "reflecting"] },
  ],
  reverse: {
    researching: { kind: "label", ...DESIGN },
    analysing: { kind: "label", ...DESIGN }, // secondary: Test
    designing: { kind: "label", ...DESIGN },
    creating: { kind: "label", ...BUILD },
    evaluating: { kind: "label", ...TEST },
    reflecting: { kind: "label", ...PRESENT },
    communicating: { kind: "label", ...PRESENT },
    planning: { kind: "label", ...BUILD },
  },
};
