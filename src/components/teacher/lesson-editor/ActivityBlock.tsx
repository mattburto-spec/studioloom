"use client";

import { useState } from "react";
import { motion, useDragControls } from "framer-motion";
import InlineEdit from "./InlineEdit";
import { CRITERIA, type CriterionKey, getDesignProcessPhases } from "@/lib/constants";
import type { ActivitySection, ResponseType } from "@/types";

interface ActivityBlockProps {
  activity: ActivitySection;
  index: number;
  framework?: string | null;
  onUpdate: (partial: Partial<ActivitySection>) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
}

const RESPONSE_TYPES: ResponseType[] = [
  "text",
  "upload",
  "voice",
  "link",
  "multi",
  "decision-matrix",
  "pmi",
  "pairwise",
  "trade-off-sliders",
  "toolkit-tool",
];

const RESPONSE_TYPE_LABELS: Record<ResponseType, string> = {
  text: "Written Response",
  upload: "Upload",
  voice: "Voice Recording",
  link: "Link",
  multi: "Multiple Choice",
  "decision-matrix": "Decision Matrix",
  pmi: "PMI Chart",
  pairwise: "Pairwise Comparison",
  "trade-off-sliders": "Trade-off Sliders",
  "toolkit-tool": "Toolkit Tool",
  canvas: "Canvas Drawing",
};

/**
 * ActivityBlock — Single activity card in the editor
 *
 * Shows:
 * - Drag handle (6-dot grip, visible on hover)
 * - Title (inline editable)
 * - Duration chip (click to edit)
 * - Prompt (multiline inline editable)
 * - Response type dropdown
 * - Criterion tags (toggleable pills)
 * - Portfolio capture toggle
 * - Expandable sections: Scaffolding, Example, Media
 * - Overflow menu (delete, duplicate)
 * - Delete button
 */
