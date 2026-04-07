/**
 * Ingestion Pipeline — Dimensions3 Phase B
 *
 * Upload → Dedup → Parse → Pass A (Classify) → Pass B (Analyse) → Extract → Review
 */

export { runIngestionPipeline, type IngestionInput } from "./pipeline";
export { ingestionPasses, getPass } from "./registry";
export { passA } from "./pass-a";
export { passB } from "./pass-b";
export { dedupCheck, computeHash } from "./dedup";
export { parseDocument } from "./parse";
export { extractBlocks } from "./extract";
export { scanForPII, hasPII } from "./pii-scan";

export type {
  PassConfig,
  IngestionPass,
  DedupResult,
  ParseResult,
  ParsedSection,
  DocumentType,
  IngestionSection,
  IngestionClassification,
  EnrichedSection,
  IngestionAnalysis,
  PIIFlag,
  ExtractedBlock,
  ExtractionResult,
  IngestionPipelineResult,
} from "./types";
