/**
 * New Metrics (Melbourne Metrics) — Constants & Reference Data
 *
 * University of Melbourne competency framework.
 * 7 competencies, each with elements, 5-level progressions.
 * StudioLoom starts with Agency in Learning for the trial.
 */

// ---------------------------------------------------------------------------
// Competencies
// ---------------------------------------------------------------------------

export interface NMCompetency {
  id: string;
  name: string;
  description: string;
}

export const NM_COMPETENCIES: NMCompetency[] = [
  { id: "agency_in_learning", name: "Agency in Learning", description: "The capacity to produce learning of value to self or community" },
  { id: "acting_ethically", name: "Acting Ethically", description: "The capacity to act with moral integrity" },
  { id: "active_citizenship", name: "Active Citizenship", description: "The capacity to contribute to civic life" },
  { id: "communication", name: "Communication", description: "The capacity to convey and exchange meaning effectively" },
  { id: "collaboration", name: "Collaboration", description: "The capacity to work with others toward shared goals" },
  { id: "quality_thinking", name: "Quality Thinking", description: "The capacity to think critically and creatively" },
  { id: "personal_development", name: "Personal Development", description: "The capacity to understand and develop oneself" },
];

// ---------------------------------------------------------------------------
// Elements of Agency in Learning
// ---------------------------------------------------------------------------

export interface NMElement {
  id: string;
  name: string;
  definition: string;
  /** Plain-English version students see */
  studentDescription: string;
  /** Colour for UI — matches the Melbourne kit colour tiles */
  color: string;
}

export const AGENCY_ELEMENTS: NMElement[] = [
  {
    id: "acting_with_autonomy",
    name: "Acting with Autonomy",
    definition: "The ability to govern one's own actions",
    studentDescription: "Making your own choices about how to learn",
    color: "#4A90D9", // blue
  },
  {
    id: "acting_with_courage",
    name: "Acting with Courage",
    definition: "The ability to act in the pursuit of a worthwhile goal in the face of adversity",
    studentDescription: "Trying things even when they feel risky or uncomfortable",
    color: "#2D5DA1", // dark blue
  },
  {
    id: "being_open_to_the_new",
    name: "Being Open to the New",
    definition: "The ability to embrace or harness new ideas, experiences and ways of doing things",
    studentDescription: "Being willing to try new ideas and approaches",
    color: "#00A693", // teal
  },
  {
    id: "being_reflective",
    name: "Being Reflective",
    definition: "The ability to evaluate and learn from experience",
    studentDescription: "Thinking about what worked and what didn't",
    color: "#E8584F", // red
  },
  {
    id: "building_social_alliances",
    name: "Building Social Alliances",
    definition: "The ability to build social networks or groups to learn, grow or achieve a purpose",
    studentDescription: "Working with others to learn and grow",
    color: "#D4457E", // pink
  },
  {
    id: "demonstrating_drive",
    name: "Demonstrating Drive",
    definition: "The ability to propel the pursuit of social, personal or community ambitions",
    studentDescription: "Pushing yourself to do your best work",
    color: "#F5A623", // orange
  },
  {
    id: "developing_skill_or_craft",
    name: "Developing Skill or Craft",
    definition: "The ability to hone, sharpen, polish or improve skill or craft",
    studentDescription: "Getting better at making and designing things",
    color: "#7B61FF", // purple
  },
  {
    id: "engaging_in_dialogue",
    name: "Engaging in Dialogue",
    definition: "The ability to engage in dialogue to connect to others, explore, negotiate meaning, or develop new perspectives",
    studentDescription: "Talking with others to share and develop ideas",
    color: "#50C878", // green
  },
  {
    id: "generating_feedback_loops",
    name: "Generating Feedback Loops",
    definition: "The ability to generate and use feedback for improved performance",
    studentDescription: "Seeking and using feedback to improve",
    color: "#8B5E3C", // brown
  },
  {
    id: "managing_ambiguity_or_uncertainty",
    name: "Managing Ambiguity or Uncertainty",
    definition: "The ability to operate in the face of things that are unknown, uncertain, or undecidable",
    studentDescription: "Staying comfortable when things are unclear",
    color: "#607D8B", // gray-blue
  },
  {
    id: "striving_for_mastery",
    name: "Striving for Mastery",
    definition: "The ability to develop deep expertise in a field or domain",
    studentDescription: "Going deep into a topic or skill",
    color: "#9C27B0", // deep purple
  },
  {
    id: "using_reason",
    name: "Using Reason",
    definition: "The ability to use thinking skills to explain, argue, analyse or evaluate",
    studentDescription: "Using evidence and logic to make decisions",
    color: "#CDDC39", // lime
  },
];

// Quick lookup maps
export const AGENCY_ELEMENT_MAP = Object.fromEntries(
  AGENCY_ELEMENTS.map((e) => [e.id, e])
) as Record<string, NMElement>;

export const NM_COMPETENCY_MAP = Object.fromEntries(
  NM_COMPETENCIES.map((c) => [c.id, c])
) as Record<string, NMCompetency>;

