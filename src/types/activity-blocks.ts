/**
 * Activity Block types for the Dimensions3 block library.
 *
 * Blocks are format-neutral by design — the `phase` field uses FormatProfile
 * phase IDs, and framework-specific labels are applied at render time by
 * the FrameworkAdapter.
 */

// =========================================================================
// Enums & Literal Types
// =========================================================================

export type BloomLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";

export type TimeWeight = "quick" | "moderate" | "extended" | "flexible";

export type Grouping = "individual" | "pair" | "small_group" | "whole_class" | "flexible";

export type ActivityCategory =
  | "ideation" | "research" | "analysis" | "making" | "critique"
  | "reflection" | "planning" | "presentation" | "warmup"
  | "collaboration" | "skill-building" | "documentation" | "assessment" | "journey";

export type LessonStructureRole = "opening" | "instruction" | "core" | "reflection" | "warmup" | "wrapup";

export type SourceType = "extracted" | "generated" | "manual" | "community";

export type CopyrightFlag = "own" | "copyrighted" | "creative_commons" | "unknown";

export type AssessmentType = "formative" | "summative" | "diagnostic";

export type ScoringMethod = "criterion-referenced" | "holistic" | "self" | "peer";

// =========================================================================
// Nested Interfaces
// =========================================================================

export interface AIRules {
  phase: "divergent" | "convergent" | "neutral";
  tone: string;
  rules: string[];
  forbidden_words?: string[];
}

export interface AssessmentConfig {
  rubric_criteria: string[];
  assessment_type: AssessmentType;
  scoring_method: ScoringMethod;
  rubric_descriptors?: Record<string, string[]>;
}

export interface InteractiveConfig {
  component_id: string;
  tool_config: Record<string, unknown>;
  ai_endpoint?: string;
  state_schema?: string;
  requires_challenge: boolean;
}

export interface Scaffolding {
  hints?: string[];
  sentence_starters?: string[];
  worked_example?: string;
  vocabulary?: string[];
}

// =========================================================================
// Main Entity
// =========================================================================

export interface ActivityBlock {
  id: string;
  teacher_id: string | null;

  // Identity
  title: string;
  description: string | null;
  prompt: string;
  // Lever 1 v2 slot fields (sub-phase 1B). Nullable for legacy rows.
  framing: string | null;
  task: string | null;
  success_signal: string | null;

  // Source tracking
  source_type: SourceType;
  source_upload_id: string | null;
  source_unit_id: string | null;
  source_page_id: string | null;
  source_activity_index: number | null;

  // Dimensions metadata
  bloom_level: BloomLevel | null;
  time_weight: TimeWeight;
  grouping: Grouping;
  phase: string | null;               // FormatProfile phase ID
  activity_category: ActivityCategory | null;
  ai_rules: AIRules | null;
  udl_checkpoints: string[];
  success_look_fors: string[];

  // Interaction metadata
  output_type: string | null;
  prerequisite_tags: string[];
  lesson_structure_role: LessonStructureRole | null;
  response_type: string | null;
  toolkit_tool_id: string | null;

  // Resources
  materials_needed: string[];
  tech_requirements: string[];
  scaffolding: Scaffolding | null;
  example_response: string | null;

  // Quality signals
  efficacy_score: number;
  times_used: number;
  times_skipped: number;
  times_edited: number;
  avg_time_spent: number | null;
  avg_completion_rate: number | null;

  // Format context
  source_format_hint: string | null;

  // Search (not typically loaded client-side)
  tags: string[];

  // Assessment & interactive
  is_assessable: boolean;
  assessment_config: AssessmentConfig | null;
  interactive_config: InteractiveConfig | null;
  supports_visual_assessment: boolean;

  // Data integrity
  pii_scanned: boolean;
  pii_flags: Record<string, unknown> | null;
  copyright_flag: CopyrightFlag;
  teacher_verified: boolean;

  // Loominary OS
  module: string;
  media_asset_ids: string[];

