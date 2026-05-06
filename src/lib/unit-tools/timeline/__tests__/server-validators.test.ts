/**
 * AG.3.3 — server-validators tests for Timeline.
 *
 * Same shape as Kanban server-validators tests. Per Lesson #38: assert
 * specific error messages, not just .ok flag.
 */

import { describe, it, expect } from "vitest";
import {
  recomputeSummary,
  validateMilestone,
  validateTimelineState,
} from "../server-validators";
import type { TimelineMilestone, TimelineState } from "../types";

function validMilestoneLike(
  over: Partial<TimelineMilestone> = {}
): TimelineMilestone {
  return {
    id: "m-1",
    label: "Test milestone",
    targetDate: null,
    status: "pending",
    doneAt: null,
    order: 0,
    isAnchor: false,
    ...over,
  };
}

function validStateLike(over: Partial<TimelineState> = {}): TimelineState {
  return {
    milestones: [],
    raceDate: null,
    lastUpdatedAt: null,
    ...over,
  };
}

describe("validateMilestone", () => {
  it("accepts a minimal valid milestone", () => {
    const r = validateMilestone(validMilestoneLike(), 0);
    expect(r.ok).toBe(true);
  });

  it("rejects missing/empty id", () => {
    const r = validateMilestone({ ...validMilestoneLike(), id: "" }, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain("milestones[0].id");
  });

  it("rejects missing/whitespace label", () => {
    const r = validateMilestone({ ...validMilestoneLike(), label: "  " }, 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain("milestones[3].label");
  });

  it("rejects oversize label (>200)", () => {
    const r = validateMilestone(
      { ...validMilestoneLike(), label: "x".repeat(201) },
      0
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain("max 200");
  });

  it("rejects unknown status", () => {
    const r = validateMilestone(
      { ...validMilestoneLike(), status: "weird" as any },
      0
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain("status");
  });

  it("rejects malformed targetDate (non-ISO)", () => {
    const r = validateMilestone(
      { ...validMilestoneLike(), targetDate: "tomorrow" } as any,
      0
    );
    expect(r.ok).toBe(false);
  });

  it("accepts targetDate = null", () => {
    const r = validateMilestone(
      { ...validMilestoneLike(), targetDate: null },
      0
    );
    expect(r.ok).toBe(true);
  });

  it("rejects negative order", () => {
    const r = validateMilestone(
      { ...validMilestoneLike(), order: -1 },
      0
    );
    expect(r.ok).toBe(false);
  });

  it("rejects non-integer order", () => {
    const r = validateMilestone(
      { ...validMilestoneLike(), order: 1.5 },
      0
    );
    expect(r.ok).toBe(false);
  });

  it("rejects non-boolean isAnchor", () => {
    const r = validateMilestone(
      { ...validMilestoneLike(), isAnchor: "yes" } as any,
      0
    );
    expect(r.ok).toBe(false);
  });

  it("collects all errors (Lesson #39)", () => {
    const r = validateMilestone(
      { id: "", label: "", status: "weird", order: -1, isAnchor: 1 },
      0
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe("validateTimelineState", () => {
  it("accepts minimal valid state", () => {
    const r = validateTimelineState(validStateLike());
    expect(r.ok).toBe(true);
  });

  it("rejects non-object", () => {
    expect(validateTimelineState(null).ok).toBe(false);
    expect(validateTimelineState("x").ok).toBe(false);
    expect(validateTimelineState([]).ok).toBe(false);
  });

  it("rejects non-array milestones", () => {
    const r = validateTimelineState({
      ...validStateLike(),
      milestones: "x" as any,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects too many milestones (DoS guard, max 50)", () => {
    const tooMany = Array.from({ length: 60 }, (_, i) =>
      validMilestoneLike({ id: `m-${i}`, order: i })
    );
    const r = validateTimelineState({ ...validStateLike(), milestones: tooMany });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("max 50"))).toBe(true);
  });

  it("rejects duplicate milestone IDs", () => {
    const r = validateTimelineState({
      ...validStateLike(),
      milestones: [
        validMilestoneLike({ id: "dup", order: 0 }),
        validMilestoneLike({ id: "dup", order: 1 }),
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("duplicate"))).toBe(true);
  });

  it("rejects duplicate order values (renderer would collapse)", () => {
    const r = validateTimelineState({
      ...validStateLike(),
      milestones: [
        validMilestoneLike({ id: "1", order: 0 }),
        validMilestoneLike({ id: "2", order: 0 }),
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors.some((e) => e.includes("duplicate order"))).toBe(true);
  });

  it("rejects malformed raceDate", () => {
    const r = validateTimelineState({
      ...validStateLike(),
      raceDate: "soon" as any,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects malformed lastUpdatedAt", () => {
    const r = validateTimelineState({
      ...validStateLike(),
      lastUpdatedAt: "just now" as any,
    });
    expect(r.ok).toBe(false);
  });

  it("collects card-level errors with positional context", () => {
    const r = validateTimelineState({
      ...validStateLike(),
      milestones: [
        validMilestoneLike({ id: "1", order: 0 }),
        { ...validMilestoneLike({ id: "2", order: 1 }), label: "" },
        { ...validMilestoneLike({ id: "3", order: 2 }), status: "weird" } as any,
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.startsWith("milestones[1]"))).toBe(true);
      expect(r.errors.some((e) => e.startsWith("milestones[2]"))).toBe(true);
    }
  });
});

describe("recomputeSummary", () => {
  it("zeros for empty state", () => {
    expect(recomputeSummary(validStateLike())).toEqual({
      next_milestone_label: null,
      next_milestone_target_date: null,
      pending_count: 0,
      done_count: 0,
    });
  });

  it("counts pending vs done correctly", () => {
    const s: TimelineState = {
      ...validStateLike(),
      milestones: [
        validMilestoneLike({ id: "1", status: "done" }),
        validMilestoneLike({ id: "2", status: "done" }),
        validMilestoneLike({ id: "3", status: "pending" }),
      ],
    };
    const out = recomputeSummary(s);
    expect(out.done_count).toBe(2);
    expect(out.pending_count).toBe(1);
  });

  it("surfaces earliest pending target date + label", () => {
    const s: TimelineState = {
      ...validStateLike(),
      milestones: [
        validMilestoneLike({
          id: "1",
          status: "done",
          targetDate: "2026-05-15",
        }),
        validMilestoneLike({
          id: "2",
          label: "Drawing",
          status: "pending",
          targetDate: "2026-05-20",
          order: 1,
        }),
        validMilestoneLike({
          id: "3",
          label: "Bandsaw",
          status: "pending",
          targetDate: "2026-05-25",
          order: 2,
        }),
      ],
    };
    const out = recomputeSummary(s);
    expect(out.next_milestone_label).toBe("Drawing");
    expect(out.next_milestone_target_date).toBe("2026-05-20");
  });

  it("ignores pending milestones with null targetDate", () => {
    const s: TimelineState = {
      ...validStateLike(),
      milestones: [
        validMilestoneLike({
          id: "1",
          status: "pending",
          targetDate: null,
          order: 0,
        }),
        validMilestoneLike({
          id: "2",
          label: "Drawing",
          status: "pending",
          targetDate: "2026-05-20",
          order: 1,
        }),
      ],
    };
    const out = recomputeSummary(s);
    expect(out.next_milestone_label).toBe("Drawing");
  });

  it("returns nulls when only done milestones have targets", () => {
    const s: TimelineState = {
      ...validStateLike(),
      milestones: [
        validMilestoneLike({
          id: "1",
          status: "done",
          targetDate: "2026-05-20",
        }),
      ],
    };
    const out = recomputeSummary(s);
    expect(out.next_milestone_label).toBeNull();
    expect(out.next_milestone_target_date).toBeNull();
  });

  it("tie-breaks earliest target by lower order", () => {
    const s: TimelineState = {
      ...validStateLike(),
      milestones: [
        validMilestoneLike({
          id: "1",
          label: "Later-order",
          status: "pending",
          targetDate: "2026-05-20",
          order: 5,
        }),
        validMilestoneLike({
          id: "2",
          label: "Earlier-order",
          status: "pending",
          targetDate: "2026-05-20",
          order: 2,
        }),
      ],
    };
    const out = recomputeSummary(s);
    expect(out.next_milestone_label).toBe("Earlier-order");
  });
});
