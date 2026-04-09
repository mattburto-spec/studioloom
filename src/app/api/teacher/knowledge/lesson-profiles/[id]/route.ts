import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

const QUARANTINE_RESPONSE = NextResponse.json({ error: "Knowledge pipeline quarantined — pending architecture rebuild. See docs/quarantine.md" }, { status: 410 });

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
  return QUARANTINE_RESPONSE;
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabaseAdmin = createAdminClient();

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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return QUARANTINE_RESPONSE;
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabaseAdmin = createAdminClient();

  // Build update object from allowed fields
  const updates: Record<string, unknown> = {};
  if (typeof body.teacher_verified === "boolean") {
    updates.teacher_verified = body.teacher_verified;
  }
  if (typeof body.teacher_quality_rating === "number" && body.teacher_quality_rating >= 1 && body.teacher_quality_rating <= 5) {
    updates.teacher_quality_rating = body.teacher_quality_rating;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const { data: row, error } = await supabaseAdmin
    .from("lesson_profiles")
    .update(updates)
    .eq("id", id)
    .eq("teacher_id", teacherId)
    .select("id, teacher_verified, teacher_quality_rating")
    .single();

  if (error || !row) {
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    profileId: row.id,
    verified: row.teacher_verified,
    rating: row.teacher_quality_rating,
  });
}
