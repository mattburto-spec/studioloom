/**
 * AG.4.1 — pure aggregation tests.
 *
 * Per Lesson #38: assert specific values, not just non-null.
 * Per Lesson #71: imports from `.ts`, no JSX boundary.
 */

import { describe, it, expect } from "vitest";
import {
  computeThreeCs,
  computeLastCalibrationAt,
  hoursBetween,
  computeAttentionPriority,
  sortByAttention,
  flagSuggestedOneOnOne,
  buildAttentionPanel,
  THREE_CS_COMPETENCIES,
  type CompetencyAssessmentLike,
} from "../aggregate";
import type { AttentionRow } from "../types";

function ca(
  competency: string,
  rating: number,
  source: "student_self" | "teacher_observation",
  created_at: string
): CompetencyAssessmentLike {
  return { competency, rating, source, created_at };
}

describe("computeThreeCs", () => {
  it("returns all-null for empty input", () => {
    const r = computeThreeCs([]);
    expect(r).toEqual({
      choice: null,
      causation: null,
      change: null,
      aggregate: null,
    });
  });

  it("picks most-recent rating per dimension", () => {
    const rows = [
      ca(THREE_CS_COMPETENCIES.choice, 2, "student_self", "2026-05-01T10:00:00Z"),
      ca(THREE_CS_COMPETENCIES.choice, 3, "teacher_observation", "2026-05-02T10:00:00Z"),
      ca(THREE_CS_COMPETENCIES.causation, 1, "student_self", "2026-05-03T10:00:00Z"),
    ];
    const r = computeThreeCs(rows);
    expect(r.choice).toBe(3); // most recent wins regardless of source
    expect(r.causation).toBe(1);
    expect(r.change).toBeNull();
  });

  it("aggregate is mean of present dimensions", () => {
    const rows = [
      ca(THREE_CS_COMPETENCIES.choice, 2, "student_self", "2026-05-01T00:00:00Z"),
      ca(THREE_CS_COMPETENCIES.causation, 4, "student_self", "2026-05-01T00:00:00Z"),
    ];
    const r = computeThreeCs(rows);
    expect(r.aggregate).toBe(3); // (2+4)/2
  });

  it("aggregate is null when all three null", () => {
    const r = computeThreeCs([]);
    expect(r.aggregate).toBeNull();
  });

  it("ignores non-Three-Cs competencies", () => {
    const rows = [
      ca("communication", 4, "student_self", "2026-05-01T00:00:00Z"),
      ca(THREE_CS_COMPETENCIES.choice, 2, "student_self", "2026-05-01T00:00:00Z"),
    ];
    const r = computeThreeCs(rows);
    expect(r.choice).toBe(2);
    expect(r.aggregate).toBe(2); // only choice present
  });
});

describe("computeLastCalibrationAt", () => {
  it("returns null when no teacher_observation rows", () => {
    const rows = [
      ca(THREE_CS_COMPETENCIES.choice, 2, "student_self", "2026-05-01T00:00:00Z"),
    ];
    expect(computeLastCalibrationAt(rows)).toBeNull();
  });

  it("returns most recent teacher_observation", () => {
    const rows = [
      ca(THREE_CS_COMPETENCIES.choice, 2, "teacher_observation", "2026-05-01T00:00:00Z"),
      ca(THREE_CS_COMPETENCIES.causation, 3, "teacher_observation", "2026-05-03T00:00:00Z"),
      ca(THREE_CS_COMPETENCIES.change, 4, "teacher_observation", "2026-05-02T00:00:00Z"),
    ];
    expect(computeLastCalibrationAt(rows)).toBe("2026-05-03T00:00:00Z");
  });

  it("ignores student_self rows even if more recent", () => {
    const rows = [
      ca(THREE_CS_COMPETENCIES.choice, 2, "teacher_observation", "2026-05-01T00:00:00Z"),
      ca(THREE_CS_COMPETENCIES.choice, 3, "student_self", "2026-05-05T00:00:00Z"),
    ];
    expect(computeLastCalibrationAt(rows)).toBe("2026-05-01T00:00:00Z");
  });
});

describe("hoursBetween", () => {
  it("returns null when earlier is null", () => {
    expect(hoursBetween(null, "2026-05-01T00:00:00Z")).toBeNull();
  });

  it("returns positive hours for normal gap", () => {
    expect(
      hoursBetween("2026-05-01T00:00:00Z", "2026-05-01T12:00:00Z")
    ).toBe(12);
  });

  it("floors negatives to zero (clock-skew defence)", () => {
    expect(
      hoursBetween("2026-05-02T00:00:00Z", "2026-05-01T00:00:00Z")
    ).toBe(0);
  });
});

