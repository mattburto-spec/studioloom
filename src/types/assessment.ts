/**
 * Assessment & Student Learning Profile Types
 *
 * Two critical data layers the AI needs:
 * 1. AssessmentRecord — teacher grades per student per criterion per unit
 * 2. StudentLearningProfile — enriched student data (SEN, skills, history)
 *
 * These enable the AI to:
 * - Adapt unit generation based on class performance patterns
 * - Provide differentiated content based on individual student needs
 * - Track skill progression and suggest next steps
 * - Generate targeted remediation or extension activities
 *
 * DB tables will follow when grading/assessment UI is built.
 */

import type { CognitiveLevel } from "./lesson-intelligence";

/* ================================================================
   ASSESSMENT RECORDS — TEACHER GRADES & FEEDBACK
   ================================================================ */

/**
 * A single criterion score within an assessment.
 * The AI uses aggregate patterns across criterion scores to identify
 * class-wide strengths and gaps that inform the next unit.
 */
export interface CriterionScore {
  criterion_key: string; // "A", "B", "C", "D" or "AO1", etc.
  level: number; // 1-8 for MYP, varies for other frameworks

  /** Per-strand scores (optional, for granular assessment) */
  strand_scores?: Record<number, number>;

  /** Teacher comment on this criterion */
  comment?: string;

  /** Which unit pages provided evidence for this score */
  evidence_page_ids?: string[];

  /** Quick tags for common patterns the AI can aggregate */
  tags?: AssessmentTag[];
}

/** Common assessment pattern tags for AI aggregation */
export type AssessmentTag =
  | "strong_research" // Criterion A: thorough investigation
  | "weak_justification" // A: can find info but can't explain why it matters
  | "creative_ideas" // B: original thinking
  | "limited_range" // B: only one or two ideas explored
  | "strong_technique" // C: skilled making/construction
  | "poor_planning" // C: jumps in without a plan
  | "honest_evaluation" // D: genuine reflection
  | "superficial_evaluation" // D: "it went well" with no depth
  | "exceeds_expectations"
  | "needs_support"
  | "significant_improvement"
  | "regression";

/**
 * A complete assessment record for one student on one unit.
 * Created when a teacher grades/marks a student's unit work.
 */
export interface AssessmentRecord {
  id: string;
  student_id: string;
  unit_id: string;
  class_id: string;
  teacher_id: string;

  // ─── Scores ───
  criterion_scores: CriterionScore[];
  /** Overall grade (if the framework has one — e.g., MYP 1-7 boundary grade) */
  overall_grade?: number;

  // ─── Qualitative feedback ───
  teacher_comments?: string;
  strengths: string[]; // "Your research was thorough and well-organised"
  areas_for_improvement: string[]; // "Next time, test your prototype before evaluating"

  // ─── Targets ───
  /** Specific, actionable targets for the student to work on */
  targets?: AssessmentTarget[];

  // ─── Metadata ───
  assessed_at: string; // ISO 8601
  is_draft: boolean;
  /** Moderation status — for schools that moderate assessments */
  moderation_status?: "unmoderated" | "moderated" | "adjusted";
  /** If adjusted during moderation, what changed */
  moderation_notes?: string;
}

/**
 * A specific, actionable target set for a student.
 * The AI references these when generating the next unit's scaffolding.
 */
export interface AssessmentTarget {
  criterion_key: string;
  target: string; // "Use at least 3 different sources in your research"
  target_level?: number; // the level they're aiming for
  status: "set" | "in_progress" | "achieved";
  set_at: string;
  achieved_at?: string;
}

/**
 * Aggregated class performance on a unit.
 * The AI uses this to plan the next unit: "Most of the class scored
 * 3-4 on Criterion A, so the next unit should scaffold research more."
 */
export interface ClassPerformanceSummary {
  class_id: string;
  unit_id: string;
  student_count: number;
  assessed_count: number;

  /** Average score per criterion */
  criterion_averages: Record<string, number>;
  /** Score distribution per criterion — how many students at each level band */
  criterion_distributions: Record<string, LevelDistribution>;

  /** Most common strengths across the class */
  common_strengths: string[];
  /** Most common areas for improvement across the class */
  common_gaps: string[];
  /** Most common assessment tags */
  common_tags: AssessmentTag[];

  /** Teacher's overall class reflection */
  teacher_reflection?: string;
}

/** Distribution of students across level bands */
export interface LevelDistribution {
  /** Count at each level band — e.g., { "1-2": 2, "3-4": 8, "5-6": 12, "7-8": 3 } */
  band_counts: Record<string, number>;
  /** The median level */
  median: number;
  /** Lowest and highest scores */
  range: [number, number];
}

/* ================================================================
   STUDENT LEARNING PROFILE — ENRICHED STUDENT DATA
   Beyond the basic Student record (username, ELL level, avatar).
   ================================================================ */

/**
 * Special Educational Needs provision.
 * The AI uses this to:
 * - Adjust activity types (e.g., avoid fine motor tasks for certain needs)
 * - Modify output expectations
 * - Suggest appropriate scaffolding and accommodations
 * - Flag safety considerations in workshops
 */
