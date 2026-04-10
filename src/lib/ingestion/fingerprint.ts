/**
 * Content Fingerprint — Phase 1.5 item 10.
 *
 * Deterministic SHA-256 fingerprint over (title, prompt, source_type) used
 * by the activity_blocks UNIQUE constraint added in migration 068. The
 * commit route uses this for ON CONFLICT (content_fingerprint) handling.
 *
 * IMPORTANT: the normalisation rules below MUST stay in lock-step with
 * the SQL backfill in migration 068. If you change one, change the other.
 *
 * Normalisation:
 *   1. lowercase
 *   2. collapse all whitespace runs to a single space
 *   3. trim leading + trailing whitespace
 *   4. strip trailing punctuation (.,;:!?)
 *
 * Composition: normalise(title) + '\n' + normalise(prompt) + '\n' + source_type
 *
 * Why these three fields:
 *   - title + prompt = the human-meaningful content of the block
 *   - source_type = preserves the meaningful difference between, e.g., a
 *     teacher's hand-curated 'manual' block and an identically-worded
 *     'extracted' block from a lesson plan upload
 *
 * Why NOT description: descriptions are auto-generated from the first
 * sentence of prompt-adjacent content, so they vary noisily across
 * extracts of the same source material. Including them would defeat the
 * point of the fingerprint.
 */

import { createHash } from "crypto";

/**
 * Normalise a single text field to its fingerprint form. Exported for
 * unit tests so the JS<->SQL parity check can hammer it directly.
 */
export function normaliseForFingerprint(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:!?]+$/g, "");
}

/**
 * Compute the content fingerprint for an activity block.
 * Returns a 64-character lowercase hex SHA-256 digest.
 */
export function computeContentFingerprint(input: {
  title: string;
  prompt: string;
  sourceType: string;
}): string {
  const composed =
    normaliseForFingerprint(input.title || "") +
    "\n" +
    normaliseForFingerprint(input.prompt || "") +
    "\n" +
    (input.sourceType || "");
  return createHash("sha256").update(composed).digest("hex");
}
