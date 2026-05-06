/**
 * Round 18 (6 May 2026) — useIntegrityTracking hook source-static
 * guards.
 *
 * Locks the contract that StructuredPromptsResponse depends on:
 * IntegrityMetadata shape compatibility, debounced notify, paste/
 * keystroke/focus/blur handlers, snapshot + word-count intervals,
 * tab-visibility tracking, unmount-flush.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const HOOK_SRC = readFileSync(
  join(__dirname, "..", "useIntegrityTracking.ts"),
  "utf-8"
);

const STRUCTURED_SRC = readFileSync(
  join(
    process.cwd(),
    "src/components/student/StructuredPromptsResponse.tsx"
  ),
  "utf-8"
);

const RESPONSE_INPUT_SRC = readFileSync(
  join(process.cwd(), "src/components/student/ResponseInput.tsx"),
  "utf-8"
);

describe("useIntegrityTracking — hook contract", () => {
  it("exports the IntegrityMetadata-compatible shape (paste/keystroke/focus/snapshot/wordCount)", () => {
    expect(HOOK_SRC).toContain("pasteEvents: []");
    expect(HOOK_SRC).toContain("keystrokeCount: 0");
    expect(HOOK_SRC).toContain("focusLossCount: 0");
    expect(HOOK_SRC).toContain("deletionCount: 0");
    expect(HOOK_SRC).toContain("snapshots: []");
    expect(HOOK_SRC).toContain("wordCountHistory: []");
  });

  it("uses the same constants MonitoredTextarea uses (snapshot 30s, debounce 1.5s)", () => {
    expect(HOOK_SRC).toContain("SNAPSHOT_INTERVAL_MS = 30_000");
    expect(HOOK_SRC).toContain("KEYSTROKE_NOTIFY_DEBOUNCE_MS = 1_500");
  });

  it("returns handlers for paste / keystroke / focus / blur", () => {
    expect(HOOK_SRC).toContain("onPaste,");
    expect(HOOK_SRC).toContain("onKeyDown,");
    expect(HOOK_SRC).toContain("onFocus,");
    expect(HOOK_SRC).toContain("onBlur,");
  });

  it("paste handler captures length + first 100 chars", () => {
    expect(HOOK_SRC).toContain('e.clipboardData.getData("text/plain")');
    expect(HOOK_SRC).toContain("substring(0, 100)");
  });

  it("counts deletions on Backspace + Delete keys", () => {
    expect(HOOK_SRC).toContain('e.key === "Backspace" || e.key === "Delete"');
    expect(HOOK_SRC).toContain("deletionCount++");
  });

  it("tracks tab-visibility loss for focusLossCount", () => {
    expect(HOOK_SRC).toContain("visibilitychange");
    expect(HOOK_SRC).toContain("focusLossCount++");
  });

  it("flushes integrity to parent on unmount (final snapshot)", () => {
    expect(HOOK_SRC).toMatch(
      /useEffect\(\(\)\s*=>\s*\{[\s\S]{0,200}return\s*\(\)\s*=>\s*\{[\s\S]{0,200}onIntegrityUpdate\(\{[\s\S]{0,80}metricsRef\.current/
    );
  });

  it("exposes a flush() function for explicit-save flows", () => {
    expect(HOOK_SRC).toMatch(/flush:\s*useCallback/);
  });

  it("noop when enabled=false (handlers gated on `if (!enabled) return`)", () => {
    // Each handler bails early when disabled
    expect(HOOK_SRC.match(/if\s*\(!enabled\)\s*return/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});

describe("StructuredPromptsResponse — integrity wiring", () => {
  it("imports useIntegrityTracking + IntegrityMetadata type", () => {
    expect(STRUCTURED_SRC).toContain('from "@/hooks/useIntegrityTracking"');
    expect(STRUCTURED_SRC).toContain('import type { IntegrityMetadata }');
  });

  it("accepts enableIntegrityMonitoring + onIntegrityUpdate props", () => {
    expect(STRUCTURED_SRC).toMatch(
      /enableIntegrityMonitoring\?:\s*boolean/
    );
    expect(STRUCTURED_SRC).toMatch(
      /onIntegrityUpdate\?:\s*\(metadata:\s*IntegrityMetadata\)\s*=>\s*void/
    );
  });

  it("calls useIntegrityTracking with combined-text getter", () => {
    expect(STRUCTURED_SRC).toMatch(/useIntegrityTracking\(\{/);
    expect(STRUCTURED_SRC).toMatch(
      /getCombinedText:[\s\S]{0,200}composeContent\(prompts,\s*responsesRef\.current\)/
    );
  });

  it("each per-prompt textarea binds onPaste/onKeyDown/onFocus/onBlur", () => {
    const idx = STRUCTURED_SRC.indexOf('data-testid={`structured-prompts-input-${prompt.id}`}');
    expect(idx).toBeGreaterThan(0);
    const before = STRUCTURED_SRC.slice(Math.max(0, idx - 800), idx);
    expect(before).toContain("integrity.handlers.onPaste");
    expect(before).toContain("integrity.handlers.onKeyDown");
    expect(before).toContain("integrity.handlers.onFocus");
    expect(before).toContain("integrity.handlers.onBlur");
  });

  it("flushes integrity metrics before save fires", () => {
    expect(STRUCTURED_SRC).toContain("integrity.flush()");
    // Flush happens before the lesson save, not after
    const flushIdx = STRUCTURED_SRC.indexOf("integrity.flush()");
    const onSaveIdx = STRUCTURED_SRC.indexOf("await onSaveImmediate(content)");
    expect(flushIdx).toBeLessThan(onSaveIdx);
  });
});

describe("ResponseInput — passes integrity props through", () => {
  it("forwards enableIntegrityMonitoring + onIntegrityUpdate to StructuredPromptsResponse", () => {
    const idx = RESPONSE_INPUT_SRC.indexOf("<StructuredPromptsResponse");
    expect(idx).toBeGreaterThan(0);
    const slice = RESPONSE_INPUT_SRC.slice(idx, idx + 800);
    expect(slice).toContain("enableIntegrityMonitoring={enableIntegrityMonitoring}");
    expect(slice).toContain("onIntegrityUpdate={onIntegrityUpdate}");
  });
});
