/**
 * GCSE Design & Technology mapping — 4 AOs → 8 neutral keys.
 * Source: docs/specs/neutral-criterion-taxonomy.md §3.2.
 *
 * AO4 is exam-only (40% written paper, "Technical principles") and maps to
 * `analysing`. §5 rule 5: exam-only activities are tagged neutral + flagged.
 * Exposed via opts.context === "exam_prep" override below.
 */
import type { FrameworkMapping } from "../adapter";

const AO1 = { short: "AO1", full: "AO1", name: "Identify, investigate and outline design possibilities" };
const AO2 = { short: "AO2", full: "AO2", name: "Design and make prototypes that are fit for purpose" };
const AO3 = { short: "AO3", full: "AO3", name: "Analyse and evaluate design decisions and outcomes" };
const AO4 = { short: "AO4", full: "AO4", name: "Demonstrate and apply knowledge of technical principles" };

export const GCSE_MAPPING: FrameworkMapping = {
  frameworkId: "GCSE_DT",
  criteria: [
    { ...AO1, neutralKeys: ["researching"] },
    { ...AO2, neutralKeys: ["designing", "creating"] },
    { ...AO3, neutralKeys: ["analysing", "evaluating"] },
    { ...AO4, neutralKeys: ["analysing"] },
  ],
  reverse: {
    researching: { kind: "label", ...AO1 },
    analysing: { kind: "label", ...AO3 },
    designing: { kind: "label", ...AO2 },
    creating: { kind: "label", ...AO2 },
    evaluating: { kind: "label", ...AO3 },
    // Gap (§3.2 silent). GCSE folds reflection on decisions/outcomes into AO3.
    reflecting: {
      kind: "implicit",
      mappedTo: "evaluating",
      ...AO3,
      note: "GCSE folds reflection into AO3 'analyse and evaluate design decisions and outcomes'; not assessed as a standalone AO.",
    },
    // Gap (§3.2 silent). GCSE NEA portfolio communication is embedded in AO2 design+make documentation.
    communicating: {
      kind: "implicit",
      mappedTo: "designing",
      ...AO2,
      note: "GCSE NEA portfolio documentation is implicit in AO2 design and make; not assessed as a standalone AO.",
    },
    // Gap (§3.2 silent). Planning is implicit in AO2 design development (timeline, making plan).
    planning: {
      kind: "implicit",
      mappedTo: "designing",
      ...AO2,
      note: "GCSE planning (making schedule, resource plan) is implicit in AO2 design and make; not assessed as a standalone AO.",
    },
  },
  examPrep: {
    // §3.2: AO4 (40%, exam only) is theoretical analysing.
    analysing: { kind: "label", ...AO4 },
  },
};
