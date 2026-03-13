/**
 * Lesson Intelligence System — Types
 *
 * Deep pedagogical analysis of uploaded lessons, post-lesson feedback,
 * and on-the-fly lesson adaptation. This powers the RAG-enhanced wizard
 * with structured teaching intelligence rather than raw text snippets.
 */

/* ================================================================
   LESSON PHASE TAXONOMY
   ================================================================ */

/** Granular lesson phase types for design teaching */
export type LessonPhase =
  | "warm_up"
  | "vocabulary"
  | "introduction"
  | "demonstration"
  | "guided_practice"
  | "independent_work"
  | "making" // hands-on construction / fabrication
  | "collaboration"
  | "critique" // peer or teacher feedback
  | "gallery_walk"
  | "presentation"
  | "testing" // testing prototypes / experiments
  | "iteration" // improving based on feedback/testing
  | "reflection"
  | "assessment"
  | "cleanup"
  | "extension"
  | "transition"
  | "station_rotation"; // rotating through workshop stations

/** Bloom's taxonomy cognitive levels */
export type CognitiveLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyse"
  | "evaluate"
  | "create";

/** Teacher's role during a phase */
export type TeacherRole =
  | "direct_instruction" // explicit teaching at the front
  | "modelling" // demonstrating a technique or process
  | "facilitating" // guiding discussion, asking questions
  | "circulating" // moving between students, checking in
  | "observing" // watching and noting, minimal intervention
  | "co-working" // working alongside students
  | "conferencing"; // 1-on-1 or small group conversations

/** Energy/mood states for pacing intelligence */
export type EnergyState =
  | "calm_focus"
  | "curious_exploration"
  | "creative_energy"
  | "high_energy_active"
  | "productive_struggle"
  | "reflective"
  | "collaborative_buzz"
  | "quiet_concentration"
  | "celebratory"
  | "tired_low_energy";

/** Lesson complexity relative to age group */
export type ComplexityLevel =
  | "introductory"
  | "developing"
  | "proficient"
  | "advanced";

/** How deeply a criterion is addressed */
export type CriterionEmphasis = "primary" | "secondary" | "touched";

/** Skill development stage */
export type SkillStage =
  | "introduced"
  | "practiced"
  | "consolidated"
  | "mastered";

/** Lesson type classification */
export type LessonType =
  | "single_lesson"
  | "multi_lesson_sequence"
  | "unit_overview"
  | "activity_template"
  | "assessment_task"
  | "workshop_session"
  | "field_trip"
  | "guest_speaker";

/* ================================================================
   LESSON PROFILE — THE CORE INTELLIGENCE MODEL
   ================================================================ */

/** Differentiation strategy for a single phase */
export interface PhaseDifferentiation {
  extension: string; // for students who finish early / grasp quickly
  support: string; // for students who struggle
  ell_modification?: string; // for English language learners
  sensory_modification?: string; // for students with sensory needs (common in workshops)
}

/** Station rotation details for shared tool/resource phases */
export interface StationRotation {
  stations: number;
  minutes_per_station: number;
  what_others_do: string; // what do non-active students do while waiting?
  rotation_management: string; // how does the teacher signal rotation?
}

/** A single phase within a lesson */
export interface LessonFlowPhase {
  phase: LessonPhase;
  title: string;
  description: string;
  estimated_minutes: number;
  activity_type: string; // e.g., "think-pair-share", "gallery walk", "hands-on making"

  // ─── Teaching Intelligence ───
  pedagogical_purpose: string; // WHY this phase exists at this point
  teacher_role: TeacherRole;
  student_cognitive_level: CognitiveLevel;
  scaffolding_present: string[]; // what supports are provided
  scaffolding_removed: string[]; // what supports from earlier are now withdrawn
  check_for_understanding?: string; // how does the teacher know students get it?
  differentiation?: PhaseDifferentiation;

