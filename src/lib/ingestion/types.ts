/**
 * Ingestion Pipeline types — Dimensions3 Phase B.
 *
 * Expandable pass architecture: each pass is a pure function conforming to
 * IngestionPass<TInput, TOutput>. The registry auto-generates sandbox panels.
 * Adding a pass = write function + push to registry. No pipeline refactoring.
 *
 * OS Seam 1: Pass functions receive supabaseClient via PassConfig — no
 * direct HTTP request dependencies, no internal client construction.
 */

import type { CostBreakdown } from "@/types/activity-blocks";

// =========================================================================
// Pass Architecture
// =========================================================================

export interface PassConfig {
  /**
   * Supabase client — created by API route, passed to pure functions (OS Seam 1).
   * Structurally typed (not the full SupabaseClient generic) so unit-test mocks
   * and the service-role client both satisfy it without dragging the generated
   * Database type through every ingestion module.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural shape; full SupabaseClient generics break inline test mocks
  supabaseClient?: { from: (table: string) => any };
  /** Teacher ID for ownership scoping */
  teacherId?: string;
  /** Override the default model for this pass */
  modelOverride?: string;
  /** Anthropic API key (for AI passes) */
  apiKey?: string;
  /** Whether we're in sandbox/test mode (no real AI calls) */
  sandboxMode?: boolean;
}

export interface IngestionPass<TInput, TOutput> {
  id: string;
  label: string;
  model: string;
  run: (input: TInput, config: PassConfig) => Promise<TOutput & { cost: CostBreakdown }>;
}

// =========================================================================
// Stage I-0: Dedup
// =========================================================================

export interface DedupResult {
  fileHash: string;
  /** Hard duplicate: same SHA-256 file_hash already in content_items. Skips downstream stages. */
  isDuplicate: boolean;
  existingContentItemId?: string;
  /**
   * Soft duplicate: max cosine similarity vs any existing activity_block embedding.
   * 0..1; populated when nearest neighbour ≥ 0.92. Informational only — does NOT
   * skip pipeline stages. Surfaces near-duplicate content in the sandbox so the
   * curator can decide whether to commit or merge.
   */
  nearDuplicateScore?: number;
  nearDuplicateBlockId?: string;
  nearDuplicateBlockTitle?: string;
  cost: CostBreakdown;
}

// =========================================================================
// Stage I-1: Deterministic Parsing
// =========================================================================

export interface ParsedSection {
  index: number;
  heading: string;
  content: string;
  level: number;           // Heading depth (1=H1, 2=H2, etc.)
  wordCount: number;
  hasListItems: boolean;
  hasDuration: boolean;    // Contains time-like patterns (e.g., "10 min")
}

export interface ParseResult {
  title: string;
  sections: ParsedSection[];
  totalWordCount: number;
  headingCount: number;
  cost: CostBreakdown;
}

// =========================================================================
// Stage I-2: Pass A — Classify + Tag
// =========================================================================

export type DocumentType =
  | "lesson_plan"
  | "scheme_of_work"
  | "rubric"
  | "resource"
  | "textbook_extract"
  | "worksheet"
  | "unknown";

export interface IngestionSection {
  index: number;
  heading: string;
  content: string;
  sectionType: "activity" | "instruction" | "assessment" | "metadata" | "unknown";
  estimatedDuration?: "quick" | "moderate" | "extended";
}

export interface IngestionClassification {
  documentType: DocumentType;
  confidence: number;
  topic: string;
  sections: IngestionSection[];
  detectedSubject?: string;
  cost: CostBreakdown;
}

// =========================================================================
// Stage I-3: Pass B — Analyse + Enrich
// =========================================================================

export interface EnrichedSection extends IngestionSection {
  bloom_level: string;
  time_weight: string;
  grouping: string;
  phase: string;
  activity_category: string;
  materials: string[];
  scaffolding_notes?: string;
  udl_hints?: string[];
  teaching_approach?: string;
}

export interface IngestionAnalysis {
  classification: IngestionClassification;
  enrichedSections: EnrichedSection[];
  cost: CostBreakdown;
}

// =========================================================================
// Stage I-4: Block Extraction
// =========================================================================

/** Copyright provenance flag set at upload and carried through extraction. */
export type CopyrightFlag = "own" | "copyrighted" | "creative_commons" | "unknown";

export interface PIIFlag {
  type: "email" | "phone" | "name" | "school" | "location" | "date" | "other";
  value: string;
  position: number;
  aiVerified: boolean;
}

export interface ExtractedBlock {
  /** Temporary ID — real UUID assigned on DB insert */
  tempId: string;
  title: string;
  description: string;
  prompt: string;
  bloom_level: string;
  time_weight: string;
  grouping: string;
  phase: string;
  activity_category: string;
  materials: string[];
  scaffolding_notes?: string;
  udl_hints?: string[];
  teaching_approach?: string;
  source_section_index: number;
  piiFlags: PIIFlag[];
  copyrightFlag: "own" | "copyrighted" | "creative_commons" | "unknown";
}

export interface ExtractionResult {
  blocks: ExtractedBlock[];
  totalSectionsProcessed: number;
  activitySectionsFound: number;
  piiDetected: boolean;
  cost: CostBreakdown;
}

// =========================================================================
// Full Pipeline Result
// =========================================================================

export interface IngestionPipelineResult {
  contentItemId?: string;
  dedup: DedupResult;
  parse: ParseResult;
  classification: IngestionClassification;
  analysis: IngestionAnalysis;
  extraction: ExtractionResult;
  totalCost: CostBreakdown;
  totalTimeMs: number;
}
