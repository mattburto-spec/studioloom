/**
 * LIS.B — source-static guards for the RichTextResponse auto-replace.
 *
 * Per Lesson #38: assert specific wiring, not just "the file mentions
 * RichTextResponse." If a future edit accidentally drops the integrity
 * monitoring forwarding, breaks the controlled-component shape, or
 * resurrects MonitoredTextarea / RichTextEditor on the auto-replace
 * path, these tests catch it.
 *
 * Style mirrors structured-prompts-dispatch.test.ts (same directory) +
 * key-callout-dispatch.test.ts: read source, assert specific patterns.
 * Avoids the React render thicket while still catching wiring regressions.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const RESPONSE_INPUT_SRC = readFileSync(
  join(__dirname, "..", "ResponseInput.tsx"),
  "utf-8",
);

const RICH_TEXT_RESPONSE_SRC = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "lesson",
    "RichTextResponse",
    "index.tsx",
  ),
  "utf-8",
);

const HOOK_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "hooks", "useIntegrityTracking.ts"),
  "utf-8",
);

describe("ResponseInput — text-response dispatch (LIS.B auto-replace)", () => {
  it("imports RichTextResponse from the lesson barrel", () => {
    expect(RESPONSE_INPUT_SRC).toMatch(
      /import\s*\{[^}]*RichTextResponse[^}]*\}\s*from\s*["']@\/components\/lesson["']/,
    );
  });

  it("no longer imports MonitoredTextarea (auto-replace removed it)", () => {
    // The IntegrityMetadata TYPE may still be imported (it's the canonical
    // type), but the COMPONENT must not be — the auto-replace renders
    // RichTextResponse for both integrity + non-integrity paths.
    expect(RESPONSE_INPUT_SRC).not.toMatch(
      /import\s*\{\s*MonitoredTextarea\s*\}\s*from/,
    );
    expect(RESPONSE_INPUT_SRC).not.toMatch(
      /<MonitoredTextarea\b/,
    );
  });

  it("no longer imports RichTextEditor (auto-replace removed it)", () => {
    expect(RESPONSE_INPUT_SRC).not.toMatch(
      /import\s*\{\s*RichTextEditor\s*\}\s*from/,
    );
    expect(RESPONSE_INPUT_SRC).not.toMatch(/<RichTextEditor\b/);
  });

  it("renders RichTextResponse for the text response branch", () => {
    expect(RESPONSE_INPUT_SRC).toMatch(/<RichTextResponse[\s\S]{0,300}\/>/);
  });

  it("forwards value/onChange in controlled-component shape", () => {
    const idx = RESPONSE_INPUT_SRC.indexOf("<RichTextResponse");
    expect(idx).toBeGreaterThan(0);
    const slice = RESPONSE_INPUT_SRC.slice(idx, idx + 600);
    expect(slice).toContain("value={value}");
    expect(slice).toContain("onChange={onChange}");
    expect(slice).toContain("placeholder={placeholder}");
  });

  it("forwards integrity props (no silent loss of academic-integrity tracking)", () => {
    const idx = RESPONSE_INPUT_SRC.indexOf("<RichTextResponse");
    const slice = RESPONSE_INPUT_SRC.slice(idx, idx + 600);
    expect(slice).toContain("enableIntegrityMonitoring={enableIntegrityMonitoring}");
    expect(slice).toContain("onIntegrityUpdate={onIntegrityUpdate}");
  });

  it("forces portfolioToggle={false} so PortfolioCaptureAffordance owns that surface", () => {
    const idx = RESPONSE_INPUT_SRC.indexOf("<RichTextResponse");
    const slice = RESPONSE_INPUT_SRC.slice(idx, idx + 600);
    expect(slice).toContain("portfolioToggle={false}");
  });
});

describe("RichTextResponse — controlled-component shape + integrity port (LIS.B)", () => {
  it("declares value/onChange (controlled) AND initialHTML/onSave (uncontrolled) modes", () => {
    expect(RICH_TEXT_RESPONSE_SRC).toContain("value?: string");
    expect(RICH_TEXT_RESPONSE_SRC).toContain("onChange?: (html: string) => void");
    expect(RICH_TEXT_RESPONSE_SRC).toContain("initialHTML?: string");
    expect(RICH_TEXT_RESPONSE_SRC).toContain("onSave?: (html: string) => void | Promise<void>");
  });

  it("declares integrity-monitoring props with the standard IntegrityMetadata shape", () => {
    expect(RICH_TEXT_RESPONSE_SRC).toContain("enableIntegrityMonitoring?: boolean");
    expect(RICH_TEXT_RESPONSE_SRC).toContain("onIntegrityUpdate?: (metadata: IntegrityMetadata) => void");
  });

  it("imports useIntegrityTracking (the canonical hook, not a duplicate impl)", () => {
    expect(RICH_TEXT_RESPONSE_SRC).toMatch(
      /import\s*\{\s*useIntegrityTracking\s*\}\s*from\s*["']@\/hooks\/useIntegrityTracking["']/,
    );
  });

  it("calls useIntegrityTracking with enabled=enableIntegrityMonitoring", () => {
    expect(RICH_TEXT_RESPONSE_SRC).toMatch(
      /useIntegrityTracking\(\{\s*[\s\S]{0,300}enabled:\s*enableIntegrityMonitoring/,
    );
  });

  it("getCombinedText reads the editor's textContent (plain text, not HTML)", () => {
    expect(RICH_TEXT_RESPONSE_SRC).toMatch(
      /getCombinedText:[\s\S]{0,200}editorRef\.current\?\.textContent/,
    );
  });

  it("forwards onPaste/onKeyDown/onFocus/onBlur to the integrity hook handlers when monitoring is on", () => {
    // Each forward must gate on enableIntegrityMonitoring so the hook
    // is a no-op in non-monitored mode (storybook / standalone usage).
    expect(RICH_TEXT_RESPONSE_SRC).toMatch(/enableIntegrityMonitoring[\s\S]{0,200}integrity\.handlers\.onPaste/);
    expect(RICH_TEXT_RESPONSE_SRC).toMatch(/enableIntegrityMonitoring[\s\S]{0,200}integrity\.handlers\.onKeyDown/);
    expect(RICH_TEXT_RESPONSE_SRC).toMatch(/enableIntegrityMonitoring[\s\S]{0,200}integrity\.handlers\.onFocus/);
    expect(RICH_TEXT_RESPONSE_SRC).toMatch(/enableIntegrityMonitoring[\s\S]{0,200}integrity\.handlers\.onBlur/);
  });

  it("paste handler still sanitises (preventDefault + insertText) BEFORE forwarding to integrity", () => {
    // Without preventDefault we'd inject foreign HTML into the editor.
    // Without forwarding we'd silently lose paste-event tracking.
    // Both must remain present in the same handler.
    const pasteIdx = RICH_TEXT_RESPONSE_SRC.indexOf("const onPaste");
    expect(pasteIdx).toBeGreaterThan(0);
    const slice = RICH_TEXT_RESPONSE_SRC.slice(pasteIdx, pasteIdx + 600);
    expect(slice).toContain("e.preventDefault()");
    expect(slice).toContain('document.execCommand("insertText"');
    expect(slice).toContain("integrity.handlers.onPaste");
  });

  it("controlled mode: emits via onChange and disables auto-save", () => {
    // isControlled === value !== undefined && onChange !== undefined
    expect(RICH_TEXT_RESPONSE_SRC).toMatch(
      /isControlled\s*=\s*value\s*!==\s*undefined\s*&&\s*onChange\s*!==\s*undefined/,
    );
    // Auto-save passes disabled: isControlled || !onSave
    expect(RICH_TEXT_RESPONSE_SRC).toMatch(
      /useAutoSave\(\{[\s\S]{0,300}disabled:\s*isControlled\s*\|\|\s*!onSave/,
    );
  });
});

describe("useIntegrityTracking — generalised handler types (LIS.B)", () => {
  it("handlers accept HTMLElement events (not HTMLTextAreaElement-only)", () => {
    // Function-parameter contravariance: HTMLElement-typed handlers are
    // assignable to HTMLTextAreaElement OR HTMLDivElement event slots,
    // so existing textarea callers (StructuredPromptsResponse) and the
    // new contenteditable caller (RichTextResponse) both compile.
    expect(HOOK_SRC).toContain("React.ClipboardEvent<HTMLElement>");
    expect(HOOK_SRC).toContain("React.KeyboardEvent<HTMLElement>");
    expect(HOOK_SRC).not.toContain("React.ClipboardEvent<HTMLTextAreaElement>");
    expect(HOOK_SRC).not.toContain("React.KeyboardEvent<HTMLTextAreaElement>");
  });
});
