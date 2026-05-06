/**
 * Round 19 (6 May 2026) — pure-logic guards for Kanban drag-drop.
 */

import { describe, it, expect } from "vitest";
import {
  findDropTargetColumn,
  classifyDrop,
  type ColumnRect,
} from "../drag-drop";
import type { KanbanCard, KanbanState } from "../types";

function rect(
  columnId: ColumnRect["columnId"],
  left: number,
  top: number,
  right: number,
  bottom: number
): ColumnRect {
  return { columnId, left, top, right, bottom };
}

describe("findDropTargetColumn", () => {
  const rects: ColumnRect[] = [
    rect("backlog", 0, 0, 100, 200),
    rect("this_class", 100, 0, 200, 200),
    rect("doing", 200, 0, 300, 200),
    rect("done", 300, 0, 400, 200),
  ];

  it("returns the column whose rect contains the point", () => {
    expect(findDropTargetColumn({ x: 50, y: 100 }, rects)).toBe("backlog");
    expect(findDropTargetColumn({ x: 150, y: 100 }, rects)).toBe("this_class");
    expect(findDropTargetColumn({ x: 250, y: 100 }, rects)).toBe("doing");
    expect(findDropTargetColumn({ x: 350, y: 100 }, rects)).toBe("done");
  });

  it("returns null when point is outside all columns", () => {
    expect(findDropTargetColumn({ x: 500, y: 100 }, rects)).toBeNull();
    expect(findDropTargetColumn({ x: 50, y: 300 }, rects)).toBeNull();
  });

  it("uses inclusive boundaries — points on the edge match", () => {
    expect(findDropTargetColumn({ x: 100, y: 50 }, rects)).toBe("backlog");
  });

  it("returns null for empty rect array", () => {
    expect(findDropTargetColumn({ x: 50, y: 100 }, [])).toBeNull();
  });
});

// ─── classifyDrop ───────────────────────────────────────────────────────────

function makeCard(over: Partial<KanbanCard> & { id: string }): KanbanCard {
  return {
    title: "Test card",
    status: "backlog",
    dod: null,
    estimateMinutes: null,
    actualMinutes: null,
    becauseClause: null,
    blockType: null,
    blockedAt: null,
    createdAt: "2026-05-06T00:00:00Z",
    movedAt: null,
    doneAt: null,
    source: "manual",
    lessonLink: null,
    ...over,
  };
}

function makeState(cards: KanbanCard[], wipLimitDoing = 1): KanbanState {
  return {
    cards,
    wipLimitDoing,
    lastMoveAt: null,
  };
}

describe("classifyDrop", () => {
  it("noop when target is null", () => {
    const card = makeCard({ id: "c1" });
    const state = makeState([card]);
    expect(classifyDrop(state, card, null)).toEqual({ kind: "noop" });
  });

  it("noop when target is the same as current status", () => {
    const card = makeCard({ id: "c1", status: "backlog" });
    const state = makeState([card]);
    expect(classifyDrop(state, card, "backlog")).toEqual({ kind: "noop" });
  });

  it("ok for clean backlog → this_class with DoD set", () => {
    const card = makeCard({
      id: "c1",
      status: "backlog",
      dod: "Smooth surface, no flat spots",
    });
    const state = makeState([card]);
    expect(classifyDrop(state, card, "this_class")).toEqual({
      kind: "ok",
      toStatus: "this_class",
    });
  });

  it("needsModal when target is this_class + no DoD", () => {
    const card = makeCard({ id: "c1", status: "backlog", dod: null });
    const state = makeState([card]);
    const out = classifyDrop(state, card, "this_class");
    expect(out.kind).toBe("needsModal");
    if (out.kind === "needsModal") {
      expect(out.toStatus).toBe("this_class");
      expect(out.missingFields).toContain("dod");
    }
  });

  it("blocked when target is doing + WIP would exceed", () => {
    const occupant = makeCard({
      id: "occ",
      status: "doing",
      dod: "DoD set",
    });
    const card = makeCard({
      id: "c1",
      status: "this_class",
      dod: "DoD set",
    });
    const state = makeState([occupant, card], 1);
    const out = classifyDrop(state, card, "doing");
    expect(out.kind).toBe("blocked");
    if (out.kind === "blocked") {
      expect(out.reason.toLowerCase()).toContain("wip");
    }
  });

  it("ok when target is doing + WIP slot is open + DoD present", () => {
    const card = makeCard({
      id: "c1",
      status: "this_class",
      dod: "DoD set",
    });
    const state = makeState([card], 1);
    expect(classifyDrop(state, card, "doing")).toEqual({
      kind: "ok",
      toStatus: "doing",
    });
  });

  it("needsModal when target is done + no becauseClause yet (DoD is set)", () => {
    const card = makeCard({
      id: "c1",
      status: "doing",
      dod: "DoD set",
      becauseClause: null,
    });
    const state = makeState([card]);
    const out = classifyDrop(state, card, "done");
    expect(out.kind).toBe("needsModal");
    if (out.kind === "needsModal") {
      expect(out.missingFields).toContain("because");
    }
  });

  it("ok when target is done + DoD + becauseClause both set", () => {
    const card = makeCard({
      id: "c1",
      status: "doing",
      dod: "DoD set",
      becauseClause: "I switched to 220 grit because 80 was tearing",
    });
    const state = makeState([card]);
    expect(classifyDrop(state, card, "done")).toEqual({
      kind: "ok",
      toStatus: "done",
    });
  });

  it("WIP block precedence over DoD — student fixes WIP first, doesn't waste time on a fixable error", () => {
    // Card going to doing without DoD AND WIP full — the blocked
    // (WIP) case wins. Student needs to free a slot before any
    // modal interaction is useful.
    const occupant = makeCard({
      id: "occ",
      status: "doing",
      dod: "DoD set",
    });
    const card = makeCard({
      id: "c1",
      status: "backlog",
      dod: null,
    });
    const state = makeState([occupant, card], 1);
    const out = classifyDrop(state, card, "doing");
    expect(out.kind).toBe("blocked");
  });
});
