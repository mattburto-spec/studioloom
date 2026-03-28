// ---------------------------------------------------------------------------
// Criterion Definition — the universal shape for any assessment criterion
// ---------------------------------------------------------------------------

export interface CriterionDefinition {
  key: string;
  name: string;
  color: string;
  bgClass: string;
  textClass: string;
}

/**
 * MYP Design criteria — the original 4-criterion set.
 * Still the default for Design units and backward compatibility.
 */
export const CRITERIA: Record<string, CriterionDefinition> = {
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
};

/** Alias for backward compatibility — the MYP A/B/C/D keys */
export const MYP_CRITERIA = CRITERIA;

/**
 * CriterionKey is now `string` to support any framework's criteria.
 * MYP uses "A"|"B"|"C"|"D", GCSE uses "AO1"-"AO5", Service uses "I"|"P"|"A"|"R"|"D", etc.
 * The specific valid keys are determined by unit type + programme at runtime.
 */
export type CriterionKey = string;

// ---------------------------------------------------------------------------
// Per-Unit-Type Criteria Definitions
// ---------------------------------------------------------------------------

/** Service Learning (IPARD) criteria */
export const SERVICE_CRITERIA: Record<string, CriterionDefinition> = {
  I: { key: "I", name: "Investigate", color: "#3B82F6", bgClass: "bg-blue-100", textClass: "text-blue-700" },
  P: { key: "P", name: "Plan", color: "#8B5CF6", bgClass: "bg-violet-100", textClass: "text-violet-700" },
  A: { key: "A", name: "Act", color: "#10B981", bgClass: "bg-emerald-100", textClass: "text-emerald-700" },
  R: { key: "R", name: "Reflect", color: "#F59E0B", bgClass: "bg-amber-100", textClass: "text-amber-700" },
  D: { key: "D", name: "Demonstrate", color: "#EF4444", bgClass: "bg-red-100", textClass: "text-red-700" },
};

/** Personal Project criteria (MYP Year 5) */
export const PP_CRITERIA: Record<string, CriterionDefinition> = {
  A: { key: "A", name: "Planning", color: "#6366F1", bgClass: "bg-accent-blue", textClass: "text-accent-blue" },
  B: { key: "B", name: "Applying Skills", color: "#10B981", bgClass: "bg-accent-green", textClass: "text-accent-green" },
  C: { key: "C", name: "Reflecting", color: "#F59E0B", bgClass: "bg-accent-orange", textClass: "text-accent-orange" },
};

/** Inquiry criteria */
export const INQUIRY_CRITERIA: Record<string, CriterionDefinition> = {
  A: { key: "A", name: "Inquiring", color: "#6366F1", bgClass: "bg-accent-blue", textClass: "text-accent-blue" },
  B: { key: "B", name: "Exploring", color: "#3B82F6", bgClass: "bg-blue-100", textClass: "text-blue-700" },
  C: { key: "C", name: "Creating", color: "#10B981", bgClass: "bg-accent-green", textClass: "text-accent-green" },
  D: { key: "D", name: "Sharing", color: "#F59E0B", bgClass: "bg-accent-orange", textClass: "text-accent-orange" },
};

// ---------------------------------------------------------------------------
// Criteria Lookup Helpers
// ---------------------------------------------------------------------------

import type { UnitType } from "@/lib/ai/unit-types";

/** All criteria sets indexed by unit type */
const CRITERIA_BY_TYPE: Record<string, Record<string, CriterionDefinition>> = {
  design: CRITERIA,
  service: SERVICE_CRITERIA,
  personal_project: PP_CRITERIA,
  inquiry: INQUIRY_CRITERIA,
};

/**
 * Get the criteria definitions for a given unit type.
 * Returns the full Record<key, CriterionDefinition>.
 * Falls back to MYP Design criteria if type is unknown.
 */
export function getCriteriaForType(unitType: UnitType | string = "design"): Record<string, CriterionDefinition> {
  return CRITERIA_BY_TYPE[unitType] || CRITERIA;
}

/**
 * Get ordered criterion keys for a unit type (e.g. ["A","B","C","D"] for design, ["I","P","A","R","D"] for service).
 */
export function getCriterionKeys(unitType: UnitType | string = "design"): string[] {
  return Object.keys(getCriteriaForType(unitType));
}

