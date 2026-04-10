/**
 * Image extraction stub — Seam 4 (content_assets).
 *
 * DEFERRED from Phase 1.5 to Phase 1.6 ("content_assets seam"). Image
 * extraction needs:
 *   1. A `content_assets` table (storage path, mime, source content_item,
 *      perceptual hash, alt text, OCR text, embedding for visual search).
 *   2. Supabase Storage bucket wiring + RLS.
 *   3. Per-format extractors:
 *      - PDF: pdfjs-dist `.getOperatorList()` to walk image XObjects
 *      - DOCX: mammoth's `convertImage` callback (already streams base64)
 *      - PPTX: officeparser exposes `media/` zip entries
 *   4. Optional OCR pass (Tesseract.js) for slide screenshots.
 *
 * The seam is here so when Phase 1.6 lands, the upload route doesn't need
 * editing — only this file gets a real implementation. Until then,
 * extractImages() is a typed no-op that always returns [].
 *
 * Tracking: see "Deferred from Phase 1.5" in
 * docs/projects/dimensions3-completion-spec.md.
 */

export interface ExtractedImage {
  /** Stable identifier within the upload (e.g., "page-3-image-1"). */
  localId: string;
  /** MIME type (e.g., "image/png"). */
  mimeType: string;
  /** Raw image bytes — caller is responsible for hashing + uploading. */
  bytes: Buffer;
  /** Perceptual hash for near-duplicate detection across uploads. */
  perceptualHash?: string;
  /** Source location hint (page number, slide number, paragraph index). */
  sourceLocation?: string;
}

/**
 * Extract embedded images from an uploaded document buffer.
 *
 * @stub Returns [] until Phase 1.6 wires content_assets. The signature
 *       is stable so callers can depend on it now.
 */
export async function extractImages(
  buffer: Buffer,
  ext: string
): Promise<ExtractedImage[]> {
  // TODO(phase-1.6/content-assets-seam): implement per-format image walk.
  // See dimensions3-completion-spec.md → "Deferred from Phase 1.5".
  void buffer;
  void ext;
  return [];
}
