/**
 * Smoke-fix round 6 — lesson-page rail buttons rewired to Kanban +
 * Timeline drawers.
 *
 * Source-static guards lock:
 *   - Old MYP-criteria PlanningPanel + page-due-date GanttPanel imports
 *     dropped from the lesson page
 *   - Class Gallery rail entry temporarily removed
 *   - New rail buttons: Portfolio / Project Board / Timeline
 *   - Project Board button opens BoardDrawer wrapping <KanbanBoard />
 *   - Timeline button opens BoardDrawer wrapping <TimelineBoard />
 *   - State vars renamed honestly (planOpen → kanbanOpen,
 *     ganttOpen → timelineOpen) — outside of comment strings
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PAGE_SRC = readFileSync(
  join(
    process.cwd(),
    "src/app/(student)/unit/[unitId]/[pageId]/page.tsx"
  ),
  "utf-8"
);

const DRAWER_SRC = readFileSync(
  join(__dirname, "..", "BoardDrawer.tsx"),
  "utf-8"
);

describe("lesson page — rail rewire (round 6)", () => {
  it("imports KanbanBoard + TimelineBoard + BoardDrawer", () => {
    expect(PAGE_SRC).toContain('from "@/components/student/kanban/KanbanBoard"');
    expect(PAGE_SRC).toContain('from "@/components/student/timeline/TimelineBoard"');
    expect(PAGE_SRC).toContain('from "@/components/student/BoardDrawer"');
  });

  it("dropped PlanningPanel + GanttPanel imports", () => {
    // The component imports are gone; mentions only survive in
    // explanatory comments (which start with "//" or "/*").
    const importLines = PAGE_SRC
      .split("\n")
      .filter((l) => l.trim().startsWith("import "));
    const joined = importLines.join("\n");
    expect(joined).not.toContain("PlanningPanel");
    expect(joined).not.toContain("GanttPanel");
  });

  it("state vars renamed: kanbanOpen + timelineOpen (no planOpen / ganttOpen left)", () => {
    expect(PAGE_SRC).toMatch(/const \[kanbanOpen, setKanbanOpen\] = useState/);
    expect(PAGE_SRC).toMatch(/const \[timelineOpen, setTimelineOpen\] = useState/);
    // Outside-comment occurrences of the old names are gone — strip
    // single-line comments to assert this without false positives from
    // doc strings.
    const stripped = PAGE_SRC
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    expect(stripped).not.toMatch(/\bplanOpen\b/);
    expect(stripped).not.toMatch(/\bganttOpen\b/);
    expect(stripped).not.toMatch(/\bsetPlanOpen\b/);
    expect(stripped).not.toMatch(/\bsetGanttOpen\b/);
  });

  it("rail visibility gate uses new state names", () => {
    expect(PAGE_SRC).toMatch(
      /\{!kanbanOpen\s*&&\s*!portfolioOpen\s*&&\s*!timelineOpen\s*&&/
    );
  });

  it("rail has exactly 3 buttons (portfolio / project-board / timeline) — Class Gallery dropped", () => {
    expect(PAGE_SRC).toContain('id: "portfolio"');
    expect(PAGE_SRC).toContain('id: "project-board"');
    expect(PAGE_SRC).toContain('id: "timeline"');
    // Class Gallery rail entry removed (the Gallery button id used to
    // be "gallery" and label "Class Gallery").
    expect(PAGE_SRC).not.toContain('id: "gallery"');
    expect(PAGE_SRC).not.toContain('label: "Class Gallery"');
  });

  it("Project Board button opens kanbanOpen drawer", () => {
    const idx = PAGE_SRC.indexOf('id: "project-board"');
    expect(idx).toBeGreaterThan(0);
    const slice = PAGE_SRC.slice(idx, idx + 600);
    expect(slice).toContain('label: "Project Board"');
    expect(slice).toContain("setKanbanOpen(true)");
  });

  it("Timeline button opens timelineOpen drawer", () => {
    const idx = PAGE_SRC.indexOf('id: "timeline"');
    expect(idx).toBeGreaterThan(0);
    const slice = PAGE_SRC.slice(idx, idx + 600);
    expect(slice).toContain('label: "Timeline"');
    expect(slice).toContain("setTimelineOpen(true)");
  });

  it("Kanban drawer mounts <KanbanBoard unitId={unitId} />", () => {
    expect(PAGE_SRC).toMatch(
      /<BoardDrawer[\s\S]{0,400}?open=\{kanbanOpen\}[\s\S]{0,400}?<KanbanBoard unitId=\{unitId\}/
    );
  });

  it("Timeline drawer mounts <TimelineBoard unitId={unitId} />", () => {
    expect(PAGE_SRC).toMatch(
      /<BoardDrawer[\s\S]{0,400}?open=\{timelineOpen\}[\s\S]{0,400}?<TimelineBoard unitId=\{unitId\}/
    );
  });

  it("both drawers expose a Full-board link to /unit/[unitId]/board", () => {
    // Two occurrences expected — one per drawer.
    const matches = PAGE_SRC.match(/fullBoardHref=\{`\/unit\/\$\{unitId\}\/board`\}/g);
    expect(matches?.length ?? 0).toBe(2);
  });
});

describe("BoardDrawer", () => {
  it("renders nothing when open=false (no scrim, no aside)", () => {
    expect(DRAWER_SRC).toMatch(/if \(!open\) return null/);
  });

  it("scrim click + close button + ESC key all close", () => {
    expect(DRAWER_SRC).toContain('data-testid="board-drawer-scrim"');
    expect(DRAWER_SRC).toContain('data-testid="board-drawer-close"');
    expect(DRAWER_SRC).toMatch(/e\.key === "Escape"/);
  });

  it("renders fullBoardHref link when prop provided", () => {
    expect(DRAWER_SRC).toContain('data-testid="board-drawer-full-link"');
    expect(DRAWER_SRC).toContain("Full board →");
    // Conditional on prop
    expect(DRAWER_SRC).toMatch(/fullBoardHref\s*&&/);
  });

  it("uses role=dialog + aria-modal=true for a11y", () => {
    expect(DRAWER_SRC).toContain('role="dialog"');
    expect(DRAWER_SRC).toContain('aria-modal="true"');
  });

  it("subtitle is optional (gated render)", () => {
    expect(DRAWER_SRC).toMatch(/subtitle\s*&&/);
  });
});
