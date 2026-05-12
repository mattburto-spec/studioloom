"use client";

import { useState, useCallback } from "react";
import { motion, useDragControls, AnimatePresence } from "framer-motion";
import InlineEdit from "./InlineEdit";
import { KeyCalloutEditor } from "./KeyCalloutEditor";
import { ImageUploadButton } from "./ImageUploadButton";
import { looksLikeVideoUrl } from "@/lib/video-embed";
import { SlotFieldEditor, SlotPreview } from "./SlotFieldEditor";
import ChoiceCardsConfigPanel from "./ChoiceCardsConfigPanel";
import InspirationBoardConfigPanel from "./InspirationBoardConfigPanel";
import FirstMoveConfigPanel from "./FirstMoveConfigPanel";
import { CRITERIA, type CriterionKey } from "@/lib/constants";
import type {
  ActivitySection,
  ResponseType,
  BloomLevel,
  TimeWeight,
  GroupingStrategy,
} from "@/types";
import {
  tools as allToolkitTools,
  INTERACTIVE_SLUGS,
} from "@/app/toolkit/tools-data";

interface ActivityBlockProps {
  activity: ActivitySection;
  index: number;
  framework?: string | null;
  udlEnabled?: boolean;
  /** Required by ImageUploadButton — scopes the storage path so a unit's images stay grouped under unit-images/{unitId}/blocks/. */
  unitId: string;
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
  "structured-prompts": "Structured Prompts",
  "project-spec": "Project Spec",
  "product-brief": "Product Brief",
  "user-profile": "User Profile",
  "success-criteria": "Success Criteria",
  "choice-cards": "Choice Cards",
  "inspiration-board": "Inspiration Board",
  "first-move": "First Move",
};

// Glyph + tint per response type — matches the warm-paper design.
const RESPONSE_ICON: Record<ResponseType, string> = {
  text: "📝",
  upload: "🎨",
  voice: "🎙",
  link: "🔗",
  multi: "✅",
  "decision-matrix": "🔢",
  pmi: "📊",
  pairwise: "⚖️",
  "trade-off-sliders": "🎚",
  "toolkit-tool": "🧭",
  canvas: "✏️",
  "structured-prompts": "📓",
  "project-spec": "📐",
  "product-brief": "🧰",
  "user-profile": "👤",
  "success-criteria": "🎯",
  "choice-cards": "🃏",
  "inspiration-board": "🖼️",
  "first-move": "⚡",
};
const RESPONSE_TINT: Record<ResponseType, string> = {
  text: "#9333EA",
  upload: "#9333EA",
  voice: "#9333EA",
  link: "#2563EB",
  multi: "#CA8A04",
  "decision-matrix": "#CA8A04",
  pmi: "#CA8A04",
  pairwise: "#CA8A04",
  "trade-off-sliders": "#CA8A04",
  "toolkit-tool": "#EA580C",
  canvas: "#9333EA",
  "structured-prompts": "#0EA5E9",
  "project-spec": "#7C3AED",
  "product-brief": "#C2410C",
  "user-profile": "#0891B2",
  "success-criteria": "#059669",
  "choice-cards": "#10B981",
  "inspiration-board": "#EC4899",
  "first-move": "#F59E0B",
};

