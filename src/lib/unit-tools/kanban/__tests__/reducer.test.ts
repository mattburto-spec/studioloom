/**
 * AG.2.2 — Kanban reducer tests (pure logic, Lesson #71).
 *
 * Per Lesson #38: assertions check expected values, not just non-null.
 * Per Lesson #67: WIP-enforcement audit covers all three "moving to Doing"
 * paths (from backlog, from this_class, from done — yes, students can
 * un-Done a card and that should also obey WIP).
 *
 * Clock + ID injection: all timestamps + ids deterministic for stable
 * snapshot-style asserts.
 */

import { describe, it, expect } from "vitest";
import {
  cardsByStatus,
  estimateAccuracy,
  findDoingCard,
  isCardBlocked,
  kanbanReducer,
  summarizeCounts,
  validateMove,
  type KanbanAction,
  type KanbanClock,
} from "../reducer";
import {
  emptyKanbanState,
  type KanbanCard,
  type KanbanState,
} from "../types";

// ─── Test fixtures ───────────────────────────────────────────────────────────

let __idCounter = 0;
function makeClock(nowIso = "2026-05-12T10:00:00.000Z"): KanbanClock {
  __idCounter = 0;
  return {
    now: () => new Date(nowIso),
    newId: () => `card-${++__idCounter}`,
  };
}

function reduce(state: KanbanState, action: KanbanAction, clock = makeClock()) {
  return kanbanReducer(state, action, clock);
}

function makeCardLike(over: Partial<KanbanCard> = {}): KanbanCard {
  return {
    id: "test-card",
    title: "Test",
    status: "backlog",
    dod: null,
    estimateMinutes: null,
    actualMinutes: null,
    blockType: null,
    blockedAt: null,
    becauseClause: null,
    lessonLink: null,
    source: "manual",
    createdAt: "2026-05-10T08:00:00.000Z",
    movedAt: null,
    doneAt: null,
    ...over,
  };
}

// ─── createCard ──────────────────────────────────────────────────────────────

describe("kanbanReducer — createCard", () => {
  it("appends a new card with status='backlog' by default", () => {
    const next = reduce(emptyKanbanState(), {
      type: "createCard",
      title: "Cut the profile",
    });
    expect(next.cards).toHaveLength(1);
    expect(next.cards[0].title).toBe("Cut the profile");
    expect(next.cards[0].status).toBe("backlog");
    expect(next.cards[0].id).toBe("card-1");
    expect(next.cards[0].createdAt).toBe("2026-05-12T10:00:00.000Z");
  });

  it("respects explicit status (e.g. journal-next creates in this_class)", () => {
    const next = reduce(emptyKanbanState(), {
      type: "createCard",
      title: "Mass check",
      status: "this_class",
      source: "journal_next",
    });
    expect(next.cards[0].status).toBe("this_class");
    expect(next.cards[0].source).toBe("journal_next");
  });

  it("trims whitespace from title", () => {
    const next = reduce(emptyKanbanState(), {
      type: "createCard",
      title: "  Spaced out  ",
    });
    expect(next.cards[0].title).toBe("Spaced out");
  });

  it("attaches lessonLink when provided (auto-create from journal)", () => {
    const link = { unit_id: "u1", page_id: "p1", section_index: 2 };
    const next = reduce(emptyKanbanState(), {
      type: "createCard",
      title: "x",
      lessonLink: link,
    });
    expect(next.cards[0].lessonLink).toEqual(link);
  });

  it("starts with null DoD, blockType, becauseClause, estimate", () => {
    const next = reduce(emptyKanbanState(), { type: "createCard", title: "x" });
    expect(next.cards[0].dod).toBeNull();
    expect(next.cards[0].blockType).toBeNull();
    expect(next.cards[0].becauseClause).toBeNull();
    expect(next.cards[0].estimateMinutes).toBeNull();
  });
});

// ─── updateTitle / updateDoD ─────────────────────────────────────────────────

