/**
 * summariseInspirationBoardForAI — flatten Inspiration Board JSON into
 * a readable summary the AI grading helpers can actually reason about.
 *
 * Matt smoke 13 May 2026: focus panel showed raw JSON for IB
 * responses, AND the AI was receiving the same raw JSON and grading
 * the JSON structure instead of the student's commentary.
 */

import { describe, it, expect } from "vitest";
import { summariseInspirationBoardForAI } from "../parse-inspiration-board";

describe("summariseInspirationBoardForAI", () => {
  it("returns null for non-Inspiration-Board inputs (plain text, malformed JSON)", () => {
    expect(summariseInspirationBoardForAI("plain text response")).toBe(null);
    expect(summariseInspirationBoardForAI("{not valid json")).toBe(null);
    expect(summariseInspirationBoardForAI("")).toBe(null);
    expect(summariseInspirationBoardForAI(null)).toBe(null);
  });

  it("returns an empty-board stub when items array is empty", () => {
    const out = summariseInspirationBoardForAI(
      JSON.stringify({ items: [], synthesis: "", completed: false }),
    );
    expect(out).toMatch(/empty/i);
    expect(out).toMatch(/Inspiration Board/i);
  });

  it("flattens items as numbered list with commentary quoted", () => {
    const out = summariseInspirationBoardForAI(
      JSON.stringify({
        items: [
          {
            id: "a",
            url: "https://example.com/1.jpg",
            commentary: "Modular furniture inspired me",
            stealNote: "",
            altText: "img 1",
          },
          {
            id: "b",
            url: "https://example.com/2.jpg",
            commentary: "Love the wood texture",
            stealNote: "",
            altText: "img 2",
          },
        ],
        synthesis: "",
        completed: true,
      }),
    );
    expect(out).toMatch(/Inspiration Board \(2 images selected\)/);
    expect(out).toMatch(/1\. "Modular furniture inspired me"/);
    expect(out).toMatch(/2\. "Love the wood texture"/);
  });

  it("includes stealNote when present (student-curated 'what I'd steal' annotation)", () => {
    const out = summariseInspirationBoardForAI(
      JSON.stringify({
        items: [
          {
            id: "a",
            url: "/u/1.jpg",
            commentary: "Stunning silhouette",
            stealNote: "The asymmetric handle",
            altText: "",
          },
        ],
        synthesis: "",
        completed: true,
      }),
    );
    expect(out).toMatch(/What I'd steal: "The asymmetric handle"/);
  });

  it("appends synthesis as a trailing line when non-empty", () => {
    const out = summariseInspirationBoardForAI(
      JSON.stringify({
        items: [
          { id: "a", url: "/u/1.jpg", commentary: "x", stealNote: "", altText: "" },
        ],
        synthesis: "Combining modular ideas with natural materials",
        completed: true,
      }),
    );
    expect(out).toMatch(
      /Synthesis: "Combining modular ideas with natural materials"/,
    );
  });

  it("does NOT include URLs, IDs, or altText in the summary (signal-only)", () => {
    const url = "https://very-distinctive-test-domain.example.org/image.jpg";
    const id = "very-distinctive-test-id-xyz123";
    const out = summariseInspirationBoardForAI(
      JSON.stringify({
        items: [
          {
            id,
            url,
            commentary: "test commentary",
            stealNote: "",
            altText: "auto-generated alt text",
          },
        ],
        synthesis: "",
        completed: false,
      }),
    );
    expect(out).not.toContain(url);
    expect(out).not.toContain(id);
    expect(out).not.toContain("auto-generated alt text");
  });

  it("handles items with no commentary (renders a '(no commentary)' marker)", () => {
    const out = summariseInspirationBoardForAI(
      JSON.stringify({
        items: [
          { id: "a", url: "/u/1.jpg", commentary: "", stealNote: "", altText: "" },
        ],
        synthesis: "",
        completed: false,
      }),
    );
    expect(out).toMatch(/1\. \(no commentary\)/);
  });
});
