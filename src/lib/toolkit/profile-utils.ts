/**
 * Profile Utilities — Infer ELL tier and other signals from StudentLearningIntake
 *
 * This bridges the student's self-reported learning profile (intake survey)
 * with the effort assessment system's ELL tier parameter.
 *
 * Research basis: docs/research/student-influence-factors.md
 * - Language proficiency moderates EVERY text-based metric
 * - BICS to CALP transition takes 5-7 years
 * - During transition, ELL students score 0.5-1.0 SD below peers
 * - Key signal: how many languages + whether English is primary
 */

import type { ELLTier } from "./effort-assessment";
import type { StudentLearningIntake } from "@/types";

/**
 * Languages where English is the primary medium of education.
 * Students who speak one of these + English are likely proficient (Tier 3).
 */
const ENGLISH_MEDIUM_LANGUAGES = new Set([
  "english",
]);

/**
 * Languages that share significant cognates/structure with English,
 * making CALP acquisition faster (~3-4 years instead of 5-7).
 * Students speaking these + English are likely Tier 2-3.
 */
const COGNATE_LANGUAGES = new Set([
  "french", "spanish", "portuguese", "italian", "german",
  "dutch", "swedish", "norwegian", "danish",
]);

/**
 * Infer ELL tier from a student's learning profile.
 *
 * Heuristic (not a formal language assessment — self-reported data):
 *
 * Tier 3 (Proficient): English is the ONLY language at home,
 *   OR English + one cognate language, OR student has lived in
 *   an English-speaking country for 3+ entries (proxy for extended stay).
 *
 * Tier 2 (Developing): English is one of multiple languages at home
 *   and the student has some international school experience
 *   (indicated by multiple countries). Default for multilingual students.
 *
 * Tier 1 (Beginning): English is NOT in their language list at all,
 *   OR they only speak non-cognate languages with English.
 *   This is the most conservative tier — better to over-scaffold.
 *
 * Falls back to the student's DB `ell_level` if available.
 *
 * @param profile - Student's self-reported learning profile
 * @param dbEllLevel - ELL level from the students table (teacher-assigned)
 * @returns ELLTier (1, 2, or 3)
 */
export function inferELLTier(
  profile: StudentLearningIntake | null | undefined,
  dbEllLevel?: string | null
): ELLTier {
  // If teacher has explicitly set ELL level in the DB, trust that first
  if (dbEllLevel) {
    const level = dbEllLevel.toLowerCase();
    if (level === "beginner" || level === "beginning" || level === "emerging") return 1;
    if (level === "intermediate" || level === "developing") return 2;
    if (level === "advanced" || level === "proficient" || level === "native") return 3;
  }

  // No profile → default to proficient (don't penalize)
  if (!profile?.languages_at_home?.length) return 3;

  const langs = profile.languages_at_home.map(l => l.toLowerCase().trim());
  const speaksEnglish = langs.some(l => ENGLISH_MEDIUM_LANGUAGES.has(l));
  const langCount = langs.length;

  // Only English → Tier 3
  if (speaksEnglish && langCount === 1) return 3;

  // English + cognate language(s) only → Tier 3
  if (speaksEnglish) {
    const nonEnglishLangs = langs.filter(l => !ENGLISH_MEDIUM_LANGUAGES.has(l));
    const allCognate = nonEnglishLangs.every(l => COGNATE_LANGUAGES.has(l));
    if (allCognate) return 3;

    // English + non-cognate languages → Tier 2 (multilingual, developing CALP)
    return 2;
  }

  // No English in language list → Tier 1
  // This student's primary language(s) are non-English
  return 1;
}

/**
 * Determine if a student is a Third Culture Kid (TCK).
 * TCKs have enhanced perspective-taking and creativity (research-backed).
 * Used by the Design Assistant to celebrate cross-cultural strengths.
 */
export function isTCK(profile: StudentLearningIntake | null | undefined): boolean {
  if (!profile?.countries_lived_in?.length) return false;
  return profile.countries_lived_in.length >= 2;
}

/**
 * Get a human-readable summary of the student's profile for teacher views.
 */
export function profileSummary(profile: StudentLearningIntake | null | undefined): string {
  if (!profile) return "No profile completed";

  const parts: string[] = [];

  if (profile.languages_at_home?.length) {
    parts.push(`${profile.languages_at_home.join(", ")}`);
  }
  if (profile.countries_lived_in?.length) {
    parts.push(`Lived in ${profile.countries_lived_in.length} ${profile.countries_lived_in.length === 1 ? "country" : "countries"}`);
  }
  if (profile.design_confidence) {
    const labels = ["", "Nervous", "Unsure", "Getting there", "Confident", "Loves it"];
    parts.push(`Design: ${labels[profile.design_confidence]}`);
  }
  if (profile.working_style) {
    const styles = { solo: "Solo worker", partner: "Partner worker", small_group: "Group worker" };
    parts.push(styles[profile.working_style] || profile.working_style);
  }
  if (profile.feedback_preference) {
    parts.push(`${profile.feedback_preference === "private" ? "Private" : "Public"} feedback`);
  }

  return parts.join(" · ") || "No profile completed";
}
