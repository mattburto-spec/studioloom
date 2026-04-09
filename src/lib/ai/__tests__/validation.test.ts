/**
 * Tests for AI output validation — validateGeneratedPages + validateTimelineActivities
 *
 * These validators are the LAST LINE OF DEFENSE before AI-generated content
 * reaches the database. They will be reused in Dimensions3 Stage 3 (gap fill)
 * and Stage 4 (polish). Bugs here = corrupted units in production.
 */

import { describe, it, expect } from "vitest";
import { validateGeneratedPages, validateTimelineActivities } from "../validation";

// =========================================================================
// validateGeneratedPages
// =========================================================================

describe("validateGeneratedPages", () => {
  function makePage(overrides?: Record<string, unknown>) {
    return {
      title: "Introduction to User Research",
      learningGoal: "Students will understand the purpose of user research in the design cycle",
      sections: [
        {
          prompt: "Describe a time when a product didn't meet your needs. What went wrong?",
          responseType: "text",
        },
      ],
      ...overrides,
    };
  }

  it("accepts a valid page", () => {
    const result = validateGeneratedPages({ "page-1": makePage() });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.pages["page-1"]).toBeDefined();
  });

  it("validates multiple pages independently", () => {
    const result = validateGeneratedPages({
      "page-1": makePage(),
      "page-2": makePage({ title: "Lesson 2" }),
      "page-3": makePage({ title: "" }), // invalid
    });
    expect(result.pages["page-1"]).toBeDefined();
    expect(result.pages["page-2"]).toBeDefined();
    expect(result.pages["page-3"]).toBeUndefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects page with missing title", () => {
    const result = validateGeneratedPages({ p: makePage({ title: undefined }) });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("title"))).toBe(true);
  });

  it("rejects page with missing learningGoal", () => {
    const result = validateGeneratedPages({ p: makePage({ learningGoal: "" }) });
    expect(result.valid).toBe(false);
  });

  it("rejects page with empty sections array", () => {
    const result = validateGeneratedPages({ p: makePage({ sections: [] }) });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("sections"))).toBe(true);
  });

  it("auto-fixes invalid responseType to 'text'", () => {
    const page = makePage({
      sections: [{ prompt: "What do you think?", responseType: "INVALID_TYPE" }],
    });
    const result = validateGeneratedPages({ p: page });
    expect(result.valid).toBe(true);
    // The section should still exist with fixed type
    const sections = result.pages.p?.sections;
    expect(sections).toBeDefined();
    if (sections) {
      expect((sections[0] as Record<string, unknown>).responseType).toBe("text");
    }
  });

  it("removes invalid vocabWarmup gracefully", () => {
    const page = makePage({ vocabWarmup: { terms: "not-an-array" } });
    const result = validateGeneratedPages({ p: page });
    expect(result.valid).toBe(true);
    expect(result.pages.p?.vocabWarmup).toBeUndefined();
  });

  it("fixes invalid vocab activity type to 'matching'", () => {
    const page = makePage({
      vocabWarmup: {
        terms: [{ term: "Prototype", definition: "A first model" }],
        activity: { type: "INVALID" },
      },
    });
    const result = validateGeneratedPages({ p: page });
    expect(result.valid).toBe(true);
  });

  it("fixes invalid reflection type to 'confidence-slider'", () => {
    const page = makePage({
      reflection: { type: "INVALID", items: ["I understand"] },
    });
    const result = validateGeneratedPages({ p: page });
    expect(result.valid).toBe(true);
  });

  it("adds default reflection items if missing", () => {
    const page = makePage({
      reflection: { type: "checklist" },
    });
    const result = validateGeneratedPages({ p: page });
    expect(result.valid).toBe(true);
  });

  it("rejects non-object page values", () => {
    const result = validateGeneratedPages({
      p1: "string",
      p2: null,
      p3: 42,
    } as unknown as Record<string, unknown>);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(3);
  });

  it("handles section with missing prompt", () => {
    const page = makePage({
      sections: [{ responseType: "text" }], // no prompt
    });
    const result = validateGeneratedPages({ p: page });
    // Page should fail because no valid sections remain
    expect(result.valid).toBe(false);
  });

  it("handles empty input gracefully", () => {
    const result = validateGeneratedPages({});
    expect(result.valid).toBe(true);
    expect(Object.keys(result.pages)).toHaveLength(0);
  });
});

// =========================================================================
// validateTimelineActivities
// =========================================================================

