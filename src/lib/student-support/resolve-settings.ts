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
 *   4. defaults (l1='en', tapAWordEnabled=true)
 *
 * Authority model (Q1 locked 27 Apr): student is source of truth (intake),
 * teacher overrides per-context. Original learning_profile.languages_at_home
 * is never written to by the teacher — overrides go in support_settings JSONB.
 *
 * All callers that need the runtime values for tap-a-word (and future
 * Phase 4 settings) MUST go through this resolver. Don't read
 * learning_profile.languages_at_home[0] directly anywhere except inside
 * this function — bypassing the resolver means teacher overrides won't
 * apply.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  mapLanguageToCode,
  type L1Target,
} from "@/lib/tap-a-word/language-mapping";
import { parseSupportSettings, type ResolvedSupportSettings } from "./types";

const DEFAULTS = {
  l1Target: "en" as L1Target,
  tapAWordEnabled: true,
} as const;

export async function resolveStudentSettings(
  studentId: string,
  classId?: string
): Promise<ResolvedSupportSettings> {
  const supabase = createAdminClient();

  // Per-student row: support_settings + learning_profile (for intake-derived L1).
  const { data: studentRow } = await supabase
    .from("students")
    .select("support_settings, learning_profile")
    .eq("id", studentId)
    .maybeSingle();

  // Defensive: missing student row → defaults. Shouldn't happen in practice
  // because requireStudentAuth would have failed first, but the resolver
  // can be called from contexts beyond the route (e.g. server components).
  if (!studentRow) {
    return {
      l1Target: DEFAULTS.l1Target,
      tapAWordEnabled: DEFAULTS.tapAWordEnabled,
      l1Source: "default",
      tapASource: "default",
    };
  }

  const studentOverrides = parseSupportSettings(studentRow.support_settings);

  // Per-class row: only fetched when classId is passed (per-student-only
  // contexts skip this query entirely, e.g. student dashboard before they
  // enter a class).
  let classOverrides = parseSupportSettings(undefined);
  if (classId) {
    const { data: csRow } = await supabase
      .from("class_students")
      .select("support_settings")
      .eq("student_id", studentId)
      .eq("class_id", classId)
      .maybeSingle();
    classOverrides = parseSupportSettings(csRow?.support_settings);
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

  // Resolve tapAWordEnabled: class > student > default
  let tapAWordEnabled: boolean = DEFAULTS.tapAWordEnabled;
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
