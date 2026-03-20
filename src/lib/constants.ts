export const CRITERIA = {
  A: {
    key: "A",
    name: "Inquiring & Analysing",
    color: "#6366F1",       // indigo — richer, more brand-aligned
    bgClass: "bg-accent-blue",
    textClass: "text-accent-blue",
  },
  B: {
    key: "B",
    name: "Developing Ideas",
    color: "#10B981",       // emerald — fresher green
    bgClass: "bg-accent-green",
    textClass: "text-accent-green",
  },
  C: {
    key: "C",
    name: "Creating the Solution",
    color: "#F59E0B",       // amber — warmer, more legible
    bgClass: "bg-accent-orange",
    textClass: "text-accent-orange",
  },
  D: {
    key: "D",
    name: "Evaluating",
    color: "#8B5CF6",       // violet — closer to brand purple
    bgClass: "bg-accent-purple",
    textClass: "text-accent-purple",
  },
} as const;

export type CriterionKey = keyof typeof CRITERIA;

/** Default MYP Design pages — used as a template for new units and v1→v2 migration. */
export const DEFAULT_MYP_PAGES = [
  { id: "A1", number: 1, criterion: "A" as CriterionKey, title: "Explain and justify the need for a solution" },
  { id: "A2", number: 2, criterion: "A" as CriterionKey, title: "Construct a detailed research plan" },
  { id: "A3", number: 3, criterion: "A" as CriterionKey, title: "Analyse existing products/solutions" },
  { id: "A4", number: 4, criterion: "A" as CriterionKey, title: "Develop a detailed design brief" },
  { id: "B1", number: 5, criterion: "B" as CriterionKey, title: "Develop a design specification" },
  { id: "B2", number: 6, criterion: "B" as CriterionKey, title: "Develop a range of feasible design ideas" },
  { id: "B3", number: 7, criterion: "B" as CriterionKey, title: "Present the chosen design with justification" },
  { id: "B4", number: 8, criterion: "B" as CriterionKey, title: "Develop accurate and detailed planning drawings/diagrams" },
  { id: "C1", number: 9, criterion: "C" as CriterionKey, title: "Construct a logical plan with resources and time" },
  { id: "C2", number: 10, criterion: "C" as CriterionKey, title: "Demonstrate excellent technical skills" },
  { id: "C3", number: 11, criterion: "C" as CriterionKey, title: "Follow the plan to create the solution" },
  { id: "C4", number: 12, criterion: "C" as CriterionKey, title: "Explain changes made to the chosen design and plan" },
  { id: "D1", number: 13, criterion: "D" as CriterionKey, title: "Design detailed and relevant testing methods" },
  { id: "D2", number: 14, criterion: "D" as CriterionKey, title: "Evaluate the success of the solution against the design specification" },
  { id: "D3", number: 15, criterion: "D" as CriterionKey, title: "Explain how the solution could be improved" },
  { id: "D4", number: 16, criterion: "D" as CriterionKey, title: "Explain the impact of the solution on the client/community" },
] as const;

/** @deprecated Use DEFAULT_MYP_PAGES. Kept as alias during migration. */
export const PAGES = DEFAULT_MYP_PAGES;

export type PageId = (typeof DEFAULT_MYP_PAGES)[number]["id"];

// --- Flexible Page Helpers ---

/** Maps emphasis level to number of pages per criterion */
export const EMPHASIS_PAGE_COUNT: Record<string, number> = {
  light: 2,
  standard: 3,
  emphasis: 4,
};

/**
 * Build page definitions for a set of selected criteria with emphasis levels.
 * Returns an ordered array of page metadata with IDs like A1, A2, B1, etc.
 */
export function buildPageDefinitions(
  selectedCriteria: CriterionKey[],
  criteriaFocus: Partial<Record<CriterionKey, "light" | "standard" | "emphasis">>
): Array<{ id: string; criterion: CriterionKey; title: string; strandIndex: number }> {
  const result: Array<{ id: string; criterion: CriterionKey; title: string; strandIndex: number }> = [];
  for (const criterion of selectedCriteria) {
    const emphasis = criteriaFocus[criterion] || "standard";
    const count = EMPHASIS_PAGE_COUNT[emphasis];
    const defaultPages = DEFAULT_MYP_PAGES.filter(p => p.criterion === criterion);
    for (let i = 0; i < count; i++) {
      const defaultPage = defaultPages[i];
      result.push({
        id: `${criterion}${i + 1}`,
        criterion,
        title: defaultPage?.title || `${CRITERIA[criterion].name} - Page ${i + 1}`,
        strandIndex: i + 1,
      });
    }
  }
  return result;
}

