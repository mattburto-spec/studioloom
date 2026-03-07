import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Validate session and get student
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // Get student's class
  const { data: student } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", session.student_id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Get active units for this class
  const { data: classUnits } = await supabase
    .from("class_units")
    .select("unit_id, locked_pages")
    .eq("class_id", student.class_id)
    .eq("is_active", true);

  if (!classUnits || classUnits.length === 0) {
    return NextResponse.json({ units: [] });
  }

  const unitIds = classUnits.map((cu) => cu.unit_id);

  // Get units
  const { data: units } = await supabase
    .from("units")
    .select("id, title, description, thumbnail_url")
    .in("id", unitIds);

  // Get progress for this student
  const { data: progress } = await supabase
    .from("student_progress")
    .select("*")
    .eq("student_id", session.student_id)
    .in("unit_id", unitIds);

  // Combine units with progress
  const unitsWithProgress = (units || []).map((unit) => ({
    ...unit,
    progress: (progress || []).filter((p) => p.unit_id === unit.id),
    locked_pages: classUnits.find((cu) => cu.unit_id === unit.id)?.locked_pages || [],
  }));

  return NextResponse.json({ units: unitsWithProgress });
}
