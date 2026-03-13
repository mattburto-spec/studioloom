/**
 * Curriculum Data Layers
 *
 * Three critical data structures the AI needs for intelligent generation:
 * 1. CurriculumFramework — what are the actual standards, descriptors, and command terms?
 * 2. ScopeAndSequence — what's the year plan, unit order, and skill progression?
 * 3. AcademicCalendar — what's the term structure, holidays, and events?
 *
 * These are data-capture types. The AI model uses them as context for
 * lesson analysis, unit generation, and contextual adaptation.
 * DB tables will follow when onboarding/settings UI is built.
 */

/* ================================================================
   CURRICULUM FRAMEWORK — STANDARDS & DESCRIPTORS
   The actual criteria text, achievement bands, and command terms
   that the AI needs to assess alignment quality.
   ================================================================ */

/**
 * A single strand objective within a criterion.
 * e.g., MYP Criterion A strand i: "explain and justify the need for a solution"
 *
 * Strand text often varies by year group — Year 1 says "outline" where
 * Year 5 says "explain and justify." The AI must know the difference.
 */
export interface StrandObjective {
  strand_number: number; // i=1, ii=2, iii=3, iv=4
  strand_label: string; // "i", "ii", "iii", "iv" or "AO1a", "AO1b"

  /**
   * Descriptor text per year group.
   * Key is the year group identifier (e.g., "1-3", "4-5" for MYP phase grouping,
   * or "10", "11" for GCSE years).
   * Value is the actual strand text for that year group.
   */
  descriptors_by_year_group: Record<string, string>;

  /** Fallback descriptor if no year-group-specific one matches */
  default_descriptor: string;
}

/**
 * Achievement level band within a criterion.
 * e.g., MYP levels 7-8 = "Excellent"
 */
export interface AchievementBand {
  level_range: [number, number]; // [1, 2], [3, 4], [5, 6], [7, 8]
  label: string; // "Limited", "Adequate", "Substantial", "Excellent"

  /**
   * General band descriptor — what does this level look like?
   * e.g., "The student demonstrates excellent critical and creative thinking"
   */
  general_descriptor: string;

  /**
   * Per-strand descriptors — what does this level look like for each strand?
   * Key is strand_number, value is the descriptor text.
   * e.g., strand 1 at 7-8: "explains and justifies the need for a solution
   * to a problem for a specified client/target audience"
   */
  strand_descriptors?: Record<number, string>;
}

/**
 * Complete criterion definition with strands and achievement bands.
 * This is the heart of what the AI needs — the actual standards text.
 */
export interface CriterionDefinition {
  criterion_key: string; // "A", "B", "C", "D" or "AO1", "AO2"
  criterion_name: string; // "Inquiring & Analysing"
  max_score: number; // 8 for MYP, varies for GCSE
  strands: StrandObjective[];
  achievement_bands: AchievementBand[];
}

/**
 * Command term with definition and cognitive level.
 * MYP has specific command terms (analyse, evaluate, justify, etc.)
 * that carry precise meanings the AI must respect.
 */
export interface CommandTerm {
  term: string; // "analyse", "evaluate", "justify", "outline"
  definition: string; // IB's official definition
  cognitive_level: "remember" | "understand" | "apply" | "analyse" | "evaluate" | "create";
  /** Example usage in a design context */
  example?: string;
}

/**
 * Complete curriculum framework — all the standards data for one framework.
 * Populated from official curriculum documents.
 * The AI uses this to:
 * - Generate assessment tasks at the right cognitive level
 * - Evaluate whether a lesson genuinely develops criterion skills (not just mentions them)
 * - Produce appropriate rubric language for student-facing pages
 * - Differentiate expectations by year group
 */
export interface CurriculumFramework {
  id: string; // "IB_MYP_DESIGN", "GCSE_AQA_DT", "ACARA_DT_7_10"
  name: string; // "IB MYP Design"
  organisation: string; // "IBO", "AQA", "ACARA"
  country: string; // "international", "GB", "AU"

  /** Year groups this framework covers */
  year_groups: YearGroup[];

  /** Full criterion definitions with strands and achievement bands */
  criteria: CriterionDefinition[];

  /** Official command terms and definitions */
  command_terms: CommandTerm[];

  /** Assessment weighting per criterion (if applicable) */
  assessment_weighting?: Record<string, number>; // e.g., { "A": 25, "B": 25, "C": 25, "D": 25 }

  /** Framework-specific pedagogy notes the AI should know */
  pedagogy_notes?: string; // e.g., "MYP emphasises inquiry-based learning and the design cycle"

  /** Version/year of the framework (curricula get updated) */
  framework_version?: string; // e.g., "2024", "First teaching 2025"
}

/** Year group definition */
export interface YearGroup {
  id: string; // "MYP1", "MYP4", "Year10"
  label: string; // "MYP Year 1 (Grade 6)"
  age_range: [number, number]; // [11, 12]
  /** Phase grouping — some frameworks group years for descriptor purposes */
  phase?: string; // "1-3" or "4-5" for MYP
}

/* ================================================================
   SCOPE AND SEQUENCE — THE YEAR PLAN
   How units connect, what skills build on what, and
   what's been taught vs what's coming.
   ================================================================ */

/**
 * A single unit's position in the year plan.
 * The AI uses this to:
 * - Avoid repeating contexts/topics from earlier units
 * - Build on skills already introduced
 * - Plan appropriate tool progression
 * - Generate smooth narrative transitions between units
 */
export interface UnitPlacement {
  position: number; // order in the year (1, 2, 3...)
  term_id: string; // which term this falls in

  /** Linked unit (if created in the system) */
  unit_id?: string;

