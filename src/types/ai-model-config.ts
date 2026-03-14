/**
 * AI Model Configuration Types
 *
 * Defines the shape of the admin-configurable AI model parameters.
 * An empty config {} means "use all hardcoded defaults" — only
 * overridden values are stored in the database.
 */

import type { GradeTimingProfile } from "@/lib/ai/prompts";

// =========================================================================
// Category 1: Generation Emphasis (20 dials, 1-10 scale)
// =========================================================================

export interface GenerationEmphasis {
  endGoal: number;              // 10 — north star for backward-mapping
  topic: number;                // 8
  gradeLevel: number;           // 8
  duration: number;             // 7
  assessmentCriteria: number;   // 7
  frameworkVocab: number;       // 6
  ragChunks: number;            // 5
  lessonProfiles: number;       // 5
  aggregatedFeedback: number;   // 6
  scaffoldingFade: number;      // 5
  spacedRetrieval: number;      // 7
  selfAssessment: number;       // 7
  compareContrast: number;      // 7
  ellScaffolding: number;       // 6
  teacherNotes: number;         // 6
  productiveFailure: number;    // 5
  critiqueCulture: number;      // 5
  digitalPhysicalBalance: number; // 5
  safetyCulture: number;        // 5
  portfolioCapture: number;     // 4
}

// =========================================================================
// Category 2: Timing Profiles (per MYP year)
// =========================================================================

/** All 5 MYP year timing profiles */
export type TimingProfiles = Record<number, GradeTimingProfile>;

// =========================================================================
// Category 3: Quality Evaluation Weights (10 principles, 0-10)
// =========================================================================

export interface QualityWeights {
  iteration: number;
  productive_failure: number;
  diverge_converge: number;
  scaffolding_fade: number;
  process_assessment: number;
  critique_culture: number;
  digital_physical_balance: number;
  differentiation: number;
  metacognitive_framing: number;
  safety_culture: number;
}

// =========================================================================
// Category 4: Structural Check Thresholds
// =========================================================================

export interface StructuralThresholds {
  minReflections: number;           // 1
  minWarmups: number;               // 1
  minPortfolioCapture: number;      // 1
  ellCoveragePercent: number;       // 50
  minTeacherNotes: number;          // 1
  spacedRetrievalPercent: number;   // 50
  minSelfAssessment: number;        // 1
}

// =========================================================================
// Category 5: Feedback Loop Weights
// =========================================================================

export interface FeedbackWeights {
  teacherStrongPositive: number;    // 0.1
  teacherPositive: number;          // 0.05
  teacherNegative: number;          // -0.1
  studentPositive: number;          // 0.05
  studentNegative: number;          // -0.05
}

// =========================================================================
// Category 6: RAG Retrieval Weighting
// =========================================================================

export interface RAGWeights {
  similarityWeight: number;         // 0.7 (vs quality_score at 0.3)
  retrievalFrequencyBoost: number;  // 0.02
  usageBoost: number;               // 0.05
  forkCountBoost: number;           // 0.03
}

// =========================================================================
// Category 7: Relative Emphasis Breakdown (must sum to 100)
// =========================================================================

export interface RelativeEmphasis {
  teacherInput: number;             // 35
  pedagogicalIntelligence: number;  // 25
  evidenceBasedStrategies: number;  // 18
  knowledgeBase: number;            // 12
  feedbackLoop: number;             // 7
  frameworkAdaptation: number;      // 3
}

// =========================================================================
// Category 8: Student Design Assistant Controls
// =========================================================================

export interface StudentAssistantConfig {
  bloomAdaptInterval: number;       // 4 (turns between level-ups)
  effortThreshold: number;          // 4 (min effort score to level up)
  effortGateThreshold: number;      // 2 (redirect at this effort score)
  lowEffortWordCount: number;       // 3 (words or fewer = -1 effort)
  goodEffortWordCount: number;      // 15 (words or more = +1 effort)
}

// =========================================================================
// Combined Config
// =========================================================================

export interface AIModelConfig {
  generationEmphasis?: Partial<GenerationEmphasis>;
  timingProfiles?: Partial<Record<number, Partial<GradeTimingProfile>>>;
  qualityWeights?: Partial<QualityWeights>;
  structuralThresholds?: Partial<StructuralThresholds>;
  feedbackWeights?: Partial<FeedbackWeights>;
  ragWeights?: Partial<RAGWeights>;
  relativeEmphasis?: Partial<RelativeEmphasis>;
  studentAssistant?: Partial<StudentAssistantConfig>;
}

/** Fully resolved config with no optional fields */
export interface ResolvedModelConfig {
  generationEmphasis: GenerationEmphasis;
  timingProfiles: TimingProfiles;
  qualityWeights: QualityWeights;
  structuralThresholds: StructuralThresholds;
  feedbackWeights: FeedbackWeights;
  ragWeights: RAGWeights;
  relativeEmphasis: RelativeEmphasis;
  studentAssistant: StudentAssistantConfig;
}

/** Metadata about a slider for the admin UI */
export interface SliderMeta {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  effectSize?: string;       // e.g. "d=1.44"
  description?: string;
}

/** Category definition for admin UI */
export interface CategoryMeta {
  key: keyof AIModelConfig;
  label: string;
  icon: string;
  description: string;
  sliders: SliderMeta[];
}
