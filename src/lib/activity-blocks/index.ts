/**
 * Activity Block Library — Dimensions2
 *
 * Reusable activity blocks extracted from uploads, generated units, and manual creation.
 * Core entity for block-aware generation (assembling proven blocks vs generating from scratch).
 */

export { extractBlocksFromUpload, extractBlocksFromUnit } from "./extract";
export {
  insertActivityBlocks,
  insertActivityBlock,
  getActivityBlock,
  listActivityBlocks,
  deleteBlocksByUpload,
  deleteBlocksByUnit,
  retrieveActivityBlocks,
  formatBlocksForPrompt,
  formatBlocksAsPromptText,
  recordBlockUsage,
  recordBlockUsageFromPages,
  computeFileHash,
  checkFileHash,
} from "./store";
export type {
  BlockRetrievalParams,
  RetrievedBlock,
  ExtractFromUploadParams,
  ExtractFromUnitParams,
  LessonFlowPhase,
  FormattedBlockForPrompt,
} from "./types";
