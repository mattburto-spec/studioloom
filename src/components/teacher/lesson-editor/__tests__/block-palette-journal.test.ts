/**
 * AG.1 follow-up — Process Journal block in BlockPalette.
 *
 * Source-static guards locking the contract:
 *   - "process-journal" entry exists in BLOCK_LIBRARY
 *   - create() returns responseType="structured-prompts"
 *   - create() seeds prompts with JOURNAL_PROMPTS preset
 *   - create() sets autoCreateKanbanCardOnSave=true (so AG.2.4 wiring fires)
 *   - JOURNAL_PROMPTS imported from the canonical preset module
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PALETTE_SRC = readFileSync(
  join(__dirname, "..", "BlockPalette.tsx"),
  "utf-8"
);

describe("Process Journal block in BlockPalette", () => {
  it('imports JOURNAL_PROMPTS from "@/lib/structured-prompts/presets"', () => {
    expect(PALETTE_SRC).toContain(
      'from "@/lib/structured-prompts/presets"'
    );
    expect(PALETTE_SRC).toMatch(/import\s*\{[^}]*JOURNAL_PROMPTS/);
  });

  it("registers a 'process-journal' entry in BLOCK_LIBRARY", () => {
    expect(PALETTE_SRC).toContain('id: "process-journal"');
    expect(PALETTE_SRC).toContain('label: "Process Journal"');
  });

  it("uses responseType='structured-prompts' in create() factory", () => {
    const idx = PALETTE_SRC.indexOf('id: "process-journal"');
    expect(idx).toBeGreaterThan(0);
    const block = PALETTE_SRC.slice(idx, idx + 1000);
    expect(block).toContain('responseType: "structured-prompts"');
    expect(block).toContain("prompts: JOURNAL_PROMPTS");
    expect(block).toContain("autoCreateKanbanCardOnSave: true");
    // Round 5: surfaces the entry in Narrative even when other blocks
    // in the unit are portfolioCapture-flagged.
    expect(block).toContain("portfolioCapture: true");
  });

  it("category=response (so it surfaces in the Student Response group)", () => {
    const idx = PALETTE_SRC.indexOf('id: "process-journal"');
    const block = PALETTE_SRC.slice(idx, idx + 500);
    expect(block).toMatch(/category:\s*"response"/);
  });

  it("default phase = debrief (Workshop Model alignment)", () => {
    const idx = PALETTE_SRC.indexOf('id: "process-journal"');
    const block = PALETTE_SRC.slice(idx, idx + 700);
    expect(block).toMatch(/defaultPhase:\s*"debrief"/);
  });
});

describe("ResponseInput receives prompts + autoCreate from section", () => {
  const ACTIVITY_CARD_SRC = readFileSync(
    join(process.cwd(), "src/components/student/ActivityCard.tsx"),
    "utf-8"
  );

  it("ActivityCard passes section.prompts to ResponseInput", () => {
    expect(ACTIVITY_CARD_SRC).toContain("prompts={section.prompts}");
  });

  it("ActivityCard passes section.autoCreateKanbanCardOnSave through", () => {
    expect(ACTIVITY_CARD_SRC).toContain(
      "autoCreateKanbanCardOnSave={section.autoCreateKanbanCardOnSave}"
    );
  });

  it("ActivityCard passes section.requirePhoto through", () => {
    expect(ACTIVITY_CARD_SRC).toContain("requirePhoto={section.requirePhoto}");
  });
});

describe("LessonSidebar Project Board CTA (smoke-feedback 6 May 2026)", () => {
  const SIDEBAR_SRC = readFileSync(
    join(process.cwd(), "src/components/student/LessonSidebar.tsx"),
    "utf-8"
  );

  it("renders the prominent Project Board button", () => {
    expect(SIDEBAR_SRC).toContain('data-testid="lesson-sidebar-project-board"');
    expect(SIDEBAR_SRC).toContain("Project Board");
  });

  it("button navigates to /unit/[unitId]/board", () => {
    expect(SIDEBAR_SRC).toMatch(/router\.push\(`\/unit\/\$\{unitId\}\/board`\)/);
  });

  it("button placed inside the unit-title block (under the title)", () => {
    const titleIdx = SIDEBAR_SRC.indexOf("{data.unit.title}");
    const buttonIdx = SIDEBAR_SRC.indexOf(
      'data-testid="lesson-sidebar-project-board"'
    );
    expect(titleIdx).toBeGreaterThan(0);
    expect(buttonIdx).toBeGreaterThan(titleIdx);
    // Should be reasonably close (within ~200 lines / ~8000 chars)
    expect(buttonIdx - titleIdx).toBeLessThan(8000);
  });

  it("retired the inline % progress bar (no longer rendered)", () => {
    expect(SIDEBAR_SRC).not.toMatch(/\{pct\}% Complete/);
  });

  it("button uses an SVG kanban-style icon (not just an emoji)", () => {
    const idx = SIDEBAR_SRC.indexOf('data-testid="lesson-sidebar-project-board"');
    const block = SIDEBAR_SRC.slice(idx, idx + 1500);
    expect(block).toContain("<svg");
    expect(block).toContain("rect");
  });

  it("dropped the redundant tucked-away Project Board link below the nav", () => {
    // The duplicate had a 📋 emoji + "Project board" text in a smaller link.
    // The inline doc replacement comment should be present, not the
    // emoji-button pattern.
    const occurrences = SIDEBAR_SRC.match(
      /data-testid="lesson-sidebar-project-board"/g
    );
    expect(occurrences?.length ?? 0).toBe(1);
  });
});
