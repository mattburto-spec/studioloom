"use client";

import { useState, useEffect, useCallback, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";
import type { ActivitySection, ResponseType } from "@/types";
import { useDndContext } from "./DndContext";
import {
  JOURNAL_PROMPTS,
  STRATEGY_CANVAS_PROMPTS,
  SELF_REREAD_PROMPTS,
  FINAL_REFLECTION_PROMPTS,
} from "@/lib/structured-prompts/presets";
import type { BlockDefinition, BlockCategory } from "./BlockPalette.types";
// Lever-MM: re-exported from BlockPalette.types so existing consumers
// keep importing types from `BlockPalette` (public surface unchanged).
export type { BlockDefinition, BlockCategory };
// Lever-MM: NM-element BlockDefinition factory lives in a pure .ts module
// so it's importable from .test.ts without JSX-transform issues.
// Re-exported here so the public surface stays unchanged.
export { buildNmElementBlocks } from "./nm-element-blocks";

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

// Lever-MM — buildNmElementBlocks lives in ./nm-element-blocks (pure
// .ts so it's testable from .test.ts without JSX). Re-exported above
// for the existing public surface.

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
  {
    // AG.1 / AG.2.4 — Process Journal block. The 4-prompt Did/Noticed/
    // Decided/Next preset is the CO2 Racers default (and a good fit for
    // any maker / design unit). Auto-creates a Kanban backlog card from
    // the "Next" prompt on save.
    //
    // portfolioCapture=true so the entry always surfaces in the
    // Narrative view (round 5 fix — without it, units that have other
    // portfolioCapture-flagged blocks would exclude the journal under
    // narrative-utils' usePortfolioFilter branch).
    id: "process-journal",
    label: "Process Journal",
    icon: "📓",
    category: "response",
    description: "4-prompt reflection journal — Did / Noticed / Decided / Next. Auto-creates Kanban card from Next.",
    defaultPhase: "debrief",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Take 5 minutes to journal what just happened.",
      responseType: "structured-prompts" as ResponseType,
      durationMinutes: 5,
      prompts: JOURNAL_PROMPTS,
      autoCreateKanbanCardOnSave: true,
      portfolioCapture: true,
      // LIS.D — Process Journal defaults to stepper since DO/NOTICE/DECIDE/NEXT
      // is the canonical criterion-coloured stepper use case. Teachers can
      // uncheck the toggle in the section editor if they prefer all-at-once.
      promptsLayout: "stepper" as const,
    }),
  },
  {
    // AG.5 / Round 12 — Strategy Canvas (Class 1 anchor activity).
    // 3 first-day commitments per docs/units/co2-racers-agency-unit.md
    // §4.11. Re-prompted at Class 7 ("anything changed?"). Kanban
    // auto-create OFF — these aren't tasks.
    id: "strategy-canvas",
    label: "Strategy Canvas",
    icon: "🧭",
    category: "response",
    description: "Class 1 anchor — Design philosophy / Biggest risk / Fallback plan. Re-prompt at Class 7.",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Lock in your three first-day commitments. You'll re-read these mid-unit.",
      responseType: "structured-prompts" as ResponseType,
      durationMinutes: 10,
      prompts: STRATEGY_CANVAS_PROMPTS,
      autoCreateKanbanCardOnSave: false,
      portfolioCapture: true,
    }),
  },
  {
    // AG.5 / Round 12 — Self-Reread (Class 7 anchor activity).
    // Single deep prompt. Per agency-unit §4.6 the highest-leverage
    // intervention. Schön reflection-on-action.
    id: "self-reread",
    label: "Self-Reread",
    icon: "🔁",
    category: "response",
    description: "Class 7 anchor — re-read your last 3 journal entries and name the pattern.",
    defaultPhase: "miniLesson",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Open your Portfolio. Read your last 3 journal entries. Then write below.",
      responseType: "structured-prompts" as ResponseType,
      durationMinutes: 10,
      prompts: SELF_REREAD_PROMPTS,
      autoCreateKanbanCardOnSave: false,
      portfolioCapture: true,
    }),
  },
  {
    // AG.5 / Round 12 — Final Reflection (Class 14 anchor activity).
    // 5 deep prompts comparing baseline (Class 1) to now. Per
    // agency-unit §4.4 Class 14: deeper than mid-unit surveys.
    id: "final-reflection",
    label: "Final Reflection",
    icon: "🎯",
    category: "response",
    description: "Class 14 anchor — 5 deep reflection prompts comparing baseline to now.",
    defaultPhase: "debrief",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Big-picture reflection. Take your time — this anchors the agency evidence in your final grade.",
      responseType: "structured-prompts" as ResponseType,
      durationMinutes: 15,
      prompts: FINAL_REFLECTION_PROMPTS,
      autoCreateKanbanCardOnSave: false,
      portfolioCapture: true,
    }),
  },
  // Project Spec v1 — PALETTE ENTRY HIDDEN (12 May 2026) per
  // FU-PSV2-V1-DEPRECATION step 2. Replaced in the lesson editor by
  // the three v2 blocks (Product Brief / User Profile / Success
  // Criteria) below. The underlying system stays running — existing
  // student_unit_project_specs rows continue to render in marking,
  // and any lesson that already has a v1 block placed continues to
  // work end-to-end. Pure UI hide; no schema or component changes.
  // Full retirement (drop table + delete component) deferred to
  // FU-PSV2-V1-DEPRECATION step 3 (~90 days zero new inserts).
  {
    // Project Spec v2 — Product Brief block. 9 slots covering name,
    // pitch, mechanism, primary + secondary material, scale, constraints,
    // precedents, technical risks. Archetype-driven (Toy / Architecture
    // share IDs with v1). Storage in student_unit_product_briefs.
    id: "product-brief",
    label: "Product Brief",
    icon: "🧰",
    category: "response",
    description: "v2 Product Brief — 9-slot archetype-driven product spec. Adds precedents, constraints, technical risks.",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Lock in what you're going to make. Materials, scale, mechanism, risks.",
      responseType: "product-brief" as ResponseType,
      durationMinutes: 15,
    }),
  },
  {
    // Project Spec v2 — User Profile block. UNIVERSAL across archetypes.
    // 8 slots covering name, age band, context, problem, alternatives,
    // unique value, optional photo (user-profile-photos bucket), optional
    // quote. Storage in student_unit_user_profiles.
    id: "user-profile",
    label: "User Profile",
    icon: "👤",
    category: "response",
    description: "v2 User Profile — 8-slot empathy work for the person you're designing for. Optional photo + quote.",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Build a real picture of your user. Name them. Watch them. Quote them.",
      responseType: "user-profile" as ResponseType,
      durationMinutes: 15,
    }),
  },
  {
    // Project Spec v2 — Success Criteria block. UNIVERSAL across
    // archetypes. 5 slots covering observable signal, measurement
    // protocol, test setup, failure mode, iteration trigger. Storage
    // in student_unit_success_criteria.
    id: "success-criteria",
    label: "Success Criteria",
    icon: "🎯",
    category: "response",
    description: "v2 Success Criteria — 5-slot research planning: observable signal, measurement, setup, failure mode, iteration trigger.",
    defaultPhase: "workTime",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Decide how you'll test this and what success looks like — BEFORE you build.",
      responseType: "success-criteria" as ResponseType,
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
    // LIS.D — Magazine callout palette entry. Pre-fills 3 sample
    // bullets so teachers can see the 3-card layout immediately, then
    // edit term/hint/body in the KeyCalloutEditor surface.
    id: "magazine-callout",
    label: "Magazine Callout",
    icon: "📰",
    category: "content",
    description: "3-card 'Worth remembering' explainer (cream warm magazine layout)",
    defaultPhase: "miniLesson",
    create: () => ({
      activityId: nanoid(8),
      prompt: "Worth remembering — three things",
      durationMinutes: 3,
      contentStyle: "key-callout" as const,
      bulletsTitle: ["The", "Three", "Cs."],
      bulletsIntro: "Replace this intro with the one-line orient students should carry into the rest of the lesson.",
      bullets: [
        {
          term: "Choice",
          hint: "autonomy",
          body: "Replace with the body for card 1 — what this term means and why it matters here.",
        },
        {
          term: "Causation",
          hint: "because-clauses",
          body: "Replace with the body for card 2.",
        },
        {
          term: "Change",
          hint: "iteration",
          body: "Replace with the body for card 3.",
        },
      ],
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
  /**
   * Lever-MM: full list of available NM competencies for the selector
   * inside the New Metrics accordion. Pass undefined (or empty) to hide
   * the selector — typically when use_new_metrics is off.
   */
  nmCompetencies?: ReadonlyArray<{ id: string; name: string; description?: string }>;
  /** Lever-MM: currently-active competency ID (drives selector value). */
  nmCurrentCompetencyId?: string;
  /** Lever-MM: change handler when teacher picks a different competency. */
  onSetNmCompetency?: (competencyId: string) => void;
}

export default function BlockPalette({
  onAddBlock,
  suggestedBlockIds,
  customBlocks,
  onAddNmCheckpoint,
  activeNmElementIds,
  nmCompetencies,
  nmCurrentCompetencyId,
  onSetNmCompetency,
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

  // Gather which categories actually have blocks.
  // Lever-MM exception: the "new_metrics" category renders whenever the
  // parent passes `nmCompetencies` (i.e. NM is enabled for this teacher's
  // school) — even when the active competency has zero elements. Without
  // this, picking a competency with no elements would hide the accordion
  // and the competency selector would become inaccessible (teacher
  // couldn't switch back).
  //
  // History — 5 May 2026 declutter pass briefly set NM_CATEGORY_VISIBLE
  // to false on a misinterpretation of "remove the NM yellow bar"
  // (Matt's intent was the amber checkpoint strip on lesson cards in
  // LessonEditor.tsx — SHOW_NM_CHECKPOINT_STRIP — NOT this BlockPalette
  // category, which is the AUTHORING PATH for NM checkpoints/surveys).
  // Restored same day. The yellow checkpoint strip stays hidden via
  // SHOW_NM_CHECKPOINT_STRIP in LessonEditor.tsx.
  const NM_CATEGORY_VISIBLE = true;
  const activeCategories = (Object.keys(CATEGORIES) as BlockCategory[]).filter(
    (cat) => {
      if (cat === "new_metrics") {
        if (!NM_CATEGORY_VISIBLE) return false;
        if (nmCompetencies && nmCompetencies.length > 0) return true;
      }
      return filteredBlocks.some((b) => b.category === cat);
    }
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
              // Lever-MM: don't bail on empty new_metrics — the selector
              // still needs to render so the teacher can switch competencies.
              if (blocks.length === 0 && cat !== "new_metrics") return null;

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
                        {/* Lever-MM — competency selector inside the
                            New Metrics accordion. Only renders for the
                            new_metrics category AND when LessonEditor
                            passes a non-empty competency list. */}
                        {cat === "new_metrics" && nmCompetencies && nmCompetencies.length > 0 && (
                          <div className="px-3 pt-2 pb-1">
                            <label className="block text-[10px] le-cap text-[var(--le-ink-3)] mb-1">
                              Competency
                            </label>
                            <select
                              value={nmCurrentCompetencyId || ""}
                              onChange={(e) => onSetNmCompetency?.(e.target.value)}
                              className="w-full text-[12px] px-2 py-1.5 bg-white border border-yellow-300 rounded-md focus:outline-none focus:border-yellow-500 font-medium text-[var(--le-ink)]"
                            >
                              {nmCompetencies.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            {/* Empty-state hint when competency has no elements yet */}
                            {blocks.length === 0 && (
                              <p className="text-[10.5px] text-[var(--le-ink-3)] italic mt-1.5 leading-relaxed">
                                No elements available for this competency yet. Pick another competency or come back when the kit ships.
                              </p>
                            )}
                          </div>
                        )}
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
