/**
 * RELOCATED — canonical file is now src/lib/ingestion/document-extract.ts
 *
 * This file re-exports everything so existing consumers don't break.
 * New code should import from "@/lib/ingestion/document-extract" directly.
 *
 * TODO: Delete this shim once all importers are updated (tracked as FU-Library-B3).
 */
export {
  extractFromPDF,
  extractFromDOCX,
  extractFromPPTX,
  extractDocument,
  sectionsToMarkdown,
} from "@/lib/ingestion/document-extract";

export type {
  ExtractedSection,
  ExtractedDoc,
} from "@/lib/ingestion/document-extract";
