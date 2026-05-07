/**
 * Round 21 (6 May 2026 PM) — KanbanAddCardModal contract guards.
 *
 * Replaces the v1 `window.prompt("Card title:")` with a properly styled
 * modal. Board-level wiring asserts the modal opens / closes / submits
 * cleanly, plus the drag-end ghost-click suppression that prevents the
 * "+ Add card" button from firing when a card is dropped on top of it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const MODAL_SRC = readFileSync(
  join(__dirname, "..", "KanbanAddCardModal.tsx"),
  "utf-8"
);
const BOARD_SRC = readFileSync(
  join(__dirname, "..", "KanbanBoard.tsx"),
  "utf-8"
);

describe("KanbanAddCardModal — modal contract", () => {
  it("renders a labeled dialog with the right testid", () => {
    expect(MODAL_SRC).toContain('role="dialog"');
    expect(MODAL_SRC).toContain('aria-modal="true"');
    expect(MODAL_SRC).toContain('data-testid="kanban-add-card-modal"');
  });

  it("autofocuses the title input on mount", () => {
    expect(MODAL_SRC).toMatch(/inputRef\.current\?\.focus\(\)/);
    expect(MODAL_SRC).toMatch(/ref=\{inputRef\}/);
  });

  it("Enter submits + Escape cancels", () => {
    expect(MODAL_SRC).toMatch(/e\.key === "Enter"[\s\S]{0,80}handleSubmit\(\)/);
    expect(MODAL_SRC).toMatch(/e\.key === "Escape"[\s\S]{0,80}onClose\(\)/);
  });

  it("Save button is disabled until title is non-empty (trim-aware)", () => {
    expect(MODAL_SRC).toContain("disabled={!title.trim()}");
  });

  it("submit calls onSubmit with the trimmed title", () => {
    expect(MODAL_SRC).toMatch(/const trimmed = title\.trim\(\)/);
    expect(MODAL_SRC).toContain("onSubmit(trimmed)");
  });

  it("scrim click closes the modal", () => {
    expect(MODAL_SRC).toMatch(/onClick=\{onClose\}[\s\S]{0,200}data-testid="kanban-add-card-scrim"/);
  });

  it("renders the destination column label in the header", () => {
    expect(MODAL_SRC).toContain("COLUMN_LABELS[toStatus]");
  });
});

describe("KanbanBoard — Add Card flow wiring", () => {
  it("does NOT use window.prompt anymore", () => {
    expect(BOARD_SRC).not.toMatch(/window\.prompt\(/);
  });

  it("imports + renders KanbanAddCardModal", () => {
    expect(BOARD_SRC).toContain("KanbanAddCardModal");
    expect(BOARD_SRC).toMatch(/<KanbanAddCardModal/);
  });

  it("addCardForColumn state opens the modal pre-set to a target column", () => {
    expect(BOARD_SRC).toMatch(
      /\[addCardForColumn,\s*setAddCardForColumn\][\s\S]{0,80}useState/
    );
    expect(BOARD_SRC).toContain("toStatus={addCardForColumn}");
  });

  it("submit dispatches createCard + closes the modal", () => {
    expect(BOARD_SRC).toMatch(
      /handleAddCardSubmit[\s\S]{0,200}type:\s*"createCard"[\s\S]{0,80}setAddCardForColumn\(null\)/
    );
  });

  // Round 37 (proven load-bearing) replaced the round-28 timestamp
  // gate with a stateful boolean ref. Set true at dragStart, released
  // 350ms after dragEnd via setTimeout. handleAddCard bails when true
  // so the synthetic click that follows a drag pointer-release can't
  // open the composer.
  it("dragStart claims isDraggingRef so the post-drop click is swallowed", () => {
    expect(BOARD_SRC).toContain("isDraggingRef");
    expect(BOARD_SRC).toMatch(/isDraggingRef\.current\s*=\s*true/);
  });

  it("handleAddCard ignores clicks while isDraggingRef is true", () => {
    const startIdx = BOARD_SRC.indexOf("function handleAddCard(");
    expect(startIdx).toBeGreaterThan(0);
    const nextFnIdx = BOARD_SRC.indexOf("function ", startIdx + 1);
    const body = BOARD_SRC.slice(startIdx, nextFnIdx);
    expect(body).toMatch(/if\s*\(isDraggingRef\.current\)\s*return/);
  });
});