  // ─── Workshop Specifics ───
  materials_needed?: string[];
  tools_required?: string[];
  tool_setup_time_minutes?: number;
  cleanup_time_minutes?: number;
  safety_considerations?: string[];
  station_rotation?: StationRotation;

  // ─── Energy & Transitions ───
  energy_state: EnergyState;
  transition_from_previous?: string; // how does this connect to what came before?
  transition_to_next?: string; // how does this set up what comes next?

  // ─── Source Mapping ───
  source_text_excerpt?: string; // key excerpt from original doc this maps to
}

/** Criterion analysis with pedagogical reasoning */
export interface CriterionAnalysis {
  criterion: "A" | "B" | "C" | "D";
  emphasis: CriterionEmphasis;
  skill_development: string; // WHAT skill is genuinely developed
  how_developed: string; // HOW the lesson develops it (not just "students do X")
  evidence_from_text: string; // quote showing this
  assessment_embedded: boolean; // is assessment woven into the activity or bolted on?
  assessment_approach?: string; // how is progress being captured?
}

/** Pedagogical approach with reasoning */
export interface PedagogicalApproach {
  primary: string; // "inquiry-based", "project-based", "direct instruction", "design thinking"
  secondary?: string;
  reasoning: string; // why this approach suits this content + age group
}

/** Scaffolding strategy with reasoning */
export interface ScaffoldingStrategy {
  model: string; // "gradual release", "I do / we do / you do", "discovery with guardrails"
  how_supports_are_introduced: string;
  how_supports_are_removed: string;
  reasoning: string;
}

/** Cognitive load analysis */
export interface CognitiveLoadCurve {
  description: string; // "Starts low (vocabulary), peaks mid-lesson (design challenge), settles (reflection)"
  peak_moment: string; // when is the hardest cognitive demand?
  recovery_moment: string; // when do students get a breather?
}

/** Classroom management implications */
export interface ClassroomManagement {
  noise_level_curve: string; // "quiet → moderate → loud (making) → quiet (reflection)"
  movement_required: boolean;
  grouping_progression: string; // "individual → pairs → groups of 4"
  the_5_and_5: string; // how does this lesson handle fast finishers and stragglers?
  behaviour_hotspots?: string; // moments where off-task behaviour is most likely
}

/** Prerequisite with reasoning */
export interface Prerequisite {
  skill_or_knowledge: string;
  why_needed: string;
}

/** Skill developed with depth indication */
export interface SkillDeveloped {
  skill: string;
  to_what_level: SkillStage;
}

/** Energy and sequencing intelligence */
export interface EnergyAndSequencing {
  starts_as: EnergyState;
  ends_as: EnergyState;
  ideal_follows: string; // what kind of lesson should come next?
  avoid_after: string; // what should NOT follow this lesson?
  ideal_time_of_day?: string; // "morning (high energy needed)" or "any"
  ideal_day_of_week?: string; // "not Friday afternoon" etc.
}

/** Strength with reasoning */
export interface AnalysedStrength {
  what: string;
  why_it_works: string;
}

/** Gap with actionable suggestion */
export interface AnalysedGap {
  what: string;
  suggestion: string;
}

/**
 * The complete lesson intelligence profile.
 * Produced by 3-pass AI analysis of an uploaded document.
 */
export interface LessonProfile {
  // ─── Identity ───
  title: string;
  subject_area: string;
  grade_level: string;
  estimated_duration_minutes: number;
  lesson_type: LessonType;

  // ─── Curriculum Alignment (with reasoning) ───
  criteria_analysis: CriterionAnalysis[];

  // ─── Lesson Flow (with pedagogical reasoning) ───
  lesson_flow: LessonFlowPhase[];

  // ─── Pedagogical DNA ───
  pedagogical_approach: PedagogicalApproach;
  scaffolding_strategy: ScaffoldingStrategy;
  cognitive_load_curve: CognitiveLoadCurve;
  classroom_management: ClassroomManagement;

