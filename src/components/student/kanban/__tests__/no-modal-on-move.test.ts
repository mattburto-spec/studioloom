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

describe("KanbanBoard — drag-end suppresses post-drop card click", () => {
  it("declares suppressCardClick state", () => {
    expect(BOARD_SRC).toMatch(
      /\[suppressCardClick,\s*setSuppressCardClick\][\s\S]{0,80}useState/
    );
  });

  it("flips suppressCardClick on every drag-end + clears after 250ms", () => {
    expect(BOARD_SRC).toMatch(/setSuppressCardClick\(true\)/);
    expect(BOARD_SRC).toMatch(
      /setTimeout\(\(\)\s*=>\s*setSuppressCardClick\(false\),\s*250\)/
    );
  });

  it("forwards suppressCardClick to each KanbanColumn", () => {
    expect(BOARD_SRC).toContain("suppressCardClick={suppressCardClick}");
  });
});

describe("KanbanColumn — passes suppressClick to each card", () => {
  it("accepts suppressCardClick prop", () => {
    expect(COLUMN_SRC).toMatch(/suppressCardClick\?:\s*boolean/);
  });

  it("forwards it to the KanbanCard render as suppressClick", () => {
    expect(COLUMN_SRC).toMatch(/suppressClick=\{suppressCardClick\}/);
  });
});

describe("KanbanCard — already had suppressClick wiring (round 19)", () => {
  it("short-circuits handleClick when suppressClick is true", () => {
    expect(CARD_SRC).toMatch(/if\s*\(suppressClick\)/);
    expect(CARD_SRC).toContain("e.preventDefault()");
    expect(CARD_SRC).toContain("e.stopPropagation()");
  });
});

describe("KanbanCardModal — edit-mode 'Move to' buttons direct-dispatch", () => {
  it("does NOT call onChangeMode for move-target buttons (no sub-mode)", () => {
    // Find the Move-to picker block and confirm the button onClick is
    // onMove(col, {}) and not onChangeMode("move-to", col).
    const idx = MODAL_SRC.indexOf('data-testid={`kanban-modal-move-${col}`}');
    expect(idx).toBeGreaterThan(0);
    const slice = MODAL_SRC.slice(Math.max(0, idx - 600), idx);
    expect(slice).toContain("onMove(col, {})");
    expect(slice).not.toMatch(/onChangeMode\("move-to",\s*col\)/);
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
