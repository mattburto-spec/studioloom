/**
 * TG.0C.3 — pure-logic tests for TasksPanel display formatters.
 *
 * Per Lesson #71: tests import from the .ts sibling, never from the .tsx.
 * Per Lesson #38: assertions check expected values, not just non-null.
 */

import { describe, it, expect } from "vitest";
import {
  buildCriterionLabelMap,
  extractDueDate,
  formatCriterionLine,
  formatDueDate,
  formatTaskRow,
} from "../TasksPanel.types";
import type { AssessmentTask } from "@/lib/tasks/types";
import type { NeutralCriterionKey } from "@/lib/pipeline/stages/stage4-neutral-validator";

describe("formatDueDate", () => {
  it("formats ISO date as 'Wkd D Mmm'", () => {
    // 2026-05-12 was a Tuesday
    expect(formatDueDate("2026-05-12")).toBe("Tue 12 May");
  });

  it("returns empty string for missing input", () => {
    expect(formatDueDate(undefined)).toBe("");
    expect(formatDueDate(null)).toBe("");
    expect(formatDueDate("")).toBe("");
  });

  it("returns empty string for malformed input", () => {
    expect(formatDueDate("May 12 2026")).toBe("");
    expect(formatDueDate("2026-5-12")).toBe(""); // not zero-padded → fails regex
    expect(formatDueDate("not-a-date")).toBe("");
  });

  it("handles single-digit days correctly (no leading zero in output)", () => {
    expect(formatDueDate("2026-05-01")).toBe("Fri 1 May");
  });

  it("is timezone-stable (uses UTC construction)", () => {
    // 2026-01-01 is a Thursday in UTC, regardless of test runner TZ
    expect(formatDueDate("2026-01-01")).toBe("Thu 1 Jan");
    expect(formatDueDate("2026-12-31")).toBe("Thu 31 Dec");
  });
});

describe("formatCriterionLine", () => {
  it("returns short framework labels joined with comma", () => {
    const map = new Map<NeutralCriterionKey, string>([
      ["researching", "A"],
      ["analysing", "A"],
      ["designing", "B"],
      ["planning", "B"],
    ]);
    expect(formatCriterionLine(["researching", "designing"], map)).toBe("A, B");
  });

  it("returns empty string for empty input", () => {
    const map = new Map<NeutralCriterionKey, string>([
      ["researching", "A"],
    ]);
    expect(formatCriterionLine([], map)).toBe("");
  });

  it("falls back to neutral key if not in label map", () => {
    const map = new Map<NeutralCriterionKey, string>();
    expect(formatCriterionLine(["researching"], map)).toBe("researching");
  });

  it("preserves duplicates (e.g. A appearing twice — both researching+analysing map to A)", () => {
    const map = new Map<NeutralCriterionKey, string>([
      ["researching", "A"],
      ["analysing", "A"],
    ]);
    expect(formatCriterionLine(["researching", "analysing"], map)).toBe("A, A");
  });
});

describe("buildCriterionLabelMap", () => {
  it("inverts criterion definitions into a flat key→short map", () => {
    const defs = [
      {
        short: "A",
        neutralKeys: ["researching", "analysing"] as NeutralCriterionKey[],
      },
      {
        short: "B",
        neutralKeys: ["designing", "planning"] as NeutralCriterionKey[],
      },
      {
        short: "C",
        neutralKeys: ["creating"] as NeutralCriterionKey[],
      },
      {
        short: "D",
        neutralKeys: ["evaluating", "reflecting"] as NeutralCriterionKey[],
      },
    ];
    const map = buildCriterionLabelMap("IB_MYP", defs);
    expect(map.size).toBe(7);
    expect(map.get("researching")).toBe("A");
    expect(map.get("analysing")).toBe("A");
    expect(map.get("designing")).toBe("B");
    expect(map.get("creating")).toBe("C");
    expect(map.get("reflecting")).toBe("D");
  });

  it("returns empty map for empty defs", () => {
    const map = buildCriterionLabelMap("IB_MYP", []);
    expect(map.size).toBe(0);
  });
});