  // ─── Quality Analysis ───
  strengths: AnalysedStrength[];
  gaps: AnalysedGap[];
  complexity_level: ComplexityLevel;

  // ─── Sequencing Intelligence ───
  prerequisites: Prerequisite[];
  skills_developed: SkillDeveloped[];
  energy_and_sequencing: EnergyAndSequencing;
  narrative_role?: string; // if part of a unit, where does this sit in the story arc?

  // ─── Provenance (never discard) ───
  analysis_version: string; // prompt version, so we can re-analyse later
  analysis_model: string; // which AI model was used
  analysis_timestamp: string; // ISO 8601
}

/* ================================================================
   ANALYSIS PIPELINE TYPES
   ================================================================ */

/** Pass 1 output: structural extraction */
export interface Pass1Structure {
  title: string;
  subject_area: string;
  grade_level: string;
  estimated_duration_minutes: number;
  lesson_type: LessonType;

  sections: Array<{
    title: string;
    content_summary: string;
    estimated_minutes: number;
    materials_mentioned: string[];
    tools_mentioned: string[];
    activity_type?: string;
  }>;

  materials_list: string[];
  tools_list: string[];
  criteria_mentioned: string[]; // raw criterion references found
  vocabulary_terms?: string[];
}

/** Pass 2 output: pedagogical analysis */
export interface Pass2Pedagogy {
  pedagogical_approach: PedagogicalApproach;
  scaffolding_strategy: ScaffoldingStrategy;
  cognitive_load_curve: CognitiveLoadCurve;

  phase_analysis: Array<{
    section_title: string; // maps to Pass 1 section
    phase: LessonPhase;
    pedagogical_purpose: string;
    teacher_role: TeacherRole;
    student_cognitive_level: CognitiveLevel;
    scaffolding_present: string[];
    scaffolding_removed: string[];
    check_for_understanding?: string;
    differentiation?: PhaseDifferentiation;
    energy_state: EnergyState;
    transition_notes?: string;
  }>;

  criteria_analysis: CriterionAnalysis[];

  strengths: AnalysedStrength[];
  gaps: AnalysedGap[];
  complexity_level: ComplexityLevel;
}

/** Pass 3 output: design teaching & workshop intelligence */
export interface Pass3DesignTeaching {
  classroom_management: ClassroomManagement;

  workshop_analysis: Array<{
    section_title: string; // maps to Pass 1 section
    safety_considerations: string[];
    setup_time_minutes: number;
    cleanup_time_minutes: number;
    station_rotation?: StationRotation;
    tool_management_notes?: string;
  }>;

  prerequisites: Prerequisite[];
  skills_developed: SkillDeveloped[];
  energy_and_sequencing: EnergyAndSequencing;
  narrative_role?: string;

  // Refinements to previous passes
  timing_adjustments: Array<{
    section_title: string;
    original_minutes: number;
    adjusted_minutes: number;
    reason: string; // e.g., "setup time not accounted for"
  }>;
}

/** Complete analysis result from all 3 passes */
export interface AnalysisResult {
  pass1: Pass1Structure;
  pass2: Pass2Pedagogy;
  pass3: Pass3DesignTeaching;
  profile: LessonProfile; // merged final profile
}

/* ================================================================
   POST-LESSON FEEDBACK — THE LEARNING LOOP
   ================================================================ */

/**
 * Teacher reflection captured after teaching a lesson.
 * This feeds back into the lesson profile to make it smarter over time.
 */
export interface TeacherPostLessonFeedback {
  id?: string;
  lesson_profile_id: string; // which lesson was taught
  unit_id?: string; // if part of a unit
  page_id?: string; // if linked to a specific unit page
  class_id?: string; // which class was it taught to
  taught_at: string; // ISO 8601 — when was this taught

  // ─── Quick Capture (teacher fills in 60 seconds) ───
  overall_rating: 1 | 2 | 3 | 4 | 5;
  went_well: string[]; // bullet points — what worked
  to_change: string[]; // bullet points — what to change next time
  student_engagement: "low" | "mixed" | "good" | "excellent";

