/**
 * LIS.D — source-static guards for the lesson-editor authoring surfaces:
 *   - promptsLayout toggle on structured-prompts sections (ActivityBlock)
 *   - JOURNAL_PROMPTS preset has criterion tags (DO/NOTICE/DECIDE/NEXT)
 *   - Process Journal palette entry defaults to promptsLayout: "stepper"
 *   - KeyCalloutEditor wired into ActivityBlock for callout-shaped sections
 *   - "Magazine callout" palette entry creates a key-callout block with
 *     pre-filled bullets
 *
 * Mirrors the source-static convention used elsewhere in this directory
 * (key-callout-dispatch, rich-text-response-dispatch, multi-question-
 * stepper-dispatch). Catches wiring regressions without the React render
 * thicket.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ACTIVITY_BLOCK_SRC = readFileSync(
  join(__dirname, "..", "ActivityBlock.tsx"),
  "utf-8",
);

const BLOCK_PALETTE_SRC = readFileSync(
  join(__dirname, "..", "BlockPalette.tsx"),
  "utf-8",
);

const PRESETS_SRC = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "lib",
    "structured-prompts",
    "presets.ts",
  ),
  "utf-8",
);

const KEY_CALLOUT_EDITOR_SRC = readFileSync(
  join(__dirname, "..", "KeyCalloutEditor.tsx"),
  "utf-8",
);

describe("ActivityBlock — promptsLayout stepper toggle (LIS.D)", () => {
  it("renders the stepper toggle only for responseType === 'structured-prompts'", () => {
    expect(ACTIVITY_BLOCK_SRC).toMatch(
      /responseType === "structured-prompts" && \(/,
    );
  });

  it("toggle reads from activity.promptsLayout and writes 'stepper' or undefined", () => {
    expect(ACTIVITY_BLOCK_SRC).toContain(
      'checked={activity.promptsLayout === "stepper"}',
    );
    expect(ACTIVITY_BLOCK_SRC).toContain(
      "promptsLayout: e.target.checked ? \"stepper\" : undefined",
    );
  });
});

describe("ActivityBlock — KeyCalloutEditor wiring (LIS.D)", () => {
  it("imports KeyCalloutEditor from the local module", () => {
    expect(ACTIVITY_BLOCK_SRC).toMatch(
      /import\s*\{\s*KeyCalloutEditor\s*\}\s*from\s*["']\.\/KeyCalloutEditor["']/,
    );
  });

  it("renders KeyCalloutEditor only on content-only sections with callout-shaped contentStyle", () => {
    // The condition gates on:
    //   !activity.responseType  (content-only — no response slot)
    //   AND (contentStyle === "info" OR contentStyle === "key-callout")
    expect(ACTIVITY_BLOCK_SRC).toMatch(
      /!activity\.responseType\s*&&[\s\S]{0,200}activity\.contentStyle === "info"[\s\S]{0,100}activity\.contentStyle === "key-callout"/,
    );
    expect(ACTIVITY_BLOCK_SRC).toMatch(
      /<KeyCalloutEditor\s+activity=\{activity\}\s+onUpdate=\{onUpdate\}\s*\/>/,
    );
  });
});

describe("KeyCalloutEditor — authoring surface (LIS.D)", () => {
  it("exposes inputs for eyebrow / title / intro / bullets[] (term + hint + body)", () => {
    expect(KEY_CALLOUT_EDITOR_SRC).toContain("bulletsEyebrow");
    expect(KEY_CALLOUT_EDITOR_SRC).toContain("bulletsTitle");
    expect(KEY_CALLOUT_EDITOR_SRC).toContain("bulletsIntro");
    expect(KEY_CALLOUT_EDITOR_SRC).toContain("term");
    expect(KEY_CALLOUT_EDITOR_SRC).toContain("hint");
    expect(KEY_CALLOUT_EDITOR_SRC).toContain("body");
  });

  it("title input parses newlines into a string[] (one-word-per-line magazine rhythm)", () => {
    // parseTitleInput collapses single line → string, multi-line → string[].
    // Single-line collapse keeps the JSONB tidy; without it every title
    // would persist as a 1-element array.
    expect(KEY_CALLOUT_EDITOR_SRC).toMatch(/parseTitleInput/);
    expect(KEY_CALLOUT_EDITOR_SRC).toMatch(
      /lines\.length === 1[\s\S]{0,100}return lines\[0\]/,
    );
    expect(KEY_CALLOUT_EDITOR_SRC).toMatch(/return lines/);
  });

  it("addBullet/removeBullet preserve immutability (return new arrays)", () => {
    expect(KEY_CALLOUT_EDITOR_SRC).toMatch(/onUpdate\(\{\s*bullets:\s*\[\.\.\.bullets,\s*emptyBullet\(\)\]/);
    expect(KEY_CALLOUT_EDITOR_SRC).toMatch(/bullets\.filter\(/);
  });
});

describe("JOURNAL_PROMPTS — criterion tags applied (LIS.D)", () => {
  it('"did" → DO, "noticed" → NOTICE, "decided" → DECIDE, "next" → NEXT', () => {
    expect(PRESETS_SRC).toMatch(/id:\s*"did"[\s\S]{0,400}criterion:\s*"DO"/);
    expect(PRESETS_SRC).toMatch(/id:\s*"noticed"[\s\S]{0,400}criterion:\s*"NOTICE"/);
    expect(PRESETS_SRC).toMatch(/id:\s*"decided"[\s\S]{0,400}criterion:\s*"DECIDE"/);
    expect(PRESETS_SRC).toMatch(/id:\s*"next"[\s\S]{0,400}criterion:\s*"NEXT"/);
  });
});

describe("BlockPalette — Process Journal defaults to stepper (LIS.D)", () => {
  it("Process Journal create() sets promptsLayout: 'stepper'", () => {
    // Match against the palette ENTRY (id: "process-journal") rather than
    // the descriptive comment string above it — the comment block adds
    // hundreds of chars and pushes the actual create() out of any narrow
    // window we set.
    const idx = BLOCK_PALETTE_SRC.indexOf('id: "process-journal"');
    expect(idx).toBeGreaterThan(0);
    const slice = BLOCK_PALETTE_SRC.slice(idx, idx + 1200);
    expect(slice).toContain('promptsLayout: "stepper" as const');
  });
});

describe("BlockPalette — Magazine Callout palette entry (LIS.D)", () => {
  it("declares a magazine-callout entry with contentStyle: 'key-callout'", () => {
    expect(BLOCK_PALETTE_SRC).toContain('id: "magazine-callout"');
    expect(BLOCK_PALETTE_SRC).toContain('contentStyle: "key-callout" as const');
  });

  it("magazine-callout entry pre-fills 3 sample bullets and a 3-line title array", () => {
    const idx = BLOCK_PALETTE_SRC.indexOf('id: "magazine-callout"');
    const slice = BLOCK_PALETTE_SRC.slice(idx, idx + 1200);
    expect(slice).toContain("bulletsTitle:");
    // Three-card sample so the teacher sees the layout immediately
    expect(slice).toContain('term: "Choice"');
    expect(slice).toContain('term: "Causation"');
    expect(slice).toContain('term: "Change"');
  });
});
