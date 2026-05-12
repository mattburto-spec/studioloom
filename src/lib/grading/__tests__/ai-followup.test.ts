/**
 * TFL.3 C.3 — ai-followup helper source-static guards.
 *
 * Pins:
 *   - PII contract: NO student-name field on the input shape; the
 *     helper builds prompts using STUDENT_NAME_PLACEHOLDER. Caller
 *     restores via restoreStudentName().
 *   - 3 sub-prompts (got_it / not_sure / pushback), one per
 *     sentiment branch.
 *   - Sentinel "(no follow-up needed)" used for got_it silence.
 *   - Tool-use contract: submit_followup with followup_body field.
 *   - max_tokens cap so a runaway response doesn't truncate
 *     silently (Lesson #39).
 *   - Endpoint string matches the AI call-site convention.
 *   - Goes through callAnthropicMessages chokepoint (no direct
 *     SDK / fetch use).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "..", "ai-followup.ts"),
  "utf-8",
);

describe("ai-followup — PII contract", () => {
  it("uses STUDENT_NAME_PLACEHOLDER via studentRef local (no real name leaks)", () => {
    expect(src).toMatch(
      /import\s*\{\s*STUDENT_NAME_PLACEHOLDER\s*\}\s*from\s*"@\/lib\/security\/student-name-placeholder"/,
    );
    // The helper assigns the placeholder to a local `studentRef` then
    // references that variable throughout prompts. Verify the
    // assignment exists + the variable is used in the prompts.
    expect(src).toMatch(/const studentRef\s*=\s*STUDENT_NAME_PLACEHOLDER/);
    // studentRef appears in not_sure + pushback prompts at minimum.
    const matches = src.match(/studentRef/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it("AiFollowupInput interface carries NO student-name field", () => {
    const block = src.match(/export interface AiFollowupInput[\s\S]*?\n\}/)?.[0] ?? "";
    expect(block).not.toMatch(/displayName/);
    expect(block).not.toMatch(/display_name/);
    expect(block).not.toMatch(/firstName/);
    expect(block).not.toMatch(/studentName/);
  });
});

describe("ai-followup — 3 sub-prompts (sentiment variants)", () => {
  it("buildSystemPrompt has a switch on sentiment with all 3 cases", () => {
    expect(src).toMatch(/switch\s*\(input\.sentiment\)\s*\{/);
    expect(src).toMatch(/case\s+"got_it":/);
    expect(src).toMatch(/case\s+"not_sure":/);
    expect(src).toMatch(/case\s+"pushback":/);
  });

  it("got_it variant references the NO_FOLLOWUP_SENTINEL (silence is honest)", () => {
    expect(src).toMatch(/NO_FOLLOWUP_SENTINEL\s*=\s*"\(no follow-up needed\)"/);
    // The got_it variant's prompt mentions the sentinel literally so
    // the model knows what string to return for "no reply".
    expect(src).toMatch(/return the literal string/);
  });

  it("not_sure variant tells the model to RE-FRAME (not repeat) the original", () => {
    expect(src).toMatch(/RE-FRAME|Re-frame|re-frame/);
    expect(src).toMatch(/Do NOT repeat your original wording/i);
  });

  it("pushback variant has 3 explicit moves: acknowledge / hold / Socratic question", () => {
    expect(src).toMatch(/ACKNOWLEDGE/i);
    expect(src).toMatch(/HOLD/i);
    expect(src).toMatch(/SOCRATIC/i);
  });
});

describe("ai-followup — tool-use contract", () => {
  it("uses submit_followup tool with followup_body string property", () => {
    expect(src).toContain('name: "submit_followup"');
    expect(src).toMatch(/followup_body:\s*\{/);
    expect(src).toMatch(/required:\s*\["followup_body"\]/);
  });

  it("forces tool_choice on the submit_followup tool", () => {
    expect(src).toMatch(
      /toolChoice:\s*\{\s*type:\s*"tool"\s*,\s*name:\s*FOLLOWUP_TOOL\.name\s*\}/,
    );
  });
});

describe("ai-followup — chokepoint + cost guard", () => {
  it("calls callAnthropicMessages (single chokepoint per CLAUDE.md)", () => {
    expect(src).toMatch(
      /import\s*\{\s*callAnthropicMessages\s*\}\s*from\s*"@\/lib\/ai\/call"/,
    );
    expect(src).toMatch(/await\s+callAnthropicMessages\(/);
  });

  it("does NOT import the Anthropic SDK directly", () => {
    // Strip comments first so doc references to "Anthropic" don't trip.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toMatch(/from\s+"@anthropic-ai\/sdk"/);
    expect(codeOnly).not.toMatch(/new\s+Anthropic\(/);
  });

  it("declares MAX_OUTPUT_TOKENS to avoid silent truncation (Lesson #39)", () => {
    expect(src).toMatch(/MAX_OUTPUT_TOKENS\s*=\s*\d+/);
    expect(src).toMatch(/maxTokens:\s*MAX_OUTPUT_TOKENS/);
  });

  it("translates 'truncated' stop_reason to an explicit throw (Lesson #39)", () => {
    expect(src).toMatch(/callResult\.reason\s*===\s*"truncated"/);
  });

  it("uses the conventional endpoint string lib/grading/ai-followup", () => {
    expect(src).toMatch(/endpoint:\s*"lib\/grading\/ai-followup"/);
  });
});

describe("ai-followup — fast-path for thin got_it threads", () => {
  it("returns NO_FOLLOWUP_SENTINEL without burning a Haiku call when got_it + empty reply + thin response", () => {
    // Avoids ~$0.0015 per click for the most common case (single-
    // click got_it on a brief response). Pin the guard.
    expect(src).toMatch(
      /input\.sentiment\s*===\s*"got_it"\s*&&\s*!input\.replyText\.trim\(\)\s*&&\s*input\.studentResponse\.trim\(\)\.length\s*<\s*20/,
    );
    expect(src).toMatch(/draftBody:\s*NO_FOLLOWUP_SENTINEL/);
  });
});
