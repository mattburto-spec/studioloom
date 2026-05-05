"use client";

/**
 * TG.0C.4 + TG.0D.5 — AddTaskChooser
 *
 * Inline 2-button chooser shown when teacher clicks "+ Add task" in TasksPanel.
 * Quick check (formative) → opens QuickCheckRow inline.
 * Project task (summative) → opens TaskDrawer (TG.0D enabled).
 */

interface AddTaskChooserProps {
  onChooseQuickCheck: () => void;
  onChooseProjectTask: () => void;
  onCancel: () => void;
}

export default function AddTaskChooser({
  onChooseQuickCheck,
  onChooseProjectTask,
  onCancel,
}: AddTaskChooserProps) {
  return (
    <div
      className="px-2 py-2 border border-[var(--le-hair)] rounded bg-[var(--le-paper)] mb-1.5"
      data-testid="add-task-chooser"
    >
      <div className="text-[10.5px] text-[var(--le-ink-3)] mb-1.5">
        What kind of task?
      </div>
      <div className="space-y-1">
        <button
          type="button"
          onClick={onChooseQuickCheck}
          className="w-full text-left px-2 py-1.5 rounded text-[11px] hover:bg-white border border-transparent hover:border-[var(--le-hair)] transition-colors"
          data-testid="add-task-chooser-quick"
        >
          <div className="font-semibold text-[var(--le-ink)]">
            ⚡ Quick check
          </div>
          <div className="text-[10px] text-[var(--le-ink-3)] mt-0.5">
            Formative · &lt;30s · inline
          </div>
        </button>
        <button
          type="button"
          onClick={onChooseProjectTask}
          className="w-full text-left px-2 py-1.5 rounded text-[11px] hover:bg-white border border-transparent hover:border-[var(--le-hair)] transition-colors"
          data-testid="add-task-chooser-project"
        >
          <div className="font-semibold text-[var(--le-ink)]">
            🎯 Project task
          </div>
          <div className="text-[10px] text-[var(--le-ink-3)] mt-0.5">
            Summative · 5-tab config drawer · GRASPS + rubric
          </div>
        </button>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-[10px] text-[var(--le-ink-3)] hover:text-[var(--le-ink)] underline-offset-2 hover:underline mt-1.5"
        data-testid="add-task-chooser-cancel"
      >
        Cancel
      </button>
    </div>
  );
}
