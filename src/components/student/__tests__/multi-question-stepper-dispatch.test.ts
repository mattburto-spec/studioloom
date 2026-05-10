/**
 * LIS.C — source-static guards for the MultiQuestionResponse stepper
 * dispatch in ResponseInput.
 *
 * Per Lesson #38 + #67: the dispatch must route to
 * MultiQuestionResponse when (and only when) section.promptsLayout is
 * "stepper", AND it must forward the same persistence wiring as the
 * legacy StructuredPromptsResponse path so Narrative aggregator reads
 * (via student_progress.responses + composeContent) keep working.
 *
 * Style mirrors structured-prompts-dispatch.test.ts +
 * rich-text-response-dispatch.test.ts: read source, assert specific
 * patterns. Avoids the React render thicket while still catching
 * wiring regressions.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const RESPONSE_INPUT_SRC = readFileSync(
  join(__dirname, "..", "ResponseInput.tsx"),
  "utf-8",
);

const MULTI_QUESTION_SRC = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "lesson",
    "MultiQuestionResponse",
    "index.tsx",
  ),
  "utf-8",
);

const ACTIVITY_CARD_SRC = readFileSync(
  join(__dirname, "..", "ActivityCard.tsx"),
  "utf-8",
);

const TYPES_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "types", "index.ts"),
  "utf-8",
);

const STRUCTURED_PROMPTS_TYPES = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "..",
    "lib",
    "structured-prompts",
    "types.ts",
  ),
  "utf-8",
);

describe("ResponseInput — stepper dispatch (LIS.C)", () => {
  it("imports MultiQuestionResponse from the lesson barrel", () => {
    expect(RESPONSE_INPUT_SRC).toMatch(
      /import\s*\{[^}]*MultiQuestionResponse[^}]*\}\s*from\s*["']@\/components\/lesson["']/,
    );
  });

  it("declares the promptsLayout?: 'stepper' prop", () => {
    expect(RESPONSE_INPUT_SRC).toContain('promptsLayout?: "stepper"');
  });

  it("destructures promptsLayout from props", () => {
    expect(RESPONSE_INPUT_SRC).toMatch(/^\s*promptsLayout,/m);
  });

  it("dispatches to MultiQuestionResponse only when promptsLayout === 'stepper'", () => {
    // The ternary branches on promptsLayout === "stepper" → MultiQuestion,
    // else → legacy StructuredPromptsResponse.
    expect(RESPONSE_INPUT_SRC).toMatch(
      /promptsLayout === "stepper"\s*\?\s*\(\s*<MultiQuestionResponse/,
    );
    expect(RESPONSE_INPUT_SRC).toMatch(
      /\)\s*:\s*\(\s*<StructuredPromptsResponse/,
    );
  });

  it("forwards the same persistence wiring to MultiQuestionResponse as StructuredPromptsResponse uses", () => {
    const idx = RESPONSE_INPUT_SRC.indexOf("<MultiQuestionResponse");
    expect(idx).toBeGreaterThan(0);
    const slice = RESPONSE_INPUT_SRC.slice(idx, idx + 800);
    // Same prompt + unit context
    expect(slice).toContain("fields={prompts}");
    expect(slice).toContain("unitId={unitId}");
    expect(slice).toContain("pageId={pageId}");
    expect(slice).toContain("sectionIndex={sectionIndex}");
    // Same persistence + photo + kanban
    expect(slice).toContain("requirePhoto={requirePhoto}");
    expect(slice).toContain("autoCreateKanbanCardOnSave={autoCreateKanbanCardOnSave}");
    // Same Narrative aggregator wiring
    expect(slice).toContain("savedValue={value}");
    expect(slice).toContain("onChange={onChange}");
    expect(slice).toContain("onSaveImmediate={onSaveResponseImmediate}");
    expect(slice).toContain("onSaved={onStructuredPromptsSaved}");
    // Same integrity contract
    expect(slice).toContain("enableIntegrityMonitoring={enableIntegrityMonitoring}");
    expect(slice).toContain("onIntegrityUpdate={onIntegrityUpdate}");
  });
});

describe("ActivityCard — passes section.promptsLayout through to ResponseInput", () => {
  it("threads promptsLayout from section to ResponseInput", () => {
    expect(ACTIVITY_CARD_SRC).toContain("promptsLayout={section.promptsLayout}");
  });
});

describe("ActivitySection schema — promptsLayout (LIS.C)", () => {
  it("declares promptsLayout?: 'stepper' as an optional opt-in field", () => {
    expect(TYPES_SRC).toContain('promptsLayout?: "stepper"');
  });
});

describe("StructuredPrompt schema — optional criterion tag (LIS.C)", () => {
  it("declares criterion?: DO|NOTICE|DECIDE|NEXT optional tag", () => {
    expect(STRUCTURED_PROMPTS_TYPES).toMatch(
      /criterion\?:\s*"DO"\s*\|\s*"NOTICE"\s*\|\s*"DECIDE"\s*\|\s*"NEXT"/,
    );
  });
});

describe("MultiQuestionResponse — production-mode persistence ports (LIS.C)", () => {
  it("declares the production-mode props (unitId, pageId, sectionIndex, savedValue, onSaveImmediate, onSaved)", () => {
    expect(MULTI_QUESTION_SRC).toContain("unitId?: string");
    expect(MULTI_QUESTION_SRC).toContain("pageId?: string");
    expect(MULTI_QUESTION_SRC).toContain("sectionIndex?: number");
    expect(MULTI_QUESTION_SRC).toContain("savedValue?: string");
    expect(MULTI_QUESTION_SRC).toContain(
      "onSaveImmediate?: (composedContent: string) => Promise<void>",
    );
    expect(MULTI_QUESTION_SRC).toContain(
      "onSaved?: (saved: { content: string; nextMove: string | null })",
    );
  });

  it("declares photo upload + kanban + integrity props", () => {
    expect(MULTI_QUESTION_SRC).toContain("requirePhoto?: boolean");
    expect(MULTI_QUESTION_SRC).toContain("autoCreateKanbanCardOnSave?: boolean");
    expect(MULTI_QUESTION_SRC).toContain("enableIntegrityMonitoring?: boolean");
    expect(MULTI_QUESTION_SRC).toContain(
      "onIntegrityUpdate?: (metadata: IntegrityMetadata) => void",
    );
  });

  it("imports composeContent / parseComposedContent / extractNextMove from the canonical payload module", () => {
    expect(MULTI_QUESTION_SRC).toMatch(
      /from\s*["']@\/lib\/structured-prompts\/payload["']/,
    );
    expect(MULTI_QUESTION_SRC).toContain("composeContent");
    expect(MULTI_QUESTION_SRC).toContain("parseComposedContent");
    expect(MULTI_QUESTION_SRC).toContain("extractNextMove");
  });

  it("imports the photo helpers (compressImage + checkClientImage) used by the existing structured-prompts path", () => {
    expect(MULTI_QUESTION_SRC).toMatch(
      /from\s*["']@\/lib\/compress-image["']/,
    );
    expect(MULTI_QUESTION_SRC).toMatch(
      /from\s*["']@\/lib\/content-safety\/client-image-filter["']/,
    );
  });

  it("computes isProduction from the unitId+pageId+sectionIndex triple — null wires keep storybook mode active", () => {
    expect(MULTI_QUESTION_SRC).toMatch(
      /isProduction\s*=\s*!!\(\s*unitId\s*&&\s*pageId\s*&&\s*sectionIndex\s*!==\s*undefined\s*\)/,
    );
  });

  it("submit path POSTs to /api/student/portfolio with composed content + mediaUrl + pageId + sectionIndex", () => {
    // Same call signature as StructuredPromptsResponse — a regression
    // here would change the portfolio_entries write contract.
    expect(MULTI_QUESTION_SRC).toContain('"/api/student/portfolio"');
    const idx = MULTI_QUESTION_SRC.indexOf('"/api/student/portfolio"');
    const slice = MULTI_QUESTION_SRC.slice(idx, idx + 600);
    expect(slice).toContain('type: "auto"');
    expect(slice).toContain("content");
    expect(slice).toContain("mediaUrl");
    expect(slice).toContain("pageId");
    expect(slice).toContain("sectionIndex");
  });

  it("kanban auto-create lazy-imports appendBacklogCard so the bundle stays slim when the flag is off", () => {
    expect(MULTI_QUESTION_SRC).toMatch(
      /import\(["']@\/lib\/unit-tools\/kanban\/client["']\)/,
    );
    expect(MULTI_QUESTION_SRC).toMatch(/autoCreateKanbanCardOnSave\s*&&\s*nextMove/);
  });

  it("writes composed content back via onSaveImmediate (preferred) or onChange (fallback) — Narrative aggregator wiring", () => {
    // Without this, the entry saves to portfolio_entries but Narrative
    // shows "No responses yet" because it filters auto-captured entries
    // and reads from student_progress.responses instead.
    expect(MULTI_QUESTION_SRC).toMatch(/if\s*\(onSaveImmediate\)/);
    expect(MULTI_QUESTION_SRC).toMatch(/await onSaveImmediate\(content\)/);
    expect(MULTI_QUESTION_SRC).toMatch(/onChange\?\.\(content\)/);
  });

  it("hydrates from savedValue via parseComposedContent + late-arriving sync", () => {
    expect(MULTI_QUESTION_SRC).toMatch(/parseComposedContent\(/);
    // Round 30-style sync — when savedValue arrives after mount and the
    // user hasn't typed yet, hydrate from it.
    expect(MULTI_QUESTION_SRC).toMatch(/userHasEditedRef/);
  });
});

describe("MultiQuestionResponse — criterion is now optional (LIS.C)", () => {
  it("MultiQuestionField.criterion is optional with fallback color helpers", () => {
    const TYPES_PATH = join(
      __dirname,
      "..",
      "..",
      "lesson",
      "MultiQuestionResponse",
      "types.ts",
    );
    const SRC = readFileSync(TYPES_PATH, "utf-8");
    expect(SRC).toContain("criterion?: Criterion");
    expect(SRC).toContain("export function fieldColor");
    expect(SRC).toContain("export function fieldHex");
    expect(SRC).toContain("NEUTRAL_COLOR");
  });
});
