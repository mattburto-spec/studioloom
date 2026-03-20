import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

/**
 * GET /api/student/open-studio/status?unitId={id}
 * Returns the student's Open Studio status for a unit.
 * Used by the OpenStudioBanner and Design Assistant to determine AI mode.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Validate session
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");

  if (!unitId) {
    return NextResponse.json({ error: "unitId is required" }, { status: 400 });
  }

  // Get Open Studio status for this student + unit
  const { data: status } = await supabase
    .from("open_studio_status")
    .select("*")
    .eq("student_id", session.student_id)
    .eq("unit_id", unitId)
    .single();

  if (!status || status.status !== "unlocked") {
    return NextResponse.json({
      unlocked: false,
      status: status?.status || "locked",
      teacherNote: null,
      checkInIntervalMin: 15,
    });
  }

  // Check for active session
  const { data: activeSession } = await supabase
    .from("open_studio_sessions")
    .select("id, session_number, focus_area, started_at, ai_interactions, check_in_count, drift_flags")
    .eq("student_id", session.student_id)
    .eq("unit_id", unitId)
    .eq("status_id", status.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    unlocked: true,
    status: "unlocked",
    statusId: status.id,
    teacherNote: status.teacher_note,
    checkInIntervalMin: status.check_in_interval_min,
    unlockedAt: status.unlocked_at,
    activeSession: activeSession || null,
  });
}
