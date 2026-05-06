"use client";

/**
 * AG.2.3b — KanbanCardModal
 *
 * Multi-mode modal for card interactions. Modes:
 *   - 'edit'           — view + edit title, DoD; entry to other modes
 *   - 'move-to'        — move target picker + required input fields
 *                        (DoD if missing for this_class+, estimate for
 *                        doing, becauseClause for done)
 *   - 'block'          — 4-button blockage triage (Tool/Skill/Decision/Help)
 *   - 'confirm-delete' — yes/no
 *
 * Per Lesson #71: validation lives in the reducer's validateMove. This
 * file dispatches actions; rendering errors come from the reducer's
 * pre-emptive validate calls.
 */

import { useState, useMemo, useRef, useEffect } from "react";
import {
  validateMove,
  type MoveValidation,
} from "@/lib/unit-tools/kanban/reducer";
import {
  KANBAN_COLUMNS,
  type BlockType,
  type KanbanCard,
  type KanbanColumn,
  type KanbanState,
} from "@/lib/unit-tools/kanban/types";

const COLUMN_LABELS: Record<KanbanColumn, string> = {
  backlog: "Backlog",
  this_class: "This Class",
  doing: "Doing",
  done: "Done",
};

const BLOCK_TYPE_OPTIONS: Array<{
  type: BlockType;
  label: string;
  hint: string;
  icon: string;
}> = [
  { type: "tool", label: "Tool", hint: "Workshop tool / material unavailable or unclear", icon: "🔧" },
  { type: "skill", label: "Skill", hint: "I don't know how to do this part yet", icon: "🧠" },
  { type: "decision", label: "Decision", hint: "Multiple options, unsure which to pick", icon: "🤔" },
  { type: "help", label: "Help", hint: "Need teacher input", icon: "🙋" },
];

export type ModalMode = "edit" | "move-to" | "block" | "confirm-delete";

export interface KanbanCardModalProps {
  state: KanbanState;
  card: KanbanCard;
  mode: ModalMode;
  /** Set when mode='move-to' — the target column the user clicked. */
  moveTarget: KanbanColumn | null;
  onClose: () => void;
  onUpdateTitle: (title: string) => void;
  onUpdateDoD: (dod: string) => void;
  onMove: (
    toStatus: KanbanColumn,
    args: { estimateMinutes?: number; becauseClause?: string }
  ) => void;
  onMarkBlocked: (blockType: BlockType) => void;
  onMarkUnblocked: () => void;
  onDelete: () => void;
  onChangeMode: (mode: ModalMode, target?: KanbanColumn) => void;
}

