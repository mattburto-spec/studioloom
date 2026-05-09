/**
 * RichTextResponse — preview fixtures. Mirror the storybook states named in
 * the spec: empty, partially-filled, target-met (a target threshold isn't
 * formally part of this surface but the parent caller may signal "good
 * length" — included as a longer fixture for parity), error, narrow, standard.
 */

import { RichTextResponse } from "./index";
import { LessonStepMarker } from "../shared";

const noop = (_: string) => {};

const prompt = {
  eyebrow: "Co-construct definition",
  heading: "In your own words: what does AGENCY mean for the next 7 weeks of design? Pair-share with the person next to you, then write your own definition.",
  placeholder: "Start with: 'Agency means…' and write at least two sentences. Use your own example.",
};

export const Empty = (
  <div style={{ background: "#F5F0E8", padding: 32 }}>
    <LessonStepMarker step={1} />
    <div style={{ marginTop: 24 }}>
      <RichTextResponse prompt={prompt} onSave={noop} />
    </div>
  </div>
);

export const PartiallyFilled = (
  <div style={{ background: "#F5F0E8", padding: 32 }}>
    <RichTextResponse
      prompt={prompt}
      initialHTML="<p>Agency means deciding what to do next without waiting to be told.</p>"
      onSave={noop}
    />
  </div>
);

export const Long = (
  <div style={{ background: "#F5F0E8", padding: 32 }}>
    <RichTextResponse
      prompt={prompt}
      initialHTML={`<p><strong>Agency means</strong> deciding what to do next, when to do it, and how — without waiting to be told.</p><p>For the next 7 weeks, that looks like:</p><ul><li>Choosing my own next step at the start of every session.</li><li>Saying <em>why</em> I picked it.</li><li>Changing my plan when something isn't working.</li></ul>`}
      onSave={noop}
    />
  </div>
);

export const SaveError = (
  <div style={{ background: "#F5F0E8", padding: 32 }}>
    <RichTextResponse
      prompt={prompt}
      onSave={() => {
        throw new Error("Network unavailable");
      }}
    />
  </div>
);

export const Narrow = (
  <div style={{ background: "#F5F0E8", padding: 32, maxWidth: 1024 }}>
    <RichTextResponse prompt={prompt} onSave={noop} />
  </div>
);

export const Standard = (
  <div style={{ background: "#F5F0E8", padding: 32, maxWidth: 1280 }}>
    <RichTextResponse prompt={prompt} onSave={noop} />
  </div>
);