describe("computeAttentionPriority", () => {
  const NOW = "2026-05-06T00:00:00Z";

  it("zero-ish when everything fresh + threeCs maxed", () => {
    const score = computeAttentionPriority({
      lastJournalAt: NOW,
      lastKanbanMoveAt: NOW,
      lastCalibrationAt: NOW,
      threeCs: { choice: 4, causation: 4, change: 4, aggregate: 4 },
      nowIso: NOW,
    });
    expect(score).toBe(0); // 0 + 0 + 0 + (4-4=0)
  });

  it("treats null timestamps as max-cap gap", () => {
    const score = computeAttentionPriority({
      lastJournalAt: null,
      lastKanbanMoveAt: null,
      lastCalibrationAt: null,
      threeCs: { choice: null, causation: null, change: null, aggregate: null },
      nowIso: NOW,
    });
    // 7 (journal) + 7 (kanban) + 14 (calibration) + 2 (unknown threeCs) = 30
    expect(score).toBe(30);
  });

  it("caps individual gaps so one ancient signal doesn't dominate", () => {
    const score = computeAttentionPriority({
      lastJournalAt: "2025-01-01T00:00:00Z", // way over a year ago
      lastKanbanMoveAt: NOW,
      lastCalibrationAt: NOW,
      threeCs: { choice: 4, causation: 4, change: 4, aggregate: 4 },
      nowIso: NOW,
    });
    // journal cap = 7 days, others 0
    expect(score).toBe(7);
  });

  it("low threeCs adds to priority proportional to (4-aggregate)", () => {
    const score = computeAttentionPriority({
      lastJournalAt: NOW,
      lastKanbanMoveAt: NOW,
      lastCalibrationAt: NOW,
      threeCs: { choice: 1, causation: 1, change: 1, aggregate: 1 },
      nowIso: NOW,
    });
    expect(score).toBe(3); // 4 - 1
  });
});

describe("sortByAttention", () => {
  function row(
    over: Partial<AttentionRow> & {
      studentId: string;
      attentionPriority: number;
    }
  ): AttentionRow {
    return {
      displayName: over.displayName ?? `S-${over.studentId}`,
      lastJournalAt: null,
      lastKanbanMoveAt: null,
      lastCalibrationAt: null,
      threeCs: { choice: null, causation: null, change: null, aggregate: null },
      suggestedOneOnOne: false,
      ...over,
    };
  }

  it("sorts highest priority first", () => {
    const sorted = sortByAttention([
      row({ studentId: "a", attentionPriority: 1 }),
      row({ studentId: "b", attentionPriority: 5 }),
      row({ studentId: "c", attentionPriority: 3 }),
    ]);
    expect(sorted.map((r) => r.studentId)).toEqual(["b", "c", "a"]);
  });

  it("ties broken alphabetically by displayName", () => {
    const sorted = sortByAttention([
      row({ studentId: "a", displayName: "Bob", attentionPriority: 5 }),
      row({ studentId: "b", displayName: "Alice", attentionPriority: 5 }),
    ]);
    expect(sorted.map((r) => r.displayName)).toEqual(["Alice", "Bob"]);
  });

  it("does not mutate input", () => {
    const input = [
      row({ studentId: "a", attentionPriority: 1 }),
      row({ studentId: "b", attentionPriority: 5 }),
    ];
    const sorted = sortByAttention(input);
    expect(input.map((r) => r.studentId)).toEqual(["a", "b"]);
    expect(sorted.map((r) => r.studentId)).toEqual(["b", "a"]);
  });
});

describe("flagSuggestedOneOnOne", () => {
  function rowWithCs(studentId: string, agg: number | null): AttentionRow {
    return {
      studentId,
      displayName: `S-${studentId}`,
      lastJournalAt: null,
      lastKanbanMoveAt: null,
      lastCalibrationAt: null,
      threeCs: {
        choice: agg,
        causation: agg,
        change: agg,
        aggregate: agg,
      },
      attentionPriority: 0,
      suggestedOneOnOne: false,
    };
  }

  it("flags bottom-third by ThreeCs aggregate", () => {
    const rows = [
      rowWithCs("a", 4),
      rowWithCs("b", 3),
      rowWithCs("c", 2),
      rowWithCs("d", 1),
      rowWithCs("e", 0),
      rowWithCs("f", 4),
    ];
    const flagged = flagSuggestedOneOnOne(rows);
    const flaggedIds = flagged.filter((r) => r.suggestedOneOnOne).map((r) => r.studentId).sort();
    // ceil(6/3) = 2, bottom 2 by aggregate: e=0, d=1
    expect(flaggedIds).toEqual(["d", "e"]);
  });

  it("treats null aggregate as worst (always flagged in bottom)", () => {
    const rows = [
      rowWithCs("a", 4),
      rowWithCs("b", 3),
      rowWithCs("c", null), // never rated → bottom
    ];
    const flagged = flagSuggestedOneOnOne(rows);
    const flaggedIds = flagged.filter((r) => r.suggestedOneOnOne).map((r) => r.studentId);
    expect(flaggedIds).toContain("c");
  });

  it("flags at least one student even for tiny classes", () => {
    const rows = [rowWithCs("solo", 4)];
    const flagged = flagSuggestedOneOnOne(rows);
    expect(flagged[0].suggestedOneOnOne).toBe(true);
  });

  it("returns same length array (no drops)", () => {
    const rows = [rowWithCs("a", 4), rowWithCs("b", 3), rowWithCs("c", 2)];
    expect(flagSuggestedOneOnOne(rows)).toHaveLength(3);
  });
});

