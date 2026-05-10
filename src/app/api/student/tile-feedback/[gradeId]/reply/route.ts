/**
 * POST /api/student/tile-feedback/[gradeId]/reply
 *
 * TFL.2 Pass B sub-phase B.3. Persists a student reply turn to the
 * `tile_feedback_turns` table. Body: { sentiment, text? }.
 *
 * Validation contract:
 *   - sentiment in {got_it, not_sure, pushback}.
 *   - text required + ≥10 chars (trimmed) when sentiment is
 *     not_sure or pushback. text optional + ignored for got_it
 *     (the v1 design choice — got_it is a single-click ack).
 *   - The grade row must belong to the requesting student. Without
 *     this check, a student could craft a request with a foreign
 *     gradeId and inject replies into another student's thread.
 *
 * Auth: requireStudentSession (custom session token).
 *
 * No audit log entry in v1 — student_tile_grade_events requires a
 * non-null teacher_id and has a fixed source enum that doesn't
 * cover student replies. The reply itself is the source of truth in
 * tile_feedback_turns. Audit can be added in a follow-up if
 * compliance requires it (FU candidate).
 */

// audit-skip: student-driven reply, source-of-truth in tile_feedback_turns

import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Sentiment } from "@/components/lesson/TeacherFeedback/types";
import { REPLY_MIN_CHARS } from "@/components/lesson/TeacherFeedback/types";

const ALLOWED_SENTIMENTS: Sentiment[] = ["got_it", "not_sure", "pushback"];

interface PostBody {
  sentiment?: string;
  text?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gradeId: string }> },
) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  const { gradeId } = await params;
  if (!gradeId) {
    return NextResponse.json(
      { error: "gradeId path param required" },
      { status: 400 },
    );
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // Sentiment enum check.
  const sentiment = body.sentiment;
  if (!sentiment || !ALLOWED_SENTIMENTS.includes(sentiment as Sentiment)) {
    return NextResponse.json(
      {
        error: `sentiment must be one of: ${ALLOWED_SENTIMENTS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Text length check for the two sentiments that require justification.
  // Lesson #38: assert exact threshold rather than ">0" — must match
  // the component's REPLY_MIN_CHARS constant so client + server agree.
  const trimmedText = (body.text ?? "").trim();
  if (sentiment !== "got_it" && trimmedText.length < REPLY_MIN_CHARS) {
    return NextResponse.json(
      {
        error: `'${sentiment}' requires a reply of at least ${REPLY_MIN_CHARS} characters.`,
      },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  // Ownership check: the grade row must belong to the requesting
  // student. Without this, a crafted request could insert replies
  // into other students' threads.
  const { data: grade, error: gErr } = await db
    .from("student_tile_grades")
    .select("id, student_id")
    .eq("id", gradeId)
    .maybeSingle();

  if (gErr) {
    return NextResponse.json(
      { error: `Failed to verify grade ownership: ${gErr.message}` },
      { status: 500 },
    );
  }
  if (!grade) {
    return NextResponse.json(
      { error: "Grade not found" },
      { status: 404 },
    );
  }
  if ((grade as { student_id: string }).student_id !== session.studentId) {
    return NextResponse.json(
      { error: "Forbidden — grade belongs to a different student" },
      { status: 403 },
    );
  }

  // Insert the student turn. Per the B.1 CHECK constraint, student
  // rows have role='student' + sentiment + reply_text, and NULL
  // teacher fields (author_id, body_html, edited_at). reply_text is
  // empty string for got_it (the column is non-null but the
  // discriminator's CHECK only requires sentiment).
  const { data: inserted, error: iErr } = await db
    .from("tile_feedback_turns")
    .insert({
      grade_id: gradeId,
      role: "student",
      sentiment,
      reply_text: trimmedText || null,
    })
    .select(
      "id, grade_id, role, author_id, body_html, edited_at, sentiment, reply_text, sent_at",
    )
    .single();

  if (iErr || !inserted) {
    return NextResponse.json(
      {
        error: `Failed to persist reply: ${iErr?.message ?? "no row returned"}`,
      },
      { status: 500 },
    );
  }

  // Return the inserted turn in the same shape the GET route returns.
  // The client can append it directly to local state.
  const inserted_row = inserted as {
    id: string;
    role: "student";
    sentiment: Sentiment;
    reply_text: string | null;
    sent_at: string;
  };
  return NextResponse.json({
    turn: {
      role: "student" as const,
      id: inserted_row.id,
      sentiment: inserted_row.sentiment,
      text: inserted_row.reply_text ?? "",
      sentAt: inserted_row.sent_at,
    },
  });
}
