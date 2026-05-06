/**
 * Round 24 (6 May 2026 PM) — word-lookup reliability + diagnostics.
 *
 * Per Matt: "the word definition lookup is still struggling. sometimes
 * works, sometimes pops up for a sec and then disappears. once had a
 * fail message. any way to check it out?"
 *
 * Three issues found and fixed:
 *
 * 1. Cross-tap loading-timeout cleanup. Tapping word B while word A
 *    was loading aborted A. A's finally then ran clearTimeout on
 *    loadingTimeoutRef.current — which by that point pointed at B's
 *    timeout. B's loading window became uncapped: if B's fetch hung,
 *    popover stuck in "Looking up…" forever.
 *
 * 2. Click-outside dismissed too eagerly. Cache hits resolve in <100ms;
 *    by the time the popover renders the loaded state, the user's
 *    cursor may already be moving. Next mousedown anywhere outside
 *    the popover closed it before the student read the definition.
 *    "Pops up for a sec and disappears."
 *
 * 3. Route was bare (no withErrorHandler). Unhandled exceptions in
 *    Anthropic / Supabase / withAIBudget surfaced as default Next
 *    500s with no Sentry capture, no useful logs.
 *
 * Source-static guards lock the fixes.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const HOOK_SRC = readFileSync(
  join(__dirname, "..", "useWordLookup.ts"),
  "utf-8"
);
const POPOVER_SRC = readFileSync(
  join(__dirname, "..", "WordPopover.tsx"),
  "utf-8"
);
const ROUTE_SRC = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "app",
    "api",
    "student",
    "word-lookup",
    "route.ts"
  ),
  "utf-8"
);

describe("useWordLookup — round 24 timeout cross-tap fix", () => {
  it("captures the timeout handle locally as myTimeoutHandle", () => {
    expect(HOOK_SRC).toMatch(/const myTimeoutHandle = setTimeout/);
  });

  it("finally clears OUR timeout (clearTimeout(myTimeoutHandle)) not whatever the ref currently points at", () => {
    expect(HOOK_SRC).toMatch(/clearTimeout\(myTimeoutHandle\)/);
  });

  it("only nulls the ref when it still matches our handle", () => {
    expect(HOOK_SRC).toMatch(
      /loadingTimeoutRef\.current === myTimeoutHandle[\s\S]{0,80}loadingTimeoutRef\.current = null/
    );
  });
});

describe("useWordLookup — round 24 friendly error mapping", () => {
  it("translates budget_exceeded to a student-friendly sentence", () => {
    expect(HOOK_SRC).toMatch(/budget_exceeded[\s\S]{0,80}AI word-lookup limit/);
  });

  it("translates model_truncated", () => {
    expect(HOOK_SRC).toMatch(/model_truncated[\s\S]{0,80}got cut off/);
  });

  it("translates session-expired (Unauthorized)", () => {
    expect(HOOK_SRC).toMatch(/Unauthorized[\s\S]{0,120}session expired/);
  });

  it("network errors get a friendly 'check your connection' message", () => {
    expect(HOOK_SRC).toMatch(/Couldn.{1,5}t reach the lookup service/);
  });

  it("logs the underlying server error code in dev for diagnosis", () => {
    expect(HOOK_SRC).toMatch(
      /\[tap-a-word\] server error[\s\S]{0,200}status:\s*res\.status[\s\S]{0,80}code/
    );
  });
});

describe("WordPopover — round 24 click-outside grace period", () => {
  it("declares terminalAtRef stamped when state hits loaded/error", () => {
    expect(POPOVER_SRC).toMatch(/terminalAtRef = useRef/);
    expect(POPOVER_SRC).toMatch(
      /state === "loaded"\s*\|\|\s*state === "error"[\s\S]{0,200}terminalAtRef\.current = Date\.now\(\)/
    );
  });

  it("click-outside listener gates dismiss on a 500ms minimum-readable window", () => {
    expect(POPOVER_SRC).toMatch(
      /Date\.now\(\)\s*-\s*terminalAt\s*<\s*500/
    );
  });

  it("Esc still dismisses immediately (separate handler, no grace)", () => {
    // Esc handler should NOT reference terminalAtRef.
    const escHandlerIdx = POPOVER_SRC.indexOf('e.key === "Escape"');
    expect(escHandlerIdx).toBeGreaterThan(0);
    const slice = POPOVER_SRC.slice(escHandlerIdx, escHandlerIdx + 200);
    expect(slice).not.toContain("terminalAtRef");
  });
});

describe("word-lookup route — round 24 wrapper + structured logs", () => {
  it("imports + uses withErrorHandler", () => {
    expect(ROUTE_SRC).toContain('from "@/lib/api/error-handler"');
    expect(ROUTE_SRC).toMatch(
      /export const POST = withErrorHandler\("student\/word-lookup:POST"/
    );
  });

  it("has a logErr helper writing to console.error with route prefix", () => {
    expect(ROUTE_SRC).toMatch(/function logErr\(/);
    expect(ROUTE_SRC).toMatch(/console\.error\("\[word-lookup\]"/);
  });

  it("logs each error path: invalid_json_body / word_length / api_key_missing / budget / truncated / no_tool_use / empty_definition", () => {
    expect(ROUTE_SRC).toContain('logErr("invalid_json_body"');
    expect(ROUTE_SRC).toContain('logErr("word_length_invalid"');
    expect(ROUTE_SRC).toContain('logErr("anthropic_api_key_missing"');
    expect(ROUTE_SRC).toContain('logErr("budget_exceeded"');
    expect(ROUTE_SRC).toContain('logErr("model_truncated"');
    expect(ROUTE_SRC).toContain('logErr("no_tool_use_block"');
    expect(ROUTE_SRC).toContain('logErr("empty_definition"');
  });

  it("file is closed properly with arrow-function-and-paren after the wrap", () => {
    // Sanity check on the wrapper close. Catches the easy mistake of
    // forgetting to add the closing }) when wrapping a bare function.
    expect(ROUTE_SRC.trimEnd().endsWith("});")).toBe(true);
  });
});
