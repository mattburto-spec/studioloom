/**
 * Tap-a-word wiring for the LIS components.
 *
 * Bug surfaced post-LIS.E smoke: the magazine-callout bullet bodies +
 * intro + the stepper field.helper rendered as plain text, so students
 * couldn't tap individual words for dictionary lookups. The legacy
 * info-block path already wired tap-a-word via
 * ActivityCard → ComposedPrompt → MarkdownPrompt(tappable). The new
 * surfaces had to opt in explicitly.
 *
 * Fix: both components render student-visible prose through
 * MarkdownPrompt with `tappable` forwarded (default true). Storybook
 * usage can opt out via tappable={false}.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const CALLOUT_SRC = readFileSync(
  join(__dirname, "..", "KeyInformationCallout", "index.tsx"),
  "utf-8",
);

const STEPPER_SRC = readFileSync(
  join(__dirname, "..", "MultiQuestionResponse", "index.tsx"),
  "utf-8",
);

describe("KeyInformationCallout — tap-a-word wiring", () => {
  it("imports MarkdownPrompt from the student module", () => {
    expect(CALLOUT_SRC).toMatch(
      /import\s*\{\s*MarkdownPrompt\s*\}\s*from\s*["']@\/components\/student\/MarkdownPrompt["']/,
    );
  });

  it("declares an optional tappable prop with a default of true", () => {
    expect(CALLOUT_SRC).toContain("tappable?: boolean");
    expect(CALLOUT_SRC).toMatch(/tappable\s*=\s*true/);
  });

  it("renders intro text via MarkdownPrompt with the tappable prop forwarded", () => {
    expect(CALLOUT_SRC).toMatch(
      /<MarkdownPrompt\s+text=\{intro\}\s+tappable=\{tappable\}/,
    );
  });

  it("renders each bullet body via MarkdownPrompt with the tappable prop forwarded", () => {
    expect(CALLOUT_SRC).toMatch(
      /<MarkdownPrompt\s+text=\{b\.body\}\s+tappable=\{tappable\}/,
    );
  });
});

describe("MultiQuestionResponse — tap-a-word wiring", () => {
  it("imports MarkdownPrompt from the student module", () => {
    expect(STEPPER_SRC).toMatch(
      /import\s*\{\s*MarkdownPrompt\s*\}\s*from\s*["']@\/components\/student\/MarkdownPrompt["']/,
    );
  });

  it("declares an optional tappable prop with a default of true", () => {
    expect(STEPPER_SRC).toContain("tappable?: boolean");
    expect(STEPPER_SRC).toMatch(/tappable\s*=\s*true/);
  });

  it("renders field.helper via MarkdownPrompt with the tappable prop forwarded", () => {
    expect(STEPPER_SRC).toMatch(
      /<MarkdownPrompt\s+text=\{field\.helper\}\s+tappable=\{tappable\}/,
    );
  });
});
