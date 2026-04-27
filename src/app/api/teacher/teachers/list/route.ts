import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";

/* ──────────────────────────────────────────────────────────────
 * GET /api/teacher/teachers/list
 *
 * Returns teachers in the same school as the requesting teacher.
 * Used by the PYPX mentor picker (Phase 13a-5) — coordinator can
 * only assign teachers from their own school as mentors. Once
 * Mentor Manager ships (see docs/projects/mentor-manager.md), the
 * picker source swaps from this endpoint to the mentors pool, but
 * mentor_teacher_id stays as a backward-compat fallback for
 * staff-mentors.
 *
 * Returns the requesting teacher in the list (you can mentor your
 * own students). Excludes teachers without school_id since they're
 * unscoped.
 *
 * Shape: { teachers: { id, name, email }[] } sorted by name.
 * ────────────────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const db = createAdminClient();

  // First: which school is the caller in?
  const { data: caller, error: callerErr } = await db
    .from("teachers")
    .select("school_id")
    .eq("id", auth.teacherId)
    .maybeSingle();

  if (callerErr) {
    console.error("[teacher/teachers/list] caller lookup", callerErr);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
  if (!caller?.school_id) {
    // Unscoped teacher — return empty list rather than every teacher
    // in the system.
    return NextResponse.json({ teachers: [] });
  }

  const { data, error } = await db
    .from("teachers")
    .select("id, name, display_name, email")
    .eq("school_id", caller.school_id);

  if (error) {
    console.error("[teacher/teachers/list]", error);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }

  const teachers = (data ?? [])
    // Exclude internal system accounts (e.g. system@studioloom.internal
    // used for moderation logging) — never a real mentor candidate.
    .filter((t) => {
      const email = (t.email as string | null) ?? "";
      return !email.endsWith("@studioloom.internal");
    })
    .map((t) => ({
      id: t.id as string,
      name: ((t.display_name as string | null) ||
        (t.name as string | null) ||
        (t.email as string | null) ||
        "Unnamed") as string,
      email: (t.email as string | null) ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ teachers });
}
