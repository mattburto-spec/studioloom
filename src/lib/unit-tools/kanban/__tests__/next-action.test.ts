/**
 * Tests for selectNextAction — the pure helper that decides what the
 * student should focus on next given their current kanban state.
 */

import { describe, it, expect } from "vitest";
import { selectNextAction } from "../next-action";
import { emptyKanbanState } from "../types";
import type { KanbanState, KanbanCard } from "../types";

function card(
  id: string,
  status: KanbanCard["status"],
  title: string,
  overrides: Partial<KanbanCard> = {}
): KanbanCard {
  return {
    id,
    title,
    status,
    dod: null,
    estimateMinutes: null,
    actualMinutes: null,
    blockType: null,
    blockedAt: null,
    becauseClause: null,
    lessonLink: null,
    source: "manual",
    createdAt: "2026-05-08T00:00:00Z",
    movedAt: "2026-05-08T00:00:00Z",
    doneAt: null,
    ...overrides,
  };
}

function buildState(cards: KanbanCard[]): KanbanState {
  return { ...emptyKanbanState(), cards };
}

describe("selectNextAction", () => {
  it("empty board → 'Get started' state pointing to Backlog", () => {
    const result = selectNextAction(emptyKanbanState());
    expect(result.state).toBe("empty");
    expect(result.headline).toMatch(/Add cards/i);
    expect(result.card).toBeNull();
  });

  it("only Backlog has cards → 'needs_pull' state, no specific card", () => {
    const result = selectNextAction(
      buildState([
        card("a", "backlog", "Sketch the wheel"),
        card("b", "backlog", "Choose a body shape"),
      ])
    );
    expect(result.state).toBe("needs_pull");
    expect(result.headline).toMatch(/Pull one card from Backlog/i);
    expect(result.card).toBeNull();
  });

  it("This Class has a card but Doing is empty → 'committed' state, surfaces first This Class card", () => {
    const result = selectNextAction(
      buildState([
        card("a", "backlog", "Background research"),
        card("b", "this_class", "Sand the chassis edges"),
        card("c", "this_class", "Drill axle holes"),
      ])
    );
    expect(result.state).toBe("committed");
    expect(result.headline).toBe("Sand the chassis edges");
    expect(result.eyebrow).toMatch(/Today's commit/i);
    expect(result.ctaLabel).toMatch(/Move it to Doing/i);
    expect(result.card?.id).toBe("b");
  });

  it("Doing has a card → 'in_progress' takes priority over This Class + Backlog", () => {
    const result = selectNextAction(
      buildState([
        card("a", "backlog", "Final paint"),
        card("b", "this_class", "Sand chassis"),
        card("c", "doing", "Cut the body shape"),
      ])
    );
    expect(result.state).toBe("in_progress");
    expect(result.headline).toBe("Cut the body shape");
    expect(result.eyebrow).toMatch(/Right now/i);
    expect(result.card?.id).toBe("c");
  });

  it("Done cards alone (no Doing/This Class/Backlog) → 'empty' state", () => {
    const result = selectNextAction(
      buildState([
        card("a", "done", "Initial sketches"),
        card("b", "done", "Wheel chosen"),
      ])
    );
    expect(result.state).toBe("empty");
  });

  it("returns the FIRST card in each column (preserves student's ordering)", () => {
    const result = selectNextAction(
      buildState([
        card("c1", "this_class", "First in This Class"),
        card("c2", "this_class", "Second"),
        card("c3", "this_class", "Third"),
      ])
    );
    expect(result.headline).toBe("First in This Class");
  });
});
