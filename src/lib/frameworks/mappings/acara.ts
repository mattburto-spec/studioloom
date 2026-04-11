/**
 * ACARA Design & Technologies mapping — 2 strands → 8 neutral keys.
 * Source: docs/specs/neutral-criterion-taxonomy.md §3.5.
 *
 * ACARA's broad 2-strand structure collapses many neutral keys into PPS.
 * Activity-level tagging is more granular than the strand structure (§3.5 note).
 */
import type { FrameworkMapping } from "../adapter";

const KU = { short: "KU", full: "KU", name: "Knowledge and Understanding" };
const PPS = { short: "PPS", full: "PPS", name: "Processes and Production Skills" };

export const ACARA_MAPPING: FrameworkMapping = {
  frameworkId: "ACARA_DT",
  criteria: [
    { ...KU, neutralKeys: ["analysing", "researching"] },
    { ...PPS, neutralKeys: ["researching", "designing", "creating", "evaluating"] },
  ],
  reverse: {
    researching: { kind: "label", ...PPS },
    analysing: { kind: "label", ...KU },
    designing: { kind: "label", ...PPS },
    creating: { kind: "label", ...PPS },
    evaluating: { kind: "label", ...PPS },
    // Gap (§3.5 silent). ACARA folds reflection into PPS evaluating phase.
    reflecting: {
      kind: "implicit",
      mappedTo: "evaluating",
      ...PPS,
      note: "ACARA folds reflection into PPS evaluating phase; not assessed as a standalone strand.",
    },
    // Gap (§3.5 silent). PPS "generating" implies communicating design ideas (spec §3.5 preferredVerbs includes communicate).
    communicating: {
      kind: "implicit",
      mappedTo: "designing",
      ...PPS,
      note: "ACARA communicating design ideas is implicit in PPS generating phase; not assessed as a standalone strand.",
    },
    // Gap (§3.5 silent). Project management lives in PPS producing.
    planning: {
      kind: "implicit",
      mappedTo: "designing",
      ...PPS,
      note: "ACARA planning and managing is implicit in PPS producing phase; not assessed as a standalone strand.",
    },
  },
};
