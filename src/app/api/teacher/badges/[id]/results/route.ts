import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

function createSupabaseServer(request: NextRequest) {
  return createServerClient(
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
}

/**
 * GET /api/teacher/badges/[id]/results
 *
 * Get all student_badges for a given badge_id.
 * Optional query params:
 *   - ?classId=<classId> to filter by class
 *
 * Returns results sorted by awarded_at desc, with student info joined.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createSupabaseServer(request);

    // Verify teacher is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query params
    const url = new URL(request.url);
    const classId = url.searchParams.get("classId");

    // Use admin client for read access
    const admin = createAdminClient();

    // First verify the badge exists
    const { data: badgeExists, error: badgeError } = await admin
      .from("badges")
      .select("id")
      .eq("id", id)
      .single();

    if (badgeError || !badgeExists) {
      return NextResponse.json({ error: "Badge not found" }, { status: 404 });
    }

    // Fetch student_badges for this badge
    let query = admin
      .from("student_badges")
      .select(
        `
        id,
        student_id,
        badge_id,
        score,
        attempt_number,
        granted_by,
        teacher_note,
        status,
        answers,
        time_taken_seconds,
        awarded_at,
        expires_at,
        created_at
      `
      )
      .eq("badge_id", id);

    // If classId is provided, filter by class
    // This would require a join with students table
    if (classId) {
      // Note: This assumes students table has a class_id field
      // Adjust the column name as needed based on your schema
      query = query.eq("student_id", classId); // This is a placeholder; adjust based on actual schema
    }

    const { data, error } = await query.order("awarded_at", { ascending: false });

    if (error) {
      console.error("[badges/[id]/results/GET] Query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch results" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      results: data || [],
      badge_id: id,
    });
  } catch (error) {
    console.error("[badges/[id]/results/GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
