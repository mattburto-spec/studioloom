/**
 * Round 23 (6 May 2026 PM) — "no white popups when moving a card".
 *
 * Two surfaces could open the card-detail modal during a move:
 *   1. The synthetic click on the dragged card after framer-motion's
 *      drag-end pointer release. Fixed by wiring suppressClick on
 *      KanbanCard via a board-level 250ms gate after drag-end.
 *   2. The "Move to →" buttons in edit mode opened a sub-mode instead
 *      of dispatching the move. Fixed by direct-dispatch + closing
 *      the modal.
 *
 * Source-static guards lock both contracts. Render tests would need
 * a full Supabase mock harness for these UX guards.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const BOARD_SRC = readFileSync(
  join(__dirname, "..", "KanbanBoard.tsx"),
  "utf-8"
);
const COLUMN_SRC = readFileSync(
  join(__dirname, "..", "KanbanColumn.tsx"),
  "utf-8"
);
const CARD_SRC = readFileSync(
  join(__dirname, "..", "KanbanCard.tsx"),
  "utf-8"
);
const MODAL_SRC = readFileSync(
  join(__dirname, "..", "KanbanCardModal.tsx"),
  "utf-8"
);

// Round 26 superseded the round-23 state-mirror approach. The state
// propagation was async, so the synthetic click after a drag fired
// with the stale prop value before React re-rendered. Now the board
// does the ref check directly in handleCardClick.
describe("KanbanBoard — drag-end suppresses post-drop card click (round 26 ref-based)", () => {
  it("does NOT use state setters for suppression (state is async — was the round-23 bug)", () => {
    // Comments may reference the old approach for context — assert that
    // no actual setSuppressCardClick(...) CALL appears (parens).
    expect(BOARD_SRC).not.toMatch(/setSuppressCardClick\(/);
    expect(BOARD_SRC).not.toMatch(/\[suppressCardClick,\s*setSuppressCardClick\]/);
  });

  // Round 37 (proven load-bearing in prod) replaced the round-28
  // timestamp gate with a stateful boolean ref. The ref is true from
  // dragStart until 350ms after dragEnd. handleCardClick + handleAddCard
  // bail synchronously when it's true.
  it("handleCardDragStart claims isDraggingRef synchronously", () => {
    const startIdx = BOARD_SRC.indexOf("function handleCardDragStart(");
    expect(startIdx).toBeGreaterThan(0);
    const nextFnIdx = BOARD_SRC.indexOf("function ", startIdx + 1);
    const body = BOARD_SRC.slice(startIdx, nextFnIdx);
    expect(body).toMatch(/isDraggingRef\.current\s*=\s*true/);
  });

  it("handleCardDragEnd schedules isDraggingRef release", () => {
    const startIdx = BOARD_SRC.indexOf("function handleCardDragEnd(");
    expect(startIdx).toBeGreaterThan(0);
    const nextFnIdx = BOARD_SRC.indexOf("function ", startIdx + 1);
    const body = BOARD_SRC.slice(startIdx, nextFnIdx);
    expect(body).toMatch(/isDraggingRef\.current\s*=\s*false/);
    expect(body).toMatch(/setTimeout/);
  });

  it("handleCardClick gates on isDraggingRef before opening the modal", () => {
    expect(BOARD_SRC).toMatch(/function handleCardClick\(cardId: string\)/);
    const startIdx = BOARD_SRC.indexOf("function handleCardClick(");
    const nextFnIdx = BOARD_SRC.indexOf("function ", startIdx + 1);
    const body = BOARD_SRC.slice(startIdx, nextFnIdx);
    expect(body).toMatch(/if\s*\(isDraggingRef\.current\)\s*return/);
  });

  it("handleAddCard gates on isDraggingRef before opening the composer", () => {
    const startIdx = BOARD_SRC.indexOf("function handleAddCard(");
    expect(startIdx).toBeGreaterThan(0);
    const nextFnIdx = BOARD_SRC.indexOf("function ", startIdx + 1);
    const body = BOARD_SRC.slice(startIdx, nextFnIdx);
    expect(body).toMatch(/if\s*\(isDraggingRef\.current\)\s*return/);
  });

  it("KanbanColumn receives onCardClick={handleCardClick} (not an inline arrow)", () => {
    expect(BOARD_SRC).toMatch(/onCardClick=\{handleCardClick\}/);
  });

  // Round 35 — REVERTED rounds 31 / 33 / 34. The progressively-aggressive
  // click suppression layers collectively broke drag mechanics during
  // NIS Class 1. Drag-with-modal > no-drag-no-modal. Asserting the
  // suspect code is gone so we don't accidentally re-add it without
  // understanding why it broke drag.
  it("does NOT register a board-root onClickCapture handler (round 35 revert)", () => {
    expect(BOARD_SRC).not.toMatch(/function handleBoardClickCapture/);
    expect(BOARD_SRC).not.toMatch(/onClickCapture=\{handleBoardClickCapture\}/);
  });

  it("does NOT mutate pointer-events on the board (round 35 revert of round 33)", () => {
    expect(BOARD_SRC).not.toMatch(/boardRootRef\.current\.style\.pointerEvents/);
    expect(BOARD_SRC).not.toMatch(
      /useRef<HTMLDivElement\s*\|\s*null>\(null\)\s*\/\/.*board/i
    );
  });

  it("does NOT register a document-level click listener (round 35 revert of round 34)", () => {
    expect(BOARD_SRC).not.toMatch(/document\.addEventListener\("click"/);
    expect(BOARD_SRC).not.toMatch(/document\.removeEventListener\("click"/);
  });

  // Round 42 cleanup: the dragEnd / dragStart / phantom diagnostics
  // were stripped after round 41 (the save-race fix) proved the actual
  // root cause was at the persistence layer. Asserting the diagnostics
  // are GONE so future debugging starts from a clean console.
  it("no leftover [kanban] diagnostic console.warn calls", () => {
    expect(BOARD_SRC).not.toMatch(/console\.warn\([^)]*\[kanban\]/i);
    expect(BOARD_SRC).not.toMatch(/console\.trace\([^)]*\[kanban\]/i);
  });
});

describe("KanbanColumn — no longer passes suppressCardClick (round 26 cleanup)", () => {
  it("does not declare a suppressCardClick prop", () => {
    expect(COLUMN_SRC).not.toMatch(/suppressCardClick\?:\s*boolean/);
  });

  it("does not pass suppressClick down to KanbanCard from this layer", () => {
    expect(COLUMN_SRC).not.toMatch(/suppressClick=\{suppressCardClick\}/);
  });
});

describe("KanbanCard — already had suppressClick wiring (round 19)", () => {
  it("short-circuits handleClick when suppressClick is true", () => {
    expect(CARD_SRC).toMatch(/if\s*\(suppressClick\)/);
    expect(CARD_SRC).toContain("e.preventDefault()");
    expect(CARD_SRC).toContain("e.stopPropagation()");
  });
});

// Round 34 — "Move to" buttons removed entirely from edit mode (per
// Matt: "the pop ups have a 'move to' option but this isn't needed
// because we can drag them"). Drag-and-drop is the canonical move
// interaction. The previous round-22/23 test for direct-dispatch is
// retargeted to assert the buttons are GONE.
describe("KanbanCardModal — edit-mode 'Move to' buttons removed (round 34)", () => {
  it("no longer renders kanban-modal-move-${col} buttons in edit mode", () => {
    expect(MODAL_SRC).not.toMatch(/data-testid=\{`kanban-modal-move-\$\{col\}`\}/);
  });

  it("does not import KANBAN_COLUMNS at the top of the file (cleanup)", () => {
    // The import was only used for the move-to picker iteration.
    expect(MODAL_SRC).not.toMatch(/^\s*KANBAN_COLUMNS,\s*$/m);
  });
});

describe("KanbanBoard onMove — validates before dispatch (WIP toast)", () => {
  it("imports validateMove", () => {
    expect(BOARD_SRC).toContain("validateMove");
  });

  it("WIP failure surfaces drop-toast + keeps modal open", () => {
    expect(BOARD_SRC).toMatch(
      /const v = validateMove\(state[\s\S]{0,200}wipErr[\s\S]{0,200}setDropToast\(wipErr\.message\)/
    );
  });

  it("validation pass dispatches moveCard + closes modal", () => {
    expect(BOARD_SRC).toMatch(
      /if\s*\(!v\.ok\)[\s\S]{0,400}return;[\s\S]{0,200}dispatch\(\{[\s\S]{0,80}type:\s*"moveCard"[\s\S]{0,200}closeCardModal\(\)/
    );
  });
});

describe("KanbanCardModal — edit-mode DoD copy reflects round-22 softening", () => {
  it("DoD label includes (optional)", () => {
    // Find the edit-mode DoD field (anchored by its testid) and check
    // that the surrounding label has the "(optional)" treatment.
    const dodLabelIdx = MODAL_SRC.indexOf('data-testid="kanban-modal-dod-input"');
    expect(dodLabelIdx).toBeGreaterThan(0);
    const slice = MODAL_SRC.slice(Math.max(0, dodLabelIdx - 1200), dodLabelIdx);
    expect(slice).toMatch(/Definition of Done/);
    expect(slice).toMatch(/optional/i);
  });

  it("removes the 'Required when moving to This Class' copy", () => {
    expect(MODAL_SRC).not.toMatch(/Required when moving to This Class/);
  });
});
