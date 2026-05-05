/**
 * AG.1 — pure-logic tests for structured-prompts payload composition + validation.
 *
 * Per Lesson #38: assertions check expected values, not just non-null.
 * Per Lesson #71: tests import from `.ts`, no JSX boundary crossing.
 */

import { describe, it, expect } from "vitest";
import {
  charCountStatus,
  composeContent,
  extractNextMove,
  isReadyToSubmit,
  validateResponses,
} from "../payload";
import { JOURNAL_PROMPTS } from "../presets";
import type { StructuredPromptsConfig } from "../types";

describe("validateResponses — required-field gate", () => {
  it("returns no errors when all required prompts are filled + photo if required", () => {
    const errors = validateResponses(
      JOURNAL_PROMPTS,
      {
        did: "Sanded the bottom",
        noticed: "Grain tear-out on back",
        decided: "Switched to 220 grit because 80 was too aggressive",
        next: "Mass check then start mid-section sand",
      },
      { photoProvided: true, photoRequired: true }
    );
    expect(errors).toEqual([]);
  });

  it("flags every empty required prompt", () => {
    const errors = validateResponses(
      JOURNAL_PROMPTS,
      { did: "x", decided: "y" },
      { photoProvided: true, photoRequired: false }
    );
    // 'noticed' + 'next' missing
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.promptId).sort()).toEqual(["next", "noticed"]);
  });

  it("flags whitespace-only responses as empty", () => {
    const errors = validateResponses(
      JOURNAL_PROMPTS,
      { did: "   ", noticed: "n", decided: "d", next: "x" },
      { photoProvided: true, photoRequired: false }
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].promptId).toBe("did");
  });

  it("flags missing photo when required", () => {
    const errors = validateResponses(
      JOURNAL_PROMPTS,
      { did: "x", noticed: "y", decided: "z", next: "w" },
      { photoProvided: false, photoRequired: true }
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].promptId).toBe("__photo");
    expect(errors[0].message).toContain("Photo");
  });

  it("does not require photo when photoRequired=false", () => {
    const errors = validateResponses(
      JOURNAL_PROMPTS,
      { did: "x", noticed: "y", decided: "z", next: "w" },
      { photoProvided: false, photoRequired: false }
    );
    expect(errors).toEqual([]);
  });

  it("does not flag non-required prompts when empty", () => {
    const config: StructuredPromptsConfig = [
      { id: "a", label: "A", required: true },
      { id: "b", label: "B", required: false },
    ];
    const errors = validateResponses(
      config,
      { a: "filled" },
      { photoProvided: false, photoRequired: false }
    );
    expect(errors).toEqual([]);
  });

  it("error message includes the prompt label for actionability", () => {
    const errors = validateResponses(
      JOURNAL_PROMPTS,
      { did: "", noticed: "n", decided: "d", next: "x" },
      { photoProvided: true, photoRequired: false }
    );
    expect(errors[0].message).toContain("What did you DO?");
  });
});

describe("isReadyToSubmit", () => {
  it("returns true when no errors", () => {
    expect(
      isReadyToSubmit(
        JOURNAL_PROMPTS,
        { did: "a", noticed: "b", decided: "c", next: "d" },
        { photoProvided: true, photoRequired: true }
      )
    ).toBe(true);
  });

  it("returns false on initial empty state", () => {
    expect(
      isReadyToSubmit(JOURNAL_PROMPTS, {}, {
        photoProvided: false,
        photoRequired: true,
      })
    ).toBe(false);
  });

  it("returns false if photo missing but text is filled (when photo required)", () => {
    expect(
      isReadyToSubmit(
        JOURNAL_PROMPTS,
        { did: "a", noticed: "b", decided: "c", next: "d" },
        { photoProvided: false, photoRequired: true }
      )
    ).toBe(false);
  });
});