export interface SENProvision {
  type: string; // "ADHD", "Dyslexia", "ASD", "Visual Impairment", "EHC Plan", etc.
  /** Specific strategies that work for this student */
  support_strategies: string[];
  /** Formal accommodations (often from an IEP/EHC plan) */
  accommodations: string[]; // "extra time", "modified output", "preferential seating", "reader/scribe"
  /** Impact on design lessons specifically */
  design_class_implications?: string; // "Needs 1:1 support with power tools", "Works best with visual instructions"
  /** Is there an external support plan? */
  external_plan?: "IEP" | "EHC" | "504" | "ILP" | "other";
}

/**
 * A tool or machine certification.
 * Critical for safety tracking — the AI must know what tools
 * a student is certified to use independently.
 */
export interface ToolCertification {
  tool: string; // "Laser Cutter", "Band Saw", "Soldering Iron"
  certified_date: string; // ISO 8601
  certified_by: string; // teacher_id
  /** Certification level */
  level: "supervised" | "independent" | "can_train_others";
  /** Expiry date (some schools re-certify annually) */
  expires_at?: string;
  /** Safety quiz score if applicable */
  quiz_score?: number;
}

/**
 * A student's history with a specific criterion across multiple units.
 * The AI uses this to understand: "This student has been stuck at level 3-4
 * on Criterion A for 3 units — they need a different approach to research."
 */
export interface CriterionHistory {
  criterion_key: string;
  scores: Array<{
    unit_id: string;
    unit_title: string;
    level: number;
    assessed_at: string;
  }>;
  /** Auto-calculated trend */
  trend: "improving" | "stable" | "declining" | "insufficient_data";
  /** Current working level (most recent or teacher-set) */
  current_working_level: number;
  /** Target level set by teacher */
  target_level?: number;
}

/**
 * Software proficiency tracking.
 */
export interface SoftwareProficiency {
  software: string; // "TinkerCAD", "Fusion 360", "Adobe Illustrator"
  level: "novice" | "competent" | "proficient" | "expert";
  last_used?: string; // ISO 8601 — "haven't used it in 6 months" changes the AI's assumptions
}

/**
 * The enriched student learning profile.
 * Extends beyond the basic Student record with everything the AI needs
 * to personalise the learning experience.
 *
 * This is teacher-maintained data, NOT student self-reported.
 * It's sensitive and must be protected appropriately.
 */
export interface StudentLearningProfile {
  student_id: string;

  // ─── Learning Needs ───
  /** SEN provisions (may have multiple — e.g., ADHD + Dyslexia) */
  sen_provisions: SENProvision[];
  /** General learning preferences (teacher-observed, not self-reported) */
  learning_preferences?: string[]; // "visual learner", "needs movement breaks", "works well in pairs"
  /** Accessibility needs for digital content */
  accessibility_needs?: string[]; // "screen reader", "high contrast", "larger text", "audio instructions"

  // ─── Skills & Certifications ───
  tool_certifications: ToolCertification[];
  software_proficiency: SoftwareProficiency[];
  /** General practical skill level (teacher's holistic assessment) */
  practical_skill_level?: "beginner" | "developing" | "competent" | "advanced";

  // ─── Assessment History ───
  criterion_history: CriterionHistory[];
  /** Overall assessment trend */
  overall_trend?: "improving" | "stable" | "declining" | "insufficient_data";

  // ─── Cognitive Profile ───
  /** Where this student typically operates on Bloom's taxonomy */
  typical_cognitive_level?: CognitiveLevel;
  /** Does this student need more time on lower-order tasks before higher-order? */
  cognitive_scaffolding_notes?: string;

  // ─── Behavioural & Social ───
  /** Pastoral notes relevant to class participation (sensitive) */
  pastoral_notes?: string;
  /** Grouping preferences/constraints */
  grouping_notes?: string; // "works best with X", "keep separate from Y"
  /** Energy and engagement patterns */
  engagement_notes?: string; // "strong starter, loses focus after 20 mins"

  // ─── Interests ───
  /** Design interests (for contextualising projects) */
  interests?: string[]; // "gaming", "fashion", "architecture", "robotics"

  // ─── Metadata ───
  last_updated: string;
  updated_by: string; // teacher_id who last edited
}

/* ================================================================
   DATABASE ROW TYPES (for future migrations)
   ================================================================ */

/** Row type for assessment_records table */
export interface AssessmentRecordRow {
  id: string;
  student_id: string;
  unit_id: string;
  class_id: string;
  teacher_id: string;
  data: AssessmentRecord; // full JSONB
  overall_grade: number | null;
  is_draft: boolean;
  assessed_at: string;
  created_at: string;
  updated_at: string;
}

/** Row type for student_learning_profiles table */
export interface StudentLearningProfileRow {
  id: string;
  student_id: string;
  teacher_id: string; // who maintains this profile
  data: StudentLearningProfile; // full JSONB
  created_at: string;
  updated_at: string;
}

/** Row type for class_performance_summaries table (or materialised view) */
export interface ClassPerformanceSummaryRow {
  id: string;
  class_id: string;
  unit_id: string;
  teacher_id: string;
  data: ClassPerformanceSummary; // full JSONB
  created_at: string;
}