// ---------------------------------------------------------------------------
// Rating scales
// ---------------------------------------------------------------------------

export interface RatingOption {
  value: number;
  label: string;
  description: string;
}

/** Student self-assessment: 3-point */
export const STUDENT_RATING_SCALE: RatingOption[] = [
  { value: 1, label: "This was hard for me", description: "I found this challenging" },
  { value: 2, label: "I'm getting there", description: "I'm developing in this area" },
  { value: 3, label: "I did this well", description: "I feel confident about this" },
];

/** Teacher observation: 4-point broad development scale */
export const TEACHER_RATING_SCALE: RatingOption[] = [
  { value: 1, label: "Emerging", description: "Responds to structure and guidance" },
  { value: 2, label: "Developing", description: "Engages with support and encouragement" },
  { value: 3, label: "Applying", description: "Independently applies the element" },
  { value: 4, label: "Extending", description: "Initiates, leads, and goes beyond" },
];

// ---------------------------------------------------------------------------
// Progression levels (per competency, year-band specific)
// ---------------------------------------------------------------------------

export interface ProgressionLevel {
  level: number;
  name: string;
  statement: string;
}

/** Year 5-8 progression for Agency in Learning */
export const AGENCY_PROGRESSION_5_8: ProgressionLevel[] = [
  { level: 1, name: "The Directed Learner", statement: "Uses guidance from others to support participation in learning" },
  { level: 2, name: "The Diligent Learner", statement: "Learns by interpreting and following instructions, looking for guidance on what and how to learn" },
  { level: 3, name: "The Self-Regulated Learner", statement: "Skilled achiever who aspires to reach standards, making informed and deliberate decisions about learning" },
  { level: 4, name: "The Extended Learner", statement: "Motivated to learn independently and from others, engaging with ideas and challenges to deepen understanding" },
  { level: 5, name: "The Unbound Learner", statement: "Applies themselves relentlessly to learning, creative producer of knowledge seeking to deepen and expand capability" },
];

/** Year 9-12 progression for Agency in Learning */
export const AGENCY_PROGRESSION_9_12: ProgressionLevel[] = [
  { level: 1, name: "The Directed Learner", statement: "Uses guidance from others to support participation in learning" },
  { level: 2, name: "The Diligent Learner", statement: "Learns by interpreting and following instructions, looking for guidance on what and how to learn" },
  { level: 3, name: "The Self-Regulated Learner", statement: "Skilled achiever who aspires to reach standards, making informed and deliberate decisions about learning" },
  { level: 4, name: "The Extended Learner", statement: "Motivated to learn independently and from others, engaging with ideas and challenges to deepen understanding" },
  { level: 5, name: "The Unbound Learner", statement: "Creative producer of knowledge, constantly seeking to deepen and expand real-world competence in domains of interest" },
];

// ---------------------------------------------------------------------------
// NM Config types (stored in units.nm_config JSONB)
// ---------------------------------------------------------------------------

export interface NMCheckpointConfig {
  /** Which elements to assess at this checkpoint */
  elements: string[];
}

export interface NMUnitConfig {
  enabled: boolean;
  competencies: string[];
  elements: string[];
  /** Map of page ID → checkpoint config */
  checkpoints: Record<string, NMCheckpointConfig>;
}

export const DEFAULT_NM_CONFIG: NMUnitConfig = {
  enabled: false,
  competencies: ["agency_in_learning"],
  elements: [],
  checkpoints: {},
};

// ---------------------------------------------------------------------------
// Assessment record type (matches DB shape)
// ---------------------------------------------------------------------------

export interface CompetencyAssessment {
  id: string;
  student_id: string;
  unit_id: string;
  page_id: string | null;
  competency: string;
  element: string;
  source: "student_self" | "teacher_observation";
  rating: number;
  comment: string | null;
  context: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get elements for a given competency (currently only Agency is fully defined) */
export function getElementsForCompetency(competencyId: string): NMElement[] {
  if (competencyId === "agency_in_learning") return AGENCY_ELEMENTS;
  // Other competencies — return empty for now, will be populated as kits arrive
  return [];
}

/** Get progression for a year band */
export function getProgression(competencyId: string, yearBand: "5-8" | "9-12"): ProgressionLevel[] {
  if (competencyId === "agency_in_learning") {
    return yearBand === "5-8" ? AGENCY_PROGRESSION_5_8 : AGENCY_PROGRESSION_9_12;
  }
  return [];
}

/** Derive a suggested progression level from teacher observation ratings */
export function suggestProgressionLevel(
  ratings: { element: string; rating: number }[]
): number | null {
  if (ratings.length === 0) return null;
  const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
  // Teacher scale 1-4 maps roughly to progression levels 1-5
  // Emerging (1) → Level 1-2, Developing (2) → Level 2-3, Applying (3) → Level 3-4, Extending (4) → Level 4-5
  if (avg <= 1.5) return 1;
  if (avg <= 2.0) return 2;
  if (avg <= 2.75) return 3;
  if (avg <= 3.5) return 4;
  return 5;
}
