import { NextRequest, NextResponse } from "next/server";
import { requireStudentAuth } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Discovery Engine — Session CRUD
 *
 * GET: Load existing session for a student+unit (resume support)
 * POST: Create a new session
 * PATCH: Auto-save session state + profile data
 *
 * Uses student token auth (cookie session, NOT Supabase Auth).
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 5
 */

// GET: Load existing session or return null
export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unit_id");

  if (!unitId) {
    return NextResponse.json({ error: "unit_id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Find the most recent session for this student+unit
  const { data, error } = await supabase
    .from("discovery_sessions")
    .select("*")
    .eq("student_id", studentId)
    .eq("unit_id", unitId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Discovery GET] Error loading session:", error);
    return NextResponse.json({ error: "Failed to load session" }, { status: 500 });
  }

  // Also fetch student's graduation_year for age band detection
  const { data: student } = await supabase
    .from("students")
    .select("graduation_year")
    .eq("id", studentId)
    .maybeSingle();

  return NextResponse.json({
    session: data ?? null,
    graduationYear: student?.graduation_year ?? null,
  });
}

// POST: Create a new session
export async function POST(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const body = await request.json();
  const { unit_id, class_id, profile, mode } = body;

  if (!unit_id || !profile) {
    return NextResponse.json(
      { error: "unit_id and profile are required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("discovery_sessions")
    .insert({
      student_id: studentId,
      unit_id,
      class_id: class_id ?? null,
      state: "station_0",
      profile,
      mode: mode ?? "mode_1",
      started_at: new Date().toISOString(),
      last_saved_at: new Date().toISOString(),
      version: 1,
    })
    .select()
    .single();

  if (error) {
    console.error("[Discovery POST] Error creating session:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  return NextResponse.json({ session: data }, { status: 201 });
}

// PATCH: Auto-save session state + profile
export async function PATCH(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const body = await request.json();
  const { session_id, state, profile, completed } = body;

  if (!session_id) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("discovery_sessions")
    .select("student_id")
    .eq("id", session_id)
    .single();

  if (!existing || existing.student_id !== studentId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Build update payload — only include fields that were sent
  const updates: Record<string, unknown> = {
    last_saved_at: new Date().toISOString(),
  };

  if (state !== undefined) updates.state = state;
  if (profile !== undefined) updates.profile = profile;
  if (completed) {
    updates.completed_at = new Date().toISOString();
    updates.state = "completed";
  }

  const { data, error } = await supabase
    .from("discovery_sessions")
    .update(updates)
    .eq("id", session_id)
    .select()
    .single();

  if (error) {
    console.error("[Discovery PATCH] Error saving session:", error);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }

  return NextResponse.json({ session: data });
}
