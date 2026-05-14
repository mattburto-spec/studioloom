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

const LESSON_INTRO_SRC = readFileSync(
  join(__dirname, "..", "LessonIntroEditor.tsx"),
  "utf-8",
);

const KEY_CALLOUT_SRC = readFileSync(
  join(__dirname, "..", "KeyCalloutEditor.tsx"),
  "utf-8",
);

const RICH_TEXTAREA_SRC = readFileSync(
  join(__dirname, "..", "RichTextarea.tsx"),
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

  it("title input commits parsed value on blur — newlines split to string[], single line stays string", () => {
    // commitTitle collapses single line → string, multi-line → string[].
    // Single-line collapse keeps the JSONB tidy; without it every title
    // would persist as a 1-element array.
    expect(KEY_CALLOUT_EDITOR_SRC).toMatch(/commitTitle/);
    expect(KEY_CALLOUT_EDITOR_SRC).toMatch(
      /lines\.length === 1[\s\S]{0,100}return lines\[0\]/,
    );
    expect(KEY_CALLOUT_EDITOR_SRC).toMatch(/return lines/);
  });

  it("title textarea uses a local draft synced on blur — preserves spaces and newlines mid-edit", () => {
    // Without the draft, parsing on every onChange strips trailing
    // whitespace and clears empty lines, making it impossible to type
    // "Test Title" because the space gets clobbered before "T" lands.
    expect(KEY_CALLOUT_EDITOR_SRC).toMatch(/titleDraft/);
    expect(KEY_CALLOUT_EDITOR_SRC).toMatch(/setTitleDraft\(e\.target\.value\)/);
    expect(KEY_CALLOUT_EDITOR_SRC).toMatch(
      /onBlur=\{\(\)\s*=>\s*onUpdate\(\{\s*bulletsTitle:\s*commitTitle\(titleDraft\)/,
    );
  });

  it("addBullet/removeBullet preserve immutability (return new arrays)", () => {
    expect(KEY_CALLOUT_EDITOR_SRC).toMatch(/onUpdate\(\{\s*bullets:\s*\[\.\.\.bullets,\s*emptyBullet\(\)\]/);
    expect(KEY_CALLOUT_EDITOR_SRC).toMatch(/bullets\.filter\(/);
  });
});

describe("JOURNAL_PROMPTS — criterion tags applied (LIS.D)", () => {
  // Note: source-static check; the {0,N} window keeps each id tied to
  // its criterion within the same object literal. Bumped 400 → 800 on
  // 13 May 2026 after adding sentenceStarters + targetChars to
  // JOURNAL_PROMPTS pushed the criterion past the original window. The
  // BEHAVIORAL equivalent lives in src/lib/structured-prompts/__tests__/
  // presets.test.ts ('keeps criterion tags ...') — that import-based
  // check is the canonical version. This source-static one is kept as a
  // belt + suspenders catch for accidental commenting-out.
  it('"did" → DO, "noticed" → NOTICE, "decided" → DECIDE, "next" → NEXT', () => {
    expect(PRESETS_SRC).toMatch(/id:\s*"did"[\s\S]{0,800}criterion:\s*"DO"/);
    expect(PRESETS_SRC).toMatch(/id:\s*"noticed"[\s\S]{0,800}criterion:\s*"NOTICE"/);
    expect(PRESETS_SRC).toMatch(/id:\s*"decided"[\s\S]{0,800}criterion:\s*"DECIDE"/);
    expect(PRESETS_SRC).toMatch(/id:\s*"next"[\s\S]{0,800}criterion:\s*"NEXT"/);
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

describe("ActivityBlock — per-prompt editor for structured-prompts", () => {
  // Lets teachers customise label / placeholder / helper / required
  // on each prompt of a Process Journal (or any structured-prompts)
  // block. Edits affect only that section; presets remain the
  // authored defaults at block-creation time.
  it("imports StructuredPrompt from the local types module", () => {
    expect(ACTIVITY_BLOCK_SRC).toMatch(
      /import\s+type\s*\{\s*StructuredPrompt\s*\}\s*from\s*["']@\/lib\/structured-prompts\/types["']/,
    );
  });

  it("exposes an updatePromptAt helper that immutably patches activity.prompts[index]", () => {
    expect(ACTIVITY_BLOCK_SRC).toContain("updatePromptAt");
    // Immutability check: maps over current array, replaces only the
    // target index. Catches accidental in-place mutation.
    expect(ACTIVITY_BLOCK_SRC).toMatch(
      /current\.map\(\(p,\s*i\)\s*=>\s*\(i === index\s*\?\s*\{\s*\.\.\.p,\s*\.\.\.patch\s*\}\s*:\s*p\)\)/,
    );
    expect(ACTIVITY_BLOCK_SRC).toContain("onUpdate({ prompts: next })");
  });

  it("renders the editor only when responseType === 'structured-prompts' AND prompts has length", () => {
    // Both clauses gate the block — the .length > 0 check prevents
    // rendering an empty section on legacy blocks without prompts[].
    expect(ACTIVITY_BLOCK_SRC).toMatch(
      /responseType === "structured-prompts" &&\s*\n\s*activity\.prompts &&\s*\n\s*activity\.prompts\.length > 0/,
    );
  });

  it("renders an input for each prompt's label, placeholder, helper, and required flag", () => {
    // label → text input, placeholder → textarea, helper → text input,
    // required → checkbox. All routed through updatePromptAt(i, patch).
    expect(ACTIVITY_BLOCK_SRC).toContain("updatePromptAt(i, { label: e.target.value })");
    expect(ACTIVITY_BLOCK_SRC).toContain(
      "updatePromptAt(i, {\n                                placeholder: e.target.value || undefined,",
    );
    expect(ACTIVITY_BLOCK_SRC).toContain(
      "updatePromptAt(i, {\n                                helper: e.target.value || undefined,",
    );
    expect(ACTIVITY_BLOCK_SRC).toContain(
      "updatePromptAt(i, { required: e.target.checked })",
    );
  });

  it("displays the prompt's criterion tag (DO/NOTICE/DECIDE/NEXT) when present", () => {
    // Stepper mode reads criterion to drive accent colour — surfacing
    // it in the editor lets the teacher see which slot is which.
    expect(ACTIVITY_BLOCK_SRC).toMatch(
      /\{prompt\.criterion && \(/,
    );
  });
});

describe("RichTextarea — convenience wrapper for toolbar + textarea", () => {
  it("renders MarkdownToolbar above a controlled textarea sharing one ref", () => {
    // The wrapper owns the ref so callers don't have to. Same render
    // order as the manual SlotFieldEditor wiring: toolbar above, then
    // textarea. The toolbar uses the textareaRef to scope its
    // selection operations to the textarea below it.
    expect(RICH_TEXTAREA_SRC).toMatch(
      /import\s*\{\s*MarkdownToolbar\s*\}\s*from\s*["']\.\/MarkdownToolbar["']/,
    );
    expect(RICH_TEXTAREA_SRC).toMatch(
      /useRef<HTMLTextAreaElement \| null>\(null\)/,
    );
    expect(RICH_TEXTAREA_SRC).toMatch(
      /<MarkdownToolbar[\s\S]{0,200}textareaRef=\{ref\}/,
    );
  });

  it("forwards textarea props (placeholder / rows / className) via spread", () => {
    // PassthroughTextareaProps omits value / onChange / ref but keeps
    // everything else — callers can drop the wrapper in where a plain
    // <textarea> sat without changing styling props.
    expect(RICH_TEXTAREA_SRC).toMatch(/\{\.\.\.textareaProps\}/);
  });

  it("supports hiding the toolbar via showToolbar={false}", () => {
    // Escape hatch — useful when a parent surface already shows
    // formatting cues elsewhere, or when the textarea holds raw data
    // that should not be markdown-wrapped.
    expect(RICH_TEXTAREA_SRC).toContain("showToolbar = true");
    expect(RICH_TEXTAREA_SRC).toMatch(/\{showToolbar && \(/);
  });
});

describe("LessonIntroEditor — RichTextarea on Why this matters", () => {
  it("imports RichTextarea from the sibling module", () => {
    expect(LESSON_INTRO_SRC).toMatch(
      /import\s*\{\s*RichTextarea\s*\}\s*from\s*["']\.\/RichTextarea["']/,
    );
  });

  it("Why this matters textarea is now a RichTextarea wired to updateIntroText", () => {
    // The introText field is the highest-traffic prose in the lesson
    // intro — same markdown pipeline as activity prompts (react-
    // markdown allow-list), so it gets the same toolbar.
    expect(LESSON_INTRO_SRC).toMatch(
      /<RichTextarea[\s\S]{0,200}value=\{introText\}[\s\S]{0,200}onChange=\{updateIntroText\}/,
    );
  });

  it("Why this matters textarea is now ≥ 5 rows and user-resizable", () => {
    // Bumped from rows=3 after Matt's screenshot showed content
    // clipping below the visible area. resize-y lets the teacher drag
    // for more space without us having to ship autogrow JS.
    expect(LESSON_INTRO_SRC).toMatch(
      /<RichTextarea[\s\S]{0,400}rows=\{5\}[\s\S]{0,300}resize-y/,
    );
  });

  it("Success criteria textarea is also resizable (but no toolbar — list per line)", () => {
    // Success criteria are stored as string[] split on \n — each line
    // is a discrete I-can statement. Markdown formatting per line
    // would be semantically odd, so toolbar stays off. resize-y still
    // applies so teachers can author longer lists.
    expect(LESSON_INTRO_SRC).toMatch(
      /value=\{successCriteriaText\}[\s\S]{0,400}rows=\{5\}[\s\S]{0,300}resize-y/,
    );
  });
});

describe("KeyCalloutEditor — RichTextarea on intro + bullet bodies", () => {
  it("imports RichTextarea from the sibling module", () => {
    expect(KEY_CALLOUT_SRC).toMatch(
      /import\s*\{\s*RichTextarea\s*\}\s*from\s*["']\.\/RichTextarea["']/,
    );
  });

  it("bulletsIntro textarea is now a RichTextarea writing through onUpdate", () => {
    expect(KEY_CALLOUT_SRC).toMatch(
      /<RichTextarea[\s\S]{0,400}value=\{activity\.bulletsIntro \?\? ""\}[\s\S]{0,400}onChange=\{\(v\)\s*=>\s*onUpdate\(\{\s*bulletsIntro:\s*v \|\| undefined\s*\}\)\}/,
    );
  });

  it("each bullet body textarea is now a RichTextarea writing through updateBullet", () => {
    // Each bullet card already has its own array index — RichTextarea
    // creates its own ref internally so we don't need a per-bullet
    // sub-component just to scope refs.
    expect(KEY_CALLOUT_SRC).toMatch(
      /<RichTextarea[\s\S]{0,400}value=\{b\.body\}[\s\S]{0,400}onChange=\{\(v\)\s*=>\s*updateBullet\(i,\s*\{\s*body:\s*v\s*\}\)\}/,
    );
  });

  it("bullet term + hint stay as plain inputs (short labels, not prose)", () => {
    // Defensive: these are single-line labels, markdown formatting
    // would be over-engineered. Keep them as <input>.
    expect(KEY_CALLOUT_SRC).toMatch(
      /<input[\s\S]{0,300}value=\{b\.term\}/,
    );
    expect(KEY_CALLOUT_SRC).toMatch(
      /<input[\s\S]{0,300}value=\{b\.hint \?\? ""\}/,
    );
  });
});
