/**
 * Map free-text language names from `students.learning_profile.languages_at_home[0]`
 * to BCP-47 codes used by the word_definitions cache (`l1_target` column).
 *
 * Phase 2A supports the 6 languages explicitly listed in the master spec:
 * English, Mandarin/Chinese, Korean, Japanese, Spanish, French. Other entries
 * fall back to 'en' (no translation slot rendered in the popover).
 *
 * Lowercased + trimmed name lookup. Multi-name aliases supported (e.g. both
 * "Chinese" and "Mandarin" map to 'zh' since the intake survey asks students
 * to free-text their home language).
 *
 * Phase 2B+ may extend the table; the supported set is intentionally narrow
 * for v1 because each new language adds an Anthropic translation prompt path
 * + a Chromebook TTS voice verification step.
 */

export const SUPPORTED_L1_TARGETS = ["en", "zh", "ko", "ja", "es", "fr"] as const;
export type L1Target = (typeof SUPPORTED_L1_TARGETS)[number];

const NAME_TO_CODE: Record<string, L1Target> = {
  // English
  english: "en",
  // Chinese family — both Mandarin and Cantonese map to zh (the cache key
  // is BCP-47 macro-language; spoken variant differences don't change the
  // written translation a student would tap to read)
  mandarin: "zh",
  chinese: "zh",
  cantonese: "zh",
  putonghua: "zh",
  zhongwen: "zh",
  "中文": "zh",
  // Korean
  korean: "ko",
  hangul: "ko",
  "한국어": "ko",
  // Japanese
  japanese: "ja",
  nihongo: "ja",
  "日本語": "ja",
  // Spanish
  spanish: "es",
  espanol: "es",
  "español": "es",
  castellano: "es",
  // French
  french: "fr",
  francais: "fr",
  "français": "fr",
};

/**
 * Map a language name to its BCP-47 code. Returns null for unmapped names
 * (caller should default to 'en' — meaning no translation slot).
 *
 * @example
 *   mapLanguageToCode("Mandarin") // → 'zh'
 *   mapLanguageToCode("english")  // → 'en'
 *   mapLanguageToCode("Tagalog")  // → null (unmapped)
 *   mapLanguageToCode("")         // → null
 *   mapLanguageToCode(null)       // → null
 */
export function mapLanguageToCode(name: string | null | undefined): L1Target | null {
  if (typeof name !== "string") return null;
  const key = name.trim().toLowerCase();
  if (!key) return null;
  return NAME_TO_CODE[key] ?? null;
}

/**
 * Resolve l1_target from a student's `languages_at_home` array.
 * Picks index 0 (the student's primary L1 per spec Q3 lock).
 * Returns 'en' as the safe default (which means: no translation slot).
 */
export function resolveL1Target(languagesAtHome: string[] | null | undefined): L1Target {
  if (!Array.isArray(languagesAtHome) || languagesAtHome.length === 0) return "en";
  return mapLanguageToCode(languagesAtHome[0]) ?? "en";
}

/**
 * Display label for a language code — used in the Anthropic prompt to
 * tell the model which language to translate into. NOT shown to students.
 */
export function l1DisplayLabel(code: L1Target): string {
  switch (code) {
    case "en": return "English";
    case "zh": return "Mandarin Chinese (Simplified)";
    case "ko": return "Korean";
    case "ja": return "Japanese";
    case "es": return "Spanish";
    case "fr": return "French";
  }
}
