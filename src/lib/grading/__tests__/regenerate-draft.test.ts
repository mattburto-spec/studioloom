/**
 * TFL.3 C.4 — regenerate-draft helper source-static guards.
 *
 * Pins:
 *   - PII contract: NO student-name field on the input shape.
 *   - 4 directives via switch (shorter / warmer / sharper / ask).
 *   - Free-form ask text is capped to 400 chars + trimmed.
 *   - Tool-use contract: submit_regenerated_draft with draft_body.
 *   - max_tokens cap so a runaway response doesn't truncate silently.
 *   - Conventional endpoint string lib/grading/regenerate-draft.
 *   - Single chokepoint via callAnthropicMessages.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "..", "regenerate-draft.ts"),
  "utf-8",
);

describe("regenerate-draft — PII contract", () => {
  it("imports STUDENT_NAME_PLACEHOLDER + uses it as the studentRef anchor", () => {
    expect(src).toMatch(
      /import\s*\{\s*STUDENT_NAME_PLACEHOLDER\s*\}\s*from\s*"@\/lib\/security\/student-name-placeholder"/,
    );
    expect(src).toMatch(/const studentRef\s*=\s*STUDENT_NAME_PLACEHOLDER/);
  });

  it("RegenerateDraftInput carries NO student-name field", () => {
    const block = src.match(/export interface RegenerateDraftInput[\s\S]*?\n\}/)?.[0] ?? "";
    expect(block).not.toMatch(/displayName/);
    expect(block).not.toMatch(/display_name/);
    expect(block).not.toMatch(/firstName/);
    expect(block).not.toMatch(/studentName/);
  });
});

describe("regenerate-draft — directive switch (4 variants)", () => {
  it("switches on input.directive with all 4 cases", () => {
    expect(src).toMatch(/switch\s*\(input\.directive\)\s*\{/);
    expect(src).toMatch(/case\s+"shorter":/);
    expect(src).toMatch(/case\s+"warmer":/);
    expect(src).toMatch(/case\s+"sharper":/);
    expect(src).toMatch(/case\s+"ask":/);
  });

  it("ask directive caps free-form text at 400 chars + trims", () => {
    expect(src).toMatch(/ask\.length\s*>\s*400/);
    expect(src).toMatch(/\.slice\(0,\s*400\)/);
    expect(src).toMatch(/\(input\.askText\s*\?\?\s*""\)\.trim\(\)/);
  });

  it("shorter directive compresses to 2 sentences but PRESERVES positive+suggestion structure", () => {
    // C.7 rewrite (13 May 2026 — Matt smoke): the original "Shorter"
    // collapsed to a single bland next-step sentence and lost the
    // positive. Now both halves must survive compression.
    expect(src).toMatch(/compress this to TWO short sentences/i);
    expect(src).toMatch(/MUST keep BOTH/i);
    expect(src).toMatch(/ONE specific positive/i);
    expect(src).toMatch(/ONE concrete next step/i);
    expect(src).toMatch(/DO NOT drop the positive sentence/i);
  });

  it("warmer directive forbids empty praise (no 'great' / 'awesome')", () => {
    expect(src).toMatch(/Do NOT add empty praise/i);
    expect(src).toMatch(/'great', 'awesome'/i);
  });

  it("sharper directive cuts hedging words", () => {
    expect(src).toMatch(/Cut hedging/i);
    expect(src).toMatch(/maybe.*might.*perhaps.*I think/i);
  });
});

describe("regenerate-draft — tool-use contract", () => {
  it("uses submit_regenerated_draft tool with draft_body string property", () => {
    expect(src).toContain('name: "submit_regenerated_draft"');
    expect(src).toMatch(/draft_body:\s*\{/);
    expect(src).toMatch(/required:\s*\["draft_body"\]/);
  });

  it("forces tool_choice on the submit_regenerated_draft tool", () => {
    expect(src).toMatch(
      /toolChoice:\s*\{\s*type:\s*"tool"\s*,\s*name:\s*REGENERATE_TOOL\.name\s*\}/,
    );
  });
});

describe("regenerate-draft — chokepoint + cost guard", () => {
  it("calls callAnthropicMessages (single chokepoint per CLAUDE.md)", () => {
    expect(src).toMatch(
      /import\s*\{\s*callAnthropicMessages\s*\}\s*from\s*"@\/lib\/ai\/call"/,
    );
    expect(src).toMatch(/await\s+callAnthropicMessages\(/);
  });

  it("does NOT import the Anthropic SDK directly", () => {
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toMatch(/from\s+"@anthropic-ai\/sdk"/);
    expect(codeOnly).not.toMatch(/new\s+Anthropic\(/);
  });

  it("declares MAX_OUTPUT_TOKENS + uses it as maxTokens (Lesson #39)", () => {
    expect(src).toMatch(/MAX_OUTPUT_TOKENS\s*=\s*\d+/);
    expect(src).toMatch(/maxTokens:\s*MAX_OUTPUT_TOKENS/);
  });

  it("translates 'truncated' stop_reason to an explicit throw (Lesson #39)", () => {
    expect(src).toMatch(/callResult\.reason\s*===\s*"truncated"/);
  });

  it("uses the conventional endpoint string lib/grading/regenerate-draft", () => {
    expect(src).toMatch(/endpoint:\s*"lib\/grading\/regenerate-draft"/);
  });
});

describe("regenerate-draft — defensive guards", () => {
  it("returns empty draft (without burning a Haiku call) when currentDraft is empty", () => {
    expect(src).toMatch(
      /if\s*\(!input\.currentDraft\.trim\(\)\)\s*\{[\s\S]*?return\s*\{[\s\S]*?draftBody:\s*""/,
    );
  });
});
