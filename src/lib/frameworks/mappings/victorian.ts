/**
 * Victorian Curriculum Design & Technologies mapping — 3 strands → 8 neutral keys.
 * Source: docs/specs/neutral-criterion-taxonomy.md §3.8.
 */
import type { FrameworkMapping } from "../adapter";

const TS = { short: "TS", full: "TS", name: "Technologies and Society" };
const TC = { short: "TC", full: "TC", name: "Technological Contexts" };
const CDS = { short: "CDS", full: "CDS", name: "Creating Design Solutions" };

export const VICTORIAN_MAPPING: FrameworkMapping = {
  frameworkId: "VIC_DT",
  criteria: [
    { ...TS, neutralKeys: ["analysing", "researching"] },
    { ...TC, neutralKeys: ["analysing"] },
    { ...CDS, neutralKeys: ["researching", "designing", "creating", "evaluating"] },
  ],
  reverse: {
    researching: { kind: "label", ...CDS },
    // TC is pure "properties of technologies/materials/systems" — analysing-dominant.
    // TODO: context-aware override candidate. TC (materials/properties) is the default primary
    // per the "exclusive key wins" heuristic, but system-level analysing (e.g. product ecosystems)
    // reads better as TS. If a future consumer needs context-aware selection, this is the first
    // cell to extend.
    analysing: { kind: "label", ...TC },
    designing: { kind: "label", ...CDS },
    creating: { kind: "label", ...CDS },
    evaluating: { kind: "label", ...CDS },
    // Gap (§3.8 silent). Victorian folds reflection into CDS evaluating.
    reflecting: {
      kind: "implicit",
      mappedTo: "evaluating",
      ...CDS,
      note: "Victorian folds reflection into CDS evaluating phase; not assessed as a standalone strand.",
    },
    // Gap (§3.8 silent). CDS generating includes communication of design ideas.
    communicating: {
      kind: "implicit",
      mappedTo: "designing",
      ...CDS,
      note: "Victorian communicating design ideas is implicit in CDS generating phase; not assessed as a standalone strand.",
    },
    // Gap (§3.8 silent). Planning sits within CDS producing and managing.
    planning: {
      kind: "implicit",
      mappedTo: "designing",
      ...CDS,
      note: "Victorian planning and managing is implicit in CDS producing phase; not assessed as a standalone strand.",
    },
  },
};
