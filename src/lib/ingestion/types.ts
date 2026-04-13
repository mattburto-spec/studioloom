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

/**
 * Per-tag confidence scores. Replaces the single document-level `confidence`
 * with one score per classified dimension. Spec §4 requires per-tag confidence
 * so the curator can spot weak fields without re-reading the whole output.
 *
 * All values 0..1; absent dimensions are treated as 0 (not classified).
 */
export interface ClassificationConfidence {
  documentType: number;
  subject?: number;
  strand?: number;
  level?: number;
}

export interface IngestionClassification {
  documentType: DocumentType;
  /** @deprecated use `confidences.documentType` — kept for back-compat with v1 sandbox/tests */
  confidence: number;
  /** Per-tag confidence per spec §4. */
  confidences: ClassificationConfidence;
  topic: string;
  sections: IngestionSection[];
  detectedSubject?: string;
  /** Curriculum strand or domain (e.g., "Materials & Manufacture", "Algebra"). */
  detectedStrand?: string;
  /** Year/grade level or stage (e.g., "MYP3", "Year 9", "KS3"). */
  detectedLevel?: string;
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
  /**
   * Set by the Stage I-4b copyright heuristic when a verbatim chunk ≥ 200
   * chars matched an existing block in the corpus. Populated alongside a
   * forced `copyrightFlag='copyrighted'` flip. Advisory only — surfaced in
   * the sandbox review UI so curators can see what triggered the flag.
   */
  copyrightMatchedSnippet?: string;
}

export interface ExtractionResult {
  blocks: ExtractedBlock[];
  totalSectionsProcessed: number;
  activitySectionsFound: number;
  piiDetected: boolean;
  cost: CostBreakdown;
}

// =========================================================================
// Stage I-5: Moderation (Haiku)
// =========================================================================

/** Lifecycle of a candidate block through moderation. Matches the DB CHECK
 *  constraint on `activity_blocks.moderation_status` added in migration 067. */
export type ModerationStatus =
  | "approved"
  | "flagged"
  | "rejected"
  | "pending"
  | "grandfathered";

export interface ModerationFlag {
  category: string;                   // 'violence' | 'sexual' | ... | 'other'
  severity: "info" | "warning" | "critical";
  reason?: string;
  snippet?: string;
}

/** ExtractedBlock after Stage I-5 moderation has run. */
export interface ModeratedBlock extends ExtractedBlock {
  moderationStatus: ModerationStatus;
  moderationFlags: ModerationFlag[];
}

export interface ModerationStageResult {
  blocks: ModeratedBlock[];
  /** Total Haiku cost across the moderation batch. */
  cost: CostBreakdown;
  /** Counts for the sandbox summary panel. */
  approvedCount: number;
  flaggedCount: number;
  pendingCount: number;
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
  moderation: ModerationStageResult;
  totalCost: CostBreakdown;
  totalTimeMs: number;
  /** Phase 6C: true when upload-level safety scan flagged/blocked the content */
  moderationHold?: boolean;
  /** Phase 6C: human-readable reason for the hold */
  moderationHoldReason?: string;
}
