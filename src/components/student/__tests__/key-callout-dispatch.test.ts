/**
 * LIS.A.2 — source-static guards for ActivityCard's callout dispatch.
 *
 * Per Lesson #38: assert specific wiring patterns are present, not just
 * generic "the file mentions KeyInformationCallout." If a future edit
 * accidentally drops the contentStyle === "info" route, stops passing the
 * body fallback, or breaks the bullets-vs-prose branch, these catch it.
 *
 * Style mirrors structured-prompts-dispatch.test.ts (same directory):
 * read the source, assert specific patterns. Avoids the React render
 * thicket while still catching wiring regressions.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ACTIVITY_CARD_SRC = readFileSync(
  join(__dirname, "..", "ActivityCard.tsx"),
  "utf-8",
);

const TYPES_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "types", "index.ts"),
  "utf-8",
);

const CALLOUT_SRC = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "lesson",
    "KeyInformationCallout",
    "index.tsx",
  ),
  "utf-8",
);

describe("ActivityCard — callout dispatch (LIS.A.2)", () => {
  it("imports KeyInformationCallout from the lesson barrel", () => {
    expect(ACTIVITY_CARD_SRC).toMatch(
      /import\s*\{[^}]*KeyInformationCallout[^}]*\}\s*from\s*["']@\/components\/lesson["']/,
    );
  });

  it('routes BOTH contentStyle "info" AND "key-callout" through the new component', () => {
    expect(ACTIVITY_CARD_SRC).toContain('section.contentStyle === "info"');
    expect(ACTIVITY_CARD_SRC).toContain('section.contentStyle === "key-callout"');
    expect(ACTIVITY_CARD_SRC).toMatch(
      /isCalloutStyle\s*=[\s\S]{0,300}contentStyle === "info"[\s\S]{0,200}contentStyle === "key-callout"/,
    );
  });

  it("derives bullets only when the array is non-empty (orphan = undefined → body fallback)", () => {
    expect(ACTIVITY_CARD_SRC).toMatch(/Array\.isArray\(section\.bullets\)/);
    expect(ACTIVITY_CARD_SRC).toMatch(/section\.bullets\.length\s*>\s*0/);
    expect(ACTIVITY_CARD_SRC).toMatch(/calloutBullets\s*=[\s\S]{0,200}: undefined/);
  });

  it("renders KeyInformationCallout when isCalloutStyle is true", () => {
    expect(ACTIVITY_CARD_SRC).toMatch(
      /isCalloutStyle\s*\?\s*\(\s*<KeyInformationCallout/,
    );
  });

  it("passes title/eyebrow/intro/bullets to KeyInformationCallout", () => {
    const idx = ACTIVITY_CARD_SRC.indexOf("<KeyInformationCallout");
    expect(idx).toBeGreaterThan(0);
    const slice = ACTIVITY_CARD_SRC.slice(idx, idx + 600);
    expect(slice).toContain("title={calloutTitle}");
    expect(slice).toContain("eyebrow={section.bulletsEyebrow}");
    expect(slice).toContain("intro={section.bulletsIntro}");
    expect(slice).toContain("bullets={calloutBullets}");
  });

  it("LIS.A.3 — hoists section.framing to magazine title when bulletsTitle is absent (slot-fields only)", () => {
    // calloutTitle = bulletsTitle ?? (slot-fields && framing ? framing : undefined)
    expect(ACTIVITY_CARD_SRC).toMatch(
      /calloutTitle\s*=\s*\n?\s*section\.bulletsTitle\s*\?\?[\s\S]{0,200}section\.framing/,
    );
    // Hoist gates on slot fields presence — legacy single-prompt sections don't promote
    expect(ACTIVITY_CARD_SRC).toMatch(/sectionHasSlots\s*=[\s\S]{0,100}hasSlotFields\(section\)/);
  });

  it("LIS.A.3 — passes skipFraming to ComposedPrompt only when title was hoisted from framing", () => {
    expect(ACTIVITY_CARD_SRC).toMatch(/skipFramingInBody\s*=/);
    // skipFraming guard requires: calloutTitle truthy, NO bulletsTitle (so framing was the source), slot fields present, framing non-empty
    expect(ACTIVITY_CARD_SRC).toMatch(
      /skipFramingInBody\s*=[\s\S]{0,300}calloutTitle[\s\S]{0,100}!section\.bulletsTitle[\s\S]{0,100}sectionHasSlots[\s\S]{0,100}section\.framing/,
    );
    // ComposedPrompt receives the boolean
    const idx = ACTIVITY_CARD_SRC.indexOf("<ComposedPrompt");
    expect(idx).toBeGreaterThan(0);
    expect(ACTIVITY_CARD_SRC.slice(idx, idx + 400)).toContain(
      "skipFraming={skipFramingInBody}",
    );
  });

  it("falls back to <ComposedPrompt /> + media + links inside the body slot when bullets are missing", () => {
    const idx = ACTIVITY_CARD_SRC.indexOf("<KeyInformationCallout");
    const slice = ACTIVITY_CARD_SRC.slice(idx, idx + 1200);
    // body prop must be a React fragment carrying ComposedPrompt + media/links
    expect(slice).toMatch(/body=\{[\s\S]{0,400}<ComposedPrompt/);
    expect(slice).toMatch(/calloutBullets\s*\?\s*undefined/);
    expect(slice).toContain("<MediaBlock");
    expect(slice).toContain("<LinksBlock");
  });

  it("only takes the callout path on content-only sections (no responseType)", () => {
    expect(ACTIVITY_CARD_SRC).toMatch(/isCalloutStyle\s*=\s*\n?\s*isContentOnly/);
  });

  it("legacy CONTENT_STYLE_CONFIG path still serves warning/tip/context/activity/speaking/practical", () => {
    // The legacy lookup must skip when isCalloutStyle is true so info+key-callout
    // never double-render. Warning/tip/etc. still go through it.
    expect(ACTIVITY_CARD_SRC).toMatch(
      /isContentOnly\s*&&\s*!isCalloutStyle\s*\?\s*CONTENT_STYLE_CONFIG/,
    );
  });
});

describe("ComposedPrompt — skipFraming prop (LIS.A.3)", () => {
  const COMPOSED_SRC = readFileSync(
    join(__dirname, "..", "ComposedPrompt.tsx"),
    "utf-8",
  );

  it("declares the skipFraming optional prop", () => {
    expect(COMPOSED_SRC).toContain("skipFraming?: boolean");
  });

  it("destructures skipFraming with a false default", () => {
    expect(COMPOSED_SRC).toMatch(/skipFraming\s*=\s*false/);
  });

  it("gates the framing render on !skipFraming", () => {
    expect(COMPOSED_SRC).toMatch(/framing\s*&&\s*!skipFraming/);
  });
});

describe("KeyInformationCallout — bullets-or-body shape (LIS.A.2)", () => {
  it("makes title, bullets, and body all optional", () => {
    expect(CALLOUT_SRC).toContain("title?: string | string[]");
    expect(CALLOUT_SRC).toContain("bullets?: CalloutBullet[]");
    expect(CALLOUT_SRC).toContain("body?: React.ReactNode");
  });

  it("computes hasBullets from a non-empty array", () => {
    expect(CALLOUT_SRC).toMatch(/hasBullets\s*=\s*Array\.isArray\(bullets\)\s*&&\s*bullets\.length\s*>\s*0/);
  });

  it("renders the body slot in a single warm card when hasBullets is false", () => {
    // Single-card fallback: { body && <article ...> { body } </article> }
    expect(CALLOUT_SRC).toMatch(/hasBullets\s*\?[\s\S]{0,100}<div/);
    expect(CALLOUT_SRC).toMatch(/body\s*&&\s*\(\s*\n?\s*<article/);
  });
});

describe("ActivitySection — key-callout schema fields (LIS.A)", () => {
  it("ContentStyle union includes 'key-callout' (kept for back-compat with LIS.A)", () => {
    expect(TYPES_SRC).toMatch(
      /export type ContentStyle\s*=\s*[^;]*"key-callout"/,
    );
  });

  it("CalloutBullet interface exports term, body, optional hint", () => {
    expect(TYPES_SRC).toMatch(/export interface CalloutBullet\s*\{/);
    expect(TYPES_SRC).toMatch(/term:\s*string/);
    expect(TYPES_SRC).toMatch(/hint\?:\s*string/);
    expect(TYPES_SRC).toMatch(/body:\s*string/);
  });

  it("ActivitySection carries the four optional callout fields", () => {
    expect(TYPES_SRC).toContain("bullets?: CalloutBullet[]");
    expect(TYPES_SRC).toContain("bulletsTitle?: string | string[]");
    expect(TYPES_SRC).toContain("bulletsIntro?: string");
    expect(TYPES_SRC).toContain("bulletsEyebrow?: string");
  });
});
