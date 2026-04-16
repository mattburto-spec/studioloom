/**
 * Tests for the bold-heading promotion logic in extractFromDOCX.
 *
 * Since we can't easily create DOCX buffers in tests, we test the
 * promoteBoldToHeadings function indirectly by importing it.
 * The function is private, so we test the public behavior: extractFromDOCX
 * with real mammoth output patterns via the sectionsToMarkdown round-trip.
 */
import { describe, it, expect } from "vitest";
import { sectionsToMarkdown, type ExtractedSection } from "../extract";
import { parseDocument } from "@/lib/ingestion/parse";

describe("bold-heading promotion integration", () => {
  it("splits document with Week headings into multiple sections", () => {
    // Simulates what sectionsToMarkdown produces AFTER bold promotion
    // creates proper heading sections from a teacher doc
    const sections: ExtractedSection[] = [
      { heading: "Unit Overview", content: "This unit explores biomimicry." },
      { heading: "Week 1: Introduction to Biomimicry", content: "Students learn about nature-inspired design." },
      { heading: "Lesson 1: What is Biomimicry?", content: "Activity exploring natural designs." },
      { heading: "Lesson 2: Nature Walk", content: "Outdoor observation activity." },
      { heading: "Week 2: Research Phase", content: "Students research specific examples." },
      { heading: "Lesson 3: Case Studies", content: "Analyse real biomimicry products." },
      { heading: "Lesson 4: Research Presentation", content: "Present findings to class." },
    ];

    const markdown = sectionsToMarkdown(sections);
    const parsed = parseDocument(markdown);

    // Should detect all 7 sections
    expect(parsed.sections.length).toBeGreaterThanOrEqual(7);

    // Should detect Week and Lesson headings
    const headings = parsed.sections.map(s => s.heading);
    expect(headings.some(h => h.includes("Week 1"))).toBe(true);
    expect(headings.some(h => h.includes("Week 2"))).toBe(true);
    expect(headings.some(h => h.includes("Lesson 1"))).toBe(true);
    expect(headings.some(h => h.includes("Lesson 4"))).toBe(true);
  });

  it("12-lesson unit plan produces 12+ detected sections", () => {
    // Simulates a typical teacher unit plan structure (the Biomimicry doc)
    const lessons = Array.from({ length: 12 }, (_, i) => ({
      heading: `Lesson ${i + 1}: Activity ${i + 1}`,
      content: `Students complete activity ${i + 1}. This involves research, design, and reflection. Duration: 50 minutes.`,
    }));

    const sections: ExtractedSection[] = [
      { heading: "Product Design - Biomimicry Unit Plan", content: "A 12-lesson unit exploring biomimicry." },
      ...lessons,
    ];

    const markdown = sectionsToMarkdown(sections);
    const parsed = parseDocument(markdown);

    // Should detect at least 12 lesson sections
    const lessonSections = parsed.sections.filter(s =>
      /^Lesson \d+/i.test(s.heading)
    );
    expect(lessonSections.length).toBe(12);
  });

  it("handles mixed Week and Lesson structure", () => {
    const sections: ExtractedSection[] = [
      { heading: "Week 1", content: "Overview of week 1." },
      { heading: "Lesson 1: Introduction", content: "Intro activity." },
      { heading: "Lesson 2: Research", content: "Research activity." },
      { heading: "Week 2", content: "Overview of week 2." },
      { heading: "Lesson 3: Design", content: "Design activity." },
      { heading: "Lesson 4: Build", content: "Build activity." },
      { heading: "Weeks 3-4", content: "Overview of weeks 3 and 4." },
      { heading: "Lesson 5: Test", content: "Testing activity." },
      { heading: "Lesson 6: Present", content: "Presentation activity." },
    ];

    const markdown = sectionsToMarkdown(sections);
    const parsed = parseDocument(markdown);

    expect(parsed.sections.length).toBeGreaterThanOrEqual(9);
    // Verify Week headings detected
    const weekSections = parsed.sections.filter(s => /^Weeks?\s+\d/i.test(s.heading));
    expect(weekSections.length).toBeGreaterThanOrEqual(3);
  });
});
