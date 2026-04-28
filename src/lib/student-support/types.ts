/**
 * Phase 2.5 of language-scaffolding-redesign.
 *
 * Shape of the `support_settings` JSONB on `students` and `class_students`.
 * All keys nullable — null means "no override at this level, fall back to
 * the next level in the resolver's precedence chain".
 *
 * The resolver merges school → student → class (most-specific wins) then
 * falls back to derived defaults (e.g. l1_target from learning_profile).
 */

import type { L1Target } from "@/lib/tap-a-word/language-mapping";

export interface SupportSettingsRaw {
  /** Teacher's L1 override. null = use intake-derived L1. */
  l1_target_override?: L1Target | null;
  /** Per-student kill-switch for tap-a-word feature. null = use parent default (true). */
  tap_a_word_enabled?: boolean | null;
  // Future Phase 4 additions: hint_default, response_starters_enabled, etc.
}

/**
 * The fully-resolved settings a student sees at runtime, merged from all
 * sources. Every field has a definite value (no nulls — defaults applied).
 */
export interface ResolvedSupportSettings {
  /** Resolved L1 target (BCP-47). 'en' means no translation slot. */
  l1Target: L1Target;
  /** Whether tap-a-word is enabled for this student in this class. */
  tapAWordEnabled: boolean;
  /** Where the L1 came from — useful for the teacher UI badge. */
  l1Source: "intake" | "student-override" | "class-override" | "default";
  /** Where the tap-a-word toggle came from. */
  tapASource: "default" | "student-override" | "class-override";
}

/**
 * Defensively coerce any unknown JSONB blob to a SupportSettingsRaw object.
 * Drops unknown keys + invalid types. Used by the resolver to sanitize
 * arbitrary JSONB data from Postgres.
 */
const SUPPORTED_L1: ReadonlyArray<L1Target> = ["en", "zh", "ko", "ja", "es", "fr"];

export function parseSupportSettings(raw: unknown): SupportSettingsRaw {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: SupportSettingsRaw = {};
  if (obj.l1_target_override === null) {
    out.l1_target_override = null;
  } else if (typeof obj.l1_target_override === "string") {
    const s = obj.l1_target_override as L1Target;
    if (SUPPORTED_L1.includes(s)) out.l1_target_override = s;
  }
  if (obj.tap_a_word_enabled === null) {
    out.tap_a_word_enabled = null;
  } else if (typeof obj.tap_a_word_enabled === "boolean") {
    out.tap_a_word_enabled = obj.tap_a_word_enabled;
  }
  return out;
}

/**
 * Bug 3 — merge an incoming partial-settings patch onto existing settings,
 * treating an explicit `null` as a "delete this key" signal rather than a
 * "save null override" signal.
 *
 * Why: the resolver uses falsy/non-boolean checks to skip null values, so
 * functionally null and missing keys produce the same runtime behaviour.
 * But persisting nulls means JSONB grows orphan keys forever and the UI
 * teacher-reset action looks like a no-op (the row still has the key,
 * just set to null). Deleting on reset keeps the JSONB clean and matches
 * what the teacher intended.
 *
 * `existing` is parsed defensively before merge so unknown keys never
 * survive a write — even if a previous version of this code (or a manual
 * SQL edit) wrote junk into the column, this round-trip cleans it.
 */
export function mergeSupportSettingsForWrite(
  existing: unknown,
  incoming: SupportSettingsRaw
): SupportSettingsRaw {
  const merged: SupportSettingsRaw = { ...parseSupportSettings(existing) };
  for (const [k, v] of Object.entries(incoming) as [keyof SupportSettingsRaw, unknown][]) {
    if (v === null) {
      delete merged[k];
    } else {
      // Type assertion safe because incoming has already been parsed by
      // the caller; this only runs for valid SupportSettingsRaw values.
      (merged as Record<string, unknown>)[k] = v;
    }
  }
  return merged;
}
