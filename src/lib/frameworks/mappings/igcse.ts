/**
 * Cambridge IGCSE Design & Technology mapping — 3 AOs → 8 neutral keys.
 * Source: docs/specs/neutral-criterion-taxonomy.md §3.4.
 */
import type { FrameworkMapping } from "../adapter";

const AO1 = { short: "AO1", full: "AO1", name: "Recall and understanding" };
const AO2 = { short: "AO2", full: "AO2", name: "Handling information and problem solving" };
const AO3 = { short: "AO3", full: "AO3", name: "Design and making skills" };

export const IGCSE_MAPPING: FrameworkMapping = {
  frameworkId: "IGCSE_DT",
  criteria: [
    { ...AO1, neutralKeys: ["analysing"] },
    { ...AO2, neutralKeys: ["researching", "analysing", "designing"] },
    { ...AO3, neutralKeys: ["designing", "creating", "evaluating"] },
  ],
  reverse: {
    researching: { kind: "label", ...AO2 },
    // spec-literal: §3.4 lists both AO1 and AO2 for analysing without declaring primacy.
    // AO1 is analysing-exclusive (its sole neutral key), so the "exclusive key wins" heuristic
    // (same rule applied to Victorian × TC) selects AO1 as primary. Pedagogically AO2
    // ("Handling information and problem solving") is a stronger anchor for NEA-context
    // analysing, but honouring spec + precedent. Filed as FU-D for spec amendment.
    analysing: { kind: "label", ...AO1 },
    designing: { kind: "label", ...AO3 },
    creating: { kind: "label", ...AO3 },
    evaluating: { kind: "label", ...AO3 },
    // Gap (§3.4 silent). IGCSE folds reflection into AO3 evaluation of design outcomes.
    reflecting: {
      kind: "implicit",
      mappedTo: "evaluating",
      ...AO3,
      note: "IGCSE folds reflection into AO3 design and making skills evaluation; not assessed as a standalone AO.",
    },
    // Gap (§3.4 silent). AO3 portfolio is communication-heavy but not called out.
    communicating: {
      kind: "implicit",
      mappedTo: "designing",
      ...AO3,
      note: "IGCSE portfolio communication is implicit in AO3 design and making skills; not assessed as a standalone AO.",
    },
    // Gap (§3.4 silent). Planning is part of AO3 making skills.
    planning: {
      kind: "implicit",
      mappedTo: "designing",
      ...AO3,
      note: "IGCSE planning is implicit in AO3 design and making skills; not assessed as a standalone AO.",
    },
  },
};
