import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

// Helper: get student ID from session cookie
async function getStudentId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  return session?.student_id || null;
}

// GET: Load progress for a specific unit
export async function GET(request: NextRequest) {
  const studentId = await getStudentId(request);
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");

  if (!unitId) {
    return NextResponse.json({ error: "unitId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: progress } = await supabase
    .from("student_progress")
    .select("*")
    .eq("student_id", studentId)
    .eq("unit_id", unitId);

  return NextResponse.json({ progress: progress || [] });
}

// POST: Save/update progress for a specific page
export async function POST(request: NextRequest) {
  const studentId = await getStudentId(request);
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { unitId, pageNumber, status, responses, timeSpent } =
    await request.json();

  if (!unitId || !pageNumber) {
    return NextResponse.json(
      { error: "unitId and pageNumber required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Upsert progress
  const { data, error } = await supabase
    .from("student_progress")
    .upsert(
      {
        student_id: studentId,
        unit_id: unitId,
        page_number: pageNumber,
        ...(status && { status }),
        ...(responses && { responses }),
        ...(timeSpent !== undefined && { time_spent: timeSpent }),
      },
      {
        onConflict: "student_id,unit_id,page_number",
      }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ progress: data });
}
