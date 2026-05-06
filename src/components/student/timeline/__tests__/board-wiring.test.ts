/**
 * AG.3.4 — source-static guards for Timeline UI tree.
 *
 * Mirrors the AG.2 Kanban wiring tests for symmetry.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const HOOK_SRC = readFileSync(
  join(__dirname, "..", "use-timeline-board.ts"),
  "utf-8"
);
const BOARD_SRC = readFileSync(
  join(__dirname, "..", "TimelineBoard.tsx"),
  "utf-8"
);
const ROW_SRC = readFileSync(
  join(__dirname, "..", "TimelineMilestoneRow.tsx"),
  "utf-8"
);

describe("useTimelineBoard hook", () => {
  it("imports timelineReducer + types from lib", () => {
    expect(HOOK_SRC).toContain('from "@/lib/unit-tools/timeline/reducer"');
    expect(HOOK_SRC).toContain('from "@/lib/unit-tools/timeline/types"');
  });

  it("imports load + save client wrappers + TimelineApiError", () => {
    expect(HOOK_SRC).toContain("loadTimelineState");
    expect(HOOK_SRC).toContain("saveTimelineState");
    expect(HOOK_SRC).toContain("TimelineApiError");
  });

  it("uses 800ms debounce for autosave (matches Kanban)", () => {
    expect(HOOK_SRC).toMatch(/SAVE_DEBOUNCE_MS\s*=\s*800/);
  });

  it("dispatch wrapper does NOT auto-save during initial load", () => {
    expect(HOOK_SRC).toContain("initialLoadingRef");
    expect(HOOK_SRC).toMatch(/if\s*\(initialLoadingRef\.current\)\s*return/);
  });

  it("dispatch ignores loadState actions for save scheduling", () => {
    const dispatchIdx = HOOK_SRC.indexOf("const dispatch = useCallback");
    const dispatchBody = HOOK_SRC.slice(dispatchIdx, dispatchIdx + 1200);
    expect(dispatchBody).toMatch(
      /if\s*\(action\.type === "loadState"\)\s*return/
    );
  });

  it("flushSave clears pending debounce + replaces state with server canonical", () => {
    expect(HOOK_SRC).toMatch(/clearTimeout\(saveTimerRef\.current\)/);
    const flushIdx = HOOK_SRC.indexOf("const flushSave = useCallback");
    const flushBody = HOOK_SRC.slice(flushIdx, flushIdx + 1500);
    expect(flushBody).toMatch(
      /baseDispatch\(\{\s*type:\s*"loadState",\s*state:\s*result\.timeline\s*\}\)/
    );
  });

  it("cleans up debounce timer on unmount", () => {
    expect(HOOK_SRC).toMatch(
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?return\s*\(\)\s*=>\s*\{[\s\S]*?clearTimeout/
    );
  });

  it("TimelineApiError details are surfaced when present", () => {
    expect(HOOK_SRC).toContain("err.details.length > 0");
  });
});

describe("TimelineBoard top-level component", () => {
  it("imports orchestration hook + helpers", () => {
    expect(BOARD_SRC).toContain('from "./use-timeline-board"');
    expect(BOARD_SRC).toContain("orderedMilestones");
    expect(BOARD_SRC).toContain("findNextPendingTargeted");
  });

  it("renders 4 save indicator branches (saving / error / dirty / saved)", () => {
    expect(BOARD_SRC).toContain("save.isSaving");
    expect(BOARD_SRC).toContain("save.error");
    expect(BOARD_SRC).toContain("save.isDirty");
    expect(BOARD_SRC).toContain("save.lastSavedAt");
  });

  it("Retry button wired to flushSave", () => {
    expect(BOARD_SRC).toMatch(/onClick=\{flushSave\}[\s\S]*?Retry/);
  });

  it("loading state renders before ready", () => {
    expect(BOARD_SRC).toContain('data-testid="timeline-loading"');
    expect(BOARD_SRC).toMatch(/loadStatus === "loading"/);
  });

  it("error state has reload affordance", () => {
    expect(BOARD_SRC).toContain('data-testid="timeline-load-error"');
    expect(BOARD_SRC).toMatch(/window\.location\.reload\(\)/);
  });

  it("renders race day input wired to setRaceDate action", () => {
    expect(BOARD_SRC).toContain('data-testid="timeline-race-date"');
    expect(BOARD_SRC).toMatch(
      /dispatch\(\{\s*type:\s*"setRaceDate"/
    );
  });

  it("renders next-pending-milestone marker when next is non-null", () => {
    expect(BOARD_SRC).toContain('data-testid="timeline-next-milestone"');
    expect(BOARD_SRC).toContain("next.label");
  });

  it("renders empty state when no milestones", () => {
    expect(BOARD_SRC).toContain('data-testid="timeline-empty"');
    expect(BOARD_SRC).toMatch(/ordered\.length === 0/);
  });

  it("Add milestone uses window.prompt for label + targetDate (mirrors Kanban)", () => {
    expect(BOARD_SRC).toMatch(/window\.prompt\(\s*"New milestone label/);
    expect(BOARD_SRC).toMatch(/window\.prompt\(\s*"Target date/);
  });

  it("rejects malformed targetDate from prompt (passes null instead)", () => {
    expect(BOARD_SRC).toMatch(
      /\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(targetDate\)/
    );
  });

  it("up/down reorder dispatches reorderMilestones with full ordered IDs array", () => {
    expect(BOARD_SRC).toMatch(/type:\s*"reorderMilestones"/);
    expect(BOARD_SRC).toMatch(/orderedIds:\s*ids/);
  });

  it("modal action handlers route to reducer dispatch", () => {
    expect(BOARD_SRC).toContain('type: "updateLabel"');
    expect(BOARD_SRC).toContain('type: "setTargetDate"');
    expect(BOARD_SRC).toContain('type: "markDone"');
    expect(BOARD_SRC).toContain('type: "markPending"');
    expect(BOARD_SRC).toContain('type: "deleteMilestone"');
  });
});

describe("TimelineMilestoneRow", () => {
  it("imports computeVariance from reducer (no parallel impl)", () => {
    expect(ROW_SRC).toContain("computeVariance");
    expect(ROW_SRC).toContain('from "@/lib/unit-tools/timeline/reducer"');
  });

  it("renders variance dot with 4 color states (on_track/tight/behind/no_target)", () => {
    expect(ROW_SRC).toContain("on_track");
    expect(ROW_SRC).toContain("tight");
    expect(ROW_SRC).toContain("behind");
    expect(ROW_SRC).toContain("no_target");
    expect(ROW_SRC).toContain("bg-emerald-500");
    expect(ROW_SRC).toContain("bg-amber-500");
    expect(ROW_SRC).toContain("bg-rose-500");
    expect(ROW_SRC).toContain("bg-gray-300");
  });

  it("done milestones don't compute variance (gray dot)", () => {
    expect(ROW_SRC).toMatch(
      /isDone[\s\S]{0,40}\?\s*null\s*:\s*computeVariance/
    );
  });

  it("status checkbox dispatches markDone or markPending", () => {
    expect(ROW_SRC).toContain("onMarkDone");
    expect(ROW_SRC).toContain("onMarkPending");
    expect(ROW_SRC).toMatch(/e\.target\.checked\s*\?\s*onMarkDone\(\)\s*:\s*onMarkPending\(\)/);
  });

  it("inline label edit commits on blur (not on every keystroke)", () => {
    expect(ROW_SRC).toContain("onBlur={commitLabel}");
    expect(ROW_SRC).toMatch(/setLabelDraft/); // local draft
  });

  it("anchored milestones can't be deleted (no Delete button)", () => {
    expect(ROW_SRC).toMatch(/!milestone\.isAnchor[\s\S]{0,30}<button/);
  });

  it("reorder buttons disabled at edges (canMoveUp / canMoveDown props)", () => {
    expect(ROW_SRC).toContain("canMoveUp");
    expect(ROW_SRC).toContain("canMoveDown");
    expect(ROW_SRC).toMatch(/disabled=\{!canMoveUp\}/);
    expect(ROW_SRC).toMatch(/disabled=\{!canMoveDown\}/);
  });

  it("data attrs for smoke selectors", () => {
    expect(ROW_SRC).toContain('data-testid={`timeline-milestone-row-${milestone.id}`}');
    expect(ROW_SRC).toMatch(/data-milestone-status=\{milestone\.status\}/);
    expect(ROW_SRC).toMatch(/data-variance=\{dotKey\}/);
  });
});

describe("Student board page mounts both Timeline + Kanban", () => {
  const PAGE_SRC = readFileSync(
    join(process.cwd(), "src/app/(student)/unit/[unitId]/board/page.tsx"),
    "utf-8"
  );

  it("imports both TimelineBoard + KanbanBoard", () => {
    expect(PAGE_SRC).toContain('from "@/components/student/timeline/TimelineBoard"');
    expect(PAGE_SRC).toContain('from "@/components/student/kanban/KanbanBoard"');
  });

  it("mounts TimelineBoard ABOVE KanbanBoard (timeline = macro, kanban = micro)", () => {
    const timelineIdx = PAGE_SRC.indexOf("<TimelineBoard");
    const kanbanIdx = PAGE_SRC.indexOf("<KanbanBoard");
    expect(timelineIdx).toBeGreaterThan(0);
    expect(kanbanIdx).toBeGreaterThan(timelineIdx);
  });

  it("both components receive unitId prop", () => {
    expect(PAGE_SRC).toContain("<TimelineBoard unitId={unitId}");
    expect(PAGE_SRC).toContain("<KanbanBoard unitId={unitId}");
  });
});