  // ─── Timing Reality ───
  actual_duration_minutes: number; // how long did it actually take?
  timing_notes?: Array<{
    phase_title: string; // which phase
    planned_minutes: number;
    actual_minutes: number;
    note?: string; // e.g., "students needed more time for testing"
  }>;

  // ─── Contextual Factors ───
  time_of_day?: string; // "period 1", "after lunch", etc.
  day_of_week?: string;
  class_energy?: EnergyState; // how was the class mood?
  class_size?: number;
  absent_count?: number;
  contextual_notes?: string; // "fire drill interrupted", "substitute teacher", etc.

  // ─── Specific Observations ───
  differentiation_worked?: boolean;
  differentiation_notes?: string;
  scaffolding_observations?: string; // "students didn't need the template by round 3"
  misconceptions_observed?: string[]; // common mistakes or misunderstandings
  unexpected_successes?: string[]; // things that worked better than expected
  student_questions?: string[]; // notable questions students asked

  // ─── For Next Time ───
  modifications_for_next_time: string[]; // concrete changes
  would_use_again: boolean;
  recommended_for_grade?: string; // "better suited to Year 8 than Year 9"
}

/**
 * Student reflection captured at the end of a lesson/page.
 * Quick, minimal friction — students shouldn't spend more than 30 seconds.
 */
export interface StudentPostLessonFeedback {
  id?: string;
  lesson_profile_id?: string;
  unit_id?: string;
  page_id?: string;
  student_id: string;
  submitted_at: string;

  // ─── Quick Pulse (30 seconds max) ───
  understanding: 1 | 2 | 3 | 4 | 5; // "How well do you understand?" (emoji scale)
  engagement: 1 | 2 | 3 | 4 | 5; // "How interesting was today?" (emoji scale)
  pace: "too_slow" | "just_right" | "too_fast";

  // ─── Optional Quick Text (one sentence each) ───
  highlight?: string; // "The best part was..."
  struggle?: string; // "I found it hard to..."
  want_more?: string; // "I wish we had more time for..."
}

/**
 * Aggregated feedback from an entire class for a lesson.
 * Computed from individual teacher + student feedback.
 */
export interface AggregatedLessonFeedback {
  lesson_profile_id: string;
  times_taught: number;

  // ─── Teacher Aggregates ───
  avg_teacher_rating: number;
  common_went_well: string[]; // most frequently mentioned positives
  common_to_change: string[]; // most frequently mentioned changes
  avg_actual_duration_minutes: number;
  engagement_distribution: Record<string, number>; // { "excellent": 3, "good": 5, ... }

  // ─── Student Aggregates ───
  avg_understanding: number;
  avg_engagement: number;
  pace_distribution: Record<string, number>; // { "too_slow": 2, "just_right": 20, "too_fast": 5 }
  common_highlights: string[];
  common_struggles: string[];

  // ─── Derived Intelligence ───
  timing_reality: Array<{
    phase_title: string;
    planned_minutes: number;
    avg_actual_minutes: number; // averaged across all times taught
    variance: number; // how much does timing vary?
  }>;

  best_conditions: {
    time_of_day?: string; // "works best in the morning"
    class_size_range?: string; // "best with 20-25 students"
    energy_recommendation?: string; // "teach after a calmer lesson"
  };

  evolution_notes: string; // AI-generated summary of how this lesson has evolved
}

/* ================================================================
   ON-THE-FLY LESSON MODIFICATION
   ================================================================ */

/**
 * Context provided when a teacher requests a quick modification.
 * The system knows most of this already — teacher just describes the situation.
 */
export interface QuickModifyContext {
  // ─── What the teacher types ───
  teacher_prompt: string; // "Friday afternoon, need quiet work for last 30 mins"

  // ─── Auto-populated from system context ───
  current_unit_id?: string;
  current_page_id?: string; // where students are in the unit
  class_id?: string;
  student_count?: number;
  current_time?: string; // ISO 8601

