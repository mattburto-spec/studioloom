/**
 * Student Gallery Browse Submissions API
 *
 * GET /api/student/gallery/submissions?roundId=<uuid>
 *   List all submissions for a gallery round EXCEPT the student's own.
 *   Returns submissions in randomized order to avoid review bias.
 *   Includes student name (or "Anonymous" if round is anonymous).
 *
 *   Returns: Array<{
 *     id: string;
 *     contextNote: string;
 *     content: JSONB;
 *     createdAt: string;
 *     studentName: string;  // or "Anonymous"
 *   }>
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";

export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const { searchParams } = new URL(request.url);
  const roundId = searchParams.get("roundId");

  if (!roundId) {
    return NextResponse.json(
      { error: "roundId query param is required" },
      { status: 400, headers: { "Cache-Control": "private" } }
    );
  }

  try {
    const db = createAdminClient();

    // 1. Get the round to check if anonymous
    const { data: round, error: roundErr } = await db
      .from("gallery_rounds")
      .select("id, class_id, anonymous")
      .eq("id", roundId)
      .maybeSingle();

    if (roundErr || !round) {
      return NextResponse.json(
        { error: "Round not found" },
        { status: 404, headers: { "Cache-Control": "private" } }
      );
    }

    // 2. Verify student is enrolled in the round's class
    const { data: enrollment, error: enrollErr } = await db
      .from("class_students")
      .select("id")
      .eq("student_id", studentId)
      .eq("class_id", round.class_id)
      .eq("is_active", true)
      .maybeSingle();

    if (enrollErr || !enrollment) {
      // Legacy fallback
      const { data: student } = await db
        .from("students")
        .select("class_id")
        .eq("id", studentId)
        .maybeSingle();

      if (student?.class_id !== round.class_id) {
        return NextResponse.json(
          { error: "Unauthorized: not in this class" },
          { status: 403, headers: { "Cache-Control": "private" } }
        );
      }
    }

    // 3. Get all submissions for this round except student's own
    const { data: submissions, error: submissionsErr } = await db
      .from("gallery_submissions")
      .select("id, student_id, context_note, content, created_at")
      .eq("round_id", roundId)
      .neq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (submissionsErr) {
      console.error("[gallery-submissions] Query error:", submissionsErr);
      return NextResponse.json(
        { error: "Failed to load submissions" },
        { status: 500, headers: { "Cache-Control": "private" } }
      );
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json([], {
        headers: { "Cache-Control": "private" },
      });
    }

    // 4. Get student names (if not anonymous)
    let studentNames: Record<string, string> = {};
    if (!round.anonymous) {
      const studentIds = submissions.map((s: any) => s.student_id);
      const { data: students } = await db
        .from("students")
        .select("id, display_name")
        .in("id", studentIds);

      if (students) {
        students.forEach((s: any) => {
          studentNames[s.id] = s.display_name || s.id;
        });
      }
    }

    // 5. Randomize order (Fisher-Yates shuffle)
    const shuffled = [...submissions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 6. Transform response
    const response = shuffled.map((submission: any) => ({
      id: submission.id,
      contextNote: submission.context_note || "",
      content: submission.content,
      createdAt: submission.created_at,
      studentName: round.anonymous
        ? "Anonymous"
        : studentNames[submission.student_id] || "Unknown",
    }));

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private" },
    });
  } catch (error) {
    console.error("[gallery-submissions] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "private" } }
    );
  }
}
