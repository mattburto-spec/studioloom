import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";

/**
 * GET: Fetch the teacher's profile (school context + preferences)
 */
export const GET = withErrorHandler("teacher/profile:GET", async (request: NextRequest) => {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from("teacher_profiles")
    .select("*")
    .eq("teacher_id", teacherId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found (that's fine)
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also pull teacher.display_name + name so the settings UI can render them.
  // display_name column may not exist yet (migration 090 not applied) — retry
  // without it if PostgREST complains.
  let teacherRow = await supabaseAdmin
    .from("teachers")
    .select("name, display_name")
    .eq("id", teacherId)
    .maybeSingle();

  if (
    teacherRow.error &&
    (teacherRow.error.message.includes("display_name") ||
      teacherRow.error.code === "42703" ||
      teacherRow.error.code === "PGRST204")
  ) {
    teacherRow = await supabaseAdmin
      .from("teachers")
      .select("name")
      .eq("id", teacherId)
      .maybeSingle() as typeof teacherRow;
  }

  const teacher = teacherRow.data as { name?: string | null; display_name?: string | null } | null;

  return NextResponse.json(
    {
      profile: data || null,
      teacher: teacher
        ? { name: teacher.name || null, display_name: teacher.display_name || null }
        : null,
    },
    {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
    }
  );
});

/**
 * POST: Create or update the teacher's profile
 */
export const POST = withErrorHandler("teacher/profile:POST", async (request: NextRequest) => {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const body = await request.json();
  const supabaseAdmin = createAdminClient();

  // Upsert on teacher_id unique constraint
  const { data, error } = await supabaseAdmin
    .from("teacher_profiles")
    .upsert(
      {
        teacher_id: teacherId,
        school_context: body.school_context || {},
        teacher_preferences: body.teacher_preferences || {},
        school_name: body.school_name || null,
        country: body.country || null,
        curriculum_framework: body.curriculum_framework || null,
        typical_period_minutes: body.typical_period_minutes || null,
        subjects_taught: body.subjects_taught || [],
        grade_levels_taught: body.grade_levels_taught || [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "teacher_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("[teacher/profile] Upsert failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If the caller passed a display_name, update the teachers row too.
  // Silently ignore if the column doesn't exist yet (migration 090 not applied).
  if (typeof body.display_name !== "undefined") {
    const trimmed = typeof body.display_name === "string" ? body.display_name.trim() : "";
    const { error: displayErr } = await supabaseAdmin
      .from("teachers")
      .update({ display_name: trimmed || null })
      .eq("id", teacherId);
    if (displayErr) {
      console.warn("[teacher/profile] display_name update skipped:", displayErr.message);
    }
  }

  return NextResponse.json({ profile: data });
});