/**
 * Look up a single criterion definition by key, checking the type-specific set first,
 * then falling back to the universal MYP set.
 */
export function getCriterion(key: string, unitType: UnitType | string = "design"): CriterionDefinition | undefined {
  const typeSpecific = getCriteriaForType(unitType);
  return typeSpecific[key] || CRITERIA[key];
}

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
 *
 * Now unit-type-aware: for MYP Design, falls back to DEFAULT_MYP_PAGES titles.
 * For other types, uses the criterion name from getCriteriaForType().
 */
export function buildPageDefinitions(
  selectedCriteria: CriterionKey[],
  criteriaFocus: Partial<Record<CriterionKey, "light" | "standard" | "emphasis">>,
  unitType: UnitType | string = "design"
): Array<{ id: string; criterion: CriterionKey; title: string; strandIndex: number }> {
  const criteriaMap = getCriteriaForType(unitType);
  const result: Array<{ id: string; criterion: CriterionKey; title: string; strandIndex: number }> = [];
  for (const criterion of selectedCriteria) {
    const emphasis = criteriaFocus[criterion] || "standard";
    const count = EMPHASIS_PAGE_COUNT[emphasis];
    // For MYP Design, use the default page titles; for other types, use criterion name
    const defaultPages = unitType === "design"
      ? DEFAULT_MYP_PAGES.filter(p => p.criterion === criterion)
      : [];
    const criterionDef = criteriaMap[criterion];
    for (let i = 0; i < count; i++) {
      const defaultPage = defaultPages[i];
      const fallbackName = criterionDef?.name || criterion;
      result.push({
        id: `${criterion}${i + 1}`,
        criterion,
        title: defaultPage?.title || `${fallbackName} - Page ${i + 1}`,
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

// =========================================================================
// Framework-Aware Grade Levels Registry
// =========================================================================

/** Framework-aware grade levels. Key = framework ID from CURRICULUM_FRAMEWORKS. */
export const FRAMEWORK_GRADE_LEVELS: Record<string, readonly string[]> = {
  IB_MYP: MYP_GRADE_LEVELS,
  GCSE_DT: ["Year 10 (Grade 9)", "Year 11 (Grade 10)"],
  IGCSE_DT: ["Year 10 (Grade 9)", "Year 11 (Grade 10)"],
  A_LEVEL_DT: ["Year 12 (Grade 11)", "Year 13 (Grade 12)"],
  ACARA_DT: ["Year 5", "Year 6", "Year 7", "Year 8", "Year 9", "Year 10"],
  PLTW: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  NESA_DT: ["Year 7", "Year 8", "Year 9", "Year 10"],
  VIC_DT: ["Year 7", "Year 8", "Year 9", "Year 10"],
};

/** Get grade levels for a framework. Falls back to MYP if unknown. */
export function getFrameworkGradeLevels(framework?: string): readonly string[] {
  return FRAMEWORK_GRADE_LEVELS[framework || "IB_MYP"] || MYP_GRADE_LEVELS;
}

/** Get a sensible default grade level for a framework. */
export function getDefaultGradeLevel(framework?: string): string {
  const defaults: Record<string, string> = {
    IB_MYP: "Year 3 (Grade 8)",
    GCSE_DT: "Year 10 (Grade 9)",
    IGCSE_DT: "Year 10 (Grade 9)",
    A_LEVEL_DT: "Year 12 (Grade 11)",
    ACARA_DT: "Year 8",
    PLTW: "Grade 10",
    NESA_DT: "Year 9",
    VIC_DT: "Year 9",
  };
  return defaults[framework || "IB_MYP"] || "Year 3 (Grade 8)";
}

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

// === Service Learning option sets ===
export const SERVICE_COMMUNITY_CONTEXTS = [
  "Environmental sustainability",
  "Health & wellbeing",
  "Education access",
  "Cultural preservation",
  "Food security",
  "Animal welfare",
  "Homelessness & housing",
  "Technology access",
  "Elderly care",
  "Youth empowerment",
] as const;

export const SERVICE_SDG_OPTIONS = [
  "1: No Poverty", "2: Zero Hunger", "3: Good Health", "4: Quality Education",
  "5: Gender Equality", "6: Clean Water", "7: Affordable Energy", "8: Decent Work",
  "9: Industry & Innovation", "10: Reduced Inequalities", "11: Sustainable Cities",
  "12: Responsible Consumption", "13: Climate Action", "14: Life Below Water",
  "15: Life on Land", "16: Peace & Justice", "17: Partnerships",
] as const;

export const SERVICE_OUTCOMES = [
  "Awareness raising", "Direct service", "Advocacy", "Resource creation",
  "Policy change", "Community building", "Fundraising", "Mentoring/tutoring",
] as const;

export const SERVICE_PARTNER_TYPES = [
  "Community organisation", "Government agency", "Individual/family",
  "School community", "Online community", "No partner (student-led)",
] as const;

// === Personal Project option sets ===
export const PP_GOAL_TYPES = [
  "Create a product", "Develop a skill", "Organise an event",
  "Conduct research", "Build something", "Write/create art",
] as const;

export const PP_PRESENTATION_FORMATS = [
  "Exhibition display", "Live demonstration", "Digital portfolio",
  "Written report", "Video documentary", "Oral presentation",
] as const;

// === Inquiry option sets ===
export const INQUIRY_THEMES = [
  "Who We Are", "Where We Are in Place and Time", "How We Express Ourselves",
  "How the World Works", "How We Organize Ourselves", "Sharing the Planet",
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
    criteria: ["AO1", "AO2", "AO3", "AO4"],
    criteriaLabels: {
      AO1: "Identify, Investigate & Outline",
      AO2: "Design & Make Prototypes",
      AO3: "Analyse & Evaluate",
      AO4: "Knowledge & Understanding",
    } as Record<string, string>,
  },
  ACARA_DT: {
    id: "ACARA_DT" as const,
    label: "Australian D&T",
    criteria: ["KU", "PPS"],
    criteriaLabels: {
      KU: "Knowledge & Understanding",
      PPS: "Processes & Production Skills",
    } as Record<string, string>,
  },
  A_LEVEL_DT: {
    id: "A_LEVEL_DT" as const,
    label: "A-Level Design & Technology",
    criteria: ["C1", "C2", "C3"],
    criteriaLabels: {
      C1: "Technical Principles",
      C2: "Designing & Making Principles",
      C3: "Design & Make Project (NEA)",
    } as Record<string, string>,
  },
  IGCSE_DT: {
    id: "IGCSE_DT" as const,
    label: "IGCSE Design & Technology",
    criteria: ["AO1", "AO2", "AO3"],
    criteriaLabels: {
      AO1: "Knowledge & Understanding",
      AO2: "Application",
      AO3: "Analysis & Evaluation",
    } as Record<string, string>,
  },
  PLTW: {
    id: "PLTW" as const,
    label: "Project Lead The Way",
    criteria: ["Design", "Build", "Test", "Present"],
    criteriaLabels: {
      Design: "Design Process",
      Build: "Build & Prototype",
      Test: "Test & Evaluate",
      Present: "Present & Defend",
    } as Record<string, string>,
  },
  NESA_DT: {
    id: "NESA_DT" as const,
    label: "NSW Design & Technology",
    criteria: ["DP", "Pr", "Ev"],
    criteriaLabels: {
      DP: "Design Process",
      Pr: "Producing",
      Ev: "Evaluating",
    } as Record<string, string>,
  },
  VIC_DT: {
    id: "VIC_DT" as const,
    label: "Victorian Curriculum D&T",
    criteria: ["TS", "TC", "CDS"],
    criteriaLabels: {
      TS: "Technologies & Society",
      TC: "Technological Contexts",
      CDS: "Creating Design Solutions",
    } as Record<string, string>,
  },
} as const;

export type CurriculumFrameworkId = keyof typeof CURRICULUM_FRAMEWORKS;

// ---------------------------------------------------------------------------
// Framework-Aware Helpers — MYPflex project
// ---------------------------------------------------------------------------

/**
 * Get the criteria definitions for a specific framework, with colors and display info.
 * Returns CriterionDefinition[] for use in grading, Grade tabs, etc.
 */
export function getFrameworkCriteria(framework: CurriculumFrameworkId | string = "IB_MYP"): Record<string, CriterionDefinition> {
  const fw = CURRICULUM_FRAMEWORKS[framework as CurriculumFrameworkId];
  if (!fw) return CRITERIA; // fallback to MYP

  // Build CriterionDefinition records from the framework registry
  const FRAMEWORK_COLORS: Record<string, string[]> = {
    IB_MYP: ["#6366F1", "#10B981", "#F59E0B", "#8B5CF6"],
    GCSE_DT: ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"],
    ACARA_DT: ["#6366F1", "#10B981"],
    A_LEVEL_DT: ["#3B82F6", "#F59E0B", "#10B981"],
    IGCSE_DT: ["#6366F1", "#10B981", "#EF4444"],
    PLTW: ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"],
    NESA_DT: ["#0EA5E9", "#10B981", "#F59E0B"],
    VIC_DT: ["#6366F1", "#10B981", "#F59E0B"],
  };

  const colors = FRAMEWORK_COLORS[framework] || ["#6366F1", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444"];
  const result: Record<string, CriterionDefinition> = {};

  fw.criteria.forEach((key: string, i: number) => {
    result[key] = {
      key,
      name: fw.criteriaLabels[key] || key,
      color: colors[i % colors.length],
      bgClass: "bg-gray-100",
      textClass: "text-gray-700",
    };
  });

  return result;
}

/**
 * Get the grading scale for a specific framework.
 * Falls back to IB_MYP if framework is unknown.
 */
export function getGradingScale(framework: CurriculumFrameworkId | string = "IB_MYP"): GradingScale {
  return GRADING_SCALES[framework as CurriculumFrameworkId] || GRADING_SCALES.IB_MYP;
}

/**
 * Get a single criterion definition by key for a specific framework.
 * Falls back to unit-type criteria, then MYP defaults.
 */
export function getFrameworkCriterion(
  key: string,
  framework: CurriculumFrameworkId | string = "IB_MYP",
  unitType: string = "design"
): CriterionDefinition | undefined {
  const fwCriteria = getFrameworkCriteria(framework);
  return fwCriteria[key] || getCriterion(key, unitType);
}

/**
 * Get ordered criterion keys for a framework (e.g. ["AO1","AO2","AO3","AO4","AO5"] for GCSE).
 */
export function getFrameworkCriterionKeys(framework: CurriculumFrameworkId | string = "IB_MYP"): string[] {
  const fw = CURRICULUM_FRAMEWORKS[framework as CurriculumFrameworkId];
  if (!fw) return getCriterionKeys("design");
  return [...fw.criteria];
}

// ---------------------------------------------------------------------------
// Grading Scales — framework-agnostic scoring configuration
// ---------------------------------------------------------------------------

export interface GradingScale {
  /** Whether the scale uses numbers, letter labels, or percentages */
  type: "numeric" | "letter" | "percentage";
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

export const GRADING_SCALES: Record<string, GradingScale> = {
  IB_MYP: {
    type: "numeric",
    min: 1,
    max: 8,
    step: 1,
    formatDisplay: (v) => `${v}`,
  },
  GCSE_DT: {
    type: "percentage",
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
  A_LEVEL_DT: {
    type: "percentage",
    min: 0,
    max: 100,
    step: 1,
    formatDisplay: (v) => `${v}%`,
  },
  IGCSE_DT: {
    type: "percentage",
    min: 0,
    max: 100,
    step: 1,
    formatDisplay: (v) => `${v}%`,
  },
  PLTW: {
    type: "numeric",
    min: 1,
    max: 4,
    step: 1,
    formatDisplay: (v) => `${v}`,
  },
  NESA_DT: {
    type: "letter",
    min: 1,
    max: 5,
    step: 1,
    labels: ["A", "B", "C", "D", "E"],
    displayAsLabel: true,
    formatDisplay: (v) => (["A", "B", "C", "D", "E"][v - 1] ?? `${v}`),
  },
  VIC_DT: {
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

// ---------------------------------------------------------------------------
// Design Process Phases — Framework-Aware
// ---------------------------------------------------------------------------

/**
 * Get design process phases for a framework.
 * Returns { phases: string[], labels: Record<string, string>, colors: Record<string, string> }
 * Falls back to generic design process phases if framework unknown.
 *
 * All phases are generic slugs that work across frameworks (investigation, ideation, prototyping, evaluation).
 * For non-MYP frameworks, we derive slugs from their vocabulary.
 */
export function getDesignProcessPhases(framework?: string | null): {
  phases: string[];
  labels: Record<string, string>;
  colors: Record<string, string>;
} {
  // Generic phases — work across all frameworks
  const GENERIC_PHASES = ["investigation", "ideation", "prototyping", "evaluation"];
  const GENERIC_LABELS: Record<string, string> = {
    investigation: "Investigation",
    ideation: "Ideation",
    prototyping: "Prototyping",
    evaluation: "Evaluation",
  };
  const GENERIC_COLORS: Record<string, string> = {
    investigation: "text-indigo-600",
    ideation: "text-emerald-600",
    prototyping: "text-orange-600",
    evaluation: "text-amber-600",
  };

  // GCSE, IGCSE use similar 4-phase model
  if (framework && ["GCSE_DT", "IGCSE_DT"].includes(framework)) {
    return {
      phases: ["investigate", "design", "make", "evaluate"],
      labels: {
        investigate: "Investigate",
        design: "Design",
        make: "Make",
        evaluate: "Evaluate",
      },
      colors: {
        investigate: "text-indigo-600",
        design: "text-emerald-600",
        make: "text-orange-600",
        evaluate: "text-amber-600",
      },
    };
  }

  // A-Level has 5 phases
  if (framework === "A_LEVEL_DT") {
    return {
      phases: ["investigate", "develop", "communicate", "make", "evaluate"],
      labels: {
        investigate: "Identify & Investigate",
        develop: "Design Development",
        communicate: "Design Communication",
        make: "Make",
        evaluate: "Test & Evaluate",
      },
      colors: {
        investigate: "text-indigo-600",
        develop: "text-blue-600",
        communicate: "text-emerald-600",
        make: "text-orange-600",
        evaluate: "text-amber-600",
      },
    };
  }

  // ACARA (Australian) uses 4 phases
  if (framework === "ACARA_DT") {
    return {
      phases: ["investigating", "generating", "producing", "evaluating"],
      labels: {
        investigating: "Investigating",
        generating: "Generating",
        producing: "Producing",
        evaluating: "Evaluating",
      },
      colors: {
        investigating: "text-indigo-600",
        generating: "text-emerald-600",
        producing: "text-orange-600",
        evaluating: "text-amber-600",
      },
    };
  }

  // NESA (NSW) uses same 4 phases as ACARA
  if (framework === "NESA_DT") {
    return {
      phases: ["investigating", "designing", "producing", "evaluating"],
      labels: {
        investigating: "Investigating",
        designing: "Designing",
        producing: "Producing",
        evaluating: "Evaluating",
      },
      colors: {
        investigating: "text-indigo-600",
        designing: "text-emerald-600",
        producing: "text-orange-600",
        evaluating: "text-amber-600",
      },
    };
  }

  // VIC (Victorian Curriculum) — 5 phases
  if (framework === "VIC_DT") {
    return {
      phases: ["investigating", "generating", "producing", "evaluating", "managing"],
      labels: {
        investigating: "Investigating",
        generating: "Generating",
        producing: "Producing",
        evaluating: "Evaluating",
        managing: "Collaborating & Managing",
      },
      colors: {
        investigating: "text-indigo-600",
        generating: "text-emerald-600",
        producing: "text-orange-600",
        evaluating: "text-amber-600",
        managing: "text-purple-600",
      },
    };
  }

  // PLTW (Project Lead The Way) — 5 phases
  if (framework === "PLTW") {
    return {
      phases: ["define", "generate", "develop", "construct", "evaluate"],
      labels: {
        define: "Define Problem",
        generate: "Generate Concepts",
        develop: "Develop Solution",
        construct: "Construct & Test",
        evaluate: "Evaluate & Present",
      },
      colors: {
        define: "text-indigo-600",
        generate: "text-blue-600",
        develop: "text-emerald-600",
        construct: "text-orange-600",
        evaluate: "text-amber-600",
      },
    };
  }

  // Default: generic phases for IB_MYP or unknown frameworks
  return {
    phases: GENERIC_PHASES,
    labels: GENERIC_LABELS,
    colors: GENERIC_COLORS,
  };
}
