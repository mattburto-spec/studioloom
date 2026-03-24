"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";
import type { ActivitySection, ResponseType } from "@/types";

// ─────────────────────────────────────────────────────────────────
// Block definitions — the source of truth for every draggable block
// ─────────────────────────────────────────────────────────────────

export interface BlockDefinition {
  id: string;
  label: string;
  icon: string;
  category: BlockCategory;
  description: string;
  /** Which Workshop Model phase this block naturally fits in */
  defaultPhase: "opening" | "miniLesson" | "workTime" | "debrief" | "any";
  /** Factory function to create the ActivitySection */
  create: () => ActivitySection;
}

export type BlockCategory =
  | "response"
  | "content"
  | "toolkit"
  | "assessment"
  | "collaboration";

interface CategoryMeta {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const CATEGORIES: Record<BlockCategory, CategoryMeta> = {
  response: {
    label: "Student Response",
    icon: "✏️",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
  },
  content: {
    label: "Content",
    icon: "📄",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  toolkit: {
    label: "Toolkit",
    icon: "🧰",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  assessment: {
    label: "Assessment",
    icon: "📋",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  collaboration: {
    label: "Collaboration",
    icon: "👥",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
};

export const BLOCK_LIBRARY: BlockDefinition[] = [
  // ── Student Response ──
  {
    id: "written-response",
    label: "Written Response",
    icon: "📝",
    category: "response",
    description: "Students type a text response",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "",
      responseType: "text" as ResponseType,
      durationMinutes: 10,
    }),
  },
  {
    id: "creative-upload",
    label: "Creative Upload",
    icon: "🎨",
    category: "response",
    description: "Upload photos, sketches, or files",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Upload your work.",
      responseType: "upload" as ResponseType,
      durationMinutes: 15,
    }),
  },
  {
    id: "voice-recording",
    label: "Voice Recording",
    icon: "🎤",
    category: "response",
    description: "Record an audio explanation",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Record your explanation.",
      responseType: "voice" as ResponseType,
      durationMinutes: 5,
    }),
  },
  {
    id: "canvas-drawing",
    label: "Canvas Drawing",
    icon: "🖌️",
    category: "response",
    description: "Sketch or annotate on a digital canvas",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Sketch your idea.",
      responseType: "canvas" as ResponseType,
      durationMinutes: 10,
    }),
  },
  // ── Content ──
  {
    id: "teacher-notes",
    label: "Teacher Notes",
    icon: "📋",
    category: "content",
    description: "Read-only content for students",
    defaultPhase: "miniLesson",
    create: () => ({
      activityId: nanoid(8),
      prompt: "",
      durationMinutes: 5,
      contentStyle: "info" as const,
    }),
  },
  {
    id: "key-concepts",
    label: "Key Concepts",
    icon: "💡",
    category: "content",
    description: "Important ideas to understand",
    defaultPhase: "miniLesson",
    create: () => ({
      activityId: nanoid(8),
      prompt: "",
      durationMinutes: 5,
      contentStyle: "info" as const,
    }),
  },
  {
    id: "vocabulary",
    label: "Vocabulary",
    icon: "📖",
    category: "content",
    description: "Key terms and definitions",
    defaultPhase: "opening",
    create: () => ({
      activityId: nanoid(8),
      prompt: "",
      durationMinutes: 3,
      contentStyle: "tip" as const,
    }),
  },
  {
    id: "resource-link",
    label: "Resource Link",
    icon: "🔗",
    category: "content",
    description: "External video, article, or website",
    defaultPhase: "any",
    create: () => ({
      activityId: nanoid(8),
      prompt: "",
      durationMinutes: 5,
      links: [{ url: "", label: "" }],
    }),
  },
  {
    id: "image-media",
    label: "Image / Media",
    icon: "🖼️",
    category: "content",
    description: "Visual reference material",
    defaultPhase: "any",
    create: () => ({
      activityId: nanoid(8),
      prompt: "",
      durationMinutes: 3,
      media: { type: "image", url: "", caption: "" },
    }),
  },
  // ── Toolkit ──
  {
    id: "tool-scamper",
    label: "SCAMPER",
    icon: "🔀",
    category: "toolkit",
    description: "7-step creative ideation technique",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Use SCAMPER to generate ideas for your design challenge.",
      responseType: "toolkit-tool" as ResponseType,
      toolId: "scamper",
      durationMinutes: 20,
    }),
  },
  {
    id: "tool-six-hats",
    label: "Six Thinking Hats",
    icon: "🎩",
    category: "toolkit",
    description: "Explore a problem from 6 perspectives",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Analyze your design challenge using the Six Thinking Hats.",
      responseType: "toolkit-tool" as ResponseType,
      toolId: "six-thinking-hats",
      durationMinutes: 20,
    }),
  },
  {
    id: "tool-pmi",
    label: "PMI Chart",
    icon: "➕",
    category: "toolkit",
    description: "Evaluate Plus, Minus, Interesting",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Evaluate your ideas using the PMI Chart.",
      responseType: "toolkit-tool" as ResponseType,
      toolId: "pmi-chart",
      durationMinutes: 15,
    }),
  },
  {
    id: "tool-five-whys",
    label: "Five Whys",
    icon: "❓",
    category: "toolkit",
    description: "Root cause analysis",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Use the Five Whys to find the root cause of the problem.",
      responseType: "toolkit-tool" as ResponseType,
      toolId: "five-whys",
      durationMinutes: 15,
    }),
  },
  {
    id: "tool-empathy-map",
    label: "Empathy Map",
    icon: "🫂",
    category: "toolkit",
    description: "Understand your user deeply",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Build an empathy map for your target user.",
      responseType: "toolkit-tool" as ResponseType,
      toolId: "empathy-map",
      durationMinutes: 20,
    }),
  },
  {
    id: "tool-decision-matrix",
    label: "Decision Matrix",
    icon: "📊",
    category: "toolkit",
    description: "Score and compare options with criteria",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Compare your design options using the Decision Matrix.",
      responseType: "toolkit-tool" as ResponseType,
      toolId: "decision-matrix",
      durationMinutes: 20,
    }),
  },
  {
    id: "tool-swot",
    label: "SWOT Analysis",
    icon: "🔲",
    category: "toolkit",
    description: "Strengths, Weaknesses, Opportunities, Threats",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Analyze your design with a SWOT analysis.",
      responseType: "toolkit-tool" as ResponseType,
      toolId: "swot-analysis",
      durationMinutes: 15,
    }),
  },
  // ── Assessment ──
  {
    id: "exit-ticket",
    label: "Exit Ticket",
    icon: "🎫",
    category: "assessment",
    description: "Quick check for understanding",
    defaultPhase: "debrief",
    create: () => ({
      activityId: nanoid(8),
      prompt: "In 2-3 sentences, what is the most important thing you learned today?",
      responseType: "text" as ResponseType,
      durationMinutes: 3,
    }),
  },
  {
    id: "self-assessment",
    label: "Self-Assessment",
    icon: "🪞",
    category: "assessment",
    description: "Student reflects on their own progress",
    defaultPhase: "debrief",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Rate your progress today and explain what you'd do differently.",
      responseType: "text" as ResponseType,
      durationMinutes: 5,
    }),
  },
  {
    id: "quick-poll",
    label: "Quick Poll",
    icon: "📊",
    category: "assessment",
    description: "Fast class-wide temperature check",
    defaultPhase: "any",
    create: () => ({
      activityId: nanoid(8),
      prompt: "How confident do you feel about today's topic?",
      responseType: "text" as ResponseType,
      durationMinutes: 2,
    }),
  },
  // ── Collaboration ──
  {
    id: "think-pair-share",
    label: "Think-Pair-Share",
    icon: "💬",
    category: "collaboration",
    description: "Individual thinking → partner discussion → class share",
    defaultPhase: "debrief",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Think about the question, discuss with your partner, then share with the class.",
      responseType: "text" as ResponseType,
      durationMinutes: 8,
    }),
  },
  {
    id: "group-discussion",
    label: "Group Discussion",
    icon: "🗣️",
    category: "collaboration",
    description: "Structured small group conversation",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Discuss the following question in your group.",
      responseType: "text" as ResponseType,
      durationMinutes: 10,
    }),
  },
  {
    id: "gallery-walk",
    label: "Gallery Walk",
    icon: "🖼️",
    category: "collaboration",
    description: "Students review each other's work displayed around the room",
    defaultPhase: "debrief",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Walk around and leave feedback on at least 3 other projects using sticky notes.",
      durationMinutes: 12,
    }),
  },
  {
    id: "peer-feedback",
    label: "Peer Feedback",
    icon: "🤝",
    category: "collaboration",
    description: "Structured feedback between students",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Give your partner specific feedback using the sentence starters provided.",
      responseType: "text" as ResponseType,
      durationMinutes: 10,
    }),
  },
];

