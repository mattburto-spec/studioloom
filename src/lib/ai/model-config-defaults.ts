/**
 * AI Model Config — Hardcoded Defaults
 *
 * These are the current values extracted from prompts.ts, quality-evaluator.ts,
 * feedback.ts, retrieve.ts, and design-assistant-prompt.ts.
 *
 * When the ai_model_config table has an empty config {}, these are used.
 * Only overridden values from DB are merged on top.
 */

import type {
  GenerationEmphasis,
  QualityWeights,
  StructuralThresholds,
  FeedbackWeights,
  RAGWeights,
  RelativeEmphasis,
  StudentAssistantConfig,
  ResolvedModelConfig,
  CategoryMeta,
  TimingProfiles,
} from "@/types/ai-model-config";
import type { GradeTimingProfile } from "@/lib/ai/prompts";

// =========================================================================
// Category 1: Generation Emphasis Defaults
// =========================================================================

export const DEFAULT_GENERATION_EMPHASIS: GenerationEmphasis = {
  endGoal: 10,
  topic: 8,
  gradeLevel: 8,
  duration: 7,
  assessmentCriteria: 7,
  frameworkVocab: 6,
  ragChunks: 5,
  lessonProfiles: 5,
  aggregatedFeedback: 6,
  scaffoldingFade: 5,
  spacedRetrieval: 7,
  selfAssessment: 7,
  compareContrast: 7,
  ellScaffolding: 6,
  teacherNotes: 6,
  productiveFailure: 5,
  critiqueCulture: 5,
  digitalPhysicalBalance: 5,
  safetyCulture: 5,
  portfolioCapture: 4,
};

// =========================================================================
// Category 2: Timing Profile Defaults (from prompts.ts lines 42-68)
// =========================================================================

export const DEFAULT_TIMING_PROFILES: TimingProfiles = {
  1: {
    mypYear: 1, warmupMinutes: 5, introMinutes: 5, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 12, maxHandsOnMinutes: 40, maxCollaborativeMinutes: 15, maxDigitalMinutes: 15,
    pacingNote: "MYP Year 1 (age 11): Students sustain cognitive focus for ~10-12 minutes but can engage in hands-on making for much longer. Reading, writing, and analysis tasks must be SHORT (≤12 min) and heavily scaffolded with checklists, sentence starters, and worked examples. Hands-on/making activities can run 20-40 min as long as they have clear checkpoints. Break reading-heavy tasks into small chunks with partner discussion between them.",
  },
  2: {
    mypYear: 2, warmupMinutes: 5, introMinutes: 5, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 15, maxHandsOnMinutes: 40, maxCollaborativeMinutes: 15, maxDigitalMinutes: 20,
    pacingNote: "MYP Year 2 (age 12): Cognitive focus extends to ~12-15 minutes. Still scaffold reading/analysis tasks with sentence starters and templates, but allow some choice in how students respond. Hands-on making activities can run 20-40 min. Mix active and passive tasks — avoid back-to-back reading/writing activities.",
  },
  3: {
    mypYear: 3, warmupMinutes: 5, introMinutes: 5, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 20, maxHandsOnMinutes: 45, maxCollaborativeMinutes: 20, maxDigitalMinutes: 25,
    pacingNote: "MYP Year 3 (age 13): Cognitive focus ~15-20 minutes. Balance structured guidance with growing autonomy. Provide reference materials and exemplars but reduce step-by-step scaffolding. Students can handle longer research tasks and sustained making sessions.",
  },
  4: {
    mypYear: 4, warmupMinutes: 5, introMinutes: 5, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 25, maxHandsOnMinutes: 45, maxCollaborativeMinutes: 25, maxDigitalMinutes: 30,
    pacingNote: "MYP Year 4 (age 15): Cognitive focus ~25 minutes. Support extended independent work with clear success criteria. Scaffold through exemplars and peer critique rather than templates. Students can manage longer analysis and documentation tasks.",
  },
  5: {
    mypYear: 5, warmupMinutes: 5, introMinutes: 3, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 30, maxHandsOnMinutes: 45, maxCollaborativeMinutes: 25, maxDigitalMinutes: 35,
    pacingNote: "MYP Year 5 (age 16): Cognitive focus ~30 minutes. Minimise unnecessary transitions to allow flow state during deep work. Scaffold through prompts and peer critique. Students can sustain extended analysis, documentation, and independent making sessions.",
  },
};

// =========================================================================
// Category 3: Quality Evaluation Weight Defaults
// =========================================================================

