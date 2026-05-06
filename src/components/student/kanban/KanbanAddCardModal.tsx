"use client";

/**
 * KanbanAddCardModal — small composer modal for "+ Add card".
 *
 * Round 21 (6 May 2026 PM) — replaces the `window.prompt("Card title:")`
 * call in KanbanBoard.handleAddCard with a properly styled modal:
 *   - Title input, autofocused, max 200 chars
 *   - Save / Cancel
 *   - Enter submits, Escape cancels
 *   - Click-scrim closes
 *
 * Why a fresh modal vs reusing KanbanCardModal: Add-card is a different
 * flow (the card doesn't exist yet), and reusing the larger modal would
 * mean rendering an empty edit form with N/A placeholders for fields the
 * student hasn't filled yet — confusing. This is intentionally minimal.
 */

import { useEffect, useRef, useState } from "react";
import type { KanbanColumn as KanbanColumnId } from "@/lib/unit-tools/kanban/types";

const COLUMN_LABELS: Record<KanbanColumnId, string> = {
  backlog: "Backlog",
  this_class: "This Class",
  doing: "Doing",
  done: "Done",
};

interface Props {
  toStatus: KanbanColumnId;
  onSubmit: (title: string) => void;
  onClose: () => void;
}

export default function KanbanAddCardModal({
  toStatus,
  onSubmit,
  onClose,
}: Props) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus on mount.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        data-testid="kanban-add-card-scrim"
        aria-hidden="true"
      />

      {/* Centered card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add card"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(100%-2rem,28rem)] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
        data-testid="kanban-add-card-modal"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100">
          <div className="text-[10.5px] uppercase tracking-wide text-gray-500">
            Add card · {COLUMN_LABELS[toStatus]}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 ml-3 -mr-1 -mt-1 p-1 rounded hover:bg-gray-100"
            aria-label="Close"
            data-testid="kanban-add-card-close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          <label className="block">
            <span className="text-[10.5px] font-semibold text-gray-700 uppercase tracking-wide block mb-1">
              Title
            </span>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                }
              }}
              maxLength={200}
              placeholder="e.g. Sand the chassis edges"
              className="w-full text-[12px] px-2 py-1.5 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-500"
              data-testid="kanban-add-card-input"
            />
          </label>
          <p className="text-[10.5px] text-gray-500 mt-1.5 leading-snug">
            Just the title for now. You can add a Definition of Done from the
            card&apos;s detail view once it&apos;s on the board.
          </p>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-[11.5px] px-3 py-1.5 rounded text-gray-600 hover:text-gray-900"
            data-testid="kanban-add-card-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim()}
            className={[
              "text-[11.5px] px-3 py-1.5 rounded font-semibold",
              title.trim()
                ? "bg-violet-600 text-white hover:bg-violet-700"
                : "bg-violet-300 text-white cursor-not-allowed",
            ].join(" ")}
            data-testid="kanban-add-card-submit"
          >
            Add card
          </button>
        </div>
      </div>
    </>
  );
}
