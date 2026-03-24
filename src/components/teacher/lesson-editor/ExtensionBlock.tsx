"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import InlineEdit from "./InlineEdit";
import type { LessonExtension } from "@/types";

interface ExtensionBlockProps {
  extension: LessonExtension;
  index: number;
  onUpdate: (partial: Partial<LessonExtension>) => void;
  onDelete: () => void;
}

const DESIGN_PHASES = [
  "investigation",
  "ideation",
  "prototyping",
  "evaluation",
] as const;

const DESIGN_PHASE_LABELS: Record<string, string> = {
  investigation: "Investigation",
  ideation: "Ideation",
  prototyping: "Prototyping",
  evaluation: "Evaluation",
};

/**
 * ExtensionBlock — Extension activity card (compact)
 *
 * Shows:
 * - Title (inline editable)
 * - Description (inline editable, multiline)
 * - Duration chip
 * - Design phase dropdown
 * - Delete button
 */
export default function ExtensionBlock({
  extension,
  index,
  onUpdate,
  onDelete,
}: ExtensionBlockProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 mb-3 hover:shadow-md transition-shadow group"
    >
      {/* Header row: title, duration, delete */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1">
          <p className="text-xs text-gray-500 mb-1">Extension {index + 1}</p>
          <InlineEdit
            value={extension.title}
            onChange={(newTitle) => onUpdate({ title: newTitle })}
            placeholder="Extension title"
            className="text-base font-semibold text-gray-900"
          />
        </div>

        {/* Duration chip */}
        <div className="flex-shrink-0">
          <label className="text-xs text-gray-500 block mb-1">Duration</label>
          <div
            onClick={(e) => e.stopPropagation()}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
          >
            <input
              type="number"
              min="1"
              max="180"
              value={extension.durationMinutes || 0}
              onChange={(e) => {
                const newDuration = parseInt(e.target.value, 10);
                if (!isNaN(newDuration)) {
                  onUpdate({ durationMinutes: newDuration });
                }
              }}
              className="w-12 bg-transparent text-center focus:outline-none font-medium"
              onClick={(e) => e.stopPropagation()}
            />
            <span className="ml-1">min</span>
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
          aria-label="Delete extension"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
            />
          </svg>
        </button>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-800">Delete this extension?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1 text-sm bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onDelete();
                setShowDeleteConfirm(false);
              }}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Description */}
      <div className="mb-3">
        <label className="text-xs text-gray-500 block mb-2">Description</label>
        <InlineEdit
          value={extension.description}
          onChange={(newDesc) => onUpdate({ description: newDesc })}
          placeholder="Describe this extension..."
          multiline
          className="text-sm"
        />
      </div>

      {/* Design phase */}
      <div>
        <label className="text-xs text-gray-500 block mb-2">Design Phase</label>
        <select
          value={extension.designPhase || "ideation"}
          onChange={(e) =>
            onUpdate({
              designPhase: e.target.value as typeof DESIGN_PHASES[number],
            })
          }
          className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
        >
          {DESIGN_PHASES.map((phase) => (
            <option key={phase} value={phase}>
              {DESIGN_PHASE_LABELS[phase]}
            </option>
          ))}
        </select>
      </div>
    </motion.div>
  );
}