describe("extractDueDate", () => {
  it("pulls due_date out of formative config", () => {
    const task: AssessmentTask = {
      id: "t1",
      unit_id: "u1",
      class_id: null,
      school_id: "s1",
      title: "Quiz",
      task_type: "formative",
      status: "draft",
      config: { criteria: ["researching"], due_date: "2026-05-12" },
      created_by: "x",
      created_at: "now",
      updated_at: "now",
      criteria: ["researching"],
      linked_pages: [],
    };
    expect(extractDueDate(task)).toBe("2026-05-12");
  });

  it("returns empty string when due_date is missing", () => {
    const task: AssessmentTask = {
      id: "t1",
      unit_id: "u1",
      class_id: null,
      school_id: "s1",
      title: "Quiz",
      task_type: "formative",
      status: "draft",
      config: { criteria: ["researching"] },
      created_by: "x",
      created_at: "now",
      updated_at: "now",
      criteria: ["researching"],
      linked_pages: [],
    };
    expect(extractDueDate(task)).toBe("");
  });

  it("returns empty string when due_date is non-string", () => {
    const task: AssessmentTask = {
      id: "t1",
      unit_id: "u1",
      class_id: null,
      school_id: "s1",
      title: "Quiz",
      task_type: "formative",
      status: "draft",
      config: { criteria: ["researching"], due_date: 12345 } as any,
      created_by: "x",
      created_at: "now",
      updated_at: "now",
      criteria: ["researching"],
      linked_pages: [],
    };
    expect(extractDueDate(task)).toBe("");
  });
});

describe("formatTaskRow", () => {
  const labelMap = new Map<NeutralCriterionKey, string>([
    ["researching", "A"],
    ["analysing", "A"],
    ["designing", "B"],
  ]);

  function baseTask(over: Partial<AssessmentTask> = {}): AssessmentTask {
    return {
      id: "t1",
      unit_id: "u1",
      class_id: null,
      school_id: "s1",
      title: "Quiz 1",
      task_type: "formative",
      status: "draft",
      config: { criteria: ["researching"], due_date: "2026-05-12" },
      created_by: "x",
      created_at: "now",
      updated_at: "now",
      criteria: ["researching"],
      linked_pages: [],
      ...over,
    };
  }

  it("renders a formative draft row", () => {
    const row = formatTaskRow(baseTask(), labelMap);
    expect(row.id).toBe("t1");
    expect(row.icon).toBe("⚡");
    expect(row.title).toBe("Quiz 1");
    expect(row.criterionLine).toBe("A");
    expect(row.dueLine).toBe("Tue 12 May");
    expect(row.statusBadge).toBe(""); // draft → no badge
    expect(row.isSummative).toBe(false);
  });

  it("renders a published formative row with badge", () => {
    const row = formatTaskRow(baseTask({ status: "published" }), labelMap);
    expect(row.statusBadge).toBe("Published");
  });

  it("renders a closed task row with badge", () => {
    const row = formatTaskRow(baseTask({ status: "closed" }), labelMap);
    expect(row.statusBadge).toBe("Closed");
  });

  it("renders a summative task row with target icon + isSummative=true", () => {
    const task = baseTask({
      task_type: "summative",
      title: "Roller Coaster Brief",
      criteria: ["researching", "analysing", "designing"],
      config: {} as any, // summative config not relevant for TG.0C row test
    });
    const row = formatTaskRow(task, labelMap);
    expect(row.icon).toBe("🎯");
    expect(row.title).toBe("Roller Coaster Brief");
    expect(row.criterionLine).toBe("A, A, B");
    expect(row.isSummative).toBe(true);
  });

  it("renders empty criterion line + due line when neither is present", () => {
    const task = baseTask({ criteria: [], config: { criteria: [] } });
    const row = formatTaskRow(task, labelMap);
    expect(row.criterionLine).toBe("");
    expect(row.dueLine).toBe("");
  });

  it("falls back to default icon for unknown task_type (defensive)", () => {
    const task = baseTask({ task_type: "weekly" as any });
    const row = formatTaskRow(task, labelMap);
    expect(row.icon).toBe("📋");
  });
});