  // Lifecycle
  is_public: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// =========================================================================
// Pipeline Stage Contracts
// =========================================================================

export interface CostBreakdown {
  inputTokens: number;
  outputTokens: number;
  modelId: string;
  estimatedCostUSD: number;
  timeMs: number;
}

export interface GenerationRequest {
  topic: string;
  unitType: string;
  lessonCount: number;
  gradeLevel: string;
  framework: string;
  constraints: {
    availableResources: string[];
    periodMinutes: number;
    workshopAccess: boolean;
    softwareAvailable: string[];
  };
  context?: {
    realWorldContext?: string;
    studentContext?: string;
    classroomConstraints?: string;
  };
  preferences?: {
    suggestedSequencePattern?: string;
    emphasisAreas?: string[];
    criteriaEmphasis?: Record<string, number>;
  };
  curriculumContext?: string;
  curriculumOutcomes?: string[];
}

export interface RetrievedBlock {
  block: ActivityBlock;
  relevanceScore: number;
  scoreBreakdown: {
    vectorSimilarity: number;
    efficacyNormalized: number;
    textMatch: number;
    usageSignal: number;
    metadataFit: number;
  };
  suggestedPosition?: number;
  suggestedAdaptations?: string[];
}

export interface BlockRetrievalResult {
  request: GenerationRequest;
  candidates: RetrievedBlock[];
  retrievalMetrics: {
    totalBlocksSearched: number;
    candidatesReturned: number;
    avgRelevanceScore: number;
    retrievalTimeMs: number;
    retrievalCost: CostBreakdown;
  };
}

export interface ActivityAdaptation {
  type: "familiarity_reduction" | "scaffolding_adjust" | "time_adjust" | "context_inject";
  description: string;
  before?: string;
  after?: string;
}

export interface PrerequisiteViolation {
  blockId: string;
  blockTitle: string;
  position: number;
  requiresTag: string;
  missingFrom: string;
  severity: "hard" | "soft";
}

export interface ActivitySlot {
  slotIndex: number;
  source: "library" | "gap";
  block?: RetrievedBlock;
  gapDescription?: string;
  gapContext?: {
    precedingBlock?: string;
    followingBlock?: string;
    requiredOutputs?: string[];
    suggestedBloom?: string;
    suggestedGrouping?: string;
    suggestedTimeWeight?: string;
    suggestedCategory?: string;
    suggestedPhase?: string;
    suggestedLessonRole?: string;
  };
  adaptations?: ActivityAdaptation[];
}

export interface LessonSlot {
  position: number;
  label: string;
  description: string;
  activities: ActivitySlot[];
}

export interface AssembledSequence {
  request: GenerationRequest;
  lessons: LessonSlot[];
  sequenceMetrics: {
    totalSlots: number;
    filledFromLibrary: number;
    gapsToGenerate: number;
    fillRate: number;
    prerequisiteViolations: PrerequisiteViolation[];
    sequenceTimeMs: number;
    sequenceCost: CostBreakdown;
  };
}

export interface FilledActivity {
  source: "library" | "generated";
  sourceBlockId?: string;
  title: string;
  // Lever 1 — three v2 slot fields. Required from generation onward.
  // Library blocks pass them through; generated activities produce them
  // via stage3-generation. The legacy `prompt` field is composed from
  // these three at the output-adapter boundary.
  framing: string;
  task: string;
  success_signal: string;
  /** Legacy single-blob fallback. Composed at the adapter boundary
   *  from framing+task+success_signal. Kept on the type for old
   *  fixtures + the composed-fallback path. */
  prompt: string;
  bloom_level: string;
  time_weight: string;
  grouping: string;
  phase: string;
  activity_category: string;
  lesson_structure_role: string;
  response_type: string;
  materials_needed: string[];
  scaffolding?: Scaffolding | null;
  ai_rules?: AIRules | null;
  udl_checkpoints?: string[];
  success_look_fors?: string[];
  criterion_tags?: string[];
  output_type?: string;
  prerequisite_tags?: string[];
  adaptations?: ActivityAdaptation[];
}

export interface GapMetric {
  gapIndex: number;
  lessonPosition: number;
  tokensUsed: number;
  cost: CostBreakdown;
  timeMs: number;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
}

export interface FilledLesson {
  position: number;
  label: string;
  description: string;
  learningGoal: string;
  activities: FilledActivity[];
}

export interface FilledSequence {
  request: GenerationRequest;
  lessons: FilledLesson[];
  generationMetrics: {
    gapsFilled: number;
    totalTokensUsed: number;
    totalCost: CostBreakdown;
    generationTimeMs: number;
    perGapMetrics: GapMetric[];
  };
}

export interface CrossReference {
  targetLessonPosition: number;
  targetActivityIndex: number;
  referenceText: string;
  referenceType: "builds_on" | "revisits" | "contrasts" | "extends";
}

export interface PolishedActivity extends FilledActivity {
  transitionIn?: string;
  transitionOut?: string;
  crossReferences?: CrossReference[];
}

export interface BlockInteraction {
  type: "prerequisite" | "familiarity" | "artifact_flow" | "cross_reference";
  fromLesson: number;
  fromActivity: number;
  toLesson: number;
  toActivity: number;
  description: string;
  confidence: "verified" | "inferred";
}

export interface PolishedLesson extends FilledLesson {
  activities: PolishedActivity[];
}

export interface PolishedSequence {
  request: GenerationRequest;
  lessons: PolishedLesson[];
  polishMetrics: {
    transitionsAdded: number;
    crossReferencesAdded: number;
    familiarityAdaptations: number;
    scaffoldingProgressions: number;
    totalTokensUsed: number;
    totalCost: CostBreakdown;
    polishTimeMs: number;
  };
  interactionMap: BlockInteraction[];
}

export interface LessonExtension {
  title: string;
  description: string;
  duration: number;
  designPhase?: string;
}

export interface TimedPhase {
  label: string;
  phaseId: string;
  activities: PolishedActivity[];
  durationMinutes: number;
  isFlexible: boolean;
}

export interface TimedLesson extends PolishedLesson {
  phases: TimedPhase[];
  totalMinutes: number;
  extensions?: LessonExtension[];
}

export interface TimedUnit {
  request: GenerationRequest;
  lessons: TimedLesson[];
  timingMetrics: {
    totalMinutesAllocated: number;
    totalMinutesAvailable: number;
    overflowLessons: number[];
    timingSource: "learned_pattern" | "starter_default" | "teacher_override";
    timingTimeMs: number;
    timingCost: CostBreakdown;
  };
}

export interface DimensionScore {
  score: number;
  confidence: number;
  subScores: Record<string, number>;
  flags: string[];
}

export interface QualityReport {
  overallScore: number;
  dimensions: {
    cognitiveRigour: DimensionScore;
    studentAgency: DimensionScore;
    teacherCraft: DimensionScore;
    variety: DimensionScore;
    coherence: DimensionScore;
  };
  coverage: {
    bloomDistribution: Record<string, number>;
    groupingDistribution: Record<string, number>;
    udlCheckpointsCovered: string[];
    udlCheckpointsMissing: string[];
    phasesCovered: string[];
    categoriesCovered: string[];
  };
  libraryMetrics: {
    blockReuseRate: number;
    avgBlockEfficacy: number;
    newBlocksGenerated: number;
  };
  costSummary: {
    totalCost: CostBreakdown;
    perLessonCost: CostBreakdown[];
    perStageCost: Record<string, CostBreakdown>;
    comparisonToAverage?: number;
  };
  recommendations: string[];
}
