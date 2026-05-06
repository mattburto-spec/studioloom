/**
 * AG.2.3a — server-validators tests.
 *
 * Defense-in-depth: even though the reducer enforces rules at runtime,
 * the API endpoint MUST validate inbound state against the wire shape
 * (could come from a malicious or buggy client). These tests assert
 * the rejection of malformed payloads with actionable error messages.
 *
 * Per Lesson #38: assertions check expected error MESSAGES, not just
 * the ok=false flag. Per Lesson #67: WIP-overflow is its own check
 * separate from individual card status checks.
 */

import { describe, it, expect } from "vitest";
import {
  recomputeCounts,
  validateCard,
  validateKanbanState,
} from "../server-validators";
import type { KanbanCard, KanbanState } from "../types";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

function validCardLike(over: Partial<KanbanCard> = {}): KanbanCard {
  return {
    id: "card-1",
    title: "Test card",
    status: "backlog",
    dod: null,
    estimateMinutes: null,
    actualMinutes: null,
    blockType: null,
    blockedAt: null,
    becauseClause: null,
    lessonLink: null,
    source: "manual",
    createdAt: "2026-05-12T10:00:00.000Z",
    movedAt: null,
    doneAt: null,
    ...over,
  };
}

function validStateLike(over: Partial<KanbanState> = {}): KanbanState {
  return {
    cards: [],
    wipLimitDoing: 1,
    lastMoveAt: null,
    ...over,
  };
}