export default function KanbanCardModal({
  state,
  card,
  mode,
  moveTarget,
  onClose,
  onUpdateTitle,
  onUpdateDoD,
  onMove,
  onMarkBlocked,
  onMarkUnblocked,
  onDelete,
  onChangeMode,
}: KanbanCardModalProps) {
  // Edit-mode local state for title + DoD (debounced via parent)
  const [titleDraft, setTitleDraft] = useState(card.title);
  const [dodDraft, setDodDraft] = useState(card.dod ?? "");
  const [estimateDraft, setEstimateDraft] = useState<string>(
    card.estimateMinutes?.toString() ?? ""
  );
  const [becauseDraft, setBecauseDraft] = useState<string>(card.becauseClause ?? "");

  // ───────────────────────────────────────────────────────────────────────
  // Smoke-feedback 6 May 2026 — DoD-field disappearing bug:
  // ───────────────────────────────────────────────────────────────────────
  // Original move-to flow eagerly committed each keystroke via
  // onUpdateDoD(). Once card.dod was non-empty, the visibility gate
  // (`(card.dod?.trim() ?? "").length === 0`) flipped false and the
  // textarea unmounted mid-typing. Fix: capture "DoD was empty when we
  // entered this move-to context" once per (mode, moveTarget) transition
  // and keep the field visible for the duration of the move-to flow.
  const moveContextKeyRef = useRef<string>("");
  const dodWasInitiallyEmptyRef = useRef<boolean>(false);
  useEffect(() => {
    if (mode !== "move-to" || !moveTarget) {
      moveContextKeyRef.current = "";
      return;
    }
    const key = `${mode}:${moveTarget}`;
    if (moveContextKeyRef.current !== key) {
      // Just entered move-to (or switched target) — capture once.
      moveContextKeyRef.current = key;
      dodWasInitiallyEmptyRef.current =
        (card.dod?.trim() ?? "").length === 0;
    }
    // Intentionally NOT depending on card.dod — the whole point is to
    // freeze the snapshot at entry time. eslint will warn; suppress is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, moveTarget]);

  // Pre-emptive validation for the move target — drives error display + Save button
  const moveValidation: MoveValidation | null = useMemo(() => {
    if (mode !== "move-to" || !moveTarget) return null;
    return validateMove(state, card.id, moveTarget, {
      estimateMinutes:
        estimateDraft === "" ? null : Number(estimateDraft) || 0,
      becauseClause: becauseDraft,
    });
  }, [mode, moveTarget, state, card.id, estimateDraft, becauseDraft]);

  function commitTitle() {
    if (titleDraft.trim() !== card.title) {
      onUpdateTitle(titleDraft);
    }
  }

  function commitDoD() {
    if (dodDraft !== (card.dod ?? "")) {
      onUpdateDoD(dodDraft);
    }
  }

  function handleMoveSubmit() {
    if (!moveTarget) return;
    if (!moveValidation?.ok) return;
    const args: { estimateMinutes?: number; becauseClause?: string } = {};
    if (moveTarget === "doing" && estimateDraft !== "") {
      const n = Number(estimateDraft);
      if (Number.isFinite(n)) args.estimateMinutes = Math.max(0, Math.round(n));
    }
    if (moveTarget === "done" && becauseDraft.trim()) {
      args.becauseClause = becauseDraft.trim();
    }
    onMove(moveTarget, args);
  }

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        data-testid="kanban-modal-scrim"
        aria-hidden="true"
      />

      {/* Centered card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Card: ${card.title}`}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(100%-2rem,32rem)] max-h-[85vh] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
        data-testid="kanban-modal"
        data-mode={mode}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100">
          <div className="text-[10.5px] uppercase tracking-wide text-gray-500">
            {mode === "move-to"
              ? `Move card → ${moveTarget ? COLUMN_LABELS[moveTarget] : "..."}`
              : mode === "block"
                ? "What's blocking you?"
                : mode === "confirm-delete"
                  ? "Delete card?"
                  : `Card · ${COLUMN_LABELS[card.status]}`}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 ml-3 -mr-1 -mt-1 p-1 rounded hover:bg-gray-100"
            aria-label="Close"
            data-testid="kanban-modal-close"
          >
            ✕
          </button>
        </div>

        {/* Body — varies by mode */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* EDIT MODE */}
          {mode === "edit" && (
            <>
              <label className="block">
                <span className="text-[10.5px] font-semibold text-gray-700 uppercase tracking-wide block mb-1">
                  Title
                </span>
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  maxLength={200}
                  className="w-full text-[12px] px-2 py-1.5 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-500"
                  data-testid="kanban-modal-title-input"
                />
              </label>

              <label className="block">
                <span className="text-[10.5px] font-semibold text-gray-700 uppercase tracking-wide block mb-1">
                  Definition of Done
                </span>
                <p className="text-[10px] text-gray-500 mb-1">
                  Required when moving to This Class or beyond. &quot;I&apos;ll
                  know this is done when...&quot;
                </p>
                <textarea
                  value={dodDraft}
                  onChange={(e) => setDodDraft(e.target.value)}
                  onBlur={commitDoD}
                  rows={2}
                  maxLength={500}
                  placeholder="e.g. Smooth to touch, no flat spots, weight ≤ 35g"
                  className="w-full text-[12px] px-2 py-1.5 bg-white border border-gray-300 rounded resize-y focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-500"
                  data-testid="kanban-modal-dod-input"
                />
              </label>

              {/* Because clause display — Done cards only. Smoke-feedback
                  6 May 2026: previously captured during move-to-Done but
                  never surfaced again, so students couldn't see what
                  evidence they'd recorded. Read-only for v1; editing is
                  a follow-up (needs an updateBecauseClause reducer action). */}
              {card.status === "done" &&
                (card.becauseClause?.trim() ?? "").length > 0 && (
                  <div className="block">
                    <span className="text-[10.5px] font-semibold text-gray-700 uppercase tracking-wide block mb-1">
                      What you learned
                    </span>
                    <p className="text-[10px] text-gray-500 mb-1">
                      The note you left when you marked this Done.
                    </p>
                    <div
                      className="w-full text-[12px] px-2 py-1.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 whitespace-pre-wrap"
                      data-testid="kanban-modal-because-display"
                    >
                      {card.becauseClause}
                    </div>
                  </div>
                )}

              {/* Move-to picker */}
              <div className="pt-1 border-t border-gray-100">
                <span className="text-[10.5px] font-semibold text-gray-700 uppercase tracking-wide block mb-1.5">
                  Move to
                </span>
                <div className="flex flex-wrap gap-1">
                  {KANBAN_COLUMNS.filter((c) => c !== card.status).map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => onChangeMode("move-to", col)}
                      className="text-[11px] px-2 py-1 rounded border border-gray-200 hover:border-violet-300 hover:bg-violet-50 text-gray-700 hover:text-violet-700"
                      data-testid={`kanban-modal-move-${col}`}
                    >
                      → {COLUMN_LABELS[col]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Block / unblock */}
              <div className="pt-1 border-t border-gray-100">
                {card.blockType === null ? (
                  <button
                    type="button"
                    onClick={() => onChangeMode("block")}
                    className="text-[11px] text-rose-700 hover:text-rose-900 hover:underline underline-offset-2"
                    data-testid="kanban-modal-mark-blocked"
                  >
                    🚧 I&apos;m stuck — mark blocked
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onMarkUnblocked}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 hover:underline underline-offset-2"
                    data-testid="kanban-modal-mark-unblocked"
                  >
                    ✓ Unblock — moving forward
                  </button>
                )}
              </div>

              {/* Delete */}
              <div className="pt-1 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => onChangeMode("confirm-delete")}
                  className="text-[11px] text-gray-400 hover:text-rose-700 hover:underline underline-offset-2"
                  data-testid="kanban-modal-delete-entry"
                >
                  Delete card
                </button>
              </div>
            </>
          )}

          {/* MOVE-TO MODE */}
          {mode === "move-to" && moveTarget && (
            <>
              <p className="text-[11.5px] text-gray-700">
                Moving <strong>&ldquo;{card.title}&rdquo;</strong> from{" "}
                <em>{COLUMN_LABELS[card.status]}</em> to{" "}
                <em>{COLUMN_LABELS[moveTarget]}</em>.
              </p>

              {/* DoD field — Round 22: now optional (was required in v1).
                  Only surfaced when DoD is empty so students who already
                  set one don't see a redundant field. Visibility is gated
                  on dodWasInitiallyEmptyRef so it doesn't unmount mid-typing. */}
              {(moveTarget === "this_class" ||
                moveTarget === "doing" ||
                moveTarget === "done") &&
                dodWasInitiallyEmptyRef.current && (
                  <label className="block">
                    <span className="text-[10.5px] font-semibold text-gray-700 uppercase tracking-wide block mb-1">
                      Definition of Done{" "}
                      <span className="text-gray-400 font-normal normal-case">
                        (optional)
                      </span>
                    </span>
                    <p className="text-[10px] text-gray-500 mb-1">
                      How will you know this is done? You can fill this in
                      later from the card if you&apos;re not sure yet.
                    </p>
                    <textarea
                      value={dodDraft}
                      onChange={(e) => {
                        setDodDraft(e.target.value);
                        // Eagerly commit so the card detail reflects what
                        // the student typed even if they hit Move now.
                        onUpdateDoD(e.target.value);
                      }}
                      rows={2}
                      maxLength={500}
                      placeholder="e.g. Sketch shows top + side view"
                      className="w-full text-[12px] px-2 py-1.5 bg-white border border-gray-300 rounded resize-y focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-500"
                      data-testid="kanban-move-dod-input"
                    />
                  </label>
                )}

              {/* Estimate field for Doing */}
              {moveTarget === "doing" && (
                <label className="block">
                  <span className="text-[10.5px] font-semibold text-gray-700 uppercase tracking-wide block mb-1">
                    Time estimate (minutes)
                  </span>
                  <p className="text-[10px] text-gray-500 mb-1">
                    How long do you think this will take? (You&apos;ll see how
                    accurate your estimate was after a few cards.)
                  </p>
                  <input
                    type="number"
                    min={0}
                    max={600}
                    step={5}
                    placeholder="e.g. 25"
                    value={estimateDraft}
                    onChange={(e) => setEstimateDraft(e.target.value)}
                    className="w-32 text-[12px] px-2 py-1.5 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-500"
                    data-testid="kanban-move-estimate-input"
                  />
                </label>
              )}

              {/* Because clause for Done — Round 22: now optional (was
                  required in v1). The "Three Cs" example was confusing
                  ("220 grit / 80 grit" is sandpaper jargon — kids on a
                  CO2-racer or marble-run unit won't map onto it). */}
              {moveTarget === "done" && (
                <label className="block">
                  <span className="text-[10.5px] font-semibold text-gray-700 uppercase tracking-wide block mb-1">
                    What did you learn?{" "}
                    <span className="text-gray-400 font-normal normal-case">
                      (optional)
                    </span>
                  </span>
                  <p className="text-[10px] text-gray-500 mb-1">
                    A quick note — what worked, what changed, or what
                    you&apos;d do differently next time.
                  </p>
                  <textarea
                    value={becauseDraft}
                    onChange={(e) => setBecauseDraft(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="e.g. Glue dried faster than I thought — next time I&apos;ll start the next step sooner."
                    className="w-full text-[12px] px-2 py-1.5 bg-white border border-gray-300 rounded resize-y focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-500"
                    data-testid="kanban-move-because-input"
                  />
                </label>
              )}

              {/* Validation errors */}
              {moveValidation && !moveValidation.ok && (
                <div
                  className="px-2 py-1.5 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-700"
                  data-testid="kanban-move-errors"
                >
                  {moveValidation.errors.length === 1
                    ? "Fix this before moving:"
                    : "Fix these before moving:"}
                  <ul className="mt-0.5 ml-3 list-disc">
                    {moveValidation.errors.map((e, i) => (
                      <li key={`${e.field}-${i}`}>{e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* BLOCK MODE */}
          {mode === "block" && (
            <>
              <p className="text-[11.5px] text-gray-700">
                Naming the type of block helps you (and your teacher) figure
                out what to do next.
              </p>
              <div className="space-y-1.5">
                {BLOCK_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => onMarkBlocked(opt.type)}
                    className="w-full text-left p-2 rounded border border-gray-200 hover:border-rose-300 hover:bg-rose-50 transition-colors flex items-start gap-2"
                    data-testid={`kanban-block-${opt.type}`}
                  >
                    <span className="text-[18px]">{opt.icon}</span>
                    <span>
                      <span className="block text-[12px] font-semibold text-gray-900">
                        {opt.label}
                      </span>
                      <span className="block text-[10.5px] text-gray-600">
                        {opt.hint}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* CONFIRM-DELETE MODE */}
          {mode === "confirm-delete" && (
            <>
              <p className="text-[12px] text-gray-700">
                Delete <strong>&ldquo;{card.title}&rdquo;</strong>? This can&apos;t
                be undone.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          {mode === "move-to" && (
            <>
              <button
                type="button"
                onClick={() => onChangeMode("edit")}
                className="text-[11.5px] px-3 py-1.5 rounded text-gray-600 hover:text-gray-900"
                data-testid="kanban-modal-back"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleMoveSubmit}
                disabled={!moveValidation?.ok}
                className={[
                  "text-[11.5px] px-3 py-1.5 rounded font-semibold",
                  moveValidation?.ok
                    ? "bg-violet-600 text-white hover:bg-violet-700"
                    : "bg-violet-300 text-white cursor-not-allowed",
                ].join(" ")}
                data-testid="kanban-modal-move-submit"
              >
                Move
              </button>
            </>
          )}
          {mode === "block" && (
            <button
              type="button"
              onClick={() => onChangeMode("edit")}
              className="text-[11.5px] px-3 py-1.5 rounded text-gray-600 hover:text-gray-900"
              data-testid="kanban-modal-block-back"
            >
              Cancel
            </button>
          )}
          {mode === "confirm-delete" && (
            <>
              <button
                type="button"
                onClick={() => onChangeMode("edit")}
                className="text-[11.5px] px-3 py-1.5 rounded text-gray-600 hover:text-gray-900"
                data-testid="kanban-modal-delete-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="text-[11.5px] px-3 py-1.5 rounded font-semibold bg-rose-600 text-white hover:bg-rose-700"
                data-testid="kanban-modal-delete-confirm"
              >
                Delete
              </button>
            </>
          )}
          {mode === "edit" && (
            <button
              type="button"
              onClick={onClose}
              className="text-[11.5px] px-3 py-1.5 rounded font-semibold bg-violet-600 text-white hover:bg-violet-700"
              data-testid="kanban-modal-done"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </>
  );
}