  // ─── Derived from unit + class data ───
  unit_title?: string;
  unit_subject?: string;
  unit_grade?: string;
  pages_completed?: string[]; // which pages students have finished
  current_criterion?: string; // what criterion they're working on
  next_scheduled_page?: string; // what was supposed to come next
  recent_activities?: string[]; // what they've done in the last 2-3 lessons

  // ─── Full teaching context (school + teacher + cohort) ───
  teaching_context?: TeachingContext;
}

/**
 * Result of a quick modify request.
 * A ready-to-teach mini-lesson adapted to the situation.
 */
export interface QuickModifyResult {
  // ─── The Modified Activity ───
  title: string;
  description: string;
  estimated_minutes: number;
  type: "replacement" | "extension" | "filler" | "wind_down" | "energiser";

  // ─── Lesson Flow ───
  flow: Array<{
    phase: LessonPhase;
    title: string;
    instructions: string; // what to tell students
    teacher_notes: string; // what the teacher should do
    minutes: number;
    materials_needed?: string[];
  }>;

  // ─── Context Awareness ───
  how_this_connects: string; // how this relates to the unit they're working on
  what_students_produce?: string; // is there any portfolio-worthy output?
  criterion_alignment?: string; // does this contribute to any criterion?

  // ─── Reasoning ───
  why_this_works: string; // "Friday afternoon + last 30 mins = low energy, so quiet reflective work..."
  alternative_if_not_working: string; // quick pivot if students aren't responding
}

/* ================================================================
   UNIT NARRATIVE ARC — FOR WIZARD GENERATION
   ================================================================ */

/** The story arc structure for a unit */
export interface UnitNarrativeArc {
  unit_title: string;
  unit_subject: string;
  unit_grade: string;
  total_weeks: number;
  total_lessons: number;

  acts: Array<{
    act_number: number;
    title: string; // e.g., "The Inciting Incident"
    criteria: string[]; // which criteria are primary
    weeks: string; // e.g., "Week 1-2"
    mood_arc: string; // e.g., "Curiosity → concern → motivation"
    narrative: string; // what happens in this act
    energy_curve: string; // how energy flows across lessons in this act
    key_turning_point?: string; // the pivotal moment
  }>;

  // ─── Cross-cutting threads ───
  scaffolding_arc: string; // how scaffolding evolves across the unit
  autonomy_arc: string; // how student independence grows
  assessment_arc: string; // how evidence builds toward summative
  tools_progression: string[]; // tools introduced in order
}

/* ================================================================
   TEACHING CONTEXT — SCHOOL + TEACHER + COHORT SETTINGS
   Feeds into analysis prompts, wizard generation, and quick-modify.
   Stored per-teacher (school context) with per-class overrides.
   ================================================================ */

/** School type classification */
export type SchoolType =
  | "co_ed"
  | "boys"
  | "girls"
  | "single_sex_with_co_ed_sixth_form";

/** School setting */
export type SchoolSetting =
  | "urban"
  | "suburban"
  | "rural"
  | "remote";

/** Behavioural framework used by the school */
export type BehaviouralFramework =
  | "restorative_justice"
  | "pbis" // Positive Behavioural Interventions and Supports
  | "merit_demerit"
  | "house_points"
  | "growth_mindset"
  | "trauma_informed"
  | "other";

/**
 * School-level context — set once during onboarding, rarely changes.
 * Affects how lessons are analysed, generated, and adapted.
 */
export interface SchoolContext {
  // ─── Identity ───
  school_name?: string;
  school_type: SchoolType;
  school_setting: SchoolSetting;
  country: string; // ISO 3166-1 alpha-2 (e.g., "AE", "NZ", "GB")
  region?: string; // state/province/emirate for curriculum specificity

  // ─── Curriculum ───
  curriculum_framework: string; // "IB_MYP", "GCSE_DT", "ACARA_DT", "PLTW", etc.
  grading_system?: string; // "1-8 MYP", "9-1 GCSE", "A-E", etc.

