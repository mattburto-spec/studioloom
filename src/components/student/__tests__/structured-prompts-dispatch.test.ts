/**
 * AG.1.2 — source-static guards for structured-prompts dispatch in ResponseInput.
 *
 * Per Lesson #38: assert specific patterns are wired, not just present.
 * Per Lesson #67: a new ResponseType added to the union must be reachable
 * from every dispatcher. This file asserts ResponseInput.tsx routes
 * "structured-prompts" to the StructuredPromptsResponse component.
 *
 * Style mirrors src/app/api/teacher/tasks/__tests__/route.test.ts:
 * read the file, assert specific patterns. Avoids the React render
 * thicket while still catching wiring regressions.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const RESPONSE_INPUT_SRC = readFileSync(
  join(__dirname, "..", "ResponseInput.tsx"),
  "utf-8"
);

const STRUCTURED_PROMPTS_SRC = readFileSync(
  join(__dirname, "..", "StructuredPromptsResponse.tsx"),
  "utf-8"
);

describe("ResponseInput — structured-prompts dispatch", () => {
  it("imports StructuredPromptsResponse component", () => {
    expect(RESPONSE_INPUT_SRC).toContain('from "./StructuredPromptsResponse"');
  });

  it("imports StructuredPromptsConfig type", () => {
    expect(RESPONSE_INPUT_SRC).toContain(
      'from "@/lib/structured-prompts/types"'
    );
  });

  it("accepts prompts + requirePhoto + onStructuredPromptsSaved props", () => {
    expect(RESPONSE_INPUT_SRC).toContain("prompts?: StructuredPromptsConfig");
    expect(RESPONSE_INPUT_SRC).toContain("requirePhoto?: boolean");
    expect(RESPONSE_INPUT_SRC).toContain("onStructuredPromptsSaved?:");
  });

  it("dispatches to StructuredPromptsResponse when responseType === 'structured-prompts'", () => {
    expect(RESPONSE_INPUT_SRC).toMatch(
      /responseType === "structured-prompts"[\s\S]{0,200}<StructuredPromptsResponse/
    );
  });

  it("passes prompts + unitId + pageId + sectionIndex + requirePhoto + onSaved to the component", () => {
    const idx = RESPONSE_INPUT_SRC.indexOf("<StructuredPromptsResponse");
    expect(idx).toBeGreaterThan(0);
    const slice = RESPONSE_INPUT_SRC.slice(idx, idx + 500);
    expect(slice).toContain("prompts={prompts}");
    expect(slice).toContain("unitId={unitId}");
    expect(slice).toContain("pageId={pageId}");
    expect(slice).toContain("sectionIndex={sectionIndex}");
    expect(slice).toContain("requirePhoto={requirePhoto}");
    expect(slice).toContain("onSaved={onStructuredPromptsSaved}");
  });

  it("guards on prompts + unitId + pageId being defined before rendering (defensive)", () => {
    expect(RESPONSE_INPUT_SRC).toMatch(
      /responseType === "structured-prompts"\s*&&\s*prompts\s*&&\s*unitId\s*&&\s*pageId/
    );
  });
});

describe("StructuredPromptsResponse — module hygiene", () => {
  it("imports pure-logic helpers from src/lib/structured-prompts/payload", () => {
    expect(STRUCTURED_PROMPTS_SRC).toContain(
      'from "@/lib/structured-prompts/payload"'
    );
    expect(STRUCTURED_PROMPTS_SRC).toContain("composeContent");
    expect(STRUCTURED_PROMPTS_SRC).toContain("validateResponses");
    expect(STRUCTURED_PROMPTS_SRC).toContain("isReadyToSubmit");
    expect(STRUCTURED_PROMPTS_SRC).toContain("extractNextMove");
  });

  it("uses auto-capture path (type: 'auto') for portfolio dedup via unique index", () => {
    expect(STRUCTURED_PROMPTS_SRC).toMatch(
      /type:\s*["']auto["']/
    );
  });

  it("submits to /api/student/portfolio with unitId + pageId + sectionIndex", () => {
    // Anchor on the actual fetch call inside handleSubmit, not the doc comment at top of file
    const fetchIdx = STRUCTURED_PROMPTS_SRC.indexOf(
      'fetch("/api/student/portfolio"'
    );
    expect(fetchIdx).toBeGreaterThan(0);
    const slice = STRUCTURED_PROMPTS_SRC.slice(fetchIdx, fetchIdx + 500);
    expect(slice).toContain("unitId");
    expect(slice).toContain("pageId");
    expect(slice).toContain("sectionIndex");
  });

  it("uses moderation + compress + upload pattern for photos (mirrors QuickCaptureFAB)", () => {
    expect(STRUCTURED_PROMPTS_SRC).toContain("checkClientImage");
    expect(STRUCTURED_PROMPTS_SRC).toContain("compressImage");
    expect(STRUCTURED_PROMPTS_SRC).toContain("/api/student/upload");
  });

  it("blocks submit if photo moderation fails — does NOT proceed to upload", () => {
    // Defensive: the moderation check must early-return BEFORE the compress + upload block.
    // Anchor on first actual call, not import/comment mentions. Search after imports.
    const handleSubmitIdx = STRUCTURED_PROMPTS_SRC.indexOf("async function handleSubmit");
    expect(handleSubmitIdx).toBeGreaterThan(0);
    const fnBody = STRUCTURED_PROMPTS_SRC.slice(handleSubmitIdx);
    const moderateCallIdx = fnBody.indexOf("checkClientImage(photoFile)");
    const moderationFailIdx = fnBody.indexOf("!imageCheck.ok");
    const compressCallIdx = fnBody.indexOf("compressImage(photoFile)");
    expect(moderateCallIdx).toBeGreaterThan(0);
    expect(moderationFailIdx).toBeGreaterThan(moderateCallIdx);
    expect(compressCallIdx).toBeGreaterThan(moderationFailIdx);
  });

  it("calls onSaved callback with content + nextMove after successful save", () => {
    expect(STRUCTURED_PROMPTS_SRC).toMatch(
      /onSaved\?\.\(\{\s*content,\s*nextMove\s*\}\)/
    );
  });

  it("renders one textarea per prompt with data-testid keyed by promptId", () => {
    expect(STRUCTURED_PROMPTS_SRC).toMatch(
      /data-testid=\{`structured-prompts-input-\$\{prompt\.id\}`\}/
    );
  });

  it("shows char count when softCharCap is set on the prompt", () => {
    expect(STRUCTURED_PROMPTS_SRC).toContain("prompt.softCharCap");
    expect(STRUCTURED_PROMPTS_SRC).toContain("charCountStatus");
  });

  it("Send button data-testid matches expected smoke selector", () => {
    expect(STRUCTURED_PROMPTS_SRC).toContain('data-testid="structured-prompts-submit"');
  });
});
