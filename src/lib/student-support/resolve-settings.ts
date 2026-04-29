/**
 * Phase 2.5 of language-scaffolding-redesign.
 *
 * Server-side resolver for student support settings. Walks the precedence
 * chain and returns the resolved per-runtime values for a student in a
 * given class context.
 *
 * Precedence (most-specific wins):
 *   1. class_students.support_settings (per-class override) — only if classId given
 *   2. students.support_settings (per-student override)
 *   3. learning_profile.languages_at_home (intake-derived L1 only)
 *   4. smart defaults (l1='en'; tapAWordEnabled = (ellLevel <= 2) OR (l1Target !== 'en'))
 *
 * Authority model (Q1 locked 27 Apr): student is source of truth (intake),
 * teacher overrides per-context. Original learning_profile.languages_at_home
 * is never written to by the teacher — overrides go in support_settings JSONB.
 *
 * Smart default for tapAWordEnabled (28 Apr 2026): instead of hard-coded
 * `true` for everyone, the default is true when the student has either a
 * non-native English profile (ELL ≤ 2) OR a non-English L1 (Mandarin etc.
 * — bilingual students still benefit from translation lookup even if
 * they're advanced English readers). ELL 3 monolingual English students
 * default to OFF for clean reading. Teachers can override either way.
 *
 * All callers that need the runtime values for tap-a-word (and future
 * Phase 4 settings) MUST go through this resolver. Don't read
 * learning_profile.languages_at_home[0] directly anywhere except inside
 * this function — bypassing the resolver means teacher overrides won't
 * apply.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mapLanguageToCode,
  type L1Target,
} from "@/lib/tap-a-word/language-mapping";
import { parseSupportSettings, type ResolvedSupportSettings } from "./types";

const DEFAULTS = {
  l1Target: "en" as L1Target,
} as const;

/**
 * Smart default for tapAWordEnabled — ON when the student is still
 * developing English (ELL 1-2) OR is bilingual (L1 ≠ English). Defaults
 * OFF only for ELL 3 monolingual English students who get a clean
 * reading view. Teacher overrides at student or class level always win.
 *
 * 28 Apr 2026: replaces the previous hard-coded `true` default. Was
 * causing tap-a-word to apply unnecessary visual noise to advanced
 * native English speakers.
 */
export function defaultTapAWordEnabled(
  ellLevel: number | null | undefined,
  l1Target: L1Target
): boolean {
  // Defensive: if ellLevel is null/undefined/invalid we err on the side of
  // ON. Better to give a fluent student a useless tooltip than to leave
  // an ELL student without scaffolding because their level wasn't set.
  const ell = typeof ellLevel === "number" && ellLevel >= 1 && ellLevel <= 3 ? ellLevel : 1;
  return ell <= 2 || l1Target !== "en";
}

/**
 * Phase 1.4 CS-2 (30 Apr 2026) — accepts an optional `supabase` client.
 *
 * When omitted, defaults to `createAdminClient()` (legacy admin-bypass
 * behaviour, used by teacher routes + the student `word-lookup` route).
 *
 * When provided (e.g. `createServerSupabaseClient()` from a CS-2/CS-3
 * student route), reads respect RLS — the canonical Phase-1 chain
 * `auth.uid() → students.user_id → students.id` filters which `students`
 * + `class_students` rows the resolver can see. CS-1's policy migrations
 * pre-positioned the supporting policies; this opt-in flag activates
 * them per-caller.
 */
export async function resolveStudentSettings(
  studentId: string,
  classId?: string,
  supabase: SupabaseClient = createAdminClient()
): Promise<ResolvedSupportSettings> {

  // Per-student row: support_settings + learning_profile + ell_level
  // (the ell_level is needed to compute the smart default for
  // tapAWordEnabled — see defaultTapAWordEnabled below).
  const { data: studentRow } = await supabase
    .from("students")
    .select("support_settings, learning_profile, ell_level")
    .eq("id", studentId)
    .maybeSingle();

  // Defensive: missing student row → defaults. Shouldn't happen in practice
  // because requireStudentAuth would have failed first, but the resolver
  // can be called from contexts beyond the route (e.g. server components).
  if (!studentRow) {
    return {
      l1Target: DEFAULTS.l1Target,
      // No ELL info → fall back to "everyone gets it" so we don't
      // accidentally strip scaffolding from a student we can't read.
      tapAWordEnabled: true,
      l1Source: "default",
      tapASource: "default",
    };
  }

  const studentOverrides = parseSupportSettings(studentRow.support_settings);

  // Per-class row: only fetched when classId is passed (per-student-only
  // contexts skip this query entirely, e.g. student dashboard before they
  // enter a class). Also pulls ell_level_override so the smart default
  // can use the per-class effective ELL when present.
  let classOverrides = parseSupportSettings(undefined);
  let classEllOverride: number | null = null;
  if (classId) {
    const { data: csRow } = await supabase
      .from("class_students")
      .select("support_settings, ell_level_override")
      .eq("student_id", studentId)
      .eq("class_id", classId)
      .maybeSingle();
    classOverrides = parseSupportSettings(csRow?.support_settings);
    classEllOverride =
      typeof csRow?.ell_level_override === "number" ? csRow.ell_level_override : null;
  }

  // Resolve l1Target: class > student > intake > default.
  // For 'intake' to be the source we need a languages_at_home[0] that
  // explicitly maps to one of our 6 supported L1s. Empty arrays + unmapped
  // languages (e.g. "Tagalog") fall through to default 'en'.
  let l1Target: L1Target = DEFAULTS.l1Target;
  let l1Source: ResolvedSupportSettings["l1Source"] = "default";
  if (classOverrides.l1_target_override) {
    l1Target = classOverrides.l1_target_override;
    l1Source = "class-override";
  } else if (studentOverrides.l1_target_override) {
    l1Target = studentOverrides.l1_target_override;
    l1Source = "student-override";
  } else {
    const lp = (studentRow.learning_profile ?? {}) as { languages_at_home?: unknown };
    const firstName =
      Array.isArray(lp.languages_at_home) && typeof lp.languages_at_home[0] === "string"
        ? (lp.languages_at_home[0] as string)
        : null;
    const intakeMapped = firstName ? mapLanguageToCode(firstName) : null;
    if (intakeMapped) {
      l1Target = intakeMapped;
      l1Source = "intake";
    }
  }

  // Resolve tapAWordEnabled: class > student > smart default.
  // Smart default uses the effective ELL (per-class override or student
  // global) AND the resolved L1 — see defaultTapAWordEnabled docstring.
  const effectiveEll = classEllOverride ?? studentRow.ell_level ?? null;
  const smartDefault = defaultTapAWordEnabled(effectiveEll, l1Target);

  let tapAWordEnabled: boolean = smartDefault;
  let tapASource: ResolvedSupportSettings["tapASource"] = "default";
  if (typeof classOverrides.tap_a_word_enabled === "boolean") {
    tapAWordEnabled = classOverrides.tap_a_word_enabled;
    tapASource = "class-override";
  } else if (typeof studentOverrides.tap_a_word_enabled === "boolean") {
    tapAWordEnabled = studentOverrides.tap_a_word_enabled;
    tapASource = "student-override";
  }

  return { l1Target, tapAWordEnabled, l1Source, tapASource };
}
