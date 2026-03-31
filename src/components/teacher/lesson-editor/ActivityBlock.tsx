"use client";

import { useState } from "react";
import { motion, useDragControls } from "framer-motion";
import InlineEdit from "./InlineEdit";
import { CRITERIA, type CriterionKey, getDesignProcessPhases } from "@/lib/constants";
import type { ActivitySection, ResponseType, BloomLevel, TimeWeight, GroupingStrategy } from "@/types";
import { tools as allToolkitTools, INTERACTIVE_SLUGS } from "@/app/toolkit/tools-data";

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

// ── Dimensions constants ──────────────────────────────────────────
const BLOOM_LEVELS: { value: BloomLevel; label: string; color: string }[] = [
  { value: "remember", label: "Remember", color: "bg-red-100 text-red-800 border-red-300" },
  { value: "understand", label: "Understand", color: "bg-orange-100 text-orange-800 border-orange-300" },
  { value: "apply", label: "Apply", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { value: "analyze", label: "Analyze", color: "bg-green-100 text-green-800 border-green-300" },
  { value: "evaluate", label: "Evaluate", color: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: "create", label: "Create", color: "bg-purple-100 text-purple-800 border-purple-300" },
];

const TIME_WEIGHTS: { value: TimeWeight; label: string; icon: string; desc: string }[] = [
  { value: "quick", label: "Quick", icon: "⚡", desc: "1x weight" },
  { value: "moderate", label: "Moderate", icon: "📐", desc: "2x weight" },
  { value: "extended", label: "Extended", icon: "🔬", desc: "4x weight" },
  { value: "flexible", label: "Flexible", icon: "🔄", desc: "Fills remaining" },
];

const GROUPING_OPTIONS: { value: GroupingStrategy; label: string; icon: string }[] = [
  { value: "individual", label: "Solo", icon: "👤" },
  { value: "pair", label: "Pair", icon: "👥" },
  { value: "small_group", label: "Group", icon: "👨‍👩‍👧" },
  { value: "whole_class", label: "Whole Class", icon: "🏫" },
  { value: "mixed", label: "Mixed", icon: "🔀" },
];

const AI_PHASE_OPTIONS: { value: "divergent" | "convergent" | "neutral"; label: string; desc: string }[] = [
  { value: "divergent", label: "Divergent", desc: "Encourage wild ideas, never evaluate" },
  { value: "convergent", label: "Convergent", desc: "Push for analysis, trade-offs, evidence" },
  { value: "neutral", label: "Neutral", desc: "Balanced support, follow student's lead" },
];

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
    dimensions: false,
    airules: false,
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

      {/* Toolkit tool picker — shown when response type is toolkit-tool */}
      {activity.responseType === "toolkit-tool" && (
        <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 bg-purple-600 text-white rounded-md flex items-center justify-center text-xs font-bold">#</span>
            <label className="text-sm font-semibold text-purple-900">Toolkit Tool</label>
          </div>
          <select
            value={activity.toolId || ""}
            onChange={(e) => onUpdate({ toolId: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
          >
            <option value="">Select a tool...</option>
            {(["ideation", "analysis", "evaluation", "research", "planning"] as const).map((group) => {
              const groupTools = allToolkitTools.filter(
                (t) => t.interactive && t.group === group
              );
              if (groupTools.length === 0) return null;
              return (
                <optgroup key={group} label={group.charAt(0).toUpperCase() + group.slice(1)}>
                  {groupTools.map((t) => {
                    const slug = INTERACTIVE_SLUGS[t.id];
                    return slug ? (
                      <option key={t.id} value={slug}>{t.name}</option>
                    ) : null;
                  })}
                </optgroup>
              );
            })}
          </select>
          <div>
            <label className="text-xs text-purple-700 block mb-1">Challenge / Topic (optional)</label>
            <input
              type="text"
              value={activity.toolChallenge || ""}
              onChange={(e) => onUpdate({ toolChallenge: e.target.value || undefined })}
              placeholder="e.g. How might we reduce food waste in the school canteen?"
              className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-purple-300"
            />
          </div>
          {activity.toolId && (
            <p className="text-xs text-purple-600">
              Students will see this tool inline in the lesson. Their responses are saved and can be referenced later in the unit.
            </p>
          )}
        </div>
      )}

      {/* Dimensions quick-bar: Bloom + Time Weight + Grouping pills inline */}
      <div className="flex flex-wrap items-center gap-2 mb-4 border-t border-gray-200 pt-4">
        {/* Bloom level pill */}
        {activity.bloom_level && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
            BLOOM_LEVELS.find(b => b.value === activity.bloom_level)?.color || "bg-gray-100 text-gray-700 border-gray-300"
          }`}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {BLOOM_LEVELS.find(b => b.value === activity.bloom_level)?.label}
          </span>
        )}
        {/* Time weight pill */}
        {activity.timeWeight && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            {TIME_WEIGHTS.find(t => t.value === activity.timeWeight)?.icon}{" "}
            {TIME_WEIGHTS.find(t => t.value === activity.timeWeight)?.label}
          </span>
        )}
        {/* Grouping pill */}
        {activity.grouping && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            {GROUPING_OPTIONS.find(g => g.value === activity.grouping)?.icon}{" "}
            {GROUPING_OPTIONS.find(g => g.value === activity.grouping)?.label}
          </span>
        )}
        {/* AI rules phase pill */}
        {activity.ai_rules?.phase && activity.ai_rules.phase !== "neutral" && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
            activity.ai_rules.phase === "divergent"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-blue-50 text-blue-700 border-blue-200"
          }`}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {activity.ai_rules.phase === "divergent" ? "Divergent" : "Convergent"} AI
          </span>
        )}
        {/* UDL checkpoints count */}
        {(activity.udl_checkpoints?.length || 0) > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            {activity.udl_checkpoints?.length} UDL
          </span>
        )}
        {/* Edit dimensions button — only show if no pills yet (empty state) */}
        {!activity.bloom_level && !activity.timeWeight && !activity.grouping && (
          <button
            onClick={() => toggleSection("dimensions")}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-dashed border-gray-300 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Learning Design
          </button>
        )}
        {/* Edit button when pills exist */}
        {(activity.bloom_level || activity.timeWeight || activity.grouping) && (
          <button
            onClick={() => toggleSection("dimensions")}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            aria-label="Edit learning design"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>

      {/* Expandable sections */}
      <div className="space-y-2">
        {/* Learning Design editor */}
        <ExpandableSection
          title="Learning Design"
          isOpen={expandedSections.dimensions}
          onToggle={() => toggleSection("dimensions")}
        >
          <div className="space-y-4">
            {/* Bloom's Level */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">
                Bloom&apos;s Level
              </label>
              <div className="flex flex-wrap gap-1.5">
                {BLOOM_LEVELS.map((bloom) => (
                  <button
                    key={bloom.value}
                    onClick={() =>
                      onUpdate({
                        bloom_level:
                          activity.bloom_level === bloom.value ? undefined : bloom.value,
                      })
                    }
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      activity.bloom_level === bloom.value
                        ? bloom.color + " ring-2 ring-offset-1 ring-gray-300"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {bloom.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Weight */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">
                Time Weight
                <span className="font-normal text-gray-400 ml-1">(how phase budget is shared)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TIME_WEIGHTS.map((tw) => (
                  <button
                    key={tw.value}
                    onClick={() =>
                      onUpdate({
                        timeWeight:
                          activity.timeWeight === tw.value ? undefined : tw.value,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                      activity.timeWeight === tw.value
                        ? "bg-indigo-100 text-indigo-800 border-indigo-300 ring-2 ring-offset-1 ring-indigo-200"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    <span>{tw.icon}</span>
                    <span>{tw.label}</span>
                    <span className="text-gray-400 font-normal">{tw.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Grouping */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">
                Grouping
              </label>
              <div className="flex flex-wrap gap-1.5">
                {GROUPING_OPTIONS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() =>
                      onUpdate({
                        grouping:
                          activity.grouping === g.value ? undefined : g.value,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                      activity.grouping === g.value
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-offset-1 ring-emerald-200"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    <span>{g.icon}</span>
                    <span>{g.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Success Look-Fors */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Success Look-Fors
                <span className="font-normal text-gray-400 ml-1">(observable behaviours)</span>
              </label>
              <textarea
                placeholder="e.g. Student sketches at least 3 options&#10;Student labels all parts of the diagram&#10;Student discusses trade-offs with partner"
                value={(activity.success_look_fors || []).join("\n")}
                onChange={(e) => {
                  const lines = e.target.value.split("\n").filter(Boolean);
                  onUpdate({ success_look_fors: lines.length > 0 ? lines : undefined });
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={3}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Activity Tags
                <span className="font-normal text-gray-400 ml-1">(comma-separated, for search)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. hands-on, research, interview, prototyping"
                value={(activity.tags || []).join(", ")}
                onChange={(e) => {
                  const tags = e.target.value.split(",").map(t => t.trim()).filter(Boolean);
                  onUpdate({ tags: tags.length > 0 ? tags : undefined });
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </ExpandableSection>

        {/* AI Rules */}
        <ExpandableSection
          title="AI Rules"
          isOpen={expandedSections.airules}
          onToggle={() => toggleSection("airules")}
        >
          <div className="space-y-3">
            {/* Thinking Phase */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">
                AI Thinking Phase
              </label>
              <div className="flex flex-wrap gap-1.5">
                {AI_PHASE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      const current = activity.ai_rules || { phase: "neutral" };
                      onUpdate({
                        ai_rules: {
                          ...current,
                          phase: current.phase === opt.value ? "neutral" : opt.value,
                        },
                      });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      (activity.ai_rules?.phase || "neutral") === opt.value
                        ? opt.value === "divergent"
                          ? "bg-green-100 text-green-800 border-green-300 ring-2 ring-offset-1 ring-green-200"
                          : opt.value === "convergent"
                          ? "bg-blue-100 text-blue-800 border-blue-300 ring-2 ring-offset-1 ring-blue-200"
                          : "bg-gray-100 text-gray-800 border-gray-300 ring-2 ring-offset-1 ring-gray-200"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                    title={opt.desc}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {AI_PHASE_OPTIONS.find(o => o.value === (activity.ai_rules?.phase || "neutral"))?.desc}
              </p>
            </div>

            {/* Tone */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                AI Tone
              </label>
              <input
                type="text"
                placeholder="e.g. warm and encouraging, analytical, challenging"
                value={activity.ai_rules?.tone || ""}
                onChange={(e) => {
                  const current = activity.ai_rules || { phase: "neutral" as const };
                  onUpdate({
                    ai_rules: {
                      ...current,
                      tone: e.target.value || undefined,
                    },
                  });
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Custom Rules */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Custom Rules
                <span className="font-normal text-gray-400 ml-1">(one per line)</span>
              </label>
              <textarea
                placeholder="e.g. Never give direct answers&#10;Push for at least 3 ideas before giving feedback&#10;Use question framing from Hattie HITS"
                value={(activity.ai_rules?.rules || []).join("\n")}
                onChange={(e) => {
                  const rules = e.target.value.split("\n").filter(Boolean);
                  const current = activity.ai_rules || { phase: "neutral" as const };
                  onUpdate({
                    ai_rules: {
                      ...current,
                      rules: rules.length > 0 ? rules : undefined,
                    },
                  });
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={3}
              />
            </div>

            {/* Forbidden Words */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Forbidden Words
                <span className="font-normal text-gray-400 ml-1">(comma-separated)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. good, bad, nice, wrong"
                value={(activity.ai_rules?.forbidden_words || []).join(", ")}
                onChange={(e) => {
                  const words = e.target.value.split(",").map(w => w.trim()).filter(Boolean);
                  const current = activity.ai_rules || { phase: "neutral" as const };
                  onUpdate({
                    ai_rules: {
                      ...current,
                      forbidden_words: words.length > 0 ? words : undefined,
                    },
                  });
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </ExpandableSection>

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
                  value={(activity.scaffolding?.[tier as keyof typeof activity.scaffolding] as any)?.sentenceStarters?.join("\n") || ""}
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