describe("kanbanReducer — updateTitle + updateDoD", () => {
  let baseState: KanbanState;
  beforeEach();
  function beforeEach() {
    baseState = {
      ...emptyKanbanState(),
      cards: [makeCardLike({ id: "c1", title: "Original" })],
    };
  }
  beforeEach();

  it("updateTitle changes title only", () => {
    const next = reduce(baseState, { type: "updateTitle", cardId: "c1", title: "New Title" });
    expect(next.cards[0].title).toBe("New Title");
    expect(next.cards[0].dod).toBeNull(); // unchanged
  });

  it("updateDoD changes DoD only, trims whitespace", () => {
    const next = reduce(baseState, {
      type: "updateDoD",
      cardId: "c1",
      dod: "  Smooth to touch, no flat spots  ",
    });
    expect(next.cards[0].dod).toBe("Smooth to touch, no flat spots");
  });

  it("updateDoD with empty string sets to null (clears DoD)", () => {
    const withDod = {
      ...baseState,
      cards: [{ ...baseState.cards[0], dod: "set" }],
    };
    const next = reduce(withDod, { type: "updateDoD", cardId: "c1", dod: "   " });
    expect(next.cards[0].dod).toBeNull();
  });

  it("update on unknown cardId is a no-op", () => {
    const next = reduce(baseState, { type: "updateTitle", cardId: "ghost", title: "x" });
    expect(next).toEqual(baseState);
  });
});

// ─── moveCard — happy paths + WIP + DoD + because ────────────────────────────

describe("validateMove + moveCard — happy paths", () => {
  it("move backlog → this_class needs DoD", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [makeCardLike({ id: "c1", status: "backlog", dod: null })],
    };
    const v = validateMove(state, "c1", "this_class", {});
    expect(v.ok).toBe(false);
    expect(v.errors[0].field).toBe("dod");
  });

  it("move backlog → this_class with DoD succeeds", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [makeCardLike({ id: "c1", status: "backlog", dod: "Smooth + ≤35g" })],
    };
    const v = validateMove(state, "c1", "this_class", {});
    expect(v.ok).toBe(true);

    const next = reduce(state, {
      type: "moveCard",
      cardId: "c1",
      toStatus: "this_class",
    });
    expect(next.cards[0].status).toBe("this_class");
    expect(next.cards[0].movedAt).toBe("2026-05-12T10:00:00.000Z");
    expect(next.lastMoveAt).toBe("2026-05-12T10:00:00.000Z");
  });

  it("same-status no-op moves are valid", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [makeCardLike({ id: "c1", status: "doing", dod: "x" })],
    };
    const v = validateMove(state, "c1", "doing", {});
    expect(v.ok).toBe(true);
  });
});

describe("validateMove — WIP enforcement", () => {
  it("blocks move to doing when WIP=1 and another card is in doing", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      wipLimitDoing: 1,
      cards: [
        makeCardLike({ id: "c1", status: "doing", dod: "x" }),
        makeCardLike({ id: "c2", status: "this_class", dod: "y" }),
      ],
    };
    const v = validateMove(state, "c2", "doing", {});
    expect(v.ok).toBe(false);
    expect(v.errors[0].field).toBe("wip");
    expect(v.errors[0].message).toContain("WIP");
  });

  it("allows move when WIP=2 and only 1 card is in doing", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      wipLimitDoing: 2,
      cards: [
        makeCardLike({ id: "c1", status: "doing", dod: "x" }),
        makeCardLike({ id: "c2", status: "this_class", dod: "y" }),
      ],
    };
    const v = validateMove(state, "c2", "doing", {});
    expect(v.ok).toBe(true);
  });

  it("allows the same card to stay in doing (no double-count)", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      wipLimitDoing: 1,
      cards: [makeCardLike({ id: "c1", status: "doing", dod: "x" })],
    };
    // Re-issue moveCard targeting doing (same status) — should pass
    const v = validateMove(state, "c1", "doing", {});
    expect(v.ok).toBe(true);
  });

  it("invalid move is a no-op in the reducer (defensive)", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      wipLimitDoing: 1,
      cards: [
        makeCardLike({ id: "c1", status: "doing", dod: "x" }),
        makeCardLike({ id: "c2", status: "this_class", dod: "y" }),
      ],
    };
    const next = reduce(state, {
      type: "moveCard",
      cardId: "c2",
      toStatus: "doing",
    });
    expect(next).toEqual(state); // unchanged
  });
});

