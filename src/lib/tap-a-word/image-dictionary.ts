/**
 * Phase 2C of language-scaffolding-redesign.
 *
 * Pure synchronous loader for the curated word → image-URL mapping.
 *
 * Lookup is case-insensitive (lowercases + trims input). No fuzzy
 * matching — exact lemma match only, predictable + cheap.
 *
 * Returns null for unknown words; WordPopover hides the image slot
 * accordingly. If an image URL is set but the asset fails to load
 * (404, network, CORS), WordPopover's <img onError> hides the slot
 * client-side — no broken-image icons ever shown to students.
 *
 * The dictionary itself ships as JSON (image-dictionary.json) so it
 * can be edited or regenerated without TypeScript changes. v0 ships
 * with a small seed; content team adds entries over time.
 */

import dictionary from "./image-dictionary.json";

interface DictionaryShape {
  _meta?: unknown;
  entries: Record<string, string>;
}

const ENTRIES: Record<string, string> = (dictionary as DictionaryShape).entries ?? {};

/**
 * Look up a curated image URL for a word.
 *
 * @example
 *   imageForWord("ergonomics") // → "https://commons.wikimedia.org/..."
 *   imageForWord("ERGONOMICS") // → same (case-insensitive)
 *   imageForWord("undefined-word") // → null
 *   imageForWord("") // → null
 */
export function imageForWord(word: string | null | undefined): string | null {
  if (typeof word !== "string") return null;
  const key = word.trim().toLowerCase();
  if (!key) return null;
  return ENTRIES[key] ?? null;
}

/**
 * Test-only: how many entries are seeded. Used by tests to assert the
 * JSON shipped with non-zero seed (catches accidental empty-dictionary
 * commits).
 */
export function __dictionarySize(): number {
  return Object.keys(ENTRIES).length;
}
