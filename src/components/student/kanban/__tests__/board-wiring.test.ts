/**
 * AG.2.3b — source-static guards for the Kanban UI tree.
 *
 * Per Lesson #38: assertions check specific patterns + ordering, not
 * just presence. Per Lesson #71: tests stay in `.ts` and read source
 * files directly (no JSX boundary).
 *
 * Coverage:
 *   - useKanbanBoard hook (load → ready transition, debounce, dispatch
 *     wraps reducer, isDirty flagging)
 *   - KanbanBoard top-level (column meta, save indicator, modal mount)
 *   - KanbanColumn (WIP visual + add affordance gates)
 *   - KanbanCard (visual signals)
 *   - KanbanCardModal (mode-conditioned rendering, validation wiring,
 *     footer mode-specific buttons, scrim close)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const HOOK_SRC = readFileSync(
  join(__dirname, "..", "use-kanban-board.ts"),
  "utf-8"
);
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

describe("useKanbanBoard hook", () => {
  it("imports kanbanReducer + types from the lib", () => {
    expect(HOOK_SRC).toContain('from "@/lib/unit-tools/kanban/reducer"');
    expect(HOOK_SRC).toContain('from "@/lib/unit-tools/kanban/types"');
  });

  it("imports load + save client wrappers", () => {
    expect(HOOK_SRC).toContain("loadKanbanState");
    expect(HOOK_SRC).toContain("saveKanbanState");
    expect(HOOK_SRC).toContain("KanbanApiError");
  });

  it("uses 800ms debounce for autosave", () => {
    expect(HOOK_SRC).toMatch(/SAVE_DEBOUNCE_MS\s*=\s*800/);
  });

  it("dispatch wrapper does NOT auto-save during initial load (avoids load → save cycle)", () => {
    expect(HOOK_SRC).toContain("initialLoadingRef");
    expect(HOOK_SRC).toMatch(/if\s*\(initialLoadingRef\.current\)\s*return/);
  });

  it("dispatch wrapper marks state dirty before scheduling save", () => {
    const dispatchIdx = HOOK_SRC.indexOf("const dispatch = useCallback");
    expect(dispatchIdx).toBeGreaterThan(0);
    const dispatchBody = HOOK_SRC.slice(dispatchIdx, dispatchIdx + 1200);
    const dirtyIdx = dispatchBody.indexOf("isDirty: true");
    const setTimeoutIdx = dispatchBody.indexOf("setTimeout");
    expect(dirtyIdx).toBeGreaterThan(0);
    expect(setTimeoutIdx).toBeGreaterThan(dirtyIdx);
  });

  it("dispatch ignores loadState actions for save scheduling (server canonical)", () => {
    const dispatchIdx = HOOK_SRC.indexOf("const dispatch = useCallback");
    const dispatchBody = HOOK_SRC.slice(dispatchIdx, dispatchIdx + 1200);
    expect(dispatchBody).toMatch(
      /if\s*\(action\.type === "loadState"\)\s*return/
    );
  });

  it("flushSave clears pending debounce + saves snapshot via stateRef", () => {
    expect(HOOK_SRC).toMatch(/clearTimeout\(saveTimerRef\.current\)/);
    expect(HOOK_SRC).toContain("stateRef.current");
  });

  it("flushSave replaces state with server canonical (loadState dispatch on success)", () => {
    const flushIdx = HOOK_SRC.indexOf("const flushSave = useCallback");
    const flushBody = HOOK_SRC.slice(flushIdx, flushIdx + 1500);
    expect(flushBody).toMatch(
      /baseDispatch\(\{\s*type:\s*"loadState",\s*state:\s*result\.kanban\s*\}\)/
    );
  });

  it("cleans up debounce timer on unmount", () => {
    expect(HOOK_SRC).toMatch(
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?return\s*\(\)\s*=>\s*\{[\s\S]*?clearTimeout/
    );
  });

  it("KanbanApiError details are surfaced when present", () => {
    expect(HOOK_SRC).toContain("err.details.length > 0");
  });
});

describe("KanbanBoard top-level component", () => {
  it("imports the orchestration hook + helpers from the lib", () => {
    expect(BOARD_SRC).toContain('from "./use-kanban-board"');
    expect(BOARD_SRC).toContain("cardsByStatus");
    expect(BOARD_SRC).toContain("estimateAccuracy");
  });

  it("renders all 4 columns in canonical order via KANBAN_COLUMNS", () => {
    expect(BOARD_SRC).toMatch(/KANBAN_COLUMNS\.map\(\(col\)\s*=>/);
    // Column meta covers all 4
    expect(BOARD_SRC).toMatch(/backlog:[\s\S]{0,100}allowAdd:\s*true/);
    expect(BOARD_SRC).toMatch(/this_class:[\s\S]{0,100}allowAdd:\s*true/);
    expect(BOARD_SRC).toMatch(/doing:[\s\S]{0,100}allowAdd:\s*false/);
    expect(BOARD_SRC).toMatch(/done:[\s\S]{0,100}allowAdd:\s*false/);
  });

  it("only the Doing column gets a wipLimit prop", () => {
    expect(BOARD_SRC).toMatch(
      /wipLimit=\{col === "doing" \? state\.wipLimitDoing : undefined\}/
    );
  });

  it("save indicator distinguishes 4 states (saving / error / dirty / saved)", () => {
    expect(BOARD_SRC).toContain("save.isSaving");
    expect(BOARD_SRC).toContain("save.error");
    expect(BOARD_SRC).toContain("save.isDirty");
    expect(BOARD_SRC).toContain("save.lastSavedAt");
  });

  it("save error has a Retry button wired to flushSave", () => {
    expect(BOARD_SRC).toMatch(/onClick=\{flushSave\}[\s\S]*?Retry/);
  });

  it("renders estimate-accuracy ratio when at least one card has both estimate + actual", () => {
    expect(BOARD_SRC).toContain('data-testid="kanban-estimate-accuracy"');
    expect(BOARD_SRC).toMatch(/Estimate calibration[\s\S]{0,200}\.toFixed\(2\)/);
  });

  it("loading state renders before ready", () => {
    expect(BOARD_SRC).toContain('data-testid="kanban-loading"');
    expect(BOARD_SRC).toMatch(/loadStatus === "loading"/);
  });

  it("error state has reload affordance", () => {
    expect(BOARD_SRC).toContain('data-testid="kanban-load-error"');
    expect(BOARD_SRC).toMatch(/window\.location\.reload\(\)/);
  });

  it("modal mounts only when openCardId resolves to an existing card", () => {
    expect(BOARD_SRC).toContain("openCardId");
    expect(BOARD_SRC).toMatch(/openCard\s*&&[\s\S]{0,30}<KanbanCardModal/);
  });

  it("dispatching createCard wires title + status from the user input", () => {
    expect(BOARD_SRC).toMatch(
      /dispatch\(\{\s*type:\s*"createCard",\s*title,\s*status:\s*toStatus/
    );
  });

  it("modal action handlers route to reducer dispatch (not direct state)", () => {
    expect(BOARD_SRC).toContain('type: "moveCard"');
    expect(BOARD_SRC).toContain('type: "updateTitle"');
    expect(BOARD_SRC).toContain('type: "updateDoD"');
    expect(BOARD_SRC).toContain('type: "markBlocked"');
    expect(BOARD_SRC).toContain('type: "markUnblocked"');
    expect(BOARD_SRC).toContain('type: "deleteCard"');
  });
});

describe("KanbanColumn", () => {
  it("renders count + WIP indicator when wipLimit prop set", () => {
    expect(COLUMN_SRC).toMatch(/wipLimit !== undefined[\s\S]{0,80}\$\{count\} \/ \$\{wipLimit\}/);
  });

  it("color codes count: rose when over, amber when at, gray when under", () => {
    expect(COLUMN_SRC).toMatch(/overLimit[\s\S]{0,200}text-rose-600/);
    expect(COLUMN_SRC).toMatch(/atLimit[\s\S]{0,200}text-amber-600/);
  });

  it("only renders Add card affordance when allowAdd=true", () => {
    expect(COLUMN_SRC).toMatch(/allowAdd\s*&&[\s\S]{0,30}<button/);
  });

  it("has data-testid keyed on columnId for smoke selectors", () => {
    expect(COLUMN_SRC).toMatch(/data-testid=\{`kanban-column-\$\{columnId\}`\}/);
    expect(COLUMN_SRC).toMatch(/data-testid=\{`kanban-column-\$\{columnId\}-count`\}/);
  });
});

describe("KanbanCard", () => {
  it("shows blocked indicator when card.blockType is non-null", () => {
    expect(CARD_SRC).toContain("isBlocked");
    // Just check the literal "Blocked:" prefix + BLOCK_LABELS lookup
    expect(CARD_SRC).toContain("Blocked:");
    expect(CARD_SRC).toContain("BLOCK_LABELS[card.blockType!]");
  });

  it("renders journal-next icon when source === 'journal_next'", () => {
    expect(CARD_SRC).toMatch(
      /isJournalCreated\s*&&[\s\S]{0,200}📔/
    );
  });

  it("shows estimate badge with optional actualMinutes suffix", () => {
    expect(CARD_SRC).toContain("card.estimateMinutes");
    expect(CARD_SRC).toContain("card.actualMinutes");
    expect(CARD_SRC).toMatch(/⏱.*estimateMinutes/);
  });

  it("DoD chip renders only when card.dod is set", () => {
    expect(CARD_SRC).toMatch(/card\.dod\s*&&[\s\S]{0,50}<span/);
  });

  it("data-testid + data-card-status + data-card-blocked attrs for smoke", () => {
    expect(CARD_SRC).toContain('data-testid={`kanban-card-${card.id}`}');
    expect(CARD_SRC).toContain('data-card-status={card.status}');
    expect(CARD_SRC).toMatch(/data-card-blocked=\{isBlocked \? "true" : "false"\}/);
  });
});

describe("KanbanCardModal", () => {
  it("imports validateMove for pre-emptive move-target validation", () => {
    expect(MODAL_SRC).toContain("validateMove");
  });

  it("4 modes map to 4 distinct render branches", () => {
    expect(MODAL_SRC).toMatch(/mode === "edit"\s*&&/);
    expect(MODAL_SRC).toMatch(/mode === "move-to"\s*&&/);
    expect(MODAL_SRC).toMatch(/mode === "block"\s*&&/);
    expect(MODAL_SRC).toMatch(/mode === "confirm-delete"\s*&&/);
  });

  it("scrim closes the modal", () => {
    expect(MODAL_SRC).toMatch(/onClick=\{onClose\}[\s\S]{0,80}data-testid="kanban-modal-scrim"/);
  });

  it("blockage triage renders 4 buttons (tool/skill/decision/help)", () => {
    expect(MODAL_SRC).toContain('"tool"');
    expect(MODAL_SRC).toContain('"skill"');
    expect(MODAL_SRC).toContain('"decision"');
    expect(MODAL_SRC).toContain('"help"');
    expect(MODAL_SRC).toMatch(/BLOCK_TYPE_OPTIONS\.map/);
  });

  it("DoD field appears in move-to mode when target requires DoD AND card.dod is empty", () => {
    expect(MODAL_SRC).toMatch(
      /moveTarget === "this_class" \|\|[\s\S]{0,50}moveTarget === "doing"[\s\S]{0,50}moveTarget === "done"/
    );
    expect(MODAL_SRC).toMatch(
      /\(card\.dod\?\.\trim\(\) \?\? ""\)\.length === 0|\(card\.dod\?\.\.trim\(\) \?\? ""\)\.length === 0|trim\(\) \?\? ""\)\.length === 0/
    );
  });

  it("estimate field appears only when target === 'doing'", () => {
    // Anchor on the testid — the gating expression sits in the parent JSX block.
    // 2000-char window is generous enough for the surrounding label + helper text.
    expect(MODAL_SRC).toContain('data-testid="kanban-move-estimate-input"');
    const idx = MODAL_SRC.indexOf('data-testid="kanban-move-estimate-input"');
    const before = MODAL_SRC.slice(Math.max(0, idx - 2000), idx);
    expect(before).toContain('moveTarget === "doing"');
  });

  it("because clause field appears only when target === 'done'", () => {
    expect(MODAL_SRC).toContain('data-testid="kanban-move-because-input"');
    const idx = MODAL_SRC.indexOf('data-testid="kanban-move-because-input"');
    const before = MODAL_SRC.slice(Math.max(0, idx - 2000), idx);
    expect(before).toContain('moveTarget === "done"');
  });

  it("Move submit button disabled when validation fails", () => {
    expect(MODAL_SRC).toMatch(/disabled=\{!moveValidation\?\.ok\}/);
    expect(MODAL_SRC).toContain('data-testid="kanban-modal-move-submit"');
  });

  it("validation errors render with field-level messages", () => {
    expect(MODAL_SRC).toContain("moveValidation.errors.map");
    expect(MODAL_SRC).toMatch(/Fix th(is|ese) before moving/);
  });

  it("delete-confirm mode has explicit destructive button color (rose)", () => {
    expect(MODAL_SRC).toContain('data-testid="kanban-modal-delete-confirm"');
    const idx = MODAL_SRC.indexOf('data-testid="kanban-modal-delete-confirm"');
    const window = MODAL_SRC.slice(Math.max(0, idx - 400), idx + 400);
    expect(window).toContain("bg-rose-600");
  });

  it("eagerly commits DoD inside the move-to flow so validateMove sees it", () => {
    // The DoD field in move-to mode dispatches onUpdateDoD inside its onChange
    // (so validateMove on the next render reflects the typed value, not the
    // committed-on-blur value). Anchor on the move-to DoD testid.
    expect(MODAL_SRC).toContain('data-testid="kanban-move-dod-input"');
    const idx = MODAL_SRC.indexOf('data-testid="kanban-move-dod-input"');
    const before = MODAL_SRC.slice(Math.max(0, idx - 800), idx);
    expect(before).toContain("onUpdateDoD(e.target.value)");
  });

  // Smoke-feedback 6 May 2026 — DoD field unmount-mid-typing fix.
  it("DoD visibility gated on dodWasInitiallyEmptyRef snapshot (not live card.dod)", () => {
    expect(MODAL_SRC).toContain("dodWasInitiallyEmptyRef");
    expect(MODAL_SRC).toContain("moveContextKeyRef");
    // Captured once per (mode, moveTarget) transition; not on every card.dod change.
    expect(MODAL_SRC).toMatch(
      /moveContextKeyRef\.current\s*!==\s*key[\s\S]{0,300}dodWasInitiallyEmptyRef\.current\s*=/
    );
    // Conditional uses the ref, not (card.dod?.trim() ?? "").length === 0
    const moveDodIdx = MODAL_SRC.indexOf('data-testid="kanban-move-dod-input"');
    const sliceForCondition = MODAL_SRC.slice(
      Math.max(0, moveDodIdx - 1500),
      moveDodIdx
    );
    expect(sliceForCondition).toContain(
      "dodWasInitiallyEmptyRef.current"
    );
  });

  // Smoke-feedback 6 May 2026 — because-clause display fix.
  it("Done card edit view surfaces the captured because clause", () => {
    expect(MODAL_SRC).toContain('data-testid="kanban-modal-because-display"');
    // Gated on Done status + non-empty becauseClause
    expect(MODAL_SRC).toMatch(
      /card\.status === "done"[\s\S]{0,200}card\.becauseClause\?\.trim/
    );
    // Read-only div (not a textarea) for v1 — editing is a follow-up
    const idx = MODAL_SRC.indexOf('data-testid="kanban-modal-because-display"');
    const before = MODAL_SRC.slice(Math.max(0, idx - 400), idx);
    expect(before).toContain("<div");
    expect(before).toContain("bg-emerald-50");
  });
});