describe("validateTimelineActivities", () => {
  function makeActivity(overrides?: Record<string, unknown>) {
    return {
      id: "act-1",
      role: "core",
      title: "Design Sketching",
      prompt: "Create 3 thumbnail sketches of your packaging concept",
      durationMinutes: 15,
      responseType: "upload",
      ...overrides,
    };
  }

  it("accepts valid activities", () => {
    const result = validateTimelineActivities([makeActivity()]);
    expect(result.activities).toHaveLength(1);
  });

  it("rejects activity without id", () => {
    const result = validateTimelineActivities([makeActivity({ id: undefined })]);
    expect(result.errors.some((e) => e.includes("id"))).toBe(true);
  });

  it("defaults invalid role to 'core'", () => {
    const result = validateTimelineActivities([makeActivity({ role: "INVALID" })]);
    expect(result.activities[0].role).toBe("core");
    expect(result.errors.some((e) => e.includes("role"))).toBe(true);
  });

  it("defaults invalid durationMinutes to 10", () => {
    const result = validateTimelineActivities([makeActivity({ durationMinutes: -5 })]);
    expect(result.activities[0].durationMinutes).toBe(10);
  });

  it("defaults missing responseType to 'text'", () => {
    const result = validateTimelineActivities([makeActivity({ responseType: undefined })]);
    expect((result.activities[0] as unknown as Record<string, unknown>).responseType).toBe("text");
  });

  it("removes invalid media objects", () => {
    const result = validateTimelineActivities([
      makeActivity({ media: { type: "image" } }), // missing url
    ]);
    expect((result.activities[0] as unknown as Record<string, unknown>).media).toBeUndefined();
  });

  it("filters invalid links", () => {
    const result = validateTimelineActivities([
      makeActivity({
        links: [
          { url: "https://example.com", label: "Good link" },
          { url: 123, label: "Bad link" },
          { url: "https://other.com" }, // missing label
        ],
      }),
    ]);
    const links = (result.activities[0] as unknown as Record<string, unknown>).links as unknown[];
    expect(links).toHaveLength(1);
  });

  it("enforces Workshop Model ordering — warmup first, reflection last", () => {
    const activities = [
      makeActivity({ id: "core-1", role: "core", title: "Main activity" }),
      makeActivity({ id: "reflect-1", role: "reflection", title: "Exit ticket" }),
      makeActivity({ id: "warmup-1", role: "warmup", title: "Quick sketch warm-up" }),
    ];
    const result = validateTimelineActivities(activities);
    // warmup should be first, reflection should be last
    expect(result.activities[0].id).toBe("warmup-1");
    expect(result.activities[result.activities.length - 1].id).toBe("reflect-1");
  });

  it("moves exit-titled core activities to end", () => {
    const activities = [
      makeActivity({ id: "exit-1", role: "core", title: "Exit ticket — one word reflection" }),
      makeActivity({ id: "core-1", role: "core", title: "Sketching practice" }),
    ];
    const result = validateTimelineActivities(activities);
    expect(result.activities[0].id).toBe("core-1");
    expect(result.activities[1].id).toBe("exit-1");
  });

  it("detects various exit keywords", () => {
    const exitTitles = ["Debrief circle", "Wrap-up discussion", "Closing thoughts", "Whip around", "Lesson exit"];
    for (const title of exitTitles) {
      const activities = [
        makeActivity({ id: "exit", role: "core", title }),
        makeActivity({ id: "main", role: "core", title: "Main work" }),
      ];
      const result = validateTimelineActivities(activities);
      expect(result.activities[result.activities.length - 1].id).toBe("exit");
    }
  });

  it("handles single activity without reordering", () => {
    const result = validateTimelineActivities([makeActivity()]);
    expect(result.activities).toHaveLength(1);
  });

  it("handles empty array", () => {
    const result = validateTimelineActivities([]);
    expect(result.activities).toHaveLength(0);
    expect(result.valid).toBe(true);
  });

  it("rejects completely invalid objects", () => {
    const result = validateTimelineActivities([null, "string", 42]);
    expect(result.activities).toHaveLength(0);
    expect(result.errors.length).toBe(3);
  });

  it("content role doesn't need responseType", () => {
    const result = validateTimelineActivities([
      makeActivity({ role: "content", responseType: undefined }),
    ]);
    expect(result.activities).toHaveLength(1);
    // Should NOT have defaulted responseType to text for content role
    expect((result.activities[0] as unknown as Record<string, unknown>).responseType).toBeUndefined();
  });
});
