import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { rateLimit, type RateLimitWindow } from "@/lib/rate-limit";
import {
  getNextLessons,
  parseDate,
  formatLessonDate,
  formatLessonShort,
  type SchoolTimetable,
  type ClassMeeting,
} from "@/lib/scheduling/cycle-engine";

// Rate limit: 30 requests per minute per student
const NEXT_CLASS_LIMITS: RateLimitWindow[] = [
  { maxRequests: 30, windowMs: 60_000 },
];

// ─────────────────────────────────────────────────────────────
// GET /api/student/next-class?unitId=X
//
// Returns the next class date for the student's assigned class
// for the given unit. Uses student token auth.
//
// Response:
// {
//   nextClass: {
//     dateISO: "2026-03-25",
//     dayOfWeek: "Wednesday",
//     cycleDay: 6,
//     periodNumber: 2,
//     formatted: "Wednesday March 25 (Day 6, Period 2)",
//     short: "Day 6, P2 — Wed"
//   }
// }
// ─────────────────────────────────────────────────────────────

async function GET(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;

  // Rate limit
  const limitResult = rateLimit(session.studentId, NEXT_CLASS_LIMITS);
  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  try {
    const url = new URL(request.url);
    const unitId = url.searchParams.get("unitId");

    if (!unitId) {
      return NextResponse.json(
        { error: "unitId is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Find the student's class for this unit
    // student → students.class_id → class_units → unit
    const { data: student } = await supabase
      .from("students")
      .select("class_id")
      .eq("id", session.studentId)
      .single();

    if (!student?.class_id) {
      return NextResponse.json({ nextClass: null, reason: "no_class" });
    }

    // Find the teacher who owns this unit (to look up their timetable)
    const { data: unit } = await supabase
      .from("units")
      .select("author_teacher_id")
      .eq("id", unitId)
      .maybeSingle();

    if (!unit?.author_teacher_id) {
      return NextResponse.json({ nextClass: null, reason: "no_unit" });
    }

    // Load teacher's timetable
    const { data: timetable } = await supabase
      .from("school_timetable")
      .select("*")
      .eq("teacher_id", unit.author_teacher_id)
      .maybeSingle();

    if (!timetable) {
      return NextResponse.json({ nextClass: null, reason: "no_timetable" });
    }

    // Load class meetings
    const { data: allMeetings } = await supabase
      .from("class_meetings")
      .select("*")
      .eq("timetable_id", timetable.id);

    if (!allMeetings || allMeetings.length === 0) {
      return NextResponse.json({ nextClass: null, reason: "no_meetings" });
    }

    const tt = timetable as SchoolTimetable;
    const meetings = allMeetings as ClassMeeting[];

    // Get next lesson from tomorrow (today's class may be in progress)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fromDate = parseDate(tomorrow.toISOString().split("T")[0]);

    const nextLessons = getNextLessons(
      student.class_id,
      fromDate,
      1,
      tt,
      meetings
    );

    if (nextLessons.length === 0) {
      return NextResponse.json({ nextClass: null, reason: "no_upcoming" });
    }

    const next = nextLessons[0];
    return NextResponse.json({
      nextClass: {
        dateISO: next.dateISO,
        dayOfWeek: next.dayOfWeek,
        cycleDay: next.cycleDay,
        periodNumber: next.periodNumber,
        room: next.room,
        formatted: formatLessonDate(next),
        short: formatLessonShort(next),
      },
    });
  } catch (err) {
    console.error("[student/next-class GET]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export { GET };