  // ─── Planning data (filled before unit is created) ───
  title: string;
  topic: string;
  duration_weeks: number;
  start_week?: number; // which week of the term

  // ─── Curriculum alignment ───
  criteria_focus: string[]; // primary criteria for this unit
  criteria_emphasis?: Record<string, "light" | "standard" | "emphasis">;
  key_concept: string;
  global_context: string;
  related_concepts?: string[];
  statement_of_inquiry?: string;

  // ─── Skill & tool progression ───
  skills_introduced: string[]; // new skills first taught in this unit
  skills_practiced: string[]; // skills from previous units being reinforced
  skills_assessed: string[]; // skills formally assessed in this unit
  tools_introduced: string[]; // new tools/machines/software first used
  tools_used: string[]; // previously introduced tools used again

  // ─── Sequencing intelligence ───
  prerequisites: string[]; // what must be covered before this unit
  builds_on?: string; // which earlier unit this directly extends
  feeds_into?: string; // which later unit this prepares for

  // ─── Notes ───
  notes?: string;
  summative_task_description?: string;
}

/**
 * Tracks how a specific skill progresses across the year.
 * The AI uses this to know: "CAD was introduced in Unit 2 at 'introduced' level,
 * so by Unit 4 it can assume 'practiced' and reduce scaffolding."
 */
export interface SkillProgression {
  skill: string; // e.g., "CAD modelling", "Soldering", "User research"
  type: "practical" | "cognitive" | "social"; // tool skill vs thinking skill vs collaboration

  /** Unit positions where this skill appears, with depth */
  progression: Array<{
    unit_position: number;
    level: "introduced" | "practiced" | "consolidated" | "assessed";
    notes?: string; // "Students learn 2D CAD only" or "Full independent use expected"
  }>;
}

/**
 * The complete scope and sequence for one class/grade for one academic year.
 * This is what a teacher plans at the start of the year.
 */
export interface ScopeAndSequence {
  id: string;
  teacher_id: string;
  academic_year: string; // "2025-2026"
  curriculum_framework: string; // "IB_MYP_DESIGN", links to CurriculumFramework.id
  grade_level: string; // "MYP Year 4 (Grade 9)"

  /** Optional — scope can be per-class or per-grade */
  class_id?: string;

  /** Unit sequence for the year */
  units: UnitPlacement[];

  /** How skills build across the year */
  skill_progressions: SkillProgression[];

  /** Overall year-level goals */
  year_goals?: string[];

  /** Big ideas / themes that thread through the year */
  thematic_threads?: string[]; // e.g., "sustainability", "user-centred design"

  created_at: string;
  updated_at: string;
}

/* ================================================================
   ACADEMIC CALENDAR — TERMS, HOLIDAYS, EVENTS
   When things happen. Affects pacing, energy, assessment windows.
   ================================================================ */

/**
 * An academic term or semester.
 */
export interface AcademicTerm {
  id: string;
  name: string; // "Term 1", "Semester 1", "Fall", "Michaelmas"
  start_date: string; // ISO 8601
  end_date: string;
  teaching_weeks: number; // actual teaching weeks (excluding holidays within the term)
}

/**
 * A holiday or break period.
 */
export interface Holiday {
  name: string; // "Winter Break", "Eid al-Fitr", "Half Term"
  start_date: string;
  end_date: string;
  /** Does this fall within a term (mid-term break) or between terms? */
  type: "between_terms" | "mid_term" | "public_holiday" | "teacher_only";
}

/**
 * A school event that affects scheduling.
 * The AI needs to know about these to plan realistic pacing:
 * "Don't schedule a heavy making session during exhibition week."
 */
export interface SchoolEvent {
  name: string;
  date: string; // ISO 8601
  end_date?: string; // for multi-day events
  type:
    | "exam_period" // formal assessments
    | "exhibition" // design/art exhibitions (common in IB schools)
    | "parent_conference"
    | "professional_development" // teacher PD — no classes
    | "sports_day"
    | "field_trip"
    | "assembly" // shortened timetable
    | "guest_speaker"
    | "community_service"
    | "other";
  affects_classes?: string[]; // which class IDs are affected (empty = all)
  notes?: string;
  /** How many teaching periods are lost? */
  periods_lost?: number;
}

/**
 * The complete academic calendar for one school year.
 * Teacher sets this once; it affects all pacing calculations.
 */
export interface AcademicCalendar {
  id: string;
  teacher_id: string;
  academic_year: string; // "2025-2026"
  terms: AcademicTerm[];
  holidays: Holiday[];
  events: SchoolEvent[];

  /** Total teaching weeks in the year (auto-calculated from terms) */
  total_teaching_weeks: number;

  created_at: string;
  updated_at: string;
}

/* ================================================================
   DATABASE ROW TYPES (for future migrations)
   ================================================================ */

/** Row type for scope_and_sequences table */
export interface ScopeAndSequenceRow {
  id: string;
  teacher_id: string;
  academic_year: string;
  curriculum_framework: string;
  grade_level: string;
  class_id: string | null;
  data: ScopeAndSequence; // full JSONB
  created_at: string;
  updated_at: string;
}

/** Row type for academic_calendars table */
export interface AcademicCalendarRow {
  id: string;
  teacher_id: string;
  academic_year: string;
  data: AcademicCalendar; // full JSONB
  created_at: string;
  updated_at: string;
}

/** Row type for curriculum_frameworks table (if we store custom frameworks) */
export interface CurriculumFrameworkRow {
  id: string;
  framework_id: string; // "IB_MYP_DESIGN"
  data: CurriculumFramework; // full JSONB
  is_system: boolean; // true = shipped with the app, false = teacher-customised
  created_at: string;
}
