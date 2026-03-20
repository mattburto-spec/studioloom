/**
 * Teacher authorization helpers.
 *
 * - requireTeacherAuth() — extract authenticated teacher from Supabase session
 * - verifyTeacherHasUnit() — check teacher ↔ unit access (authored OR assigned)
 * - getNmConfigForClassUnit() — NM config with class→unit fallback
 * - verifyTeacherOwnsClass() — check teacher ↔ class ownership
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Teacher authentication
// ---------------------------------------------------------------------------

/**
 * Extract authenticated teacher from the Supabase session cookie.
 *
 * Returns the teacher's user ID or an error response.
 * Replaces the 35+ inline `createServerClient` + `getUser()` patterns.
 */
export async function requireTeacherAuth(
  request: NextRequest
): Promise<
  { teacherId: string; error?: never } | { teacherId?: never; error: NextResponse }
> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // Server components can't set cookies — no-op
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { teacherId: user.id };
}

// ---------------------------------------------------------------------------
// Teacher ↔ Unit / Class authorization
// ---------------------------------------------------------------------------

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
