/**
 * Lever 1 sub-phase 1G — schema shape assertions.
 *
 * Verifies the three production-side schemas now require the v2 slot
 * fields (framing / task / success_signal) and DO NOT require legacy
 * `prompt`. Anthropic's tool_use enforces required fields, so this
 * shape lock guarantees future generations produce three-slot output.
 *
 * Pattern bug guard (Lesson #39): three sites repeat the same schema
 * pattern. Tests every site so a regression at any one of them trips.
 *
 * Brief: docs/projects/lesson-quality-lever-1-slot-fields.md
 */

import { describe, it, expect } from "vitest";
import {
  buildPageGenerationTool,
  buildLessonGenerationTool,
  buildTimelineGenerationTool,
} from "../schemas";

// Tool input_schema is a deeply nested object literal. We pull the
// activity-section sub-schema out of each tool to assert shape.
// The .properties wrapper around individual page IDs (A1, L01, etc.)
// is direct — no extra nesting under "pages" / "lessons".

describe("Lever 1 1G schema shape — page-mode (sections)", () => {
  const tool = buildPageGenerationTool("A", 1, "design");
  const topProps = (tool.input_schema as Record<string, unknown>).properties as Record<string, unknown>;
  const a1 = topProps.A1 as Record<string, unknown>;
  const a1Props = a1.properties as Record<string, unknown>;
  const sections = a1Props.sections as Record<string, unknown>;
  const sectionItem = sections.items as Record<string, unknown>;
  const required = sectionItem.required as string[];
  const properties = sectionItem.properties as Record<string, unknown>;

  it("requires framing in section schema", () => {
    expect(required).toContain("framing");
    expect(properties.framing).toBeDefined();
  });

  it("requires task in section schema", () => {
    expect(required).toContain("task");
    expect(properties.task).toBeDefined();
  });

  it("requires success_signal in section schema", () => {
    expect(required).toContain("success_signal");
    expect(properties.success_signal).toBeDefined();
  });

  it("does NOT require legacy prompt in section schema", () => {
    expect(required).not.toContain("prompt");
  });

  it("preserves responseType requirement (regression guard)", () => {
    expect(required).toContain("responseType");
  });
});

describe("Lever 1 1G schema shape — journey-mode lessons (sections)", () => {
  const tool = buildLessonGenerationTool(["L01"], "design");
  const topProps = (tool.input_schema as Record<string, unknown>).properties as Record<string, unknown>;
  const l01 = topProps.L01 as Record<string, unknown>;
  const l01Props = l01.properties as Record<string, unknown>;
  const sections = l01Props.sections as Record<string, unknown>;
  const sectionItem = sections.items as Record<string, unknown>;
  const required = sectionItem.required as string[];
  const properties = sectionItem.properties as Record<string, unknown>;

  it("requires framing in journey-section schema", () => {
    expect(required).toContain("framing");
    expect(properties.framing).toBeDefined();
  });

  it("requires task in journey-section schema", () => {
    expect(required).toContain("task");
    expect(properties.task).toBeDefined();
  });

  it("requires success_signal in journey-section schema", () => {
    expect(required).toContain("success_signal");
    expect(properties.success_signal).toBeDefined();
  });

  it("does NOT require legacy prompt in journey-section schema", () => {
    expect(required).not.toContain("prompt");
  });

  it("preserves criterionTags requirement (regression guard)", () => {
    expect(required).toContain("criterionTags");
  });
});

describe("Lever 1 1G schema shape — timeline-mode (flat activity)", () => {
  const tool = buildTimelineGenerationTool(8);
  const topProps = (tool.input_schema as Record<string, unknown>).properties as Record<string, unknown>;
  const activities = topProps.activities as Record<string, unknown>;
  const activityItem = activities.items as Record<string, unknown>;
  const required = activityItem.required as string[];
  const properties = activityItem.properties as Record<string, unknown>;

  it("requires framing in timeline-activity schema", () => {
    expect(required).toContain("framing");
    expect(properties.framing).toBeDefined();
  });

  it("requires task in timeline-activity schema", () => {
    expect(required).toContain("task");
    expect(properties.task).toBeDefined();
  });

  it("requires success_signal in timeline-activity schema", () => {
    expect(required).toContain("success_signal");
    expect(properties.success_signal).toBeDefined();
  });

  it("does NOT require legacy prompt in timeline-activity schema", () => {
    expect(required).not.toContain("prompt");
  });

  it("preserves id, role, title requirements (regression guard)", () => {
    expect(required).toContain("id");
    expect(required).toContain("role");
    expect(required).toContain("title");
  });
});