  // ─── Timetable ───
  typical_period_minutes: number; // 35, 45, 50, 60, 80, etc.
  has_double_periods: boolean;
  double_period_minutes?: number;
  periods_per_week?: number; // how many design periods per week per class
  academic_year_start_month?: number; // 1=Jan (southern hemisphere), 9=Sep (northern)

  // ─── Class Sizes ───
  typical_class_size: number;
  max_class_size?: number;

  // ─── Facilities & Equipment ───
  workshop_spaces: string[]; // e.g., ["main workshop", "CAD lab", "textiles room"]
  available_tools: string[]; // e.g., ["laser cutter x2", "3D printer x3", "sewing machines x10"]
  available_software: string[]; // e.g., ["TinkerCAD", "Fusion 360", "Adobe Illustrator"]
  material_budget_notes?: string; // e.g., "limited consumables budget", "students buy own materials"

  // ─── Culture & Behaviour ───
  behavioural_framework: BehaviouralFramework;
  cultural_considerations: string[]; // e.g., ["Ramadan fasting affects energy", "no pork/leather materials", "modest dress for practical work"]
  religious_observances?: string[]; // e.g., ["prayer times", "Friday assembly", "chapel"]
  language_of_instruction: string; // e.g., "English", "Arabic/English bilingual"

  // ─── Safety & Compliance ───
  safety_certification_required: boolean;
  safety_framework?: string; // e.g., "CLEAPSS", "school-specific", "state requirement"
  mandatory_ppe?: string[]; // e.g., ["safety glasses", "aprons"]
  tool_age_restrictions?: Record<string, number>; // e.g., { "laser cutter": 12, "band saw": 14 }
}

/**
 * Teacher-level preferences — personalises the AI's output style.
 * Set during onboarding, evolved over time.
 */
export interface TeacherPreferences {
  // ─── Teaching Style ───
  years_experience?: number;
  preferred_pedagogical_approach?: string; // "I lean towards inquiry-based"
  classroom_management_style?: string; // "relaxed workshop", "structured rotations", "student-led"
  favourite_activities?: string[]; // activities they love and want the AI to suggest more of
  activities_to_avoid?: string[]; // "I don't do gallery walks" etc.

  // ─── Subjects & Levels ───
  subjects_taught: string[]; // e.g., ["Product Design", "Systems & Control", "Digital Design"]
  grade_levels_taught: string[]; // e.g., ["MYP 3", "MYP 4", "MYP 5"]

  // ─── Communication ───
  instruction_language_level?: string; // "simple and direct" vs "academic vocabulary"
  humour_in_lessons?: boolean; // some teachers want playful tone, others formal
  preferred_lesson_length?: number; // override school default if they have flexibility

  // ─── Assessment Preferences ───
  preferred_assessment_style?: string; // "embedded/invisible", "formal checkpoints", "portfolio-based"
  rubric_style?: string; // "MYP criteria descriptors", "simplified student-friendly", etc.
}

/**
 * Class cohort context — per-class overrides for student demographics.
 * Teachers set this per class, AI adapts content presentation accordingly.
 */
export interface ClassCohortContext {
  class_id: string;
  class_name?: string; // e.g., "9B Design"

  // ─── Demographics ───
  student_count: number;
  ell_proportion?: "none" | "few" | "some" | "many" | "majority";
  predominant_ell_level?: "beginner" | "intermediate" | "advanced";
  sen_considerations?: string[]; // e.g., ["3 students with ADHD", "1 student with visual impairment"]
  ability_range?: "narrow" | "mixed" | "wide"; // how varied the class is

  // ─── Behavioural Notes ───
  energy_profile?: string; // "high energy class", "quiet and compliant", "chatty but productive"
  behaviour_notes?: string; // "two students need separated seating", "post-lunch = low energy"
  grouping_constraints?: string; // "avoid X with Y", "must have mixed ability tables"