describe("validateMove + moveCard — Done requires becauseClause", () => {
  it("blocks move to done with no because clause", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [makeCardLike({ id: "c1", status: "doing", dod: "x" })],
    };
    const v = validateMove(state, "c1", "done", {});
    expect(v.ok).toBe(false);
    expect(v.errors[0].field).toBe("because");
  });

  it("accepts move to done when because supplied", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [makeCardLike({ id: "c1", status: "doing", dod: "x" })],
    };
    const v = validateMove(state, "c1", "done", {
      becauseClause: "Switched to 220 grit because 80 was too aggressive",
    });
    expect(v.ok).toBe(true);
  });

  it("preserves existing because on the card if no new one supplied (e.g. card already had it)", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [makeCardLike({
        id: "c1",
        status: "doing",
        dod: "x",
        becauseClause: "previous reason",
      })],
    };
    const v = validateMove(state, "c1", "done", {});
    expect(v.ok).toBe(true);
  });

  it("populates doneAt + actualMinutes when moving from doing → done", () => {
    const start = "2026-05-12T10:00:00.000Z";
    const end = "2026-05-12T10:35:00.000Z"; // 35 minutes later
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [makeCardLike({
        id: "c1",
        status: "doing",
        dod: "x",
        movedAt: start,
        estimateMinutes: 30,
      })],
    };
    const next = reduce(
      state,
      { type: "moveCard", cardId: "c1", toStatus: "done", becauseClause: "ok" },
      makeClock(end)
    );
    expect(next.cards[0].status).toBe("done");
    expect(next.cards[0].doneAt).toBe(end);
    expect(next.cards[0].actualMinutes).toBe(35);
    expect(next.cards[0].becauseClause).toBe("ok");
  });

  it("does not set actualMinutes if previous status wasn't doing", () => {
    // Edge case: student moves backlog → done directly (e.g. abandoning a card).
    // No actualMinutes computable since they didn't track time.
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [makeCardLike({ id: "c1", status: "backlog", dod: "x" })],
    };
    const next = reduce(state, {
      type: "moveCard",
      cardId: "c1",
      toStatus: "done",
      becauseClause: "abandoned this approach because",
    });
    expect(next.cards[0].actualMinutes).toBeNull();
  });
});

describe("moveCard — cleanup on transition", () => {
  it("clears blocked state when card moves to a new status", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [makeCardLike({
        id: "c1",
        status: "doing",
        dod: "x",
        blockType: "tool",
        blockedAt: "2026-05-12T09:30:00.000Z",
      })],
    };
    const next = reduce(state, {
      type: "moveCard",
      cardId: "c1",
      toStatus: "done",
      becauseClause: "ok",
    });
    expect(next.cards[0].blockType).toBeNull();
    expect(next.cards[0].blockedAt).toBeNull();
  });

  it("sets estimateMinutes when entering doing if provided", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [makeCardLike({ id: "c1", status: "this_class", dod: "x" })],
    };
    const next = reduce(state, {
      type: "moveCard",
      cardId: "c1",
      toStatus: "doing",
      estimateMinutes: 25,
    });
    expect(next.cards[0].estimateMinutes).toBe(25);
  });

  it("updates lastMoveAt at the board level on any successful move", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      lastMoveAt: null,
      cards: [makeCardLike({ id: "c1", status: "backlog", dod: "x" })],
    };
    const next = reduce(state, {
      type: "moveCard",
      cardId: "c1",
      toStatus: "this_class",
    });
    expect(next.lastMoveAt).toBe("2026-05-12T10:00:00.000Z");
  });
});

// ─── markBlocked / markUnblocked ─────────────────────────────────────────────

describe("kanbanReducer — markBlocked / markUnblocked", () => {
  it("markBlocked sets blockType + blockedAt without changing status", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [makeCardLike({ id: "c1", status: "doing" })],
    };
    const next = reduce(state, {
      type: "markBlocked",
      cardId: "c1",
      blockType: "tool",
    });
    expect(next.cards[0].status).toBe("doing");
    expect(next.cards[0].blockType).toBe("tool");
    expect(next.cards[0].blockedAt).toBe("2026-05-12T10:00:00.000Z");
  });

  it("markUnblocked clears block state", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [makeCardLike({
        id: "c1",
        status: "doing",
        blockType: "skill",
        blockedAt: "2026-05-12T09:30:00.000Z",
      })],
    };
    const next = reduce(state, { type: "markUnblocked", cardId: "c1" });
    expect(next.cards[0].blockType).toBeNull();
    expect(next.cards[0].blockedAt).toBeNull();
  });
});

// ─── deleteCard / setWipLimit / loadState ────────────────────────────────────

describe("kanbanReducer — deleteCard + setWipLimit + loadState", () => {
  it("deleteCard removes the card", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [
        makeCardLike({ id: "c1" }),
        makeCardLike({ id: "c2" }),
      ],
    };
    const next = reduce(state, { type: "deleteCard", cardId: "c1" });
    expect(next.cards).toHaveLength(1);
    expect(next.cards[0].id).toBe("c2");
  });

  it("setWipLimit clamps to 1-3", () => {
    expect(reduce(emptyKanbanState(), { type: "setWipLimit", limit: 5 }).wipLimitDoing).toBe(3);
    expect(reduce(emptyKanbanState(), { type: "setWipLimit", limit: 0 }).wipLimitDoing).toBe(1);
    expect(reduce(emptyKanbanState(), { type: "setWipLimit", limit: 2 }).wipLimitDoing).toBe(2);
    expect(reduce(emptyKanbanState(), { type: "setWipLimit", limit: 2.7 }).wipLimitDoing).toBe(2);
  });

  it("loadState replaces the entire state (used on initial fetch)", () => {
    const loaded: KanbanState = {
      cards: [makeCardLike({ id: "fromServer" })],
      wipLimitDoing: 2,
      lastMoveAt: "2026-05-10T08:00:00.000Z",
    };
    const next = reduce(emptyKanbanState(), {
      type: "loadState",
      state: loaded,
    });
    expect(next).toEqual(loaded);
  });
});