// --- Page Type Helpers ---

import type { PageType } from "@/types";

export const PAGE_TYPE_COLORS: Record<PageType, string> = {
  strand: "#6366F1",     // default indigo, overridden by criterion color
  lesson: "#7B2FF2",     // brand purple — journey-mode lesson blocks
  context: "#6366F1",    // indigo
  skill: "#F59E0B",      // amber
  reflection: "#8B5CF6", // violet
  custom: "#6B7280",     // gray
};

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  strand: "Assessment",
  lesson: "Lesson",
  context: "Context",
  skill: "Skill Builder",
  reflection: "Reflection",
  custom: "Custom",
};

/** Get the display color for a page based on its type and criterion. */
export function getPageColor(page: { type: string; criterion?: string }): string {
  if (page.type === "strand" && page.criterion && page.criterion in CRITERIA) {
    return CRITERIA[page.criterion as CriterionKey].color;
  }
  return PAGE_TYPE_COLORS[page.type as PageType] || "#6B7280";
}

export const ELL_LEVELS = {
  1: { label: "Beginner ELL", description: "Full scaffolding, sentence starters, vocab warm-ups, read-aloud" },
  2: { label: "Intermediate ELL", description: "Some scaffolding, key vocab highlighted, shorter warm-ups" },
  3: { label: "Advanced / Native", description: "No scaffolding, extension prompts, higher expectations" },
} as const;

export type EllLevel = 1 | 2 | 3;

// --- MYP Curriculum Constants ---

export const MYP_GRADE_LEVELS = [
  "Year 1 (Grade 6)",
  "Year 2 (Grade 7)",
  "Year 3 (Grade 8)",
  "Year 4 (Grade 9)",
  "Year 5 (Grade 10)",
] as const;

export const MYP_GLOBAL_CONTEXTS = [
  { value: "identities-and-relationships", label: "Identities and relationships", description: "Who we are; health; beliefs and values" },
  { value: "orientation-in-space-and-time", label: "Orientation in space and time", description: "Our relationship to place, time, and history" },
  { value: "personal-and-cultural-expression", label: "Personal and cultural expression", description: "How we express ideas, feelings, culture, and creativity" },
  { value: "scientific-and-technical-innovation", label: "Scientific and technical innovation", description: "How we understand and shape the world through science and technology" },
  { value: "globalization-and-sustainability", label: "Globalization and sustainability", description: "Our interconnected world and environmental responsibility" },
  { value: "fairness-and-development", label: "Fairness and development", description: "Rights, access, and the pursuit of equity" },
] as const;

export const MYP_KEY_CONCEPTS = [
  "Aesthetics",
  "Change",
  "Communication",
  "Communities",
  "Connections",
  "Creativity",
  "Culture",
  "Development",
  "Form",
  "Global interactions",
  "Identity",
  "Logic",
  "Perspective",
  "Relationships",
  "Systems",
  "Time, place and space",
] as const;

export const MYP_RELATED_CONCEPTS_DESIGN = [
  "Adaptation",
  "Collaboration",
  "Ergonomics",
  "Evaluation",
  "Form",
  "Function",
  "Innovation",
  "Invention",
  "Markets and trends",
  "Perspective",
  "Resources",
  "Sustainability",
] as const;

export const MYP_ATL_SKILL_CATEGORIES = [
  { category: "Communication", skills: ["Exchanging information", "Literacy", "ICT skills"] },
  { category: "Social", skills: ["Collaboration", "Conflict resolution", "Leadership"] },
  { category: "Self-management", skills: ["Organisation", "Time management", "Reflection", "Growth mindset"] },
  { category: "Research", skills: ["Information literacy", "Media literacy", "Ethical use of sources"] },
  { category: "Thinking", skills: ["Critical thinking", "Creative thinking", "Problem solving", "Transfer"] },
] as const;

export const DESIGN_SKILLS = [
  "CAD (Computer-Aided Design)",
  "3D Printing",
  "Laser Cutting",
  "Woodwork",
  "Metalwork",
  "Textiles / Sewing",
  "Electronics / Arduino",
  "Coding / Programming",
  "Graphic Design",
  "Photography",
  "Video Production",
  "Paper / Cardboard Prototyping",
  "Clay / Ceramics",
  "Food Technology",
  "CNC Machining",
] as const;

export const SESSION_COOKIE_NAME = "questerra_student_session";
export const SESSION_DURATION_DAYS = 7;

// --- Page Settings Helpers ---

import type { PageSettings, PageSettingsMap, PageDueDatesMap } from "@/types";

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  enabled: true,
  assessment_type: "formative",
  export_pdf: true,
};

