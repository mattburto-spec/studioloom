/**
 * Teacher ↔ Unit authorization helpers
 *
 * These replace the old pattern of checking `units.author_teacher_id`
 * which blocked teachers from managing units they assigned but didn't author.
 *
 * New pattern: a teacher has access to a unit if they:
 * 1. Authored it (units.author_teacher_id = teacherId), OR
 * 2. Have it assigned to one of their classes (class_units via classes.teacher_id)
 */

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Check if a teacher has access to a unit (authored OR assigned).
 * Returns the class_id if access is via assignment, null if via authorship.
 */
export async function verifyTeacherHasUnit(
  teacherId: string,
  unitId: string
): Promise<{ hasAccess: boolean; isAuthor: boolean; classIds: string[] }> {
  const db = createAdminClient();

  // Check authorship first (fastest path)
  const { data: unit } = await db
    .from("units")
    .select("id")
    .eq("id", unitId)
    .or(`author_teacher_id.eq.${teacherId},teacher_id.eq.${teacherId}`)
    .single();

  // Check class assignment
  const { data: classUnits } = await db
    .from("class_units")
    .select("class_id")
    .eq("unit_id", unitId)
    .eq("is_active", true)
    .in(
      "class_id",
      // Subquery: get all class IDs owned by this teacher
      (
        await db
          .from("classes")
          .select("id")
          .eq("teacher_id", teacherId)
      ).data?.map((c) => c.id) || []
    );

  const classIds = (classUnits || []).map((cu) => cu.class_id);
  const isAuthor = !!unit;
  const hasAccess = isAuthor || classIds.length > 0;

  return { hasAccess, isAuthor, classIds };
}

/**
 * Get the NM config for a unit in a specific class context.
 * Reads from class_units.nm_config first, falls back to units.nm_config.
 */
export async function getNmConfigForClassUnit(
  classId: string,
  unitId: string
): Promise<Record<string, unknown> | null> {
  const db = createAdminClient();

  // Try class-level config first
  const { data: classUnit } = await db
    .from("class_units")
    .select("nm_config")
    .eq("class_id", classId)
    .eq("unit_id", unitId)
    .single();

  if (classUnit?.nm_config) {
    return classUnit.nm_config as Record<string, unknown>;
  }

  // Fall back to unit-level config (backward compat)
  const { data: unit } = await db
    .from("units")
    .select("nm_config")
    .eq("id", unitId)
    .single();

  return (unit?.nm_config as Record<string, unknown>) || null;
}

/**
 * Verify a teacher owns a specific class.
 */
export async function verifyTeacherOwnsClass(
  teacherId: string,
  classId: string
): Promise<boolean> {
  const db = createAdminClient();

  const { data } = await db
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", teacherId)
    .single();

  return !!data;
}
