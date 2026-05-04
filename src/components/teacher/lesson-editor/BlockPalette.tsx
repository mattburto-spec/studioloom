"use client";

import { useState, useEffect, useCallback, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";
import type { ActivitySection, ResponseType } from "@/types";
import { useDndContext } from "./DndContext";

// ─────────────────────────────────────────────────────────────────
// Block definitions — the source of truth for every draggable block
// ─────────────────────────────────────────────────────────────────

export interface BlockDefinition {
  id: string;
  label: string;
  /** @deprecated Kept for backward compat — not rendered in palette */
  icon: string;
  category: BlockCategory;
  description: string;
  /** Which Workshop Model phase this block naturally fits in */
  defaultPhase: "opening" | "miniLesson" | "workTime" | "debrief" | "any";
  /** Factory function to create the ActivitySection */
  create: () => ActivitySection;
  /** Optional: marks this block as user-added or imported */
  source?: "built-in" | "custom" | "imported";
  /**
   * Lever-MM (NM block category): when set, this block represents an NM
   * competency element rather than a regular activity. Click → register
   * a checkpoint on the current lesson via onAddNmCheckpoint instead of
   * onAddBlock. The `create()` factory is a no-op stub for these — never
   * called through the regular onAddBlock path.
   */
  nmElementId?: string;
  /** Lever-MM: parent competency ID for NM-element blocks (so the click handler can persist it). */
  nmCompetencyId?: string;
}

export type BlockCategory =
  | "response"
  | "content"
  | "toolkit"
  | "assessment"
  | "collaboration"
  | "custom"
  /** Lever-MM: New Metrics competency elements. Empty when school's `use_new_metrics` flag is off. */
  | "new_metrics";

interface CategoryMeta {
  label: string;
  /** Tailwind color class for the category dot (bg-*) */
  dotColor: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const CATEGORIES: Record<BlockCategory, CategoryMeta> = {
  response: {
    label: "Response",
    dotColor: "bg-indigo-500",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
  },
  content: {
    label: "Content",
    dotColor: "bg-blue-500",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  toolkit: {
    label: "Toolkit",
    dotColor: "bg-purple-500",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  assessment: {
    label: "Assessment",
    dotColor: "bg-amber-500",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  collaboration: {
    label: "Collaboration",
    dotColor: "bg-emerald-500",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  custom: {
    label: "Custom",
    dotColor: "bg-rose-500",
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
  },
  new_metrics: {
    // Lever-MM: gold dot — distinct from assessment's amber + Templates' violet.
    // The category renders only when LessonEditor passes NM-element blocks
    // (i.e. school's `use_new_metrics` flag is true and a competency is selected).
    label: "New Metrics",
    dotColor: "bg-yellow-500",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
  },
};

// ─────────────────────────────────────────────────────────────────
// Lever-MM — NM-element BlockDefinition factory
// ─────────────────────────────────────────────────────────────────

/**
 * Build a list of palette BlockDefinitions from a competency's elements.
 * Each element renders in the "New Metrics" accordion. Click → registers
 * a checkpoint on the current lesson via the NM API path (handled at the
 * click site in MM.0C — for now create() throws if invoked through the
 * regular onAddBlock path, which would create a junk ActivitySection).
 *
 * Caller is responsible for:
 *   - Gating on `school_context.use_new_metrics === true` (pass empty array
 *     when off — empty category accordion auto-hides via activeCategories).
 *   - Resolving the active competency (only one shown at a time per unit).
 *   - Wiring the click handler to /api/teacher/nm-config (MM.0C).
 */
export function buildNmElementBlocks(
  /**
   * Accepts the canonical `NMElement` shape from `@/lib/nm/constants`.
   * Defined inline as a structural type so `BlockPalette` doesn't need
   * to import the NM module (keeps the palette decoupled from NM
   * internals — only the field names matter).
   */
  elements: ReadonlyArray<{ id: string; name: string; definition?: string; studentDescription?: string }>,
  competencyId: string,
): BlockDefinition[] {
  return elements.map((el) => ({
    id: `nm-element-${competencyId}-${el.id}`,
    label: el.name,
    icon: "🎯",
    category: "new_metrics" as const,
    // Prefer the student-facing description (more human) over the formal
    // definition for the palette tooltip; fall back to a generic CTA when
    // both are missing.
    description: el.studentDescription || el.definition || `Add a checkpoint for ${el.name} on this lesson.`,
    defaultPhase: "any" as const,
    nmElementId: el.id,
    nmCompetencyId: competencyId,
    source: "built-in" as const,
    // Stub create() — should never be invoked through onAddBlock. The click
    // handler in BlockPalette short-circuits NM blocks and routes to the
    // NM checkpoint registration path instead. Throwing here makes any
    // accidental invocation a loud error rather than silent junk-section.
    create: () => {
      throw new Error(
        `[BlockPalette] NM-element block "${el.id}" was invoked through onAddBlock — should route through onAddNmCheckpoint instead. (Lever-MM regression.)`,
      );
    },
  }));
}

// ─────────────────────────────────────────────────────────────────
// "My Blocks" helpers — convert DB activity_blocks to BlockDefinitions
// ─────────────────────────────────────────────────────────────────

/** Map activity_category → BlockCategory for accordion grouping */
function mapActivityCategory(cat: string | null): BlockCategory {
  switch (cat) {
    case "assessment": return "assessment";
    case "making": case "planning": case "journey": return "response";
    case "discussion": case "critique": return "collaboration";
    default: return "custom";
  }
}

/** Map phase string from DB → editor phase */
function mapPhase(phase: string | null): BlockDefinition["defaultPhase"] {
  switch (phase) {
    case "plan": case "investigate": return "miniLesson";
    case "develop": case "create": return "workTime";
    case "evaluate": case "reflect": return "debrief";
    default: return "workTime";
  }
}

/** Map time_weight → approximate duration in minutes */
function timeWeightToMinutes(tw: string | null): number {
  switch (tw) {
    case "quick": return 5;
    case "moderate": return 10;
    case "extended": return 20;
    default: return 10;
  }
}

interface ActivityBlockRow {
  id: string;
  title: string;
  description: string | null;
  prompt: string;
  bloom_level: string | null;
  time_weight: string | null;
  grouping: string | null;
  phase: string | null;
  activity_category: string | null;
  materials_needed: string[] | null;
}

function activityBlockToDefinition(block: ActivityBlockRow): BlockDefinition {
  return {
    id: `myblock-${block.id}`,
    label: block.title,
    icon: "",
    category: mapActivityCategory(block.activity_category),
    description: block.description || block.prompt.slice(0, 80),
    defaultPhase: mapPhase(block.phase),
    source: "custom",
    create: () => ({
      activityId: nanoid(8),
      prompt: block.prompt,
      responseType: "text" as ResponseType,
      durationMinutes: timeWeightToMinutes(block.time_weight),
    }),
  };
}

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
// Extensibility — custom blocks can be added at runtime
// ─────────────────────────────────────────────────────────────────

/** Merge custom blocks into the library (deduplicates by id) */
export function mergeBlocks(
  base: BlockDefinition[],
  custom: BlockDefinition[]
): BlockDefinition[] {
  const ids = new Set(base.map((b) => b.id));
  return [...base, ...custom.filter((c) => !ids.has(c.id))];
}

// ─────────────────────────────────────────────────────────────────
// BlockPalette component
// ─────────────────────────────────────────────────────────────────

interface BlockPaletteProps {
  onAddBlock: (activity: ActivitySection) => void;
  /** Filter blocks to those contextually relevant */
  suggestedBlockIds?: string[];
  /** Additional blocks to merge into the library (PP, PYP, custom, etc.) */
  customBlocks?: BlockDefinition[];
  /** @deprecated No longer used — LessonEditor controls visibility */
  isOpen?: boolean;
  /** @deprecated No longer used — LessonEditor controls visibility */
  onToggle?: () => void;
  /**
   * Lever-MM: handler for NM-element blocks (those with `nmElementId`
   * set). Wired up in MM.0C — until then, clicks on NM blocks are no-ops
   * (the click handler short-circuits if this prop is undefined).
   * Receives the NM element ID + parent competency ID so the caller can
   * register a checkpoint on the current lesson.
   */
  onAddNmCheckpoint?: (elementId: string, competencyId: string) => void;
  /**
   * Lever-MM: NM element IDs already registered as checkpoints on the
   * currently-active lesson. The palette uses this to render "added"
   * state on the corresponding NM blocks (greyed out / different
   * affordance) so teachers don't double-add. Empty/undefined = none added.
   */
  activeNmElementIds?: string[];
}

export default function BlockPalette({
  onAddBlock,
  suggestedBlockIds,
  customBlocks,
  onAddNmCheckpoint,
  activeNmElementIds,
}: BlockPaletteProps) {
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<BlockCategory | null>("response");
  const [activeTab, setActiveTab] = useState<"templates" | "my-blocks">("templates");
  const [myBlocks, setMyBlocks] = useState<BlockDefinition[]>([]);
  const [myBlocksLoading, setMyBlocksLoading] = useState(false);
  const [myBlocksFetched, setMyBlocksFetched] = useState(false);

  // Fetch teacher's blocks when "My Blocks" tab is first opened
  useEffect(() => {
    if (activeTab !== "my-blocks" || myBlocksFetched) return;
    setMyBlocksLoading(true);
    fetch("/api/teacher/activity-blocks?status=verified&limit=100")
      .then((r) => (r.ok ? r.json() : { blocks: [] }))
      .then(({ blocks }) => {
        setMyBlocks(
          (blocks || []).map((b: ActivityBlockRow) => activityBlockToDefinition(b))
        );
        setMyBlocksFetched(true);
      })
      .catch(() => setMyBlocks([]))
      .finally(() => setMyBlocksLoading(false));
  }, [activeTab, myBlocksFetched]);

  // Merge custom blocks if provided
  const allBlocks = customBlocks
    ? mergeBlocks(BLOCK_LIBRARY, customBlocks)
    : BLOCK_LIBRARY;

  const displayBlocks = activeTab === "templates" ? allBlocks : myBlocks;

  const filteredBlocks = search
    ? displayBlocks.filter(
        (b) =>
          b.label.toLowerCase().includes(search.toLowerCase()) ||
          b.description.toLowerCase().includes(search.toLowerCase())
      )
    : displayBlocks;

  const handleAdd = useCallback(
    (block: BlockDefinition) => {
      // Lever-MM: NM-element blocks DON'T create an ActivitySection — they
      // register a checkpoint on the current lesson. Route to the NM handler
      // when present; until MM.0C wires it, fall through silently (so MM.0B's
      // list-only state doesn't crash on click via the throwing `create()` stub).
      if (block.nmElementId && block.nmCompetencyId) {
        if (onAddNmCheckpoint) {
          onAddNmCheckpoint(block.nmElementId, block.nmCompetencyId);
        }
        return;
      }
      onAddBlock(block.create());
    },
    [onAddBlock, onAddNmCheckpoint]
  );

  const suggestedBlocks = suggestedBlockIds
    ? allBlocks.filter((b) => suggestedBlockIds.includes(b.id))
    : [];

  // Gather which categories actually have blocks
  const activeCategories = (Object.keys(CATEGORIES) as BlockCategory[]).filter(
    (cat) => filteredBlocks.some((b) => b.category === cat)
  );

  return (
    <div className="flex flex-col h-full bg-[var(--le-paper)] lesson-editor-warm">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-[var(--le-hair)]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="le-cap text-[var(--le-ink-3)]">Blocks</h3>
          <span className="text-[10.5px] text-[var(--le-ink-3)] le-tnum">
            {displayBlocks.length} total
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--le-ink-3)]"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks…"
            className="w-full pl-8 pr-3 py-1.5 text-[11.5px] bg-[var(--le-bg)] border border-[var(--le-hair)] rounded-md focus:outline-none focus:border-[var(--le-ink-2)]"
          />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-2">
          <button
            onClick={() => setActiveTab("templates")}
            className={`flex-1 px-2 py-1 text-[11px] font-extrabold rounded-md border transition-colors ${
              activeTab === "templates"
                ? "bg-violet-100 border-violet-300 text-violet-800"
                : "bg-[var(--le-paper)] border-[var(--le-hair)] text-[var(--le-ink-2)] hover:text-[var(--le-ink)]"
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab("my-blocks")}
            className={`flex-1 px-2 py-1 text-[11px] font-extrabold rounded-md border transition-colors ${
              activeTab === "my-blocks"
                ? "bg-rose-50 border-rose-300 text-rose-700"
                : "bg-[var(--le-paper)] border-[var(--le-hair)] text-[var(--le-ink-2)] hover:text-[var(--le-ink)]"
            }`}
          >
            My Blocks
            {myBlocksFetched && myBlocks.length > 0 && (
              <span className="ml-1 text-[10px] le-tnum opacity-70">
                {myBlocks.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {/* My Blocks loading / empty state */}
        {activeTab === "my-blocks" && myBlocksLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
            <span className="ml-2 text-[11px] text-[var(--le-ink-3)]">Loading...</span>
          </div>
        )}
        {activeTab === "my-blocks" && !myBlocksLoading && myBlocksFetched && myBlocks.length === 0 && !search && (
          <div className="text-center py-8 px-4">
            <div className="text-2xl mb-2">📚</div>
            <p className="text-[11.5px] text-[var(--le-ink-2)] mb-2">
              No blocks in your library yet.
            </p>
            <p className="text-[11px] text-[var(--le-ink-3)]">
              Upload documents at{" "}
              <a href="/teacher/library" className="text-rose-500 hover:underline">
                Library
              </a>{" "}
              to extract reusable activity blocks.
            </p>
          </div>
        )}

        {/* AI Suggested blocks — templates tab only */}
        {activeTab === "templates" && suggestedBlocks.length > 0 && !search && (
          <div className="mb-2 border-b border-[var(--le-hair)] pb-2">
            <div className="flex items-center gap-1.5 mb-1.5 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              <span className="le-cap text-violet-700">AI Suggested</span>
            </div>
            <div className="space-y-0">
              {suggestedBlocks.map((block) => (
                <PaletteBlock
                  key={`suggested-${block.id}`}
                  block={block}
                  onAdd={handleAdd}
                  highlight
                  activeNmElementIds={activeNmElementIds}
                />
              ))}
            </div>
          </div>
        )}

        {/* Search results */}
        {search ? (
          <div className="space-y-0">
            {filteredBlocks.length === 0 ? (
              <p className="text-[11px] text-[var(--le-ink-3)] text-center py-4">
                No blocks match &ldquo;{search}&rdquo;
              </p>
            ) : (
              filteredBlocks.map((block) => (
                <PaletteBlock
                  key={block.id}
                  block={block}
                  onAdd={handleAdd}
                  activeNmElementIds={activeNmElementIds}
                />
              ))
            )}
          </div>
        ) : (
          /* Categorized accordion */
          <div className="-mx-3">
            {activeCategories.map((cat) => {
              const meta = CATEGORIES[cat];
              const blocks = filteredBlocks.filter(
                (b) => b.category === cat
              );
              if (blocks.length === 0) return null;

              const isExpanded = expandedCategory === cat;

              return (
                <div key={cat} className="border-b border-[var(--le-hair)]">
                  <button
                    onClick={() =>
                      setExpandedCategory(isExpanded ? null : cat)
                    }
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--le-hair-2)] transition-colors text-left"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${meta.dotColor} flex-shrink-0`} />
                    <span className="text-[12px] font-extrabold text-[var(--le-ink)] flex-1">
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-[var(--le-ink-3)] le-tnum">
                      {blocks.length}
                    </span>
                    <span className="text-[10px] text-[var(--le-ink-3)] w-3 text-right select-none">
                      {isExpanded ? "▾" : "▸"}
                    </span>
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
                        <div className="px-2 pb-2 space-y-0.5">
                          {blocks.map((block) => (
                            <PaletteBlock
                              key={block.id}
                              block={block}
                              onAdd={handleAdd}
                              activeNmElementIds={activeNmElementIds}
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
  );
}

// ─── Bloom level → 1-6 load score for palette chips ──
const BLOOM_LOAD_MAP: Record<string, number> = {
  remember: 1,
  understand: 2,
  apply: 3,
  analyze: 4,
  evaluate: 5,
  create: 6,
};

// ─── Time weight → 1-5 effort hint for palette chips ──
const TIME_WEIGHT_LOAD_MAP: Record<string, number> = {
  quick: 1,
  moderate: 2,
  extended: 4,
  flexible: 3,
};

// ─────────────────────────────────────────────────────────────────
// Individual palette block — clean, text-forward, tooltip on hover
// ─────────────────────────────────────────────────────────────────

function PaletteBlock({
  block,
  onAdd,
  highlight = false,
  activeNmElementIds,
}: {
  block: BlockDefinition;
  onAdd: (block: BlockDefinition) => void;
  highlight?: boolean;
  /** Lever-MM: NM element IDs already on the active lesson — drives "added" state. */
  activeNmElementIds?: string[];
}) {
  const { startDrag, endDrag } = useDndContext();
  const meta = CATEGORIES[block.category] || CATEGORIES.custom;

  // Lever-MM — NM-element blocks (those with nmElementId set) take a
  // simpler render path: no dimension chips (their throwing create() stub
  // would crash if invoked), no drag-and-drop (they don't create
  // ActivitySections), and an "added" state when the element is already
  // a checkpoint on the current lesson.
  const isNmBlock = Boolean(block.nmElementId);
  const isAdded = Boolean(
    isNmBlock && block.nmElementId && (activeNmElementIds ?? []).includes(block.nmElementId),
  );

  // Skip the create() probe entirely for NM blocks — the stub throws.
  // For regular blocks, read default dimensions once per render
  // (block.create() is cheap — returns a literal).
  const sample = isNmBlock ? null : block.create();
  const bloomLoad = sample?.bloom_level ? BLOOM_LOAD_MAP[sample.bloom_level] : null;
  const effortLoad = sample?.timeWeight ? TIME_WEIGHT_LOAD_MAP[sample.timeWeight] : null;

  const handleDragStart = (e: DragEvent) => {
    // NM blocks don't create ActivitySections — don't let them seed a
    // drag payload. The dragstart is suppressed at the `draggable` flag
    // below for NM blocks, but guarding here is belt-and-braces in case
    // a future refactor accidentally re-enables drag.
    if (isNmBlock) {
      e.preventDefault();
      return;
    }
    const activity = block.create();
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ activity, label: block.label, icon: block.icon })
    );
    e.dataTransfer.effectAllowed = "copy";

    startDrag({
      activity,
      label: block.label,
      icon: block.icon,
      source: "palette",
    });
  };

  const handleDragEnd = () => {
    endDrag();
  };

  return (
    <div
      draggable={!isNmBlock}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onAdd(block)}
      title={isAdded ? `${block.description} (already on this lesson — click chip × to remove)` : block.description}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors ${
        isNmBlock ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
      } ${
        isAdded
          ? "border-yellow-300 bg-yellow-50 opacity-60"
          : highlight
          ? "border-violet-300 bg-violet-50 hover:bg-violet-100"
          : "border-transparent hover:border-[var(--le-hair)] hover:bg-[var(--le-paper)]"
      }`}
    >
      {/* Category dot */}
      <div
        className={`w-1.5 h-1.5 rounded-full ${meta.dotColor} flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity`}
      />

      {/* Label + dimension chips */}
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] font-bold truncate text-[var(--le-ink)]">
          {block.label}
        </div>
        {(bloomLoad !== null || effortLoad !== null) && (
          <div className="flex items-center gap-1 text-[9.5px] text-[var(--le-ink-3)] tracking-wider mt-0.5">
            {bloomLoad !== null && <span>B{bloomLoad}</span>}
            {bloomLoad !== null && effortLoad !== null && <span>·</span>}
            {effortLoad !== null && <span>load {effortLoad}/5</span>}
          </div>
        )}
      </div>

      {/* Custom / Pack badge */}
      {block.source === "custom" && (
        <span className="text-[9px] font-extrabold text-rose-500 uppercase tracking-wider flex-shrink-0">
          Custom
        </span>
      )}
      {block.source === "imported" && (
        <span className="text-[9px] font-extrabold text-cyan-600 uppercase tracking-wider flex-shrink-0">
          Pack
        </span>
      )}

      {/* Lever-MM — Added/Add hint (NM blocks only) */}
      {isNmBlock && (
        <span className="text-[10px] text-yellow-700 flex-shrink-0 select-none">
          {isAdded ? "✓ added" : "+ add"}
        </span>
      )}

      {/* Drag hint (regular blocks only) */}
      {!isNmBlock && (
        <span className="opacity-0 group-hover:opacity-100 text-[10px] text-[var(--le-ink-3)] flex-shrink-0 transition-opacity select-none">
          drag
        </span>
      )}
    </div>
  );
}
