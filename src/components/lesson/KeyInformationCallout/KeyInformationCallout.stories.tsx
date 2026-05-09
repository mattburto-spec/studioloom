/**
 * KeyInformationCallout — preview fixtures. Read-only surface, so the
 * variation is mostly content shape: title-as-array vs string, with/without
 * intro, custom palette, narrow vs standard viewport.
 */

import { KeyInformationCallout, type CalloutPalette } from "./index";
import { LessonStepMarker } from "../shared";

const threeCs = [
  {
    term: "Choice",
    hint: "autonomy",
    body: "You decide what to do next, when to do it, and how. You don't wait to be told.",
  },
  {
    term: "Causation",
    hint: "because-clauses",
    body: 'You can explain why you made each choice. "I sanded with 220 because 80 was leaving deep scratches" is causation. "I sanded because I was supposed to" isn\'t.',
  },
  {
    term: "Change",
    hint: "iteration",
    body: "You expect your plan to change as you learn. Changing the plan based on evidence is the work — not a sign you got it wrong the first time.",
  },
];

export const ThreeCs = (
  <div style={{ background: "#F5F0E8", padding: 32 }}>
    <LessonStepMarker step={2} />
    <div style={{ marginTop: 24 }}>
      <KeyInformationCallout
        title={["The", "Three", "Cs."]}
        intro="Every survey, every journal entry, every check-in comes back to these three. Memorise them, and the rest of the unit gets easier."
        bullets={threeCs}
      />
    </div>
  </div>
);

/** Single-line title — no array. */
export const SingleLineTitle = (
  <div style={{ background: "#F5F0E8", padding: 32 }}>
    <KeyInformationCallout
      title="The Three Cs."
      intro="Every survey, every journal entry, every check-in comes back to these three."
      bullets={threeCs}
    />
  </div>
);

/** No intro paragraph — title only above bullets. */
export const NoIntro = (
  <div style={{ background: "#F5F0E8", padding: 32 }}>
    <KeyInformationCallout title={["The", "Three", "Cs."]} bullets={threeCs} />
  </div>
);

/** Custom palette — green-spine for a different unit. */
const greenSpine: CalloutPalette[] = [
  { bg: "#E8F5EC", edge: "#2DA05E", ink: "#0F4023" },
  { bg: "#DEF1E5", edge: "#1F8A4D", ink: "#0B331C" },
  { bg: "#FFF7DB", edge: "#E8B400", ink: "#5A3F00" },
];

export const CustomPalette = (
  <div style={{ background: "#F5F0E8", padding: 32 }}>
    <KeyInformationCallout
      title={["Three", "Lenses."]}
      intro="A different unit, a different palette."
      bullets={[
        { term: "Empathy", hint: "user lens", body: "Start with what the user feels, not what the brief says." },
        { term: "Evidence", hint: "data lens", body: "Decisions follow from evidence — not the other way round." },
        { term: "Edge", hint: "constraint lens", body: "Constraints are the friend of design. Lean into the hardest one first." },
      ]}
      palette={greenSpine}
    />
  </div>
);

/** Four bullets — palette repeats. */
export const FourBullets = (
  <div style={{ background: "#F5F0E8", padding: 32 }}>
    <KeyInformationCallout
      title={["Four", "Anchors."]}
      bullets={[
        ...threeCs,
        { term: "Continuity", hint: "thread", body: "Every session connects back to the last one — that's how a unit becomes a story." },
      ]}
    />
  </div>
);

export const Narrow = (
  <div style={{ background: "#F5F0E8", padding: 32, maxWidth: 1024 }}>
    <KeyInformationCallout title={["The", "Three", "Cs."]} intro="Every survey…" bullets={threeCs} />
  </div>
);

export const Standard = (
  <div style={{ background: "#F5F0E8", padding: 32, maxWidth: 1280 }}>
    <KeyInformationCallout title={["The", "Three", "Cs."]} intro="Every survey…" bullets={threeCs} />
  </div>
);
