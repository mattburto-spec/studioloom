import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

async function getTeacherId(request: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * GET: Fetch the teacher's profile (school context + preferences)
 */
export async function GET(request: NextRequest) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  return NextResponse.json({ profile: data || null });
}

/**
 * POST: Create or update the teacher's profile
 */
export async function POST(request: NextRequest) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  return NextResponse.json({ profile: data });
}
