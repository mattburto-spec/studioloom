/**
 * A-Level Design & Technology mapping — 3 components → 8 neutral keys.
 * Source: docs/specs/neutral-criterion-taxonomy.md §3.3.
 *
 * C1 and C2 are exam-only; C3 (NEA) is the full design cycle.
 * analysing has no NEA home in A-Level (§3.3 C3 does NOT list analysing);
 * default label returns C1 (pure technical principles). exam_prep returns C2.
 */
import type { FrameworkMapping } from "../adapter";

const C1 = { short: "C1", full: "C1", name: "Technical Principles" };
const C2 = { short: "C2", full: "C2", name: "Designing and Making Principles" };
const C3 = { short: "C3", full: "C3", name: "Design and Make Task (NEA)" };

export const A_LEVEL_MAPPING: FrameworkMapping = {
  frameworkId: "A_LEVEL_DT",
  criteria: [
    { ...C1, neutralKeys: ["analysing"] },
    { ...C2, neutralKeys: ["analysing", "designing"] },
    { ...C3, neutralKeys: ["researching", "designing", "creating", "evaluating"] },
  ],
  reverse: {
    researching: { kind: "label", ...C3 },
    // §3.3: analysing lives only in C1/C2 (exam-only). C1 is primary (pure technical).
    analysing: { kind: "label", ...C1 },
    designing: { kind: "label", ...C3 },
    creating: { kind: "label", ...C3 },
    evaluating: { kind: "label", ...C3 },
    // Gap (§3.3 silent). A-Level NEA folds reflection into C3 evaluation.
    reflecting: {
      kind: "implicit",
      mappedTo: "evaluating",
      ...C3,
      note: "A-Level folds reflection into C3 evaluation phase; not assessed as a standalone component.",
    },
    // Gap (§3.3 silent). NEA design folder is communication-heavy but rolled into C3 designing.
    communicating: {
      kind: "implicit",
      mappedTo: "designing",
      ...C3,
      note: "A-Level NEA design folder documentation is implicit in C3 designing; not assessed as a standalone component.",
    },
    // Gap (§3.3 silent). Planning sits within C3 designing + making workflow.
    planning: {
      kind: "implicit",
      mappedTo: "designing",
      ...C3,
      note: "A-Level planning (timeline, manufacturing sequence) is implicit in C3 design and make; not assessed as a standalone component.",
    },
  },
  examPrep: {
    // §3.3: C2 is the applied-knowledge exam paper (analysing + designing).
    analysing: { kind: "label", ...C2 },
    designing: { kind: "label", ...C2 },
  },
};
