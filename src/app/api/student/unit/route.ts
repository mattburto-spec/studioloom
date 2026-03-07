import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");

  if (!unitId) {
    return NextResponse.json({ error: "unitId required" }, { status: 400 });
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

  // Get student's class
  const { data: student } = await supabase
    .from("students")
    .select("class_id, ell_level")
    .eq("id", session.student_id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Get the unit
  const { data: unit } = await supabase
    .from("units")
    .select("*")
    .eq("id", unitId)
    .single();

  if (!unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  // Get locked pages for this class + unit
  const { data: classUnit } = await supabase
    .from("class_units")
    .select("locked_pages, is_active")
    .eq("class_id", student.class_id)
    .eq("unit_id", unitId)
    .single();

  if (!classUnit || !classUnit.is_active) {
    return NextResponse.json(
      { error: "Unit not assigned to your class" },
      { status: 403 }
    );
  }

  // Get progress
  const { data: progress } = await supabase
    .from("student_progress")
    .select("*")
    .eq("student_id", session.student_id)
    .eq("unit_id", unitId);

  return NextResponse.json({
    unit,
    lockedPages: classUnit.locked_pages || [],
    progress: progress || [],
    ellLevel: student.ell_level,
  });
}
