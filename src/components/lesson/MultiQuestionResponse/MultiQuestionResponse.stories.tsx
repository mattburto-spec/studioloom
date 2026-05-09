/**
 * MultiQuestionResponse — preview fixtures.
 *
 * No Storybook in the project yet, so each export is a renderable React
 * element you can drop into a sandbox page (e.g. /dev/lesson-previews).
 * Covers the named acceptance states.
 */

import { MultiQuestionResponse, type MultiQuestionField, type MultiQuestionValues } from "./index";
import { LessonStepMarker } from "../shared";

const closingFields: MultiQuestionField[] = [
  {
    id: "do",
    label: "What did you DO?",
    helper: "Anti-fiction anchor. The gap between plan and reality is itself evidence.",
    placeholder: "What you actually did — not what you planned. Be specific.",
    target: 80,
    max: 400,
    criterion: "DO",
    starters: ["I started by…", "Instead of X, I tried…", "The step I actually finished was…"],
  },
  {
    id: "notice",
    label: "What did you NOTICE?",
    helper: "Look for surprises, friction, and small wins.",
    placeholder: "Something that caught your attention while making.",
    target: 80,
    max: 400,
    criterion: "NOTICE",
    starters: ["I noticed…", "What surprised me was…", "I kept getting stuck on…"],
  },
  {
    id: "decide",
    label: "What did you DECIDE?",
    helper: "Causation: what choice did you make, and why?",
    placeholder: "A decision you made, and the because-clause behind it.",
    target: 80,
    max: 400,
    criterion: "DECIDE",
    starters: ["I decided to…", "I chose X because…", "I rejected Y because…"],
  },
  {
    id: "next",
    label: "What's NEXT?",
    helper: "One concrete action for next session.",
    placeholder: "A specific next step, small enough to start in 2 minutes.",
    target: 60,
    max: 400,
    criterion: "NEXT",
    starters: ["Next session I'll…", "Before next time I need to…", "I'll try…"],
  },
];

const noop = (_: MultiQuestionValues) => {};

/** Empty state — first step focused, nothing typed. */
export const Empty = (
  <div style={{ background: "#F5F0E8", padding: 32 }}>
    <LessonStepMarker step={6} />
    <div style={{ marginTop: 24 }}>
      <MultiQuestionResponse fields={closingFields} onSave={noop} onSubmit={noop} />
    </div>
  </div>
);

/** Partially-filled — first step has some text, below target. */
export const PartiallyFilled = (
  <div style={{ background: "#F5F0E8", padding: 32 }}>
    <MultiQuestionResponse
      fields={closingFields}
      initialValues={{ do: "I started by sketching three layouts." }}
      onSave={noop}
      onSubmit={noop}
    />
  </div>
);

/** Target met — first step has enough characters; ring should be green + check. */
export const TargetMet = (
  <div style={{ background: "#F5F0E8", padding: 32 }}>
    <MultiQuestionResponse
      fields={closingFields}
      initialValues={{
        do: "I started by sketching three layouts on the iPad, then exported the strongest one to Figma. I rebuilt the spacing in 8px increments and printed a paper proof to test against the brief.",
      }}
      onSave={noop}
      onSubmit={noop}
    />
  </div>
);

/** All steps complete — the final step's button reads "Submit reflection". */
export const ReadyToSubmit = (
  <div style={{ background: "#F5F0E8", padding: 32 }}>
    <MultiQuestionResponse
      fields={closingFields}
      initialValues={{
        do: "I sketched three layouts, picked the strongest, and rebuilt it in Figma using an 8px grid. The print proof revealed the body text was sized for screen, not paper.",
        notice: "The biggest surprise was how different the paper proof felt vs the screen mockup — the headline was too loud at A4.",
        decide: "I decided to drop the headline weight from 800 to 600 because the proof showed it was overpowering the supporting copy.",
        next: "Next session I'll print the second proof and mark it up against the brief checklist.",
      }}
      onSave={noop}
      onSubmit={noop}
    />
  </div>
);

/** Error-on-save — the SaveIndicator can show an error tone (no UI scaffold for triggering it from the story). */
export const SaveError = (
  <div style={{ background: "#F5F0E8", padding: 32 }}>
    <MultiQuestionResponse
      fields={closingFields}
      onSave={() => {
        throw new Error("Network unavailable");
      }}
      onSubmit={noop}
    />
  </div>
);

/** Narrow viewport — the stepper segments shrink, chips wrap. */
export const Narrow = (
  <div style={{ background: "#F5F0E8", padding: 32, maxWidth: 1024 }}>
    <MultiQuestionResponse fields={closingFields} onSave={noop} onSubmit={noop} />
  </div>
);

/** Standard viewport. */
export const Standard = (
  <div style={{ background: "#F5F0E8", padding: 32, maxWidth: 1280 }}>
    <MultiQuestionResponse fields={closingFields} onSave={noop} onSubmit={noop} />
  </div>
);
