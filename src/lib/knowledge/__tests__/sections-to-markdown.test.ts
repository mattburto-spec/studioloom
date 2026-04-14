/**
 * Tests for sectionsToMarkdown — rebuilds heading-rich markdown from
 * ExtractedSection[] so parseDocument can detect section boundaries.
 */
import { describe, it, expect } from "vitest";
import { sectionsToMarkdown } from "../extract";
import { parseDocument } from "@/lib/ingestion/parse";

describe("sectionsToMarkdown", () => {
  it("rebuilds markdown with # heading prefixes from sections", () => {
    const sections = [
      { heading: "Intro", content: "hello" },
      { heading: "Activity 1", content: "do thing" },
    ];
    const result = sectionsToMarkdown(sections);
    expect(result).toBe("# Intro\n\nhello\n\n# Activity 1\n\ndo thing");
  });

  it("skips empty heading + content blocks", () => {
    const sections = [
      { heading: "Real", content: "data" },
      { heading: "", content: "" },
      { heading: "Also Real", content: "more data" },
    ];
    const result = sectionsToMarkdown(sections);
    expect(result).toBe("# Real\n\ndata\n\n# Also Real\n\nmore data");
    expect(result).not.toContain("\n\n\n");
  });

  it("round-trips through parseDocument and produces multiple sections from heading-rich input", () => {
    const sections = [
      { heading: "Introduction", content: "Welcome to the lesson on sustainable design." },
      { heading: "Activity 1: Research Phase", content: "Students research existing sustainable packaging solutions online. Work in pairs to compile a mood board of at least 5 examples." },
      { heading: "Activity 2: Brainstorm Session", content: "Using the SCAMPER method, students generate at least 10 ideas for packaging redesign." },
      { heading: "Activity 3: Prototype Build", content: "Build a scale model of your chosen packaging design using cardboard, recycled materials, and tape." },
    ];

    const markdown = sectionsToMarkdown(sections);
    const parsed = parseDocument(markdown);

    // parseDocument should detect at least 4 sections from the 4 headings
    expect(parsed.sections.length).toBeGreaterThanOrEqual(4);
    // At least one section heading should contain "Activity"
    const activitySections = parsed.sections.filter((s) =>
      s.heading.includes("Activity")
    );
    expect(activitySections.length).toBeGreaterThanOrEqual(1);
    // Title should be detected from the first heading
    expect(parsed.title).toBe("Introduction");
  });
});