export const DEFAULT_QUALITY_WEIGHTS: QualityWeights = {
  iteration: 7,
  productive_failure: 6,
  diverge_converge: 6,
  scaffolding_fade: 7,
  process_assessment: 7,
  critique_culture: 6,
  digital_physical_balance: 5,
  differentiation: 7,
  metacognitive_framing: 6,
  safety_culture: 5,
};

// =========================================================================
// Category 4: Structural Check Threshold Defaults
// =========================================================================

export const DEFAULT_STRUCTURAL_THRESHOLDS: StructuralThresholds = {
  minReflections: 1,
  minWarmups: 1,
  minPortfolioCapture: 1,
  ellCoveragePercent: 50,
  minTeacherNotes: 1,
  spacedRetrievalPercent: 50,
  minSelfAssessment: 1,
};

// =========================================================================
// Category 5: Feedback Loop Weight Defaults (from feedback.ts lines 296-313)
// =========================================================================

export const DEFAULT_FEEDBACK_WEIGHTS: FeedbackWeights = {
  teacherStrongPositive: 0.1,
  teacherPositive: 0.05,
  teacherNegative: -0.1,
  studentPositive: 0.05,
  studentNegative: -0.05,
};

// =========================================================================
// Category 6: RAG Retrieval Weight Defaults (from retrieve.ts line 62)
// =========================================================================

export const DEFAULT_RAG_WEIGHTS: RAGWeights = {
  similarityWeight: 0.7,
  retrievalFrequencyBoost: 0.02,
  usageBoost: 0.05,
  forkCountBoost: 0.03,
};

// =========================================================================
// Category 7: Relative Emphasis Breakdown Defaults
// =========================================================================

export const DEFAULT_RELATIVE_EMPHASIS: RelativeEmphasis = {
  teacherInput: 35,
  pedagogicalIntelligence: 25,
  evidenceBasedStrategies: 18,
  knowledgeBase: 12,
  feedbackLoop: 7,
  frameworkAdaptation: 3,
};

// =========================================================================
// Category 8: Student Design Assistant Defaults
// =========================================================================

export const DEFAULT_STUDENT_ASSISTANT: StudentAssistantConfig = {
  bloomAdaptInterval: 4,
  effortThreshold: 4,
  effortGateThreshold: 2,
  lowEffortWordCount: 3,
  goodEffortWordCount: 15,
};

// =========================================================================
// Combined Default Config
// =========================================================================

export const DEFAULT_MODEL_CONFIG: ResolvedModelConfig = {
  generationEmphasis: DEFAULT_GENERATION_EMPHASIS,
  timingProfiles: DEFAULT_TIMING_PROFILES,
  qualityWeights: DEFAULT_QUALITY_WEIGHTS,
  structuralThresholds: DEFAULT_STRUCTURAL_THRESHOLDS,
  feedbackWeights: DEFAULT_FEEDBACK_WEIGHTS,
  ragWeights: DEFAULT_RAG_WEIGHTS,
  relativeEmphasis: DEFAULT_RELATIVE_EMPHASIS,
  studentAssistant: DEFAULT_STUDENT_ASSISTANT,
};

// =========================================================================
// Admin UI Metadata — Slider definitions per category
// =========================================================================