describe("composeContent — markdown blob for portfolio_entries.content", () => {
  it("produces ## section per prompt with 1 blank line between", () => {
    const out = composeContent(
      [
        { id: "a", label: "Question A" },
        { id: "b", label: "Question B" },
      ],
      { a: "First answer", b: "Second answer" }
    );
    expect(out).toBe("## Question A\nFirst answer\n\n## Question B\nSecond answer");
  });

  it("trims whitespace from response values", () => {
    const out = composeContent(
      [{ id: "a", label: "A" }],
      { a: "   trimmed   " }
    );
    expect(out).toBe("## A\ntrimmed");
  });

  it("skips prompts with empty/whitespace responses (no orphan headers)", () => {
    const out = composeContent(
      [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
      { a: "filled", b: "   ", c: "" }
    );
    expect(out).toBe("## A\nfilled");
  });

  it("returns empty string when all responses empty", () => {
    expect(composeContent(JOURNAL_PROMPTS, {})).toBe("");
  });

  it("preserves prompt ORDER from config (not key order in responses object)", () => {
    const out = composeContent(
      [
        { id: "third", label: "Third" },
        { id: "first", label: "First" },
        { id: "second", label: "Second" },
      ],
      { first: "1", second: "2", third: "3" }
    );
    // Keys appear in config order, not alphabetical
    expect(out.indexOf("Third")).toBeLessThan(out.indexOf("First"));
    expect(out.indexOf("First")).toBeLessThan(out.indexOf("Second"));
  });

  it("handles full journal entry with realistic content", () => {
    const out = composeContent(JOURNAL_PROMPTS, {
      did: "Cut the profile on bandsaw",
      noticed: "The blade pulled to the right at the curve",
      decided: "I'll re-cut from 1mm outside the line because chasing the line caused tear-out",
      next: "Mass check then top-view cut",
    });
    expect(out).toContain("## What did you DO?");
    expect(out).toContain("## What did you NOTICE?");
    expect(out).toContain("## What did you DECIDE?");
    expect(out).toContain("## What's NEXT?");
    expect(out).toContain("Cut the profile on bandsaw");
    expect(out).toContain("re-cut from 1mm outside the line because");
  });
});

describe("extractNextMove — Kanban auto-create source", () => {
  it("returns the 'next' response when present + non-empty", () => {
    expect(
      extractNextMove({ next: "Mass check + paint prep" })
    ).toBe("Mass check + paint prep");
  });

  it("trims whitespace", () => {
    expect(extractNextMove({ next: "  Mass check  " })).toBe("Mass check");
  });

  it("returns null when 'next' is missing", () => {
    expect(extractNextMove({ did: "x" })).toBeNull();
  });

  it("returns null when 'next' is empty/whitespace", () => {
    expect(extractNextMove({ next: "" })).toBeNull();
    expect(extractNextMove({ next: "   " })).toBeNull();
  });

  it("respects custom nextPromptId for non-journal presets", () => {
    expect(
      extractNextMove({ followup: "Try iteration 2" }, "followup")
    ).toBe("Try iteration 2");
  });
});

describe("charCountStatus — UI char-count hint", () => {
  it("returns 'ok' when no soft cap", () => {
    const prompt = { id: "x", label: "X" };
    expect(charCountStatus(prompt, "any length goes")).toBe("ok");
  });

  it("returns 'ok' under 90% of cap", () => {
    const prompt = { id: "x", label: "X", softCharCap: 100 };
    expect(charCountStatus(prompt, "x".repeat(50))).toBe("ok");
    expect(charCountStatus(prompt, "x".repeat(89))).toBe("ok");
  });

  it("returns 'approaching' between 90% and 100%", () => {
    const prompt = { id: "x", label: "X", softCharCap: 100 };
    expect(charCountStatus(prompt, "x".repeat(91))).toBe("approaching");
    expect(charCountStatus(prompt, "x".repeat(100))).toBe("approaching");
  });

  it("returns 'over' past the cap", () => {
    const prompt = { id: "x", label: "X", softCharCap: 100 };
    expect(charCountStatus(prompt, "x".repeat(101))).toBe("over");
    expect(charCountStatus(prompt, "x".repeat(500))).toBe("over");
  });
});
