import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";

/**
 * GET /api/student/open-studio/status?unitId={id}
 * Returns the student's Open Studio status for a unit.
 * Used by the OpenStudioBanner and Design Assistant to determine AI mode.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const supabase = createAdminClient();

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");

  if (!unitId) {
    return NextResponse.json({ error: "unitId is required" }, { status: 400 });
  }

  // Get Open Studio status for this student + unit
  const { data: status } = await supabase
    .from("open_studio_status")
    .select("*")
    .eq("student_id", studentId)
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
    .eq("student_id", studentId)
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