// ─────────────────────────────────────────────────────────────────
// BlockPalette component
// ─────────────────────────────────────────────────────────────────

interface BlockPaletteProps {
  onAddBlock: (activity: ActivitySection) => void;
  isOpen: boolean;
  onToggle: () => void;
  /** Filter blocks to those contextually relevant */
  suggestedBlockIds?: string[];
}

export default function BlockPalette({
  onAddBlock,
  isOpen,
  onToggle,
  suggestedBlockIds,
}: BlockPaletteProps) {
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<BlockCategory | null>("response");

  const filteredBlocks = search
    ? BLOCK_LIBRARY.filter(
        (b) =>
          b.label.toLowerCase().includes(search.toLowerCase()) ||
          b.description.toLowerCase().includes(search.toLowerCase())
      )
    : BLOCK_LIBRARY;

  const handleAdd = useCallback(
    (block: BlockDefinition) => {
      onAddBlock(block.create());
    },
    [onAddBlock]
  );

  const suggestedBlocks = suggestedBlockIds
    ? BLOCK_LIBRARY.filter((b) => suggestedBlockIds.includes(b.id))
    : [];

  return (
    <>
      {/* Toggle tab on the edge */}
      <button
        onClick={onToggle}
        className={`absolute right-0 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1 px-1.5 py-3 rounded-l-lg border border-r-0 transition-all ${
          isOpen
            ? "bg-indigo-50 border-indigo-200 text-indigo-600 translate-x-0"
            : "bg-white border-gray-200 text-gray-400 hover:text-indigo-500 hover:border-indigo-200 translate-x-0"
        }`}
        title={isOpen ? "Close palette" : "Open block palette"}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Palette panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="border-l border-gray-200 bg-gray-50/80 backdrop-blur-sm flex-shrink-0 overflow-hidden flex flex-col"
          >
            <div className="w-[280px] flex flex-col h-full">
              {/* Header */}
              <div className="px-3 pt-3 pb-2">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
                  Blocks
                </h3>

                {/* Search */}
                <div className="relative">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search blocks..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                {/* AI Suggested blocks */}
                {suggestedBlocks.length > 0 && !search && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-xs">✨</span>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                        AI Suggested
                      </span>
                    </div>
                    <div className="space-y-1">
                      {suggestedBlocks.map((block) => (
                        <PaletteBlock
                          key={`suggested-${block.id}`}
                          block={block}
                          onAdd={handleAdd}
                          highlight
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Search results */}
                {search ? (
                  <div className="space-y-1">
                    {filteredBlocks.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">
                        No blocks match &ldquo;{search}&rdquo;
                      </p>
                    ) : (
                      filteredBlocks.map((block) => (
                        <PaletteBlock
                          key={block.id}
                          block={block}
                          onAdd={handleAdd}
                        />
                      ))
                    )}
                  </div>
                ) : (
                  /* Categorized accordion */
                  <div className="space-y-1">
                    {(
                      Object.keys(CATEGORIES) as BlockCategory[]
                    ).map((cat) => {
                      const meta = CATEGORIES[cat];
                      const blocks = filteredBlocks.filter(
                        (b) => b.category === cat
                      );
                      if (blocks.length === 0) return null;

                      const isExpanded = expandedCategory === cat;

                      return (
                        <div key={cat}>
                          <button
                            onClick={() =>
                              setExpandedCategory(isExpanded ? null : cat)
                            }
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                              isExpanded
                                ? `${meta.bgColor} ${meta.color}`
                                : "hover:bg-gray-100 text-gray-600"
                            }`}
                          >
                            <span className="text-sm">{meta.icon}</span>
                            <span className="text-xs font-semibold flex-1">
                              {meta.label}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {blocks.length}
                            </span>
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className={`transition-transform ${
                                isExpanded ? "rotate-90" : ""
                              }`}
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </button>

                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{
                                  type: "spring",
                                  damping: 25,
                                  stiffness: 300,
                                }}
                                className="overflow-hidden"
                              >
                                <div className="pl-2 pt-1 pb-1 space-y-0.5">
                                  {blocks.map((block) => (
                                    <PaletteBlock
                                      key={block.id}
                                      block={block}
                                      onAdd={handleAdd}
                                    />
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Individual palette block
// ─────────────────────────────────────────────────────────────────

function PaletteBlock({
  block,
  onAdd,
  highlight = false,
}: {
  block: BlockDefinition;
  onAdd: (block: BlockDefinition) => void;
  highlight?: boolean;
}) {
  return (
    <motion.button
      onClick={() => onAdd(block)}
      className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all group ${
        highlight
          ? "bg-indigo-50/70 border border-indigo-200 hover:bg-indigo-100/70 hover:border-indigo-300"
          : "hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200"
      }`}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
    >
      <span className="text-base mt-0.5 flex-shrink-0">{block.icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">
          {block.label}
        </div>
        <div className="text-[10px] text-gray-400 leading-tight mt-0.5 line-clamp-1">
          {block.description}
        </div>
      </div>
      {/* Add indicator on hover */}
      <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-indigo-400"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
    </motion.button>
  );
}