describe("buildAttentionPanel", () => {
  const NOW = "2026-05-06T00:00:00Z";

  it("returns empty rows + meta for empty roster", () => {
    const out = buildAttentionPanel({
      unitId: "u-1",
      classId: "c-1",
      nowIso: NOW,
      students: [],
      journalByStudent: {},
      kanbanMoveByStudent: {},
      kanbanCountsByStudent: {},
      competencyByStudent: {},
    });
    expect(out.unitId).toBe("u-1");
    expect(out.classId).toBe("c-1");
    expect(out.nowIso).toBe(NOW);
    expect(out.rows).toEqual([]);
  });

  it("populates per-student row with all signals", () => {
    const out = buildAttentionPanel({
      unitId: "u-1",
      classId: "c-1",
      nowIso: NOW,
      students: [{ studentId: "s1", displayName: "Alice" }],
      journalByStudent: { s1: "2026-05-05T00:00:00Z" },
      kanbanMoveByStudent: { s1: "2026-05-04T00:00:00Z" },
      kanbanCountsByStudent: { s1: { total: 4, done: 1 } },
      competencyByStudent: {
        s1: [
          ca(
            THREE_CS_COMPETENCIES.choice,
            3,
            "teacher_observation",
            "2026-05-03T00:00:00Z"
          ),
        ],
      },
    });
    expect(out.rows).toHaveLength(1);
    const r = out.rows[0];
    expect(r.displayName).toBe("Alice");
    expect(r.lastJournalAt).toBe("2026-05-05T00:00:00Z");
    expect(r.lastKanbanMoveAt).toBe("2026-05-04T00:00:00Z");
    expect(r.lastCalibrationAt).toBe("2026-05-03T00:00:00Z");
    expect(r.threeCs.choice).toBe(3);
    expect(r.threeCs.aggregate).toBe(3);
    // Kanban pulse counts come through from input
    expect(r.kanbanTotalCards).toBe(4);
    expect(r.kanbanDoneCount).toBe(1);
  });

  it("defaults kanban counts to zero when student has no kanban row", () => {
    const out = buildAttentionPanel({
      unitId: "u-1",
      classId: "c-1",
      nowIso: NOW,
      students: [{ studentId: "s-no-board", displayName: "Empty" }],
      journalByStudent: {},
      kanbanMoveByStudent: {},
      kanbanCountsByStudent: {}, // student missing from map → zeros
      competencyByStudent: {},
    });
    expect(out.rows[0].kanbanTotalCards).toBe(0);
    expect(out.rows[0].kanbanDoneCount).toBe(0);
  });

  it("sorts highest-priority first end-to-end", () => {
    const out = buildAttentionPanel({
      unitId: "u-1",
      classId: "c-1",
      nowIso: NOW,
      students: [
        { studentId: "s1", displayName: "Active" },
        { studentId: "s2", displayName: "Lapsed" },
      ],
      journalByStudent: { s1: NOW, s2: null }, // s2 never journalled
      kanbanMoveByStudent: { s1: NOW, s2: null },
      kanbanCountsByStudent: { s1: { total: 5, done: 2 }, s2: { total: 0, done: 0 } },
      competencyByStudent: {
        s1: [
          ca(
            THREE_CS_COMPETENCIES.choice,
            4,
            "teacher_observation",
            "2026-05-05T00:00:00Z"
          ),
        ],
        s2: [],
      },
    });
    // Lapsed (s2) should be first — null signals + no rating
    expect(out.rows.map((r) => r.studentId)).toEqual(["s2", "s1"]);
  });

  it("flags bottom-third for 1:1 in the panel output", () => {
    const out = buildAttentionPanel({
      unitId: "u-1",
      classId: "c-1",
      nowIso: NOW,
      students: [
        { studentId: "s1", displayName: "A" },
        { studentId: "s2", displayName: "B" },
        { studentId: "s3", displayName: "C" },
      ],
      journalByStudent: {},
      kanbanMoveByStudent: {},
      kanbanCountsByStudent: {},
      competencyByStudent: {
        s1: [ca(THREE_CS_COMPETENCIES.choice, 4, "student_self", NOW)],
        s2: [ca(THREE_CS_COMPETENCIES.choice, 3, "student_self", NOW)],
        s3: [ca(THREE_CS_COMPETENCIES.choice, 1, "student_self", NOW)],
      },
    });
    const flagged = out.rows.filter((r) => r.suggestedOneOnOne).map((r) => r.studentId);
    expect(flagged).toEqual(["s3"]); // bottom-third = 1 student
  });
});