describe("validateCard", () => {
  it("accepts a minimal valid card", () => {
    const result = validateCard(validCardLike(), 0);
    expect(result.ok).toBe(true);
  });

  it("rejects missing id", () => {
    const result = validateCard({ ...validCardLike(), id: "" }, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain("cards[0].id");
    }
  });

  it("rejects missing title", () => {
    const result = validateCard({ ...validCardLike(), title: "   " }, 3);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain("cards[3].title");
    }
  });

  it("rejects oversize title", () => {
    const result = validateCard(
      { ...validCardLike(), title: "x".repeat(201) },
      0
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain("max 200 chars");
    }
  });

  it("rejects unknown status", () => {
    const result = validateCard(
      { ...validCardLike(), status: "weird" as never },
      0
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain("status");
    }
  });

  it("rejects unknown blockType (string but not in enum)", () => {
    const result = validateCard(
      { ...validCardLike(), blockType: "bored" as never },
      0
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain("blockType");
    }
  });

  it("accepts each of the 4 block types", () => {
    for (const bt of ["tool", "skill", "decision", "help"] as const) {
      const result = validateCard(
        { ...validCardLike(), blockType: bt, blockedAt: "2026-05-12T10:00:00Z" },
        0
      );
      expect(result.ok).toBe(true);
    }
  });

  it("rejects estimateMinutes out of range", () => {
    const r1 = validateCard({ ...validCardLike(), estimateMinutes: 999 }, 0);
    const r2 = validateCard({ ...validCardLike(), estimateMinutes: -5 }, 0);
    const r3 = validateCard({ ...validCardLike(), estimateMinutes: 30.5 } as any, 0);
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    expect(r3.ok).toBe(false);
  });

  it("rejects unknown source", () => {
    const result = validateCard(
      { ...validCardLike(), source: "ai_generated" as never },
      0
    );
    expect(result.ok).toBe(false);
  });

  it("validates lessonLink shape when provided", () => {
    const ok = validateCard(
      {
        ...validCardLike(),
        lessonLink: { unit_id: VALID_UUID, page_id: "L01", section_index: 0 },
      },
      0
    );
    expect(ok.ok).toBe(true);

    const badUuid = validateCard(
      {
        ...validCardLike(),
        lessonLink: { unit_id: "not-uuid", page_id: "L01", section_index: 0 },
      },
      0
    );
    expect(badUuid.ok).toBe(false);

    const negSection = validateCard(
      {
        ...validCardLike(),
        lessonLink: { unit_id: VALID_UUID, page_id: "L01", section_index: -1 },
      },
      0
    );
    expect(negSection.ok).toBe(false);
  });

  it("rejects malformed timestamps", () => {
    const result = validateCard(
      { ...validCardLike(), movedAt: "not-a-date" } as any,
      0
    );
    expect(result.ok).toBe(false);
  });

  it("collects all errors, not just first (Lesson #39)", () => {
    const result = validateCard(
      {
        id: "",
        title: "",
        status: "weird",
        source: "ai" as any,
      },
      5
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("validateKanbanState", () => {
  it("accepts a minimal valid state", () => {
    const result = validateKanbanState(validStateLike());
    expect(result.ok).toBe(true);
  });

  it("rejects non-object input", () => {
    expect(validateKanbanState(null).ok).toBe(false);
    expect(validateKanbanState("string").ok).toBe(false);
    expect(validateKanbanState([]).ok).toBe(false);
  });

  it("rejects when cards is not an array", () => {
    const result = validateKanbanState({ ...validStateLike(), cards: "x" } as any);
    expect(result.ok).toBe(false);
  });

  it("rejects too many cards (DoS guard)", () => {
    const tooMany = Array.from({ length: 250 }, (_, i) =>
      validCardLike({ id: `card-${i}` })
    );
    const result = validateKanbanState({ ...validStateLike(), cards: tooMany });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("max 200"))).toBe(true);
    }
  });

  it("rejects duplicate card ids (state corruption)", () => {
    const result = validateKanbanState({
      ...validStateLike(),
      cards: [
        validCardLike({ id: "dup" }),
        validCardLike({ id: "dup" }),
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("duplicate id"))).toBe(true);
    }
  });

  it("rejects WIP overflow (defense-in-depth — beyond client reducer)", () => {
    const result = validateKanbanState({
      ...validStateLike(),
      wipLimitDoing: 1,
      cards: [
        validCardLike({ id: "1", status: "doing", dod: "x" }),
        validCardLike({ id: "2", status: "doing", dod: "y" }),
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) =>
          e.includes("2 cards in 'doing' exceeds wipLimitDoing=1")
        )
      ).toBe(true);
    }
  });

  it("rejects wipLimitDoing out of range", () => {
    expect(
      validateKanbanState({ ...validStateLike(), wipLimitDoing: 0 }).ok
    ).toBe(false);
    expect(
      validateKanbanState({ ...validStateLike(), wipLimitDoing: 4 }).ok
    ).toBe(false);
    expect(
      validateKanbanState({ ...validStateLike(), wipLimitDoing: 2.5 }).ok
    ).toBe(false);
  });

  it("rejects malformed lastMoveAt", () => {
    const result = validateKanbanState({
      ...validStateLike(),
      lastMoveAt: "yesterday" as any,
    });
    expect(result.ok).toBe(false);
  });

  it("collects card-level errors with positional context", () => {
    const result = validateKanbanState({
      ...validStateLike(),
      cards: [
        validCardLike({ id: "1" }),
        { ...validCardLike(), title: "" }, // index 1 — missing title
        { ...validCardLike({ id: "3" }), status: "weird" as never }, // index 2 — bad status
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.startsWith("cards[1]"))).toBe(true);
      expect(result.errors.some((e) => e.startsWith("cards[2]"))).toBe(true);
    }
  });
});

describe("recomputeCounts", () => {
  it("counts each column correctly", () => {
    const state: KanbanState = {
      ...validStateLike(),
      cards: [
        validCardLike({ id: "1", status: "backlog" }),
        validCardLike({ id: "2", status: "backlog" }),
        validCardLike({ id: "3", status: "this_class" }),
        validCardLike({ id: "4", status: "doing" }),
        validCardLike({ id: "5", status: "done" }),
        validCardLike({ id: "6", status: "done" }),
      ],
    };
    expect(recomputeCounts(state)).toEqual({
      backlog_count: 2,
      this_class_count: 1,
      doing_count: 1,
      done_count: 2,
    });
  });

  it("returns all zeros for empty board", () => {
    expect(recomputeCounts(validStateLike())).toEqual({
      backlog_count: 0,
      this_class_count: 0,
      doing_count: 0,
      done_count: 0,
    });
  });
});
