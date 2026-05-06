/**
 * AG.3.2 — Timeline reducer tests (pure logic, Lesson #71).
 *
 * Coverage: every action + every helper. Per Lesson #38 expected-value
 * asserts. Deterministic clock + ID for stable snapshot-style asserts.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  computeVariance,
  findNextPendingTargeted,
  isIsoDate,
  milestonesByStatus,
  orderedMilestones,
  summarizeTimeline,
  timelineReducer,
  type TimelineAction,
  type TimelineClock,
} from "../reducer";
import {
  emptyTimelineState,
  type TimelineMilestone,
  type TimelineState,
} from "../types";

let __idCounter = 0;
function makeClock(nowIso = "2026-05-12T10:00:00.000Z"): TimelineClock {
  __idCounter = 0;
  return {
    now: () => new Date(nowIso),
    newId: () => `m-${++__idCounter}`,
  };
}

function reduce(state: TimelineState, action: TimelineAction, clock = makeClock()) {
  return timelineReducer(state, action, clock);
}

function makeMilestoneLike(over: Partial<TimelineMilestone> = {}): TimelineMilestone {
  return {
    id: "m-test",
    label: "Test milestone",
    targetDate: null,
    status: "pending",
    doneAt: null,
    order: 0,
    isAnchor: false,
    ...over,
  };
}

// ─── isIsoDate ──────────────────────────────────────────────────────────────

describe("isIsoDate", () => {
  it("accepts YYYY-MM-DD", () => {
    expect(isIsoDate("2026-05-12")).toBe(true);
    expect(isIsoDate("2026-12-31")).toBe(true);
  });
  it("rejects malformed inputs", () => {
    expect(isIsoDate("12/05/2026")).toBe(false);
    expect(isIsoDate("2026-5-12")).toBe(false);
    expect(isIsoDate("")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(20260512)).toBe(false);
  });
});

// ─── addMilestone ───────────────────────────────────────────────────────────

describe("timelineReducer — addMilestone", () => {
  it("appends a milestone with order = milestones.length", () => {
    let state = emptyTimelineState();
    state = reduce(state, { type: "addMilestone", label: "Sketches done" });
    state = reduce(state, { type: "addMilestone", label: "Drawing done" });
    expect(state.milestones).toHaveLength(2);
    expect(state.milestones[0].order).toBe(0);
    expect(state.milestones[1].order).toBe(1);
  });

  it("trims whitespace", () => {
    const state = reduce(emptyTimelineState(), {
      type: "addMilestone",
      label: "  Sketches  ",
    });
    expect(state.milestones[0].label).toBe("Sketches");
  });

  it("ignores empty / whitespace-only labels", () => {
    const initial = emptyTimelineState();
    const a = reduce(initial, { type: "addMilestone", label: "" });
    const b = reduce(initial, { type: "addMilestone", label: "   " });
    expect(a.milestones).toHaveLength(0);
    expect(b.milestones).toHaveLength(0);
  });

  it("sets status='pending', doneAt=null, isAnchor default false", () => {
    const state = reduce(emptyTimelineState(), {
      type: "addMilestone",
      label: "x",
    });
    expect(state.milestones[0].status).toBe("pending");
    expect(state.milestones[0].doneAt).toBeNull();
    expect(state.milestones[0].isAnchor).toBe(false);
  });

  it("respects explicit isAnchor=true (e.g. RACE DAY)", () => {
    const state = reduce(emptyTimelineState(), {
      type: "addMilestone",
      label: "RACE",
      isAnchor: true,
    });
    expect(state.milestones[0].isAnchor).toBe(true);
  });

  it("accepts ISO target date", () => {
    const state = reduce(emptyTimelineState(), {
      type: "addMilestone",
      label: "x",
      targetDate: "2026-06-11",
    });
    expect(state.milestones[0].targetDate).toBe("2026-06-11");
  });

  it("rejects malformed target date (sets to null instead of erroring)", () => {
    const state = reduce(emptyTimelineState(), {
      type: "addMilestone",
      label: "x",
      targetDate: "June 11" as any,
    });
    expect(state.milestones[0].targetDate).toBeNull();
  });

  it("updates lastUpdatedAt", () => {
    const state = reduce(emptyTimelineState(), {
      type: "addMilestone",
      label: "x",
    });
    expect(state.lastUpdatedAt).toBe("2026-05-12T10:00:00.000Z");
  });
});

// ─── updateLabel + setTargetDate ────────────────────────────────────────────

describe("timelineReducer — updateLabel + setTargetDate", () => {
  let baseState: TimelineState;
  beforeEach(() => {
    baseState = {
      ...emptyTimelineState(),
      milestones: [makeMilestoneLike({ id: "m1", label: "Original" })],
    };
  });

  it("updateLabel changes label, trims whitespace, updates lastUpdatedAt", () => {
    const next = reduce(baseState, {
      type: "updateLabel",
      milestoneId: "m1",
      label: "  New Label  ",
    });
    expect(next.milestones[0].label).toBe("New Label");
    expect(next.lastUpdatedAt).toBe("2026-05-12T10:00:00.000Z");
  });

  it("updateLabel ignores empty (no-op)", () => {
    const next = reduce(baseState, {
      type: "updateLabel",
      milestoneId: "m1",
      label: "   ",
    });
    expect(next.milestones[0].label).toBe("Original");
  });

  it("updateLabel on unknown id is a no-op (.toEqual matches)", () => {
    const next = reduce(baseState, {
      type: "updateLabel",
      milestoneId: "ghost",
      label: "x",
    });
    expect(next).toEqual(baseState);
  });

  it("setTargetDate to ISO date sets correctly", () => {
    const next = reduce(baseState, {
      type: "setTargetDate",
      milestoneId: "m1",
      date: "2026-06-11",
    });
    expect(next.milestones[0].targetDate).toBe("2026-06-11");
  });

  it("setTargetDate to null clears target", () => {
    const withDate = {
      ...baseState,
      milestones: [{ ...baseState.milestones[0], targetDate: "2026-06-11" }],
    };
    const next = reduce(withDate, {
      type: "setTargetDate",
      milestoneId: "m1",
      date: null,
    });
    expect(next.milestones[0].targetDate).toBeNull();
  });

  it("setTargetDate rejects malformed dates (no-op)", () => {
    const next = reduce(baseState, {
      type: "setTargetDate",
      milestoneId: "m1",
      date: "next Friday" as any,
    });
    expect(next).toEqual(baseState);
  });
});

// ─── markDone / markPending ─────────────────────────────────────────────────

describe("timelineReducer — markDone / markPending", () => {
  it("markDone sets status + doneAt", () => {
    const state: TimelineState = {
      ...emptyTimelineState(),
      milestones: [makeMilestoneLike({ id: "m1" })],
    };
    const next = reduce(state, { type: "markDone", milestoneId: "m1" });
    expect(next.milestones[0].status).toBe("done");
    expect(next.milestones[0].doneAt).toBe("2026-05-12T10:00:00.000Z");
  });

  it("markDone is no-op if already done", () => {
    const state: TimelineState = {
      ...emptyTimelineState(),
      milestones: [
        makeMilestoneLike({
          id: "m1",
          status: "done",
          doneAt: "2026-05-10T08:00:00.000Z",
        }),
      ],
    };
    const next = reduce(state, { type: "markDone", milestoneId: "m1" });
    expect(next.milestones[0].doneAt).toBe("2026-05-10T08:00:00.000Z");
  });

  it("markPending clears doneAt", () => {
    const state: TimelineState = {
      ...emptyTimelineState(),
      milestones: [
        makeMilestoneLike({
          id: "m1",
          status: "done",
          doneAt: "2026-05-10T08:00:00.000Z",
        }),
      ],
    };
    const next = reduce(state, { type: "markPending", milestoneId: "m1" });
    expect(next.milestones[0].status).toBe("pending");
    expect(next.milestones[0].doneAt).toBeNull();
  });
});

// ─── deleteMilestone ────────────────────────────────────────────────────────

describe("timelineReducer — deleteMilestone", () => {
  it("removes the milestone + compacts orders", () => {
    const state: TimelineState = {
      ...emptyTimelineState(),
      milestones: [
        makeMilestoneLike({ id: "m1", order: 0 }),
        makeMilestoneLike({ id: "m2", order: 1 }),
        makeMilestoneLike({ id: "m3", order: 2 }),
      ],
    };
    const next = reduce(state, { type: "deleteMilestone", milestoneId: "m2" });
    expect(next.milestones).toHaveLength(2);
    expect(next.milestones[0].id).toBe("m1");
    expect(next.milestones[0].order).toBe(0);
    expect(next.milestones[1].id).toBe("m3");
    expect(next.milestones[1].order).toBe(1); // compacted
  });

  it("refuses to delete an anchored milestone", () => {
    const state: TimelineState = {
      ...emptyTimelineState(),
      milestones: [
        makeMilestoneLike({ id: "m1" }),
        makeMilestoneLike({ id: "m-anchor", isAnchor: true }),
      ],
    };
    const next = reduce(state, {
      type: "deleteMilestone",
      milestoneId: "m-anchor",
    });
    expect(next.milestones).toHaveLength(2); // unchanged
  });

  it("deleting unknown id is a no-op", () => {
    const state: TimelineState = {
      ...emptyTimelineState(),
      milestones: [makeMilestoneLike({ id: "m1" })],
    };
    const next = reduce(state, { type: "deleteMilestone", milestoneId: "x" });
    expect(next).toEqual(state);
  });
});

// ─── reorderMilestones ──────────────────────────────────────────────────────

describe("timelineReducer — reorderMilestones", () => {
  it("reorders + sorts by new order", () => {
    const state: TimelineState = {
      ...emptyTimelineState(),
      milestones: [
        makeMilestoneLike({ id: "m1", order: 0 }),
        makeMilestoneLike({ id: "m2", order: 1 }),
        makeMilestoneLike({ id: "m3", order: 2 }),
      ],
    };
    const next = reduce(state, {
      type: "reorderMilestones",
      orderedIds: ["m3", "m1", "m2"],
    });
    expect(next.milestones[0].id).toBe("m3");
    expect(next.milestones[0].order).toBe(0);
    expect(next.milestones[1].id).toBe("m1");
    expect(next.milestones[2].id).toBe("m2");
  });

  it("rejects when orderedIds count differs from milestones count", () => {
    const state: TimelineState = {
      ...emptyTimelineState(),
      milestones: [
        makeMilestoneLike({ id: "m1" }),
        makeMilestoneLike({ id: "m2" }),
      ],
    };
    const next = reduce(state, {
      type: "reorderMilestones",
      orderedIds: ["m1"], // missing m2
    });
    expect(next).toEqual(state);
  });

  it("rejects when orderedIds includes unknown id", () => {
    const state: TimelineState = {
      ...emptyTimelineState(),
      milestones: [
        makeMilestoneLike({ id: "m1" }),
        makeMilestoneLike({ id: "m2" }),
      ],
    };
    const next = reduce(state, {
      type: "reorderMilestones",
      orderedIds: ["m1", "ghost"],
    });
    expect(next).toEqual(state);
  });
});

// ─── setRaceDate / loadState ────────────────────────────────────────────────

describe("timelineReducer — setRaceDate / loadState", () => {
  it("setRaceDate accepts ISO date", () => {
    const next = reduce(emptyTimelineState(), {
      type: "setRaceDate",
      date: "2026-06-11",
    });
    expect(next.raceDate).toBe("2026-06-11");
  });

  it("setRaceDate rejects malformed (no-op)", () => {
    const next = reduce(emptyTimelineState(), {
      type: "setRaceDate",
      date: "june" as any,
    });
    expect(next.raceDate).toBeNull();
  });

  it("setRaceDate to null clears", () => {
    const initial: TimelineState = {
      ...emptyTimelineState(),
      raceDate: "2026-06-11",
    };
    const next = reduce(initial, { type: "setRaceDate", date: null });
    expect(next.raceDate).toBeNull();
  });

  it("loadState replaces entire state", () => {
    const loaded: TimelineState = {
      milestones: [makeMilestoneLike({ id: "fromServer" })],
      raceDate: "2026-06-11",
      lastUpdatedAt: "2026-05-10T08:00:00.000Z",
    };
    const next = reduce(emptyTimelineState(), { type: "loadState", state: loaded });
    expect(next).toEqual(loaded);
  });
});

// ─── findNextPendingTargeted ────────────────────────────────────────────────

describe("findNextPendingTargeted", () => {
  it("returns null on empty timeline", () => {
    expect(findNextPendingTargeted(emptyTimelineState())).toBeNull();
  });

  it("returns null when no milestones have target dates", () => {
    const state: TimelineState = {
      ...emptyTimelineState(),
      milestones: [makeMilestoneLike({ targetDate: null })],
    };
    expect(findNextPendingTargeted(state)).toBeNull();
  });

  it("returns null when only done milestones have targets", () => {
    const state: TimelineState = {
      ...emptyTimelineState(),
      milestones: [
        makeMilestoneLike({
          id: "m1",
          status: "done",
          targetDate: "2026-06-11",
        }),
      ],
    };
    expect(findNextPendingTargeted(state)).toBeNull();
  });

  it("picks earliest target date among pending", () => {
    const state: TimelineState = {
      ...emptyTimelineState(),
      milestones: [
        makeMilestoneLike({ id: "m1", targetDate: "2026-06-15", order: 0 }),
        makeMilestoneLike({ id: "m2", targetDate: "2026-05-20", order: 1 }),
        makeMilestoneLike({ id: "m3", targetDate: "2026-06-01", order: 2 }),
      ],
    };
    const next = findNextPendingTargeted(state);
    expect(next?.id).toBe("m2");
  });

  it("tie-breaks by lower order when target dates are identical", () => {
    const state: TimelineState = {
      ...emptyTimelineState(),
      milestones: [
        makeMilestoneLike({ id: "m1", targetDate: "2026-05-20", order: 5 }),
        makeMilestoneLike({ id: "m2", targetDate: "2026-05-20", order: 2 }),
      ],
    };
    expect(findNextPendingTargeted(state)?.id).toBe("m2");
  });
});

// ─── computeVariance ────────────────────────────────────────────────────────

describe("computeVariance", () => {
  it("returns null when targetDate is null", () => {
    expect(computeVariance(null, "2026-05-12T10:00:00Z")).toBeNull();
  });

  it("returns null when targetDate is malformed", () => {
    expect(computeVariance("garbage", "2026-05-12T10:00:00Z")).toBeNull();
  });

  it("'behind' when target is in the past", () => {
    expect(computeVariance("2026-05-10", "2026-05-12T10:00:00Z")).toBe("behind");
  });

  it("'tight' when target is today", () => {
    expect(computeVariance("2026-05-12", "2026-05-12T15:00:00Z")).toBe("tight");
  });

  it("'tight' when target is tomorrow", () => {
    expect(computeVariance("2026-05-13", "2026-05-12T15:00:00Z")).toBe("tight");
  });

  it("'on_track' when target is 2+ days away", () => {
    expect(computeVariance("2026-05-15", "2026-05-12T15:00:00Z")).toBe("on_track");
    expect(computeVariance("2026-06-11", "2026-05-12T15:00:00Z")).toBe("on_track");
  });
});

// ─── summarizeTimeline ──────────────────────────────────────────────────────

describe("summarizeTimeline", () => {
  it("zeros for empty state", () => {
    expect(summarizeTimeline(emptyTimelineState())).toEqual({
      next_milestone_label: null,
      next_milestone_target_date: null,
      pending_count: 0,
      done_count: 0,
    });
  });

  it("counts pending + done correctly", () => {
    const state: TimelineState = {
      ...emptyTimelineState(),
      milestones: [
        makeMilestoneLike({ id: "1", status: "done" }),
        makeMilestoneLike({ id: "2", status: "done" }),
        makeMilestoneLike({ id: "3", status: "pending" }),
      ],
    };
    const s = summarizeTimeline(state);
    expect(s.pending_count).toBe(1);
    expect(s.done_count).toBe(2);
  });

  it("surfaces next milestone (label + target date)", () => {
    const state: TimelineState = {
      ...emptyTimelineState(),
      milestones: [
        makeMilestoneLike({
          id: "1",
          status: "done",
          targetDate: "2026-05-15",
        }),
        makeMilestoneLike({
          id: "2",
          label: "Working drawing",
          status: "pending",
          targetDate: "2026-05-20",
          order: 1,
        }),
        makeMilestoneLike({
          id: "3",
          label: "Bandsaw",
          status: "pending",
          targetDate: "2026-05-25",
          order: 2,
        }),
      ],
    };
    const s = summarizeTimeline(state);
    expect(s.next_milestone_label).toBe("Working drawing");
    expect(s.next_milestone_target_date).toBe("2026-05-20");
  });
});

// ─── milestonesByStatus + orderedMilestones ─────────────────────────────────

describe("milestonesByStatus + orderedMilestones", () => {
  const state: TimelineState = {
    ...emptyTimelineState(),
    milestones: [
      makeMilestoneLike({ id: "1", order: 2 }),
      makeMilestoneLike({ id: "2", order: 0, status: "done" }),
      makeMilestoneLike({ id: "3", order: 1 }),
    ],
  };

  it("milestonesByStatus returns sorted by order, filtered by status", () => {
    const pending = milestonesByStatus(state, "pending");
    expect(pending.map((m) => m.id)).toEqual(["3", "1"]);
    const done = milestonesByStatus(state, "done");
    expect(done.map((m) => m.id)).toEqual(["2"]);
  });

  it("orderedMilestones returns ALL milestones sorted by order", () => {
    const out = orderedMilestones(state);
    expect(out.map((m) => m.id)).toEqual(["2", "3", "1"]);
  });
});
