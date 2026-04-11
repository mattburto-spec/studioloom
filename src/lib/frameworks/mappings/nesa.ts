/**
 * NESA NSW Design & Technology mapping — 3 outcomes → 8 neutral keys.
 * Source: docs/specs/neutral-criterion-taxonomy.md §3.7.
 *
 * Spec bug FU-C: §3.7 prose says "Ev — Evaluating: Testing, analysing,
 * reflecting on design solutions" — `analysing` is in the prose notes but
 * NOT in the Neutral Keys column. Treated here as explicit (EXPLICIT call
 * per 5.9 design-phase decision) pulling the label from the §3.7 prose.
 * Spec fix filed as FU-C for next saveme.
 */
import type { FrameworkMapping } from "../adapter";

const DP = { short: "DP", full: "DP", name: "Design Process" };
const PR = { short: "Pr", full: "Pr", name: "Producing" };
const EV = { short: "Ev", full: "Ev", name: "Evaluating" };

export const NESA_MAPPING: FrameworkMapping = {
  frameworkId: "NESA_DT",
  criteria: [
    { ...DP, neutralKeys: ["researching", "designing", "communicating"] },
    { ...PR, neutralKeys: ["creating", "planning"] },
    // FU-C: analysing added per §3.7 prose ("testing, analysing, reflecting").
    { ...EV, neutralKeys: ["evaluating", "reflecting", "analysing"] },
  ],
  reverse: {
    researching: { kind: "label", ...DP },
    // FU-C: §3.7 prose intent, omitted from Neutral Keys column — filed as spec bug FU-C.
    analysing: { kind: "label", ...EV },
    designing: { kind: "label", ...DP },
    creating: { kind: "label", ...PR },
    evaluating: { kind: "label", ...EV },
    reflecting: { kind: "label", ...EV },
    communicating: { kind: "label", ...DP },
    planning: { kind: "label", ...PR },
  },
};
