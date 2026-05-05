/**
 * TG.0D.5 — source-static guards for TasksPanel ↔ TaskDrawer wiring.
 *
 * Same style as src/app/api/teacher/tasks/__tests__/route.test.ts: read
 * the file, assert specific patterns. Catches regressions on the chooser
 * un-grey + summative-row Configure→ click handler.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PANEL_SRC = readFileSync(
  join(__dirname, "..", "TasksPanel.tsx"),
  "utf-8"
);
const CHOOSER_SRC = readFileSync(
  join(__dirname, "..", "AddTaskChooser.tsx"),
  "utf-8"
);

describe("AddTaskChooser — TG.0D.5 un-grey", () => {
  it("project-task button is no longer disabled", () => {
    expect(CHOOSER_SRC).not.toMatch(/disabled\s*[\s\S]{0,100}data-testid="add-task-chooser-project"/);
  });

  it("project-task button has onClick wired to onChooseProjectTask", () => {
    expect(CHOOSER_SRC).toMatch(
      /onClick=\{onChooseProjectTask\}[\s\S]{0,200}data-testid="add-task-chooser-project"/
    );
  });

  it("no longer mentions 'Coming soon — TG.0D' on the project-task button", () => {
    expect(CHOOSER_SRC).not.toContain("Coming soon (TG.0D)");
  });

  it("AddTaskChooserProps now requires onChooseProjectTask", () => {
    expect(CHOOSER_SRC).toContain("onChooseProjectTask: () => void");
  });
});

describe("TasksPanel — TG.0D.5 drawer mount", () => {
  it("AddMode union includes 'summative'", () => {
    expect(PANEL_SRC).toMatch(/AddMode\s*=\s*"idle"\s*\|\s*"chooser"\s*\|\s*"quickCheck"\s*\|\s*"summative"/);
  });

  it("AddTaskChooser is wired to setAddMode('summative') via onChooseProjectTask", () => {
    expect(PANEL_SRC).toMatch(
      /onChooseProjectTask=\{\(\)\s*=>\s*setAddMode\("summative"\)\}/
    );
  });

  it("renders TaskDrawer when addMode === 'summative' (create flow)", () => {
    expect(PANEL_SRC).toMatch(
      /addMode === "summative"[\s\S]{0,300}<TaskDrawer/
    );
  });

  it("create-flow drawer wires onSaved + onClose to existing handlers", () => {
    const m = PANEL_SRC.match(/addMode === "summative"[\s\S]{0,500}\)\}/);
    expect(m).not.toBeNull();
    const block = m![0];
    expect(block).toContain("onSaved={handleSaved}");
    expect(block).toContain("onClose={() => setAddMode(\"idle\")}");
  });

  it("editingDrawerTaskId state controls the edit-flow drawer", () => {
    expect(PANEL_SRC).toContain("editingDrawerTaskId");
    expect(PANEL_SRC).toMatch(/setEditingDrawerTaskId\(null\)/);
  });

  it("edit-flow drawer renders only when editingDrawerTaskId is set + task found", () => {
    expect(PANEL_SRC).toMatch(/editingDrawerTaskId\s*&&\s*\(/);
    expect(PANEL_SRC).toContain(
      "(tasks ?? []).find((t) => t.id === editingDrawerTaskId)"
    );
  });

  it("edit-flow drawer passes editingTask prop", () => {
    const editBlockMatch = PANEL_SRC.match(
      /editingDrawerTaskId &&[\s\S]{0,800}<\/TaskDrawer>|editingDrawerTaskId &&[\s\S]{0,800}\}\)\(\)\}/
    );
    expect(editBlockMatch).not.toBeNull();
    if (editBlockMatch) {
      expect(editBlockMatch[0]).toContain("editingTask={task}");
    }
  });

  it("[Configure →] is a clickable button on summative rows", () => {
    // Anchor at [Configure →] directly — there's only one occurrence, and
    // it's inside the summative-row branch.
    const idx = PANEL_SRC.indexOf("[Configure →]");
    expect(idx).toBeGreaterThan(0);
    // Look at a window around the marker (300 chars before + 200 after) so
    // we capture the wrapping <button> + onClick + data-testid.
    const slice = PANEL_SRC.slice(Math.max(0, idx - 600), idx + 200);
    expect(slice).toContain("setEditingDrawerTaskId(row.id)");
    expect(slice).toContain("data-testid={`tasks-panel-configure-${row.id}`}");
    expect(slice).toContain("e.stopPropagation()");
  });

  it("imports TaskDrawer", () => {
    expect(PANEL_SRC).toContain('from "./TaskDrawer"');
  });
});
