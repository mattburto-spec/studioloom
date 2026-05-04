/**
 * Lever 1 sub-phase 1H — validator slot-field regression guard.
 *
 * 1G changed the page + timeline tool schemas to require framing/task/
 * success_signal and stopped requiring legacy `prompt`. Without 1H's
 * matching validator update, every v2 generation would have been
 * rejected ("Missing 'prompt'"). These tests lock that fix in place.
 *
 * Pattern bug guard (Lesson #39): both validateGeneratedPages AND
 * validateTimelineActivities had the same legacy required-prompt
 * check. Tests both so a regression at either site trips.
 *
 * Brief: docs/projects/lesson-quality-lever-1-slot-fields.md
 */

import { describe, it, expect } from "vitest";
import { validateGeneratedPages, validateTimelineActivities } from "../validation";

describe("Lever 1 1H — validateGeneratedPages slot-aware (regression: 1G removed prompt from required)", () => {
  it("accepts a section with v2 slots only and composes prompt for back-compat", () => {
    const pages = {
      A1: {
        title: "Test Page",
        learningGoal: "Learn things",
        sections: [
          {
            framing: "Today we explore Newton's laws.",
            task: "Roll each racer down the ramp and observe.",
            success_signal: "Submit one conclusion sentence.",
            responseType: "text",
          },
        ],
      },
    };

    const result = validateGeneratedPages(pages);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.pages.A1).toBeDefined();
    const section = result.pages.A1.sections[0] as Record<string, unknown>;
    // Lever 1: validator composes legacy `prompt` from slots so non-migrated readers keep working
    expect(section.prompt).toBe(
      "Today we explore Newton's laws.\n\nRoll each racer down the ramp and observe.\n\nSubmit one conclusion sentence.",
    );
    expect(section.framing).toBe("Today we explore Newton's laws.");
    expect(section.task).toBe("Roll each racer down the ramp and observe.");
    expect(section.success_signal).toBe("Submit one conclusion sentence.");
  });

  it("accepts a legacy single-blob prompt (no slots) for back-compat", () => {
    const pages = {
      A1: {
        title: "Legacy Page",
        learningGoal: "Old-shape unit",
        sections: [
          {
            prompt: "Legacy single-blob prompt.",
            responseType: "text",
          },
        ],
      },
    };

    const result = validateGeneratedPages(pages);
    expect(result.valid).toBe(true);
    const section = result.pages.A1.sections[0] as Record<string, unknown>;
    expect(section.prompt).toBe("Legacy single-blob prompt.");
  });

  it("rejects when both slots and legacy prompt are missing", () => {
    const pages = {
      A1: {
        title: "Bad Page",
        learningGoal: "Goal",
        sections: [{ responseType: "text" }],
      },
    };

    const result = validateGeneratedPages(pages);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Missing both v2 slot fields");
  });

  it("composes prompt when only framing + task are populated (partial slots)", () => {
    const pages = {
      A1: {
        title: "Partial",
        learningGoal: "Goal",
        sections: [
          {
            framing: "Framing only.",
            task: "Task only.",
            responseType: "text",
          },
        ],
      },
    };

    const result = validateGeneratedPages(pages);
    expect(result.valid).toBe(true);
    const section = result.pages.A1.sections[0] as Record<string, unknown>;
    expect(section.prompt).toBe("Framing only.\n\nTask only.");
  });
});

describe("Lever 1 1H — validateTimelineActivities slot-aware (regression: 1G removed prompt from required)", () => {
  it("accepts a timeline activity with v2 slots only and composes prompt", () => {
    const activities = [
      {
        id: "a1",
        role: "core",
        title: "Ramp test",
        framing: "Today we test ramps.",
        task: "Roll each racer down the ramp.",
        success_signal: "Note the fastest racer.",
        durationMinutes: 15,
      },
    ];

    const result = validateTimelineActivities(activities);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.activities).toHaveLength(1);
    const a = result.activities[0] as Record<string, unknown>;
    // Lever 1: validator composes prompt from slots — keeps TimelineActivity
    // consumers (wizard, output-adapter) working without further changes.
    expect(a.prompt).toBe(
      "Today we test ramps.\n\nRoll each racer down the ramp.\n\nNote the fastest racer.",
    );
    expect(a.framing).toBe("Today we test ramps.");
    expect(a.task).toBe("Roll each racer down the ramp.");
    expect(a.success_signal).toBe("Note the fastest racer.");
  });

  it("accepts a legacy single-blob prompt (no slots) for back-compat", () => {
    const activities = [
      {
        id: "a1",
        role: "core",
        title: "Legacy task",
        prompt: "Legacy single-blob prompt that's substantive.",
        durationMinutes: 15,
      },
    ];

    const result = validateTimelineActivities(activities);
    expect(result.valid).toBe(true);
    const a = result.activities[0] as Record<string, unknown>;
    expect(a.prompt).toBe("Legacy single-blob prompt that's substantive.");
  });

  it("rejects when both slots and legacy prompt are missing", () => {
    const activities = [
      {
        id: "a1",
        role: "core",
        title: "Bad",
        durationMinutes: 15,
      },
    ];

    const result = validateTimelineActivities(activities);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Missing both v2 slot fields"))).toBe(true);
  });

  it("composes prompt when only framing + task are populated (partial slots)", () => {
    const activities = [
      {
        id: "a1",
        role: "core",
        title: "Partial",
        framing: "Framing only.",
        task: "Task only.",
        durationMinutes: 15,
      },
    ];

    const result = validateTimelineActivities(activities);
    expect(result.valid).toBe(true);
    const a = result.activities[0] as Record<string, unknown>;
    expect(a.prompt).toBe("Framing only.\n\nTask only.");
  });
});
