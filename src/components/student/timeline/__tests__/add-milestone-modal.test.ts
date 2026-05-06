/**
 * Round 21 (6 May 2026 PM) — TimelineAddMilestoneModal contract guards.
 *
 * Replaces the v1 `window.prompt("New milestone label:") +
 * window.prompt("Target date (YYYY-MM-DD), or leave empty:")` with a
 * single modal that has a label input + a native date picker.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const MODAL_SRC = readFileSync(
  join(__dirname, "..", "TimelineAddMilestoneModal.tsx"),
  "utf-8"
);
const BOARD_SRC = readFileSync(
  join(__dirname, "..", "TimelineBoard.tsx"),
  "utf-8"
);

describe("TimelineAddMilestoneModal — modal contract", () => {
  it("renders a labeled dialog with the right testid", () => {
    expect(MODAL_SRC).toContain('role="dialog"');
    expect(MODAL_SRC).toContain('aria-modal="true"');
    expect(MODAL_SRC).toContain('data-testid="timeline-add-milestone-modal"');
  });

  it("autofocuses the label input on mount", () => {
    expect(MODAL_SRC).toMatch(/inputRef\.current\?\.focus\(\)/);
    expect(MODAL_SRC).toMatch(/ref=\{inputRef\}/);
  });

  it("uses a native date picker (input type=date), not a text field", () => {
    expect(MODAL_SRC).toContain('type="date"');
    expect(MODAL_SRC).toContain('data-testid="timeline-add-milestone-date-input"');
  });

  it("Enter submits + Escape cancels (on label AND date inputs)", () => {
    const enterMatches = MODAL_SRC.match(/e\.key === "Enter"/g) ?? [];
    const escapeMatches = MODAL_SRC.match(/e\.key === "Escape"/g) ?? [];
    expect(enterMatches.length).toBeGreaterThanOrEqual(2);
    expect(escapeMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("Save button is disabled until label is non-empty (trim-aware)", () => {
    expect(MODAL_SRC).toContain("disabled={!label.trim()}");
  });

  it("malformed date is normalised to null in the submit path", () => {
    expect(MODAL_SRC).toMatch(/\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(targetDate\)/);
    expect(MODAL_SRC).toMatch(/onSubmit\(\s*trimmed,[\s\S]{0,200}:\s*null/);
  });

  it("scrim click closes the modal", () => {
    expect(MODAL_SRC).toMatch(/onClick=\{onClose\}[\s\S]{0,200}data-testid="timeline-add-milestone-scrim"/);
  });

  it("date is optional — copy makes that explicit", () => {
    expect(MODAL_SRC).toMatch(/optional/i);
  });
});

describe("TimelineBoard — Add Milestone flow wiring", () => {
  it("does NOT use window.prompt anymore", () => {
    expect(BOARD_SRC).not.toMatch(/window\.prompt\(/);
  });

  it("imports + renders TimelineAddMilestoneModal", () => {
    expect(BOARD_SRC).toContain("TimelineAddMilestoneModal");
    expect(BOARD_SRC).toMatch(/<TimelineAddMilestoneModal/);
  });

  it("addOpen state gates the modal", () => {
    expect(BOARD_SRC).toMatch(/addOpen,\s*setAddOpen\] = useState/);
  });

  it("submit dispatches addMilestone + closes the modal", () => {
    expect(BOARD_SRC).toMatch(
      /handleAddMilestoneSubmit[\s\S]{0,200}type:\s*"addMilestone"[\s\S]{0,80}setAddOpen\(false\)/
    );
  });
});