/** Resolve page settings for a given page ID, merging with defaults */
export function getPageSettings(
  pageSettingsMap: PageSettingsMap | undefined,
  pageId: string | number
): PageSettings {
  const key = String(pageId);
  const override = pageSettingsMap?.[key];
  if (!override) return DEFAULT_PAGE_SETTINGS;
  return { ...DEFAULT_PAGE_SETTINGS, ...override };
}

/** Get the due date for a specific page (by page ID, e.g. "A1", "B3") */
export function getPageDueDate(
  pageDueDates: PageDueDatesMap | undefined,
  pageId: string
): string | null {
  return pageDueDates?.[pageId] || null;
}

// ---------------------------------------------------------------------------
// Curriculum Frameworks — extensible registry for multi-framework support
// ---------------------------------------------------------------------------

export const CURRICULUM_FRAMEWORKS = {
  IB_MYP: {
    id: "IB_MYP" as const,
    label: "IB MYP Design",
    criteria: ["A", "B", "C", "D"],
    criteriaLabels: {
      A: "Inquiring & Analysing",
      B: "Developing Ideas",
      C: "Creating the Solution",
      D: "Evaluating",
    } as Record<string, string>,
  },
  GCSE_DT: {
    id: "GCSE_DT" as const,
    label: "GCSE Design & Technology",
    criteria: ["AO1", "AO2", "AO3", "AO4", "AO5"],
    criteriaLabels: {
      AO1: "Identify, investigate and outline",
      AO2: "Design and make prototypes",
      AO3: "Analyse and evaluate",
      AO4: "Demonstrate and apply knowledge",
      AO5: "Technical principles",
    } as Record<string, string>,
  },
  ACARA_DT: {
    id: "ACARA_DT" as const,
    label: "Australian D&T",
    criteria: ["Knowledge", "Processes"],
    criteriaLabels: {
      Knowledge: "Knowledge and Understanding",
      Processes: "Processes and Production Skills",
    } as Record<string, string>,
  },
} as const;

export type CurriculumFrameworkId = keyof typeof CURRICULUM_FRAMEWORKS;

// ---------------------------------------------------------------------------
// Grading Scales — framework-agnostic scoring configuration
// ---------------------------------------------------------------------------

export interface GradingScale {
  /** Whether the scale uses numbers or letter labels */
  type: "numeric" | "letter";
  /** Minimum score value */
  min: number;
  /** Maximum score value */
  max: number;
  /** Increment step (1 for whole numbers) */
  step: number;
  /** Display labels for letter-based scales (indexed from min) */
  labels?: string[];
  /** If true, display labels[value - min] instead of the raw number */
  displayAsLabel?: boolean;
  /** Format a numeric value for display (e.g., "6", "72%", "B") */
  formatDisplay: (value: number) => string;
}

export const GRADING_SCALES: Record<CurriculumFrameworkId, GradingScale> = {
  IB_MYP: {
    type: "numeric",
    min: 1,
    max: 8,
    step: 1,
    formatDisplay: (v) => `${v}`,
  },
  GCSE_DT: {
    type: "numeric",
    min: 0,
    max: 100,
    step: 1,
    formatDisplay: (v) => `${v}%`,
  },
  ACARA_DT: {
    type: "letter",
    min: 1,
    max: 5,
    step: 1,
    labels: ["A", "B", "C", "D", "E"],
    displayAsLabel: true,
    formatDisplay: (v) => (["A", "B", "C", "D", "E"][v - 1] ?? `${v}`),
  },
};

// ---------------------------------------------------------------------------
// Knowledge Item Type metadata — icons, labels, colors for the library UI
// ---------------------------------------------------------------------------

export const KNOWLEDGE_ITEM_TYPES = {
  tutorial: { label: "Tutorial", icon: "BookOpen", color: "#2E86AB" },
  "choice-board": { label: "Choice Board", icon: "LayoutGrid", color: "#E86F2C" },
  reference: { label: "Reference", icon: "FileText", color: "#6366F1" },
  "skill-guide": { label: "Skill Guide", icon: "Wrench", color: "#2DA05E" },
  "textbook-section": { label: "Textbook", icon: "BookMarked", color: "#8B5CF6" },
  "lesson-resource": { label: "Lesson Resource", icon: "GraduationCap", color: "#D63384" },
  image: { label: "Image", icon: "Image", color: "#F59E0B" },
  video: { label: "Video", icon: "Play", color: "#EF4444" },
  audio: { label: "Audio", icon: "Music", color: "#10B981" },
  other: { label: "Other", icon: "Package", color: "#6B7280" },
} as const;

export type KnowledgeItemTypeKey = keyof typeof KNOWLEDGE_ITEM_TYPES;