// ─── Helpers (summarizeCounts, findDoingCard, etc.) ──────────────────────────

describe("summarizeCounts", () => {
  it("returns 0s on empty board", () => {
    expect(summarizeCounts(emptyKanbanState())).toEqual({
      backlog: 0,
      this_class: 0,
      doing: 0,
      done: 0,
    });
  });

  it("counts cards across all 4 columns", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [
        makeCardLike({ id: "1", status: "backlog" }),
        makeCardLike({ id: "2", status: "backlog" }),
        makeCardLike({ id: "3", status: "this_class" }),
        makeCardLike({ id: "4", status: "doing" }),
        makeCardLike({ id: "5", status: "done" }),
        makeCardLike({ id: "6", status: "done" }),
        makeCardLike({ id: "7", status: "done" }),
      ],
    };
    expect(summarizeCounts(state)).toEqual({
      backlog: 2,
      this_class: 1,
      doing: 1,
      done: 3,
    });
  });
});

describe("findDoingCard + cardsByStatus + isCardBlocked", () => {
  const state: KanbanState = {
    ...emptyKanbanState(),
    cards: [
      makeCardLike({ id: "1", status: "backlog" }),
      makeCardLike({ id: "2", status: "doing" }),
      makeCardLike({ id: "3", status: "doing", blockType: "skill", blockedAt: "x" }),
      makeCardLike({ id: "4", status: "done" }),
    ],
  };

  it("findDoingCard returns first doing card", () => {
    const c = findDoingCard(state);
    expect(c?.id).toBe("2");
  });

  it("findDoingCard returns null when no doing cards", () => {
    const empty: KanbanState = {
      ...emptyKanbanState(),
      cards: [makeCardLike({ id: "x", status: "backlog" })],
    };
    expect(findDoingCard(empty)).toBeNull();
  });

  it("cardsByStatus filters correctly", () => {
    expect(cardsByStatus(state, "doing")).toHaveLength(2);
    expect(cardsByStatus(state, "backlog")).toHaveLength(1);
    expect(cardsByStatus(state, "this_class")).toHaveLength(0);
  });

  it("isCardBlocked is true only when blockType is non-null", () => {
    expect(isCardBlocked(state.cards[1])).toBe(false);
    expect(isCardBlocked(state.cards[2])).toBe(true);
  });
});

describe("estimateAccuracy", () => {
  it("returns null on board with no completed cards", () => {
    expect(estimateAccuracy(emptyKanbanState())).toBeNull();
  });

  it("computes ratio across completed cards (actual / estimate)", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [
        makeCardLike({
          id: "1",
          status: "done",
          estimateMinutes: 30,
          actualMinutes: 45, // student under-estimated
        }),
        makeCardLike({
          id: "2",
          status: "done",
          estimateMinutes: 20,
          actualMinutes: 25,
        }),
      ],
    };
    const acc = estimateAccuracy(state);
    expect(acc).not.toBeNull();
    expect(acc!.cardsCompared).toBe(2);
    // (45+25) / (30+20) = 70/50 = 1.4
    expect(acc!.ratio).toBeCloseTo(1.4, 2);
  });

  it("ignores cards without both estimate and actual", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [
        makeCardLike({
          id: "1",
          status: "done",
          estimateMinutes: null,
          actualMinutes: 30,
        }), // no estimate — skip
        makeCardLike({
          id: "2",
          status: "done",
          estimateMinutes: 20,
          actualMinutes: 25,
        }),
      ],
    };
    const acc = estimateAccuracy(state);
    expect(acc!.cardsCompared).toBe(1);
    expect(acc!.ratio).toBeCloseTo(1.25, 2);
  });

  it("returns null if all completed cards had zero-minute estimates (avoid divide-by-zero)", () => {
    const state: KanbanState = {
      ...emptyKanbanState(),
      cards: [
        makeCardLike({
          id: "1",
          status: "done",
          estimateMinutes: 0,
          actualMinutes: 30,
        }),
      ],
    };
    expect(estimateAccuracy(state)).toBeNull();
  });
});
