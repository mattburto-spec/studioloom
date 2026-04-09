/**
 * Activity Block Library — Dimensions2 Project
 *
 * Retrieval, extraction, and management of reusable Activity Blocks.
 * Blocks are first-class entities extracted from uploads and generated units,
 * used by the generation pipeline to assemble proven activities.
 */

import type {
  ActivityBlock,
  CreateActivityBlockParams,
  BloomLevel,
  TimeWeight,
  GroupingStrategy,
  DesignPhase,
  LessonStructureRole,
  ResponseType,
} from "@/types";

// ----- Retrieval -----

export interface BlockRetrievalParams {
  /** Semantic search text (required) */
  query: string;
  /** Teacher ID — retrieves own blocks + public community blocks */
  teacherId: string;
  /** Filter by Bloom's level */
  bloomLevel?: BloomLevel;
  /** Filter by design thinking phase */
  designPhase?: DesignPhase;
  /** Filter by time weight */
  timeWeight?: TimeWeight;
  /** Filter by grouping strategy */
  grouping?: GroupingStrategy;
  /** Filter by response type */
  responseType?: ResponseType;
  /** Filter by lesson structure role */
  lessonStructureRole?: LessonStructureRole;
  /** Maximum blocks to return (default 10) */
  maxBlocks?: number;
  /** Minimum efficacy score (default 0 = include all) */
  minEfficacy?: number;
  /** Exclude blocks already used in this unit */
  excludeBlockIds?: string[];
}

export interface RetrievedBlock extends ActivityBlock {
  /** Relevance score from hybrid search (0-1) */
  relevance_score: number;
}

// ----- Extraction -----

/** Parameters for extracting blocks from a knowledge upload's analysis */
export interface ExtractFromUploadParams {
  teacherId: string;
  uploadId: string;
  /** lesson_flow phases from Pass 2 analysis */
  lessonFlowPhases: LessonFlowPhase[];
  /** Unit type context for design_phase inference */
  unitType?: string;
}

/** A lesson flow phase from the analysis pipeline (Pass 2 output) */
export interface LessonFlowPhase {
  phase: string;
  title: string;
  description: string;
  estimated_minutes?: number;
  activity_type?: string;
  pedagogical_purpose?: string;
  teacher_role?: string;
  student_cognitive_level?: string;
  scaffolding_present?: string[];
  materials_needed?: string[];
  safety_considerations?: string[];
  bloom_level?: string;
  time_weight?: string;
  energy_state?: string;
}

/** Parameters for extracting blocks from an existing unit's content_data */
export interface ExtractFromUnitParams {
  teacherId: string;
  unitId: string;
  /** Normalized pages array from content_data */
  pages: Array<{
    id: string;
    title: string;
    sections?: Array<{
      prompt: string;
      responseType?: string;
      scaffolding?: unknown;
      exampleResponse?: string;
      criterionTags?: string[];
      durationMinutes?: number;
      activityId?: string;
      toolId?: string;
      toolChallenge?: string;
      bloom_level?: string;
      timeWeight?: string;
      grouping?: string;
      ai_rules?: unknown;
      udl_checkpoints?: string[];
      success_look_fors?: string[];
      tags?: string[];
      source_block_id?: string;
    }>;
  }>;
}

// ----- Formatting -----

/** A block formatted for injection into a generation prompt */
export interface FormattedBlockForPrompt {
  id: string;
  title: string;
  prompt: string;
  efficacy_score: number;
  times_used: number;
  bloom_level: string | null;
  grouping: string | null;
  time_weight: string | null;
  design_phase: string | null;
  success_look_fors: string[] | null;
  ai_rules: unknown | null;
  response_type: string | null;
  materials_needed: string[] | null;
}