// ── Dimensions constants ──────────────────────────────────────────
const BLOOM_LEVELS: { value: BloomLevel; label: string; color: string; load: number }[] = [
  { value: "remember", label: "Remember", color: "bg-red-100 text-red-800 border-red-300", load: 1 },
  { value: "understand", label: "Understand", color: "bg-orange-100 text-orange-800 border-orange-300", load: 2 },
  { value: "apply", label: "Apply", color: "bg-yellow-100 text-yellow-800 border-yellow-300", load: 3 },
  { value: "analyze", label: "Analyze", color: "bg-green-100 text-green-800 border-green-300", load: 4 },
  { value: "evaluate", label: "Evaluate", color: "bg-blue-100 text-blue-800 border-blue-300", load: 5 },
  { value: "create", label: "Create", color: "bg-purple-100 text-purple-800 border-purple-300", load: 6 },
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

// ── UDL Checkpoints (CAST framework, condensed) ──
const UDL_CHECKPOINTS: { id: string; short: string; label: string }[] = [
  { id: "1.1", short: "Choice", label: "Optimize individual choice and autonomy" },
  { id: "1.2", short: "Relevance", label: "Optimize relevance, value, and authenticity" },
  { id: "1.3", short: "Threats", label: "Minimize threats and distractions" },
  { id: "2.1", short: "Goals", label: "Heighten salience of goals and objectives" },
  { id: "2.2", short: "Demands", label: "Vary demands and resources to optimize challenge" },
  { id: "2.3", short: "Collab", label: "Foster collaboration and community" },
  { id: "2.4", short: "Feedback", label: "Increase mastery-oriented feedback" },
  { id: "3.1", short: "Motivation", label: "Promote expectations that optimize motivation" },
  { id: "3.2", short: "Coping", label: "Facilitate personal coping skills and strategies" },
  { id: "3.3", short: "Self-assess", label: "Develop self-assessment and reflection" },
  { id: "4.1", short: "Perception", label: "Offer ways of customizing the display of information" },
  { id: "4.2", short: "Audio", label: "Offer alternatives for auditory information" },
  { id: "4.3", short: "Visual", label: "Offer alternatives for visual information" },
  { id: "5.1", short: "Vocab", label: "Clarify vocabulary and symbols" },
  { id: "5.2", short: "Syntax", label: "Clarify syntax and structure" },
  { id: "5.3", short: "Decoding", label: "Support decoding of text and notation" },
  { id: "5.4", short: "Languages", label: "Promote understanding across languages" },
  { id: "5.5", short: "Multi-media", label: "Illustrate through multiple media" },
  { id: "6.1", short: "Prior know.", label: "Activate or supply background knowledge" },
  { id: "6.2", short: "Patterns", label: "Highlight patterns, critical features, relationships" },
  { id: "6.3", short: "Processing", label: "Guide information processing and visualization" },
  { id: "6.4", short: "Transfer", label: "Maximize transfer and generalization" },
  { id: "7.1", short: "Physical", label: "Vary methods for response and navigation" },
  { id: "7.2", short: "Tools", label: "Optimize access to tools and assistive tech" },
  { id: "8.1", short: "Media use", label: "Use multiple media for communication" },
  { id: "8.2", short: "Composition", label: "Use multiple tools for construction and composition" },
  { id: "8.3", short: "Fluency", label: "Build fluencies with graduated levels of support" },
  { id: "9.1", short: "Goal-set", label: "Guide appropriate goal-setting" },
  { id: "9.2", short: "Planning", label: "Support planning and strategy development" },
  { id: "9.3", short: "Info manage", label: "Facilitate managing information and resources" },
  { id: "9.4", short: "Monitoring", label: "Enhance capacity for monitoring progress" },
];

const UDL_GROUPS = [
  {
    principle: "engagement",
    label: "Engagement (Why)",
    dotColor: "bg-emerald-500",
    selectedColor: "bg-emerald-100 text-emerald-800 border-emerald-300 font-medium",
    checkpoints: UDL_CHECKPOINTS.filter((c) => parseFloat(c.id) < 4),
  },
  {
    principle: "representation",
    label: "Representation (What)",
    dotColor: "bg-blue-500",
    selectedColor: "bg-blue-100 text-blue-800 border-blue-300 font-medium",
    checkpoints: UDL_CHECKPOINTS.filter((c) => parseFloat(c.id) >= 4 && parseFloat(c.id) < 7),
  },
  {
    principle: "action",
    label: "Action & Expression (How)",
    dotColor: "bg-purple-500",
    selectedColor: "bg-purple-100 text-purple-800 border-purple-300 font-medium",
    checkpoints: UDL_CHECKPOINTS.filter((c) => parseFloat(c.id) >= 7),
  },
];

/**
 * ActivityBlock — collapsed-by-default activity row, expands inline.
 *
 * Collapsed state: number · type icon · title · portfolio · subtype · duration pill · Bloom · chevron
 * Expanded state: prompt + responseType/criteria/portfolio + dimensions tabs + footer actions
 */
export default function ActivityBlock({
  activity,
  index,
  udlEnabled = false,
  unitId,
  onUpdate,
  onDelete,
  onDuplicate,
}: ActivityBlockProps) {
  const dragControls = useDragControls();
  type TabId = "design" | "udl" | "airules" | "scaffolding" | "example" | "media" | null;
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [promptMode, setPromptMode] = useState<"edit" | "preview">("edit");

  const toggleTab = useCallback((tab: TabId) => {
    setActiveTab((prev) => (prev === tab ? null : tab));
  }, []);

  const toggleCriterion = (criterion: CriterionKey) => {
    const current = activity.criterionTags || [];
    const updated = current.includes(criterion)
      ? current.filter((c) => c !== criterion)
      : [...current, criterion];
    onUpdate({ criterionTags: updated });
  };

  const responseType: ResponseType = activity.responseType || "text";
  const tint = RESPONSE_TINT[responseType];
  const icon = RESPONSE_ICON[responseType];
  const subtypeLabel = RESPONSE_TYPE_LABELS[responseType];
  // Lever 1 — title derives from framing first (one-sentence orient is
  // the natural label), then falls through to task / legacy prompt.
  const titleText =
    (activity.framing && activity.framing.trim()) ||
    (activity.task && activity.task.split("\n")[0]) ||
    (activity.prompt || "").split("\n")[0] ||
    "Activity";
  const bloomLoad = activity.bloom_level
    ? BLOOM_LEVELS.find((b) => b.value === activity.bloom_level)?.load
    : null;

  return (
    <div
      className={`rounded-lg border ${
        expanded
          ? "border-[var(--le-ink)] bg-[var(--le-paper)] shadow-[0_1px_0_rgba(15,14,12,0.04),0_2px_10px_rgba(15,14,12,0.04)]"
          : "border-[var(--le-hair)] bg-[var(--le-paper)] hover:border-[var(--le-ink-3)]"
      } transition-colors group`}
    >
      {/* ── Collapsed-row header (always visible) ── */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Drag handle */}
        <motion.button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            dragControls.start(e);
          }}
          onClick={(e) => e.stopPropagation()}
          whileTap={{ scale: 1.05 }}
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing flex-shrink-0 text-[var(--le-ink-3)] text-[12px] leading-none -ml-1 px-1 select-none transition-opacity"
          aria-label="Drag to reorder"
        >
          ⋮⋮
        </motion.button>

        {/* Number */}
        <span className="text-[10.5px] font-extrabold le-tnum text-[var(--le-ink-3)] w-5 flex-shrink-0">
          {index + 1}.
        </span>

        {/* Type icon */}
        <span
          className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] flex-shrink-0"
          style={{ background: `${tint}18`, color: tint }}
          title={subtypeLabel}
        >
          {icon}
        </span>

        {/* Title (truncated) */}
        <span
          className={`text-[12.5px] flex-1 truncate ${
            expanded ? "font-extrabold text-[var(--le-ink)]" : "font-semibold text-[var(--le-ink)]"
          }`}
        >
          {titleText}
        </span>

        {/* Portfolio paperclip */}
        {activity.portfolioCapture && (
          <span title="Portfolio capture" className="text-[11px] text-amber-700 flex-shrink-0">
            📎
          </span>
        )}

        {/* Subtype label (md+) */}
        <span className="text-[10px] le-cap text-[var(--le-ink-3)] hidden md:inline flex-shrink-0">
          {subtypeLabel}
        </span>

        {/* Duration pill */}
        <span className="text-[11px] font-extrabold le-tnum bg-violet-50 text-violet-700 border border-violet-200 rounded px-1.5 py-[1px] flex-shrink-0">
          {activity.durationMinutes || 0}m
        </span>

        {/* Bloom */}
        {bloomLoad !== null && (
          <span
            className="text-[11px] font-extrabold le-tnum text-[var(--le-ink-3)] flex-shrink-0"
            title={`Bloom's: ${activity.bloom_level}`}
          >
            B{bloomLoad}
          </span>
        )}

        {/* Chevron */}
        <span className="text-[var(--le-ink-3)] text-[13px] leading-none flex-shrink-0 select-none">
          {expanded ? "▴" : "▾"}
        </span>
      </div>

      {/* ── Expanded body ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-[var(--le-hair)]">
              {/* Delete confirm */}
              {showDeleteConfirm && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between">
                  <p className="text-[12px] text-rose-800">Delete this activity?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1 text-[11.5px] bg-white border border-rose-200 rounded-md hover:bg-rose-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onDelete();
                        setShowDeleteConfirm(false);
                      }}
                      className="px-3 py-1 text-[11.5px] bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Prompt — Lever 1 three-box editor + composed Preview */}
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-[10px] le-cap text-[var(--le-ink-3)]">Prompt to students</div>
                  <div className="ml-auto flex items-center text-[10px] font-extrabold tracking-wider rounded-md border border-[var(--le-hair)] overflow-hidden bg-[var(--le-paper)]">
                    <button
                      type="button"
                      onClick={() => setPromptMode("edit")}
                      className={`px-2 py-0.5 transition-colors ${
                        promptMode === "edit"
                          ? "bg-[var(--le-ink)] text-white"
                          : "text-[var(--le-ink-3)] hover:text-[var(--le-ink)]"
                      }`}
                    >
                      EDIT
                    </button>
                    <button
                      type="button"
                      onClick={() => setPromptMode("preview")}
                      className={`px-2 py-0.5 transition-colors border-l border-[var(--le-hair)] ${
                        promptMode === "preview"
                          ? "bg-[var(--le-ink)] text-white"
                          : "text-[var(--le-ink-3)] hover:text-[var(--le-ink)]"
                      }`}
                    >
                      PREVIEW
                    </button>
                  </div>
                </div>
                {promptMode === "edit" ? (
                  <SlotFieldEditor activity={activity} onUpdate={onUpdate} />
                ) : (
                  <div className="px-3 py-2 rounded-md border border-[var(--le-hair)] bg-[var(--le-bg)] text-[12.5px] leading-relaxed text-[var(--le-ink-2)] [&_p]:my-1.5 [&_strong]:font-bold [&_strong]:text-[var(--le-ink)] [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5">
                    <SlotPreview activity={activity} />
                    <div className="mt-2 pt-2 border-t border-dashed border-[var(--le-hair)] text-[10px] text-[var(--le-ink-3)] italic">
                      Note: students see only paragraphs, <strong className="not-italic">bold</strong>, <em>italic</em>, lists, and links. Headings (<code>###</code>) and tables (<code>| col | col |</code>) are dropped.
                    </div>
                  </div>
                )}
              </div>

              {/* Response type / Criteria / Portfolio + Duration */}
              <div className="mt-3 grid grid-cols-4 gap-3">
                <div>
                  <div className="text-[10px] le-cap text-[var(--le-ink-3)]">Response type</div>
                  <select
                    value={responseType}
                    onChange={(e) => onUpdate({ responseType: e.target.value as ResponseType })}
                    className="mt-1 w-full text-[12px] border border-[var(--le-hair)] rounded px-2 py-1 bg-[var(--le-bg)] text-[var(--le-ink)]"
                  >
                    {RESPONSE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {RESPONSE_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-[10px] le-cap text-[var(--le-ink-3)]">Criteria</div>
                  <div className="mt-1 flex gap-1">
                    {(Object.keys(CRITERIA) as CriterionKey[]).map((c) => (
                      <button
                        key={c}
                        onClick={() => toggleCriterion(c)}
                        className={`w-6 h-6 rounded border text-[11px] font-extrabold transition-colors ${
                          (activity.criterionTags || []).includes(c)
                            ? "bg-[var(--le-ink)] text-white border-[var(--le-ink)]"
                            : "bg-[var(--le-paper)] border-[var(--le-hair)] text-[var(--le-ink-3)] hover:border-[var(--le-ink-2)]"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] le-cap text-[var(--le-ink-3)]">Portfolio</div>
                  <label className="mt-1 flex items-center gap-2 text-[12px] text-[var(--le-ink-2)]">
                    <input
                      type="checkbox"
                      checked={activity.portfolioCapture || false}
                      onChange={(e) => onUpdate({ portfolioCapture: e.target.checked })}
                      className="w-3.5 h-3.5 rounded border-[var(--le-hair)] text-violet-600 focus:ring-violet-500"
                    />
                    Capture
                  </label>
                </div>
                <div>
                  <div className="text-[10px] le-cap text-[var(--le-ink-3)]">Duration</div>
                  <div className="mt-1 flex items-center gap-1 text-[12px]">
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={activity.durationMinutes || 0}
                      onChange={(e) => {
                        const newDuration = parseInt(e.target.value, 10);
                        if (!isNaN(newDuration)) onUpdate({ durationMinutes: newDuration });
                      }}
                      className="w-14 px-2 py-1 text-[12px] le-tnum bg-violet-50 text-violet-700 border border-violet-200 rounded focus:outline-none focus:border-violet-400"
                    />
                    <span className="text-[var(--le-ink-3)] text-[11px]">min</span>
                  </div>
                </div>
              </div>

              {/* LIS.D — magazine callout authoring. Renders for content-only
                  sections (no responseType) where the section is opted into
                  the cream warm callout treatment via contentStyle:
                  "info" (auto-flipped via LIS.A.2) or "key-callout".
                  Other content styles (warning/tip/practical/etc.) keep
                  their functional colour identities and don't get bullets. */}
              {!activity.responseType &&
                (activity.contentStyle === "info" ||
                  activity.contentStyle === "key-callout") && (
                  <KeyCalloutEditor activity={activity} onUpdate={onUpdate} />
                )}

              {/* LIS.D — stepper-layout toggle for structured-prompts.
                  When checked, students see one question at a time
                  (MultiQuestionResponse) instead of the all-at-once
                  StructuredPromptsResponse render. Per-section opt-in
                  because stepper isn't strictly better for every
                  multi-prompt activity. */}
              {responseType === "structured-prompts" && (
                <div className="mt-3 p-3 bg-purple-50/60 border border-purple-200 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span>📐</span>
                    <label className="text-[12px] font-bold text-purple-900">Layout</label>
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-purple-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activity.promptsLayout === "stepper"}
                      onChange={(e) =>
                        onUpdate({
                          promptsLayout: e.target.checked ? "stepper" : undefined,
                        })
                      }
                      className="w-3.5 h-3.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span>
                      <strong>Stepper</strong> — students answer one prompt at a time
                    </span>
                  </label>
                  <p className="text-[11px] text-purple-700/80 ml-6">
                    Default (unchecked) shows all prompts on one page.
                    Stepper drives a focus-one-question UX with optional
                    DO / NOTICE / DECIDE / NEXT colour coding when prompts
                    are tagged with a criterion.
                  </p>
                </div>
              )}

              {/* Toolkit picker — only when responseType is toolkit-tool */}
              {responseType === "toolkit-tool" && (
                <div className="mt-3 p-3 bg-orange-50/60 border border-orange-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span>🧭</span>
                    <label className="text-[12px] font-bold text-orange-900">Toolkit Tool</label>
                  </div>
                  <select
                    value={activity.toolId || ""}
                    onChange={(e) => onUpdate({ toolId: e.target.value || undefined })}
                    className="w-full px-2 py-1 text-[12px] border border-orange-200 rounded bg-white"
                  >
                    <option value="">Select a tool...</option>
                    {(["ideation", "analysis", "evaluation", "research", "planning"] as const).map(
                      (group) => {
                        const groupTools = allToolkitTools.filter(
                          (t) => t.interactive && t.group === group
                        );
                        if (groupTools.length === 0) return null;
                        return (
                          <optgroup
                            key={group}
                            label={group.charAt(0).toUpperCase() + group.slice(1)}
                          >
                            {groupTools.map((t) => {
                              const slug = INTERACTIVE_SLUGS[t.id];
                              return slug ? (
                                <option key={t.id} value={slug}>
                                  {t.name}
                                </option>
                              ) : null;
                            })}
                          </optgroup>
                        );
                      }
                    )}
                  </select>
                  <div>
                    <label className="text-[10px] le-cap text-orange-800 block mb-1">
                      Challenge / Topic (optional)
                    </label>
                    <input
                      type="text"
                      value={activity.toolChallenge || ""}
                      onChange={(e) =>
                        onUpdate({ toolChallenge: e.target.value || undefined })
                      }
                      placeholder="e.g. How might we reduce food waste in the school canteen?"
                      className="w-full px-2 py-1 text-[12px] border border-orange-200 rounded bg-white placeholder-orange-300"
                    />
                  </div>
                </div>
              )}

              {/* Choice Cards deck config — only when responseType is choice-cards */}
              {responseType === "choice-cards" && (
                <ChoiceCardsConfigPanel
                  config={activity.choiceCardsConfig}
                  onUpdate={(next) => onUpdate({ choiceCardsConfig: next })}
                />
              )}

              {/* Inspiration Board config — only when responseType is inspiration-board */}
              {responseType === "inspiration-board" && (
                <InspirationBoardConfigPanel
                  activity={activity}
                  onUpdate={onUpdate}
                />
              )}

              {/* First Move config — only when responseType is first-move */}
              {responseType === "first-move" && (
                <FirstMoveConfigPanel activity={activity} onUpdate={onUpdate} />
              )}

              {/* Configure tab buttons */}
              <div className="mt-3 pt-2 border-t border-[var(--le-hair)] flex items-center gap-1 text-[11px] text-[var(--le-ink-3)] flex-wrap">
                {(
                  [
                    { id: "design" as TabId, label: "⚙ Configure" },
                    ...(udlEnabled ? [{ id: "udl" as TabId, label: "🎯 UDL" }] : []),
                    { id: "airules" as TabId, label: "AI Rules" },
                    { id: "scaffolding" as TabId, label: "🪜 Scaffolding" },
                    { id: "example" as TabId, label: "💡 Example" },
                    { id: "media" as TabId, label: "🎬 Media" },
                  ] as const
                ).map(({ id, label }) => {
                  const isActive = activeTab === id;
                  const hasContent =
                    id === "design"
                      ? !!(
                          activity.bloom_level ||
                          activity.timeWeight ||
                          activity.grouping ||
                          activity.success_look_fors?.length ||
                          activity.tags?.length
                        )
                      : id === "udl"
                      ? !!activity.udl_checkpoints?.length
                      : id === "airules"
                      ? !!(
                          (activity.ai_rules?.phase &&
                            activity.ai_rules.phase !== "neutral") ||
                          activity.ai_rules?.tone ||
                          activity.ai_rules?.rules?.length ||
                          activity.ai_rules?.forbidden_words?.length
                        )
                      : id === "scaffolding"
                      ? !!(
                          activity.scaffolding &&
                          Object.values(activity.scaffolding).some(
                            (v: any) => v?.sentenceStarters?.length
                          )
                        )
                      : id === "example"
                      ? !!activity.exampleResponse
                      : id === "media"
                      ? !!activity.media
                      : false;
                  return (
                    <button
                      key={id}
                      onClick={() => toggleTab(id)}
                      className={`relative px-2 py-1 rounded-md font-bold transition-colors ${
                        isActive
                          ? "bg-[var(--le-ink)] text-white"
                          : "bg-[var(--le-paper)] border border-[var(--le-hair)] text-[var(--le-ink-2)] hover:text-[var(--le-ink)]"
                      }`}
                    >
                      {label}
                      {hasContent && !isActive && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-violet-500 rounded-full" />
                      )}
                    </button>
                  );
                })}
                <span className="ml-auto flex items-center gap-2">
                  {onDuplicate && (
                    <button
                      onClick={onDuplicate}
                      className="hover:text-[var(--le-ink)] transition-colors"
                    >
                      ⧉ Duplicate
                    </button>
                  )}
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-rose-500 hover:text-rose-700 transition-colors"
                  >
                    Delete
                  </button>
                </span>
              </div>

              {/* Tab panels */}
              <AnimatePresence mode="wait">
                {activeTab && (
                  <motion.div
                    key={activeTab}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 px-3 py-3 bg-[var(--le-bg)] border border-[var(--le-hair)] rounded-lg">
                      {/* ── Learning Design tab ── */}
                      {activeTab === "design" && (
                        <div className="space-y-4">
                          <div>
                            <label className="text-[11px] font-semibold text-[var(--le-ink-2)] block mb-2">
                              Bloom&apos;s Level
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {BLOOM_LEVELS.map((bloom) => (
                                <button
                                  key={bloom.value}
                                  onClick={() =>
                                    onUpdate({
                                      bloom_level:
                                        activity.bloom_level === bloom.value
                                          ? undefined
                                          : bloom.value,
                                    })
                                  }
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                                    activity.bloom_level === bloom.value
                                      ? bloom.color +
                                        " ring-2 ring-offset-1 ring-gray-300"
                                      : "bg-[var(--le-paper)] text-[var(--le-ink-2)] border-[var(--le-hair)] hover:border-[var(--le-ink-3)]"
                                  }`}
                                >
                                  {bloom.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-[var(--le-ink-2)] block mb-2">
                              Time Weight{" "}
                              <span className="font-normal text-[var(--le-ink-3)]">
                                (how phase budget is shared)
                              </span>
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {TIME_WEIGHTS.map((tw) => (
                                <button
                                  key={tw.value}
                                  onClick={() =>
                                    onUpdate({
                                      timeWeight:
                                        activity.timeWeight === tw.value
                                          ? undefined
                                          : tw.value,
                                    })
                                  }
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all flex items-center gap-1.5 ${
                                    activity.timeWeight === tw.value
                                      ? "bg-violet-100 text-violet-800 border-violet-300 ring-2 ring-offset-1 ring-violet-200"
                                      : "bg-[var(--le-paper)] text-[var(--le-ink-2)] border-[var(--le-hair)] hover:border-[var(--le-ink-3)]"
                                  }`}
                                >
                                  <span>{tw.icon}</span>
                                  <span>{tw.label}</span>
                                  <span className="text-[var(--le-ink-3)] font-normal">
                                    {tw.desc}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-[var(--le-ink-2)] block mb-2">
                              Grouping
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {GROUPING_OPTIONS.map((g) => (
                                <button
                                  key={g.value}
                                  onClick={() =>
                                    onUpdate({
                                      grouping:
                                        activity.grouping === g.value
                                          ? undefined
                                          : g.value,
                                    })
                                  }
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all flex items-center gap-1.5 ${
                                    activity.grouping === g.value
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-offset-1 ring-emerald-200"
                                      : "bg-[var(--le-paper)] text-[var(--le-ink-2)] border-[var(--le-hair)] hover:border-[var(--le-ink-3)]"
                                  }`}
                                >
                                  <span>{g.icon}</span>
                                  <span>{g.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-[var(--le-ink-2)] block mb-1">
                              Success Look-Fors{" "}
                              <span className="font-normal text-[var(--le-ink-3)]">
                                (observable behaviours)
                              </span>
                            </label>
                            <textarea
                              placeholder={"e.g. Student sketches at least 3 options\nStudent labels all parts of the diagram"}
                              value={(activity.success_look_fors || []).join("\n")}
                              onChange={(e) => {
                                const lines = e.target.value
                                  .split("\n")
                                  .filter(Boolean);
                                onUpdate({
                                  success_look_fors:
                                    lines.length > 0 ? lines : undefined,
                                });
                              }}
                              className="w-full px-2 py-1.5 text-[12px] border border-[var(--le-hair)] rounded bg-[var(--le-paper)] focus:outline-none focus:border-[var(--le-ink-2)]"
                              rows={3}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-[var(--le-ink-2)] block mb-1">
                              Activity Tags{" "}
                              <span className="font-normal text-[var(--le-ink-3)]">
                                (comma-separated)
                              </span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. hands-on, research, interview, prototyping"
                              value={(activity.tags || []).join(", ")}
                              onChange={(e) => {
                                const tags = e.target.value
                                  .split(",")
                                  .map((t) => t.trim())
                                  .filter(Boolean);
                                onUpdate({ tags: tags.length > 0 ? tags : undefined });
                              }}
                              className="w-full px-2 py-1.5 text-[12px] border border-[var(--le-hair)] rounded bg-[var(--le-paper)] focus:outline-none focus:border-[var(--le-ink-2)]"
                            />
                          </div>
                        </div>
                      )}

                      {/* ── UDL tab ── */}
                      {activeTab === "udl" && (
                        <div className="space-y-3">
                          <p className="text-[11px] text-[var(--le-ink-3)]">
                            Tag which{" "}
                            <a
                              href="https://udlguidelines.cast.org"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-violet-700 underline"
                            >
                              CAST UDL
                            </a>{" "}
                            checkpoints this activity addresses.
                          </p>
                          {(activity.udl_checkpoints?.length || 0) > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {activity.udl_checkpoints!.map((cp) => {
                                const info = UDL_CHECKPOINTS.find((u) => u.id === cp);
                                const principle =
                                  parseFloat(cp) < 4
                                    ? "engagement"
                                    : parseFloat(cp) < 7
                                    ? "representation"
                                    : "action";
                                const pillColor =
                                  principle === "engagement"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : principle === "representation"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-purple-50 text-purple-700 border-purple-200";
                                return (
                                  <button
                                    key={cp}
                                    onClick={() => {
                                      const next = (
                                        activity.udl_checkpoints || []
                                      ).filter((c) => c !== cp);
                                      onUpdate({
                                        udl_checkpoints:
                                          next.length > 0 ? next : undefined,
                                      });
                                    }}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${pillColor} hover:opacity-70 transition-opacity`}
                                    title={`Remove ${cp}: ${info?.label || cp}`}
                                  >
                                    {cp} {info?.short || ""} <span className="text-gray-400">×</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div className="space-y-2">
                            {UDL_GROUPS.map((group) => (
                              <div key={group.principle}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className={`w-2 h-2 rounded-full ${group.dotColor}`} />
                                  <span className="text-[10px] font-semibold text-[var(--le-ink-3)] uppercase tracking-wider">
                                    {group.label}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {group.checkpoints.map((cp) => {
                                    const isSelected = (
                                      activity.udl_checkpoints || []
                                    ).includes(cp.id);
                                    return (
                                      <button
                                        key={cp.id}
                                        onClick={() => {
                                          const current = activity.udl_checkpoints || [];
                                          const next = isSelected
                                            ? current.filter((c) => c !== cp.id)
                                            : [...current, cp.id];
                                          onUpdate({
                                            udl_checkpoints:
                                              next.length > 0 ? next : undefined,
                                          });
                                        }}
                                        className={`px-2 py-0.5 rounded text-[11px] border transition-all ${
                                          isSelected
                                            ? group.selectedColor
                                            : "bg-[var(--le-paper)] text-[var(--le-ink-3)] border-[var(--le-hair)] hover:border-[var(--le-ink-2)]"
                                        }`}
                                        title={cp.label}
                                      >
                                        {cp.id} {cp.short}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── AI Rules tab ── */}
                      {activeTab === "airules" && (
                        <div className="space-y-3">
                          <div>
                            <label className="text-[11px] font-semibold text-[var(--le-ink-2)] block mb-2">
                              AI Thinking Phase
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {AI_PHASE_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => {
                                    const current =
                                      activity.ai_rules || { phase: "neutral" as const };
                                    onUpdate({
                                      ai_rules: {
                                        ...current,
                                        phase:
                                          current.phase === opt.value
                                            ? "neutral"
                                            : opt.value,
                                      },
                                    });
                                  }}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                                    (activity.ai_rules?.phase || "neutral") === opt.value
                                      ? opt.value === "divergent"
                                        ? "bg-green-100 text-green-800 border-green-300 ring-2 ring-offset-1 ring-green-200"
                                        : opt.value === "convergent"
                                        ? "bg-blue-100 text-blue-800 border-blue-300 ring-2 ring-offset-1 ring-blue-200"
                                        : "bg-gray-100 text-gray-800 border-gray-300 ring-2 ring-offset-1 ring-gray-200"
                                      : "bg-[var(--le-paper)] text-[var(--le-ink-2)] border-[var(--le-hair)] hover:border-[var(--le-ink-3)]"
                                  }`}
                                  title={opt.desc}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                            <p className="text-[10px] text-[var(--le-ink-3)] mt-1">
                              {
                                AI_PHASE_OPTIONS.find(
                                  (o) =>
                                    o.value === (activity.ai_rules?.phase || "neutral")
                                )?.desc
                              }
                            </p>
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-[var(--le-ink-2)] block mb-1">
                              AI Tone
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. warm and encouraging, analytical, challenging"
                              value={activity.ai_rules?.tone || ""}
                              onChange={(e) => {
                                const current =
                                  activity.ai_rules || { phase: "neutral" as const };
                                onUpdate({
                                  ai_rules: { ...current, tone: e.target.value || undefined },
                                });
                              }}
                              className="w-full px-2 py-1.5 text-[12px] border border-[var(--le-hair)] rounded bg-[var(--le-paper)] focus:outline-none focus:border-[var(--le-ink-2)]"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-[var(--le-ink-2)] block mb-1">
                              Custom Rules{" "}
                              <span className="font-normal text-[var(--le-ink-3)]">
                                (one per line)
                              </span>
                            </label>
                            <textarea
                              placeholder={"e.g. Never give direct answers\nPush for at least 3 ideas before giving feedback"}
                              value={(activity.ai_rules?.rules || []).join("\n")}
                              onChange={(e) => {
                                const rules = e.target.value
                                  .split("\n")
                                  .filter(Boolean);
                                const current =
                                  activity.ai_rules || { phase: "neutral" as const };
                                onUpdate({
                                  ai_rules: {
                                    ...current,
                                    rules: rules.length > 0 ? rules : undefined,
                                  },
                                });
                              }}
                              className="w-full px-2 py-1.5 text-[12px] border border-[var(--le-hair)] rounded bg-[var(--le-paper)] focus:outline-none focus:border-[var(--le-ink-2)]"
                              rows={3}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-[var(--le-ink-2)] block mb-1">
                              Forbidden Words{" "}
                              <span className="font-normal text-[var(--le-ink-3)]">
                                (comma-separated)
                              </span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. good, bad, nice, wrong"
                              value={(activity.ai_rules?.forbidden_words || []).join(", ")}
                              onChange={(e) => {
                                const words = e.target.value
                                  .split(",")
                                  .map((w) => w.trim())
                                  .filter(Boolean);
                                const current =
                                  activity.ai_rules || { phase: "neutral" as const };
                                onUpdate({
                                  ai_rules: {
                                    ...current,
                                    forbidden_words:
                                      words.length > 0 ? words : undefined,
                                  },
                                });
                              }}
                              className="w-full px-2 py-1.5 text-[12px] border border-[var(--le-hair)] rounded bg-[var(--le-paper)] focus:outline-none focus:border-[var(--le-ink-2)]"
                            />
                          </div>
                        </div>
                      )}

                      {/* ── Scaffolding tab ── */}
                      {activeTab === "scaffolding" && (
                        <div className="space-y-3">
                          {["ell1", "ell2", "ell3"].map((tier, idx) => (
                            <div key={tier}>
                              <label className="text-[11px] font-semibold text-[var(--le-ink-2)] block mb-1">
                                ELL Tier {idx + 1}
                              </label>
                              <textarea
                                placeholder={`Scaffolding for tier ${idx + 1}...`}
                                value={
                                  (activity.scaffolding?.[
                                    tier as keyof typeof activity.scaffolding
                                  ] as any)?.sentenceStarters?.join("\n") || ""
                                }
                                onChange={(e) => {
                                  const lines = e.target.value
                                    .split("\n")
                                    .filter(Boolean);
                                  const scaffolding = activity.scaffolding || {};
                                  onUpdate({
                                    scaffolding: {
                                      ...scaffolding,
                                      [tier]: {
                                        ...(scaffolding[
                                          tier as keyof typeof scaffolding
                                        ] || {}),
                                        sentenceStarters: lines,
                                      },
                                    },
                                  });
                                }}
                                className="w-full px-2 py-1.5 text-[12px] border border-[var(--le-hair)] rounded bg-[var(--le-paper)] focus:outline-none focus:border-[var(--le-ink-2)]"
                                rows={2}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ── Example Response tab ── */}
                      {activeTab === "example" && (
                        <InlineEdit
                          value={activity.exampleResponse || ""}
                          onChange={(newExample) =>
                            onUpdate({ exampleResponse: newExample })
                          }
                          placeholder="Show an example response..."
                          multiline
                          className="text-[12.5px] text-[var(--le-ink-2)]"
                        />
                      )}

                      {/* ── Media tab ──
                          Image upload from device OR paste a URL. Uploads
                          go to the unit-images bucket via /api/teacher/
                          upload-image, returning the proxy URL that gets
                          written into activity.media.url. Existing URL
                          paste flow stays — YouTube / Vimeo / any
                          external image URL works as before. */}
                      {activeTab === "media" && (
                        <div className="space-y-3">
                          {activity.media?.url && (
                            <div className="p-2 bg-[var(--le-paper)] rounded border border-[var(--le-hair)] space-y-2">
                              {activity.media.type === "image" && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={activity.media.url}
                                  alt="Block media preview"
                                  style={{
                                    maxHeight: 120,
                                    maxWidth: "100%",
                                    borderRadius: 6,
                                    border: "1px solid var(--le-hair)",
                                  }}
                                />
                              )}
                              <p className="text-[10px] text-[var(--le-ink-3)] break-all">
                                <span className="font-bold uppercase tracking-wider">
                                  {activity.media.type}:
                                </span>{" "}
                                {activity.media.url}
                              </p>
                              <button
                                type="button"
                                onClick={() => onUpdate({ media: undefined })}
                                className="text-[10.5px] text-rose-600 hover:text-rose-800 font-semibold"
                              >
                                × Remove media
                              </button>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <input
                              type="url"
                              value={activity.media?.url || ""}
                              onChange={(e) => {
                                const url = e.target.value.trim();
                                if (!url) {
                                  onUpdate({ media: undefined });
                                  return;
                                }
                                onUpdate({
                                  media: {
                                    type: looksLikeVideoUrl(url) ? "video" : "image",
                                    url,
                                  },
                                });
                              }}
                              placeholder="Paste image or video URL"
                              className="flex-1 px-2 py-1.5 text-[12px] border border-[var(--le-hair)] rounded bg-[var(--le-paper)] focus:outline-none focus:border-[var(--le-ink-2)]"
                            />
                            <ImageUploadButton
                              unitId={unitId}
                              onUploaded={(url) =>
                                onUpdate({ media: { type: "image", url } })
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