export default function ActivityBlock({
  activity,
  index,
  framework,
  onUpdate,
  onDelete,
  onDuplicate,
}: ActivityBlockProps) {
  const dragControls = useDragControls();
  const { phases } = getDesignProcessPhases(framework);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    scaffolding: false,
    example: false,
    media: false,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleCriterion = (criterion: CriterionKey) => {
    const current = activity.criterionTags || [];
    const updated = current.includes(criterion)
      ? current.filter((c) => c !== criterion)
      : [...current, criterion];
    onUpdate({ criterionTags: updated });
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className="bg-white border border-gray-200 rounded-xl p-5 mb-4 hover:shadow-md transition-shadow group"
    >
      {/* Header row: drag handle, title, duration, delete */}
      <div className="flex items-start gap-3 mb-4">
        {/* Drag handle */}
        <motion.button
          type="button"
          onPointerDown={(e) => dragControls.start(e)}
          whileTap={{ scale: 1.05 }}
          className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing flex-shrink-0 pt-1 transition-opacity"
          aria-label="Drag to reorder"
        >
          <svg
            className="w-5 h-5 text-gray-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <circle cx="6" cy="5" r="1.5" />
            <circle cx="14" cy="5" r="1.5" />
            <circle cx="6" cy="10" r="1.5" />
            <circle cx="14" cy="10" r="1.5" />
            <circle cx="6" cy="15" r="1.5" />
            <circle cx="14" cy="15" r="1.5" />
          </svg>
        </motion.button>

        {/* Title and index */}
        <div className="flex-1">
          <p className="text-xs text-gray-500 mb-1">Activity {index + 1}</p>
          <InlineEdit
            value={activity.prompt.split("\n")[0] || "Activity"}
            onChange={(newTitle) => {
              // Update just the first line of the prompt
              const lines = activity.prompt.split("\n");
              lines[0] = newTitle;
              onUpdate({ prompt: lines.join("\n") });
            }}
            placeholder="Activity title"
            className="text-base font-semibold text-gray-900"
          />
        </div>

        {/* Duration chip */}
        <div className="flex-shrink-0">
          <label className="text-xs text-gray-500 block mb-1">Duration</label>
          <div
            onClick={(e) => e.stopPropagation()}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            <input
              type="number"
              min="1"
              max="180"
              value={activity.durationMinutes || 0}
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

        {/* Duplicate button */}
        {onDuplicate && (
          <button
            onClick={onDuplicate}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            aria-label="Duplicate activity"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
        )}

        {/* Delete button */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
          aria-label="Delete activity"
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
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-800">Delete this activity?</p>
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

      {/* Prompt (main content) */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 block mb-2">Prompt</label>
        <InlineEdit
          value={activity.prompt}
          onChange={(newPrompt) => onUpdate({ prompt: newPrompt })}
          placeholder="Enter activity prompt..."
          multiline
          className="text-sm"
        />
      </div>

      {/* Response type, criteria, portfolio capture */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Response type */}
        <div>
          <label className="text-xs text-gray-500 block mb-2">Response Type</label>
          <select
            value={activity.responseType || "text"}
            onChange={(e) => onUpdate({ responseType: e.target.value as ResponseType })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          >
            {RESPONSE_TYPES.map((type) => (
              <option key={type} value={type}>
                {RESPONSE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        {/* Criteria */}
        <div>
          <label className="text-xs text-gray-500 block mb-2">Criteria</label>
          <div className="flex gap-1 flex-wrap">
            {(Object.keys(CRITERIA) as CriterionKey[]).map((criterion) => (
              <button
                key={criterion}
                onClick={() => toggleCriterion(criterion)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  (activity.criterionTags || []).includes(criterion)
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {criterion}
              </button>
            ))}
          </div>
        </div>

        {/* Portfolio capture */}
        <div>
          <label className="text-xs text-gray-500 block mb-2">Portfolio</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={activity.portfolioCapture || false}
              onChange={(e) => onUpdate({ portfolioCapture: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Capture</span>
          </label>
        </div>
      </div>

      {/* Expandable sections */}
      <div className="space-y-2 border-t border-gray-200 pt-4">
        {/* Scaffolding */}
        <ExpandableSection
          title="Scaffolding"
          isOpen={expandedSections.scaffolding}
          onToggle={() => toggleSection("scaffolding")}
        >
          <div className="space-y-3">
            {["ell1", "ell2", "ell3"].map((tier, idx) => (
              <div key={tier}>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  ELL Tier {idx + 1}
                </label>
                <textarea
                  placeholder={`Scaffolding for tier ${idx + 1}...`}
                  value={activity.scaffolding?.[tier as keyof typeof activity.scaffolding]?.sentenceStarters?.join("\n") || ""}
                  onChange={(e) => {
                    const lines = e.target.value.split("\n").filter(Boolean);
                    const scaffolding = activity.scaffolding || {};
                    onUpdate({
                      scaffolding: {
                        ...scaffolding,
                        [tier]: {
                          ...(scaffolding[tier as keyof typeof scaffolding] || {}),
                          sentenceStarters: lines,
                        },
                      },
                    });
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={2}
                />
              </div>
            ))}
          </div>
        </ExpandableSection>

        {/* Example response */}
        <ExpandableSection
          title="Example Response"
          isOpen={expandedSections.example}
          onToggle={() => toggleSection("example")}
        >
          <InlineEdit
            value={activity.exampleResponse || ""}
            onChange={(newExample) => onUpdate({ exampleResponse: newExample })}
            placeholder="Show an example response..."
            multiline
            className="text-sm"
          />
        </ExpandableSection>

        {/* Media */}
        <ExpandableSection
          title="Media"
          isOpen={expandedSections.media}
          onToggle={() => toggleSection("media")}
        >
          <div className="space-y-2">
            {activity.media && (
              <div className="p-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">
                  <span className="font-medium">Media URL:</span>{" "}
                  {activity.media.url}
                </p>
              </div>
            )}
            <input
              type="url"
              placeholder="Media URL (image or video)"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </ExpandableSection>
      </div>
    </motion.div>
  );
}

/**
 * ExpandableSection — Reusable expandable accordion section
 */
function ExpandableSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
      >
        {title}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          <svg
            className="w-4 h-4 text-gray-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </motion.div>
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="overflow-hidden"
      >
        <div className="px-3 py-3 bg-gray-50 rounded-lg">{children}</div>
      </motion.div>
    </div>
  );
}
