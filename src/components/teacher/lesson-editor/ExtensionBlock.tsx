"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import InlineEdit from "./InlineEdit";
import { getDesignProcessPhases } from "@/lib/constants";
import type { LessonExtension } from "@/types";

interface ExtensionBlockProps {
  extension: LessonExtension;
  index: number;
  framework?: string | null;
  onUpdate: (partial: Partial<LessonExtension>) => void;
  onDelete: () => void;
}

/**
 * ExtensionBlock — compact yellow-tinted row for early-finisher activities.
 *
 * Collapsed: number · title · phase chip · duration pill
 * Expanded: description + phase select + delete
 */
export default function ExtensionBlock({
  extension,
  index,
  framework,
  onUpdate,
  onDelete,
}: ExtensionBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { phases, labels } = getDesignProcessPhases(framework);

  const phaseLabel =
    extension.designPhase ? labels[extension.designPhase] : labels[phases[1] || "ideation"];

  return (
    <div className="bg-amber-50/50 border-y border-[var(--le-hair)] -mx-px">
      {/* Collapsed row */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-amber-100/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-[10.5px] font-extrabold le-tnum text-[var(--le-ink-3)] w-4 flex-shrink-0">
          {index + 1}.
        </span>
        <span className="text-[12.5px] font-semibold flex-1 truncate text-[var(--le-ink)]">
          {extension.title || "Extension Activity"}
        </span>
        <span className="text-[10.5px] font-extrabold tracking-wider uppercase px-2 py-[3px] border rounded-full bg-[var(--le-paper)] text-[var(--le-ink-2)] border-[var(--le-hair)] flex-shrink-0">
          {phaseLabel}
        </span>
        <span className="text-[11px] font-extrabold le-tnum bg-white border border-[var(--le-hair)] text-[var(--le-ink)] rounded px-1.5 py-[1px] flex-shrink-0">
          {extension.durationMinutes || 0}m
        </span>
        <span className="text-[var(--le-ink-3)] text-[12px] leading-none flex-shrink-0 select-none">
          {expanded ? "▴" : "▾"}
        </span>
      </div>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="ext-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-amber-200/70 space-y-3">
              {/* Title editor */}
              <div className="mt-3">
                <div className="text-[10px] le-cap text-[var(--le-ink-3)]">Title</div>
                <div className="mt-1">
                  <InlineEdit
                    value={extension.title}
                    onChange={(newTitle) => onUpdate({ title: newTitle })}
                    placeholder="Extension title"
                    className="text-[13px] font-semibold text-[var(--le-ink)]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="text-[10px] le-cap text-[var(--le-ink-3)]">Description</div>
                <div className="mt-1">
                  <InlineEdit
                    value={extension.description}
                    onChange={(newDesc) => onUpdate({ description: newDesc })}
                    placeholder="Describe this extension..."
                    multiline
                    className="text-[12px] leading-relaxed text-[var(--le-ink-2)]"
                  />
                </div>
              </div>

              {/* Phase + Duration + Delete */}
              <div className="grid grid-cols-3 gap-3 items-end">
                <div>
                  <div className="text-[10px] le-cap text-[var(--le-ink-3)]">Design Phase</div>
                  <select
                    value={extension.designPhase || phases[1] || "ideation"}
                    onChange={(e) =>
                      onUpdate({
                        designPhase: e.target.value as
                          | "investigation"
                          | "ideation"
                          | "prototyping"
                          | "evaluation",
                      })
                    }
                    className="mt-1 w-full text-[12px] border border-[var(--le-hair)] rounded px-2 py-1 bg-[var(--le-paper)] text-[var(--le-ink)]"
                  >
                    {phases.map((phase) => (
                      <option key={phase} value={phase}>
                        {labels[phase]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-[10px] le-cap text-[var(--le-ink-3)]">Duration</div>
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={extension.durationMinutes || 0}
                      onChange={(e) => {
                        const newDuration = parseInt(e.target.value, 10);
                        if (!isNaN(newDuration)) onUpdate({ durationMinutes: newDuration });
                      }}
                      className="w-14 px-2 py-1 text-[12px] le-tnum bg-amber-50 text-amber-900 border border-amber-200 rounded focus:outline-none focus:border-amber-400"
                    />
                    <span className="text-[var(--le-ink-3)] text-[11px]">min</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-[11px] text-rose-500 hover:text-rose-700 transition-colors font-bold"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Delete confirmation */}
              {showDeleteConfirm && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-md flex items-center justify-between">
                  <p className="text-[12px] text-rose-800">Delete this extension?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2 py-0.5 text-[11.5px] bg-white border border-rose-200 rounded hover:bg-rose-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onDelete();
                        setShowDeleteConfirm(false);
                      }}
                      className="px-2 py-0.5 text-[11.5px] bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
