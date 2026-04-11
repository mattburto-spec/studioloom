/**
 * IB MYP Design mapping — 4 criteria → 8 neutral keys.
 * Source: docs/specs/neutral-criterion-taxonomy.md §3.1 (has explicit reverse table).
 */
import type { FrameworkMapping } from "../adapter";

const A = { short: "A", full: "Criterion A", name: "Inquiring and Analysing" };
const B = { short: "B", full: "Criterion B", name: "Developing Ideas" };
const C = { short: "C", full: "Criterion C", name: "Creating the Solution" };
const D = { short: "D", full: "Criterion D", name: "Evaluating" };

export const MYP_MAPPING: FrameworkMapping = {
  frameworkId: "IB_MYP",
  criteria: [
    { ...A, neutralKeys: ["researching", "analysing"] },
    { ...B, neutralKeys: ["designing", "planning"] },
    { ...C, neutralKeys: ["creating", "planning"] },
    { ...D, neutralKeys: ["evaluating", "reflecting"] },
  ],
  reverse: {
    researching: { kind: "label", ...A },
    analysing: { kind: "label", ...A },
    designing: { kind: "label", ...B },
    creating: { kind: "label", ...C },
    evaluating: { kind: "label", ...D },
    reflecting: { kind: "label", ...D },
    // §3.1 reverse table: "communicating — (implicit across all) | A, D".
    // §5 rule 6: implicit communication is not tagged at the activity level.
    // Rendered via Criterion A (design brief / research report) as the most
    // common MYP communication context.
    communicating: {
      kind: "implicit",
      mappedTo: "researching",
      ...A,
      note: "MYP treats communicating as implicit across all criteria (§3.1 reverse table); rendered via Criterion A context. §5 rule 6: not tagged at activity level.",
    },
    planning: { kind: "label", ...C },
  },
};
