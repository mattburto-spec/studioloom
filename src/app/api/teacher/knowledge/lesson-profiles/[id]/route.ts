import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

// Phase 0.4 (10 Apr 2026): GET kept as a historical read on the legacy
// lesson_profiles table. PATCH re-quarantined — verification/rating writes
// to lesson_profiles no longer accepted. See docs/quarantine.md.
const QUARANTINE_RESPONSE = NextResponse.json(
  {
    error:
      "Legacy lesson-profile PATCH quarantined — use /api/teacher/knowledge/ingest (Dimensions3). See docs/quarantine.md",
  },
  { status: 410 }
);

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
 * GET: Fetch a stored lesson profile by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabaseAdmin = createAdminClient();

  // Historical read — legacy pipeline, do not reintroduce writes.
  const { data: row, error } = await supabaseAdmin
    .from("lesson_profiles")
    .select(
      "id, title, subject_area, grade_level, lesson_type, pedagogical_approach, complexity_level, criteria_covered, profile_data, teacher_verified, teacher_quality_rating, analysis_version, analysis_model, created_at, updated_at"
    )
    .eq("id", id)
    .eq("teacher_id", teacherId)
    .single();

  if (error || !row) {
    return NextResponse.json(
      { error: "Lesson profile not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    profileId: row.id,
    profile: row.profile_data,
    title: row.title,
    verified: row.teacher_verified,
    rating: row.teacher_quality_rating,
    subjectArea: row.subject_area,
    gradeLevel: row.grade_level,
    lessonType: row.lesson_type,
    complexityLevel: row.complexity_level,
    criteriaCovered: row.criteria_covered,
    analysisVersion: row.analysis_version,
    analysisModel: row.analysis_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/**
 * PATCH: Update verification status and rating
 */
export async function PATCH(
  _request: NextRequest,
  _ctx: { params: Promise<{ id: string }> }
) {
  return QUARANTINE_RESPONSE;
}
