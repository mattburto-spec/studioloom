/**
 * Unit Content Resolution — Copy-on-Write Forking
 *
 * Resolution chain (same pattern as NM config):
 *   1. class_units.content_data  (class-local fork, if exists)
 *   2. units.content_data         (master template fallback)
 *
 * When a teacher edits a class-unit for the first time, ensureForked()
 * deep-copies the master content into class_units.content_data.
 * All subsequent reads use the fork; the master is untouched.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UnitContentData } from "@/types";

// ---------------------------------------------------------------------------
// Pure resolution (no DB calls)
// ---------------------------------------------------------------------------

/**
 * Returns class-local content if it exists, otherwise master content.
 * Use when you already have both values loaded from DB.
 */
export function resolveClassUnitContent(
  masterContent: UnitContentData,
  classUnitContent: UnitContentData | null | undefined
): UnitContentData {
  return classUnitContent ?? masterContent;
}

// ---------------------------------------------------------------------------
// Server-side resolution (with DB calls — use in API routes only)
// ---------------------------------------------------------------------------

export interface ResolvedContent {
  content: UnitContentData;
  isForked: boolean;
  forkedAt: string | null;
  forkedFromVersion: number | null;
}

/**
 * Fetches resolved content for a class-unit from the database.
 * Checks class_units.content_data first, falls back to units.content_data.
 *
 * @param supabase - Admin or authenticated Supabase client
 * @param unitId - The master unit ID
 * @param classId - The class ID
 */
export async function getResolvedContent(
  supabase: SupabaseClient,
  unitId: string,
  classId: string
): Promise<ResolvedContent> {
  // Try class-local content first
  const { data: classUnit } = await supabase
    .from("class_units")
    .select("content_data, forked_at, forked_from_version")
    .eq("unit_id", unitId)
    .eq("class_id", classId)
    .maybeSingle();

  if (classUnit?.content_data) {
    return {
      content: classUnit.content_data as UnitContentData,
      isForked: true,
      forkedAt: classUnit.forked_at,
      forkedFromVersion: classUnit.forked_from_version,
    };
  }

  // Fall back to master
  const { data: unit } = await supabase
    .from("units")
    .select("content_data")
    .eq("id", unitId)
    .single();

  if (!unit) {
    throw new Error(`Unit ${unitId} not found`);
  }

  return {
    content: unit.content_data as UnitContentData,
    isForked: false,
    forkedAt: null,
    forkedFromVersion: null,
  };
}

// ---------------------------------------------------------------------------
// Fork-on-write
// ---------------------------------------------------------------------------

export interface ForkResult {
  content: UnitContentData;
  alreadyForked: boolean;
}

/**
 * Ensures a class-unit has its own content_data (fork-on-write).
 * If not yet forked, deep-copies from master and writes to class_units.
 * If already forked, returns the existing class-local content.
 *
 * Call this before any content edit in a class context.
 *
 * @param supabase - Admin Supabase client (bypasses RLS)
 * @param unitId - The master unit ID
 * @param classId - The class ID
 */
export async function ensureForked(
  supabase: SupabaseClient,
  unitId: string,
  classId: string
): Promise<ForkResult> {
  // Check if already forked
  const { data: classUnit } = await supabase
    .from("class_units")
    .select("content_data")
    .eq("unit_id", unitId)
    .eq("class_id", classId)
    .maybeSingle();

  if (classUnit?.content_data) {
    return {
      content: classUnit.content_data as UnitContentData,
      alreadyForked: true,
    };
  }

  // Not yet forked — deep-copy from master
  const { data: unit } = await supabase
    .from("units")
    .select("content_data")
    .eq("id", unitId)
    .single();

  if (!unit) {
    throw new Error(`Unit ${unitId} not found`);
  }

  // Deep copy to break all references
  const forkedContent = JSON.parse(
    JSON.stringify(unit.content_data)
  ) as UnitContentData;

  const { error } = await supabase
    .from("class_units")
    .update({
      content_data: forkedContent,
      forked_at: new Date().toISOString(),
      forked_from_version: (unit as Record<string, unknown>).current_version ?? 1,
    })
    .eq("unit_id", unitId)
    .eq("class_id", classId);

  if (error) {
    throw new Error(`Failed to fork content: ${error.message}`);
  }

  return {
    content: forkedContent,
    alreadyForked: false,
  };
}

// ---------------------------------------------------------------------------
// Version management (for P1 — save back to master)
// ---------------------------------------------------------------------------

/**
 * Saves a class-unit's content as a new version of the master unit.
 * Does NOT overwrite the master content — appends to version history.
 */
export async function saveAsVersion(
  supabase: SupabaseClient,
  unitId: string,
  classId: string,
  label: string
): Promise<{ versionNumber: number }> {
  // Get current class content
  const { data: classUnit } = await supabase
    .from("class_units")
    .select("content_data")
    .eq("unit_id", unitId)
    .eq("class_id", classId)
    .single();

  if (!classUnit?.content_data) {
    throw new Error("Class unit has no forked content to save as version");
  }

  // Get current version number from master
  const { data: unit } = await supabase
    .from("units")
    .select("current_version, versions")
    .eq("id", unitId)
    .single();

  if (!unit) throw new Error(`Unit ${unitId} not found`);

  const nextVersion = (unit.current_version ?? 1) + 1;

  // Store version content in separate table
  const { error: versionError } = await supabase
    .from("unit_versions")
    .insert({
      unit_id: unitId,
      version_number: nextVersion,
      label,
      content_data: classUnit.content_data,
      source_class_id: classId,
    });

  if (versionError) {
    throw new Error(`Failed to save version: ${versionError.message}`);
  }

  // Update master's version metadata (lightweight — no content in this array)
  const versions = Array.isArray(unit.versions) ? unit.versions : [];
  versions.push({
    version: nextVersion,
    label,
    created_at: new Date().toISOString(),
    source_class_id: classId,
  });

  const { error: updateError } = await supabase
    .from("units")
    .update({
      versions,
      current_version: nextVersion,
    })
    .eq("id", unitId);

  if (updateError) {
    throw new Error(`Failed to update master: ${updateError.message}`);
  }

  return { versionNumber: nextVersion };
}
