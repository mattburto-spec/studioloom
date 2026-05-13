import { describe, it, expect } from "vitest";
import { adaptFields } from "../adapter";
import type { StructuredPromptsConfig } from "@/lib/structured-prompts/types";

/**
 * Phase C backfill (13 May 2026) — the per-prompt `targetChars` field
 * ships in JOURNAL_PROMPTS, but journal activity blocks created BEFORE
 * `a840a85` (~6 May → 13 May window) have their prompts snapshotted into
 * the block JSONB without `targetChars`. Their `criterion` tag is still
 * present though. So the renderer uses criterion-based defaults as a
 * second-tier fallback after explicit targetChars but before the global
 * 80-char default. These tests lock the precedence in.
 */

describe("adaptFields — target resolution precedence", () => {
  it("uses explicit targetChars when set (highest priority)", () => {
    const prompts: StructuredPromptsConfig = [
      {
        id: "did",
        label: "What did you DO?",
        targetChars: 25,
        criterion: "DO",
        softCharCap: 400,
      },
    ];
    const out = adaptFields(prompts);
    expect(out[0].target).toBe(25);
  });

  it("falls back to criterion default when targetChars is omitted (DO=40)", () => {
    // This is the bug-fix case: an old journal block whose prompts
    // were snapshotted before targetChars existed. Criterion is still
    // present → renderer applies the DO default of 40.
    const prompts: StructuredPromptsConfig = [
      {
        id: "did",
        label: "What did you DO?",
        criterion: "DO",
        softCharCap: 400,
      },
    ];
    const out = adaptFields(prompts);
    expect(out[0].target).toBe(40);
  });

  it("applies per-criterion defaults: DO=40, NOTICE=40, DECIDE=50, NEXT=30", () => {
    const prompts: StructuredPromptsConfig = [
      { id: "did", label: "DO?", criterion: "DO", softCharCap: 400 },
      { id: "noticed", label: "NOTICE?", criterion: "NOTICE", softCharCap: 400 },
      { id: "decided", label: "DECIDE?", criterion: "DECIDE", softCharCap: 400 },
      { id: "next", label: "NEXT?", criterion: "NEXT", softCharCap: 300 },
    ];
    const out = adaptFields(prompts);
    expect(out.map((f) => f.target)).toEqual([40, 40, 50, 30]);
  });

  it("falls back to 80-char global default when neither targetChars nor criterion is set", () => {
    const prompts: StructuredPromptsConfig = [
      {
        id: "open",
        label: "Strategy canvas philosophy",
        softCharCap: 300,
      },
    ];
    const out = adaptFields(prompts);
    expect(out[0].target).toBe(80);
  });

  it("caps target at softCharCap when criterion default would exceed it", () => {
    // Pathological: DECIDE criterion (default 50) with a softCharCap of
    // only 30. The cap wins — never ask for more than the prompt allows.
    const prompts: StructuredPromptsConfig = [
      {
        id: "decided",
        label: "DECIDE?",
        criterion: "DECIDE",
        softCharCap: 30,
      },
    ];
    const out = adaptFields(prompts);
    expect(out[0].target).toBe(30);
  });

  it("caps target at softCharCap when explicit targetChars exceeds it", () => {
    const prompts: StructuredPromptsConfig = [
      {
        id: "did",
        label: "DO?",
        targetChars: 200,
        criterion: "DO",
        softCharCap: 80,
      },
    ];
    const out = adaptFields(prompts);
    expect(out[0].target).toBe(80);
  });

  it("passes through already-adapted MultiQuestionField shape unchanged", () => {
    // Storybook / standalone shape — has target+max already, adapter
    // should be a no-op for these.
    const out = adaptFields([
      { id: "x", label: "X", target: 17, max: 200, criterion: "DO" },
    ]);
    expect(out[0].target).toBe(17);
    expect(out[0].max).toBe(200);
  });
});