export const CATEGORY_META: CategoryMeta[] = [
  {
    key: "generationEmphasis",
    label: "Generation Emphasis",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    description: "How much weight each input signal gets in the generation prompts (1-10)",
    sliders: [
      { key: "endGoal", label: "End Goal Alignment", min: 1, max: 10, step: 1, defaultValue: 10, description: "North star — everything backward-maps from this" },
      { key: "topic", label: "Topic Relevance", min: 1, max: 10, step: 1, defaultValue: 8 },
      { key: "gradeLevel", label: "Grade Level", min: 1, max: 10, step: 1, defaultValue: 8, description: "Drives timing, complexity, scaffolding" },
      { key: "duration", label: "Duration Constraints", min: 1, max: 10, step: 1, defaultValue: 7 },
      { key: "assessmentCriteria", label: "Assessment Criteria", min: 1, max: 10, step: 1, defaultValue: 7 },
      { key: "frameworkVocab", label: "Framework Vocabulary", min: 1, max: 10, step: 1, defaultValue: 6, description: "MYP vs GCSE vs PLTW language" },
      { key: "ragChunks", label: "RAG Knowledge Chunks", min: 1, max: 10, step: 1, defaultValue: 5, description: "Similar past content as inspiration" },
      { key: "lessonProfiles", label: "Lesson Profiles", min: 1, max: 10, step: 1, defaultValue: 5, description: "Pedagogical patterns from uploads" },
      { key: "aggregatedFeedback", label: "Aggregated Feedback", min: 1, max: 10, step: 1, defaultValue: 6, description: "Real teaching experience data" },
      { key: "scaffoldingFade", label: "Scaffolding Fade", min: 1, max: 10, step: 1, defaultValue: 5, effectSize: "d=0.82" },
      { key: "spacedRetrieval", label: "Spaced Retrieval", min: 1, max: 10, step: 1, defaultValue: 7, effectSize: "d=0.71" },
      { key: "selfAssessment", label: "Self-Assessment Prediction", min: 1, max: 10, step: 1, defaultValue: 7, effectSize: "d=1.44" },
      { key: "compareContrast", label: "Compare/Contrast", min: 1, max: 10, step: 1, defaultValue: 7, effectSize: "d=1.61" },
      { key: "ellScaffolding", label: "ELL Scaffolding", min: 1, max: 10, step: 1, defaultValue: 6, description: "3-tier language support" },
      { key: "teacherNotes", label: "Teacher Notes", min: 1, max: 10, step: 1, defaultValue: 6, description: "Circulation questions and tips" },
      { key: "productiveFailure", label: "Productive Failure", min: 1, max: 10, step: 1, defaultValue: 5, effectSize: "d=0.82" },
      { key: "critiqueCulture", label: "Critique Culture", min: 1, max: 10, step: 1, defaultValue: 5, effectSize: "d=0.73" },
      { key: "digitalPhysicalBalance", label: "Digital + Physical Balance", min: 1, max: 10, step: 1, defaultValue: 5, effectSize: "d=0.57" },
      { key: "safetyCulture", label: "Safety Culture", min: 1, max: 10, step: 1, defaultValue: 5, description: "Non-negotiable for making/testing" },
      { key: "portfolioCapture", label: "Portfolio Capture", min: 1, max: 10, step: 1, defaultValue: 4 },
    ],
  },
  {
    key: "qualityWeights",
    label: "Quality Evaluation",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    description: "Weight for each of the 10 quality evaluation principles (0-10)",
    sliders: [
      { key: "iteration", label: "Iteration", min: 0, max: 10, step: 1, defaultValue: 7, description: "Students revise/improve work" },
      { key: "productive_failure", label: "Productive Failure", min: 0, max: 10, step: 1, defaultValue: 6, effectSize: "d=0.82" },
      { key: "diverge_converge", label: "Diverge-Converge", min: 0, max: 10, step: 1, defaultValue: 6 },
      { key: "scaffolding_fade", label: "Scaffolding Fade", min: 0, max: 10, step: 1, defaultValue: 7, effectSize: "d=0.82" },
      { key: "process_assessment", label: "Process Assessment", min: 0, max: 10, step: 1, defaultValue: 7 },
      { key: "critique_culture", label: "Critique Culture", min: 0, max: 10, step: 1, defaultValue: 6, effectSize: "d=0.73" },
      { key: "digital_physical_balance", label: "Digital-Physical Balance", min: 0, max: 10, step: 1, defaultValue: 5, effectSize: "d=0.57" },
      { key: "differentiation", label: "Differentiation", min: 0, max: 10, step: 1, defaultValue: 7 },
      { key: "metacognitive_framing", label: "Metacognitive Framing", min: 0, max: 10, step: 1, defaultValue: 6 },
      { key: "safety_culture", label: "Safety Culture", min: 0, max: 10, step: 1, defaultValue: 5 },
    ],
  },
  {
    key: "structuralThresholds",
    label: "Structural Checks",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    description: "Minimum thresholds for structural quality checks",
    sliders: [
      { key: "minReflections", label: "Min Reflections", min: 0, max: 5, step: 1, defaultValue: 1 },
      { key: "minWarmups", label: "Min Warmups", min: 0, max: 5, step: 1, defaultValue: 1 },
      { key: "minPortfolioCapture", label: "Min Portfolio Captures", min: 0, max: 5, step: 1, defaultValue: 1 },
      { key: "ellCoveragePercent", label: "ELL Coverage %", min: 0, max: 100, step: 5, defaultValue: 50 },
      { key: "minTeacherNotes", label: "Min Teacher Notes", min: 0, max: 5, step: 1, defaultValue: 1 },
      { key: "spacedRetrievalPercent", label: "Spaced Retrieval %", min: 0, max: 100, step: 5, defaultValue: 50 },
      { key: "minSelfAssessment", label: "Min Self-Assessment", min: 0, max: 5, step: 1, defaultValue: 1 },
    ],
  },
  {
    key: "feedbackWeights",
    label: "Feedback Loop",
    icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    description: "How much teacher/student feedback adjusts knowledge base quality scores",
    sliders: [
      { key: "teacherStrongPositive", label: "Teacher Strong Positive", min: 0, max: 0.3, step: 0.01, defaultValue: 0.1, description: "Rating 4+ AND would use again" },
      { key: "teacherPositive", label: "Teacher Positive", min: 0, max: 0.2, step: 0.01, defaultValue: 0.05, description: "Rating 4+ only" },
      { key: "teacherNegative", label: "Teacher Negative", min: -0.3, max: 0, step: 0.01, defaultValue: -0.1, description: "Rating 2 or below" },
      { key: "studentPositive", label: "Student Positive", min: 0, max: 0.2, step: 0.01, defaultValue: 0.05, description: "Understanding 4+ and good pace" },
      { key: "studentNegative", label: "Student Negative", min: -0.2, max: 0, step: 0.01, defaultValue: -0.05, description: "Understanding 2 or below" },
    ],
  },
  {
    key: "ragWeights",
    label: "RAG Retrieval",
    icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    description: "How knowledge chunks are scored and ranked for retrieval",
    sliders: [
      { key: "similarityWeight", label: "Similarity vs Quality", min: 0, max: 1, step: 0.05, defaultValue: 0.7, description: "0.7 = 70% semantic similarity, 30% quality score" },
      { key: "retrievalFrequencyBoost", label: "Retrieval Frequency Boost", min: 0, max: 0.1, step: 0.005, defaultValue: 0.02 },
      { key: "usageBoost", label: "Usage in Saved Units Boost", min: 0, max: 0.2, step: 0.01, defaultValue: 0.05 },
      { key: "forkCountBoost", label: "Fork Count Boost", min: 0, max: 0.1, step: 0.005, defaultValue: 0.03 },
    ],
  },
  {
    key: "relativeEmphasis",
    label: "Emphasis Breakdown",
    icon: "M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z",
    description: "High-level allocation of generation focus (must sum to 100%)",
    sliders: [
      { key: "teacherInput", label: "Teacher Input", min: 0, max: 60, step: 1, defaultValue: 35 },
      { key: "pedagogicalIntelligence", label: "Pedagogical Intelligence", min: 0, max: 50, step: 1, defaultValue: 25 },
      { key: "evidenceBasedStrategies", label: "Evidence-Based Strategies", min: 0, max: 40, step: 1, defaultValue: 18 },
      { key: "knowledgeBase", label: "Knowledge Base (RAG)", min: 0, max: 30, step: 1, defaultValue: 12 },
      { key: "feedbackLoop", label: "Feedback Loop", min: 0, max: 20, step: 1, defaultValue: 7 },
      { key: "frameworkAdaptation", label: "Framework Adaptation", min: 0, max: 15, step: 1, defaultValue: 3 },
    ],
  },
  {
    key: "studentAssistant",
    label: "Student Advisor",
    icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z",
    description: "Controls for the Socratic student design assistant",
    sliders: [
      { key: "bloomAdaptInterval", label: "Bloom's Level-Up Interval", min: 2, max: 10, step: 1, defaultValue: 4, description: "Turns between Bloom's level increases" },
      { key: "effortThreshold", label: "Effort Threshold for Level-Up", min: 1, max: 8, step: 1, defaultValue: 4, description: "Min effort score to advance Bloom's" },
      { key: "effortGateThreshold", label: "Effort Gate Threshold", min: 1, max: 5, step: 1, defaultValue: 2, description: "Below this, redirect instead of asking" },
      { key: "lowEffortWordCount", label: "Low Effort Word Count", min: 1, max: 10, step: 1, defaultValue: 3, description: "Words or fewer = negative effort" },
      { key: "goodEffortWordCount", label: "Good Effort Word Count", min: 5, max: 30, step: 1, defaultValue: 15, description: "Words or more = positive effort" },
    ],
  },
];

// Timing profiles get special UI treatment (grid, not simple sliders),
// so we define them separately
export const TIMING_CATEGORY_META = {
  key: "timingProfiles" as const,
  label: "Timing Profiles",
  icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  description: "Per-grade, per-activity-type maximum durations",
  years: [1, 2, 3, 4, 5],
  fields: [
    { key: "warmupMinutes", label: "Warmup", min: 2, max: 10, step: 1 },
    { key: "introMinutes", label: "Intro", min: 2, max: 10, step: 1 },
    { key: "reflectionMinutes", label: "Reflection", min: 2, max: 10, step: 1 },
    { key: "maxHighCognitiveMinutes", label: "Max High Cognitive", min: 5, max: 40, step: 1 },
    { key: "maxHandsOnMinutes", label: "Max Hands-On", min: 10, max: 60, step: 5 },
    { key: "maxCollaborativeMinutes", label: "Max Collaborative", min: 5, max: 30, step: 1 },
    { key: "maxDigitalMinutes", label: "Max Digital", min: 5, max: 45, step: 5 },
  ],
};
