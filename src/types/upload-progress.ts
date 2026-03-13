/**
 * Upload Progress Types
 *
 * SSE event types and stage configuration for the document upload pipeline.
 * Used by the upload API route (streaming) and knowledge page (progress UI).
 */

import type { LessonProfile } from "./lesson-intelligence";

/* ================================================================
   UPLOAD STAGES
   ================================================================ */

export type UploadStage =
  | "extracting"
  | "vision"
  | "pass1_structure"
  | "pass2_pedagogy"
  | "pass3_design_teaching"
  | "storing_profile"
  | "chunking"
  | "embedding"
  | "creating_library_item"
  | "complete";

/* ================================================================
   SSE EVENT TYPES
   ================================================================ */

export interface UploadProgressEvent {
  type: "progress";
  stage: UploadStage;
  percent: number;
  message: string;
}

export interface UploadCompleteEvent {
  type: "complete";
  uploadId: string;
  filename: string;
  chunkCount: number;
  imageCount: number;
  title: string;
  profileId?: string;
  profile?: LessonProfile;
  analysed?: boolean;
}

export interface UploadErrorEvent {
  type: "error";
  error: string;
}

export type UploadSSEEvent =
  | UploadProgressEvent
  | UploadCompleteEvent
  | UploadErrorEvent;

/* ================================================================
   STAGE CONFIGURATION — Educational messages + progress percentages
   ================================================================ */

export interface StageConfig {
  percent: number;
  messages: string[];
}

/**
 * Maps each upload stage to a progress percentage and array of
 * educational messages. The client rotates through messages for
 * long-running stages (pass2, pass3) every ~4 seconds.
 */
export const UPLOAD_STAGE_CONFIG: Record<UploadStage, StageConfig> = {
  extracting: {
    percent: 5,
    messages: [
      "Reading through your document...",
      "Extracting text and structure...",
    ],
  },
  vision: {
    percent: 15,
    messages: [
      "Examining diagrams and images...",
      "Analysing visual content...",
    ],
  },
  pass1_structure: {
    percent: 25,
    messages: [
      "Mapping the lesson structure...",
      "Identifying sections and timing...",
      "Finding learning objectives...",
    ],
  },
  pass2_pedagogy: {
    percent: 40,
    messages: [
      "Analysing pedagogical approach...",
      "Identifying scaffolding and differentiation...",
      "Mapping cognitive load curve...",
      "Evaluating assessment strategies...",
    ],
  },
  pass3_design_teaching: {
    percent: 60,
    messages: [
      "Assessing workshop reality...",
      "Checking safety considerations and materials...",
      "Analysing classroom management implications...",
      "Evaluating tool and equipment usage...",
    ],
  },
  storing_profile: {
    percent: 72,
    messages: [
      "Building lesson intelligence profile...",
    ],
  },
  chunking: {
    percent: 80,
    messages: [
      "Breaking into searchable knowledge...",
      "Aligning to lesson phases...",
    ],
  },
  embedding: {
    percent: 90,
    messages: [
      "Building semantic connections...",
      "Indexing for intelligent retrieval...",
    ],
  },
  creating_library_item: {
    percent: 95,
    messages: [
      "Adding to your knowledge library...",
    ],
  },
  complete: {
    percent: 100,
    messages: [
      "Analysis complete",
    ],
  },
};
