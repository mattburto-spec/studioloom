/**
 * LIS.A — source-static guards for ActivityCard's key-callout dispatch.
 *
 * Per Lesson #38: assert specific wiring patterns are present, not just
 * generic "the file mentions KeyInformationCallout." If a future edit
 * accidentally drops the bullets-non-empty guard or stops passing the
 * intro/eyebrow props, these tests catch the regression.
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

describe("ActivityCard — key-callout dispatch (LIS.A)", () => {
  it("imports KeyInformationCallout from the lesson barrel", () => {
    expect(ACTIVITY_CARD_SRC).toMatch(
      /import\s*\{[^}]*KeyInformationCallout[^}]*\}\s*from\s*["']@\/components\/lesson["']/,
    );
  });

  it("computes isKeyCallout from contentStyle === 'key-callout' AND a non-empty bullets array", () => {
    expect(ACTIVITY_CARD_SRC).toContain('section.contentStyle === "key-callout"');
    // Both the array-shape guard and the non-empty guard must be present —
    // an orphan key-callout (no bullets) must NOT take this branch.
    expect(ACTIVITY_CARD_SRC).toMatch(/Array\.isArray\(section\.bullets\)/);
    expect(ACTIVITY_CARD_SRC).toMatch(/section\.bullets\.length\s*>\s*0/);
  });

  it("renders KeyInformationCallout when isKeyCallout is true", () => {
    expect(ACTIVITY_CARD_SRC).toMatch(
      /isKeyCallout\s*\?\s*\(\s*<KeyInformationCallout/,
    );
  });

  it("passes title (with bulletsTitle override → prompt fallback), eyebrow, intro, bullets", () => {
    const idx = ACTIVITY_CARD_SRC.indexOf("<KeyInformationCallout");
    expect(idx).toBeGreaterThan(0);
    const slice = ACTIVITY_CARD_SRC.slice(idx, idx + 400);
    expect(slice).toContain("title={section.bulletsTitle ?? section.prompt}");
    expect(slice).toContain("eyebrow={section.bulletsEyebrow}");
    expect(slice).toContain("intro={section.bulletsIntro}");
    expect(slice).toContain("bullets={section.bullets!}");
  });

  it("re-routes the legacy CONTENT_STYLE_CONFIG lookup so 'key-callout' doesn't crash on the orphan path", () => {
    // The lookup must coerce "key-callout" to "info" (a sensible fallback
    // for half-authored sections) before indexing the record — otherwise
    // an orphan key-callout would dereference undefined.
    expect(ACTIVITY_CARD_SRC).toMatch(
      /section\.contentStyle === "key-callout"\s*\?\s*"info"/,
    );
  });

  it("only takes the callout path on content-only sections (no responseType)", () => {
    // The isKeyCallout boolean must be gated on isContentOnly so the
    // callout path doesn't fire for activities that also have a response.
    expect(ACTIVITY_CARD_SRC).toMatch(/isKeyCallout\s*=\s*\n?\s*isContentOnly/);
  });
});

describe("ActivitySection — key-callout schema fields (LIS.A)", () => {
  it("ContentStyle union includes 'key-callout'", () => {
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
    // All four must be optional — adding required fields would break
    // every existing pageContent.sections row that doesn't have them.
    expect(TYPES_SRC).toContain("bullets?: CalloutBullet[]");
    expect(TYPES_SRC).toContain("bulletsTitle?: string | string[]");
    expect(TYPES_SRC).toContain("bulletsIntro?: string");
    expect(TYPES_SRC).toContain("bulletsEyebrow?: string");
  });
});