  // ─── Cultural & Social ───
  cultural_notes?: string[]; // class-specific cultural sensitivities
  social_dynamics?: string; // "strong friendship groups", "new students integrating"

  // ─── Prior Knowledge ───
  prior_tools_used?: string[]; // tools this class has been certified on
  prior_software_used?: string[]; // software they've used before
  skills_at_entry?: string; // "most can use a ruler and craft knife; half have used CAD"
}

/**
 * Complete teaching context — combines all three layers.
 * Fed into analysis prompts, wizard generation, and quick-modify.
 */
export interface TeachingContext {
  school: SchoolContext;
  teacher: TeacherPreferences;
  cohort?: ClassCohortContext; // optional — populated when generating for a specific class
}

/**
 * Partial teaching context — all fields optional.
 * Used when teacher profile may be partially filled or missing.
 * Fed into upload analysis pipeline to enrich AI prompts.
 */
export interface PartialTeachingContext {
  schoolContext?: Partial<SchoolContext>;
  teacherPreferences?: Partial<TeacherPreferences>;
  schoolName?: string;
  country?: string;
  curriculumFramework?: string;
  typicalPeriodMinutes?: number;
  subjectsTaught?: string[];
  gradeLevelsTaught?: string[];
}

/* ================================================================
   DATABASE ROW TYPES (for Supabase)
   ================================================================ */

/* ================================================================
   QUALITY EVALUATOR — POST-GENERATION VALIDATION
   Scores generated content against 10 design pedagogy principles.
   ================================================================ */

/** The 10 non-negotiable pedagogy principles for design education */
export type PedagogyPrinciple =
  | "iteration"
  | "productive_failure"
  | "diverge_converge"
  | "scaffolding_fade"
  | "process_assessment"
  | "critique_culture"
  | "digital_physical_balance"
  | "differentiation"
  | "metacognitive_framing"
  | "safety_culture";

/** Score for a single pedagogy principle */
export interface PrincipleScore {
  principle: PedagogyPrinciple;
  score: number;                  // 0-10
  present: boolean;               // is this principle addressed at all?
  issue?: string;                 // what's wrong (if score < 7)
  suggestion?: string;            // how to fix it
}

/** Complete quality evaluation report for a generated unit/lesson */
export interface QualityReport {
  overallScore: number;           // 0-100
  principleScores: PrincipleScore[];
  warnings: string[];             // yellow — teacher should review
  criticalIssues: string[];       // red — should not ship as-is
  timingAnalysis?: {
    totalMinutes: number;
    expectedMinutes: number;
    variance: number;             // percentage over/under
  };
  portfolioCaptureCount: number;  // how many activities have portfolioCapture: true
  evaluatedAt: string;            // ISO 8601
  modelVersion: string;           // which model was used
}

/** Row type for lesson_profiles table */
export interface LessonProfileRow {
  id: string;
  teacher_id: string;
  upload_id: string | null;

  title: string;
  subject_area: string | null;
  grade_level: string | null;
  estimated_duration_minutes: number | null;
  lesson_type: string;

  pedagogical_approach: string | null;
  scaffolding_model: string | null;
  complexity_level: string | null;
  criteria_covered: string[];

  profile_data: LessonProfile;
  raw_extracted_text: string;
  analysis_version: string;
  analysis_model: string;

  teacher_verified: boolean;
  teacher_corrections: Record<string, unknown> | null;
  times_referenced: number;
  teacher_quality_rating: number | null;

  created_at: string;
  updated_at: string;
}

/** Row type for lesson_feedback table */
export interface LessonFeedbackRow {
  id: string;
  lesson_profile_id: string;
  teacher_id: string;
  unit_id: string | null;
  page_id: string | null;
  class_id: string | null;
  feedback_type: "teacher" | "student";
  feedback_data: TeacherPostLessonFeedback | StudentPostLessonFeedback;
  created_at: string;
}
