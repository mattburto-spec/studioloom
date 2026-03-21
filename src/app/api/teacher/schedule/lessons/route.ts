import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import {
  getNextLessons,
  countLessonsInRange,
  getLessonCalendar,
  parseDate,
  type SchoolTimetable,
  type ClassMeeting,
} from "@/lib/scheduling/cycle-engine";

// ─────────────────────────────────────────────────────────────
// GET /api/teacher/schedule/lessons
//
// Query params:
//   classId (required) — which class
//   mode (required) — "next" | "count" | "calendar"
//   from (optional) — ISO date, defaults to today
//   to (optional) — ISO date, required for "count" and "calendar" modes
//   count (optional) — number of lessons, for "next" mode (default 10)
//   termStart / termEnd (optional) — for reset_each_term calculations
// ─────────────────────────────────────────────────────────────

async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const classId = url.searchParams.get("classId");
    const mode = url.searchParams.get("mode") || "next";
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const countParam = url.searchParams.get("count");
    const termStartParam = url.searchParams.get("termStart");
    const termEndParam = url.searchParams.get("termEnd");

    if (!classId) {
      return NextResponse.json(
        { error: "classId is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch timetable
    const { data: timetable, error: ttErr } = await supabase
      .from("school_timetable")
      .select("*")
      .eq("teacher_id", auth.teacherId)
      .maybeSingle();

    if (ttErr || !timetable) {
      return NextResponse.json(
        { error: "No timetable configured. Set up your timetable in Settings." },
        { status: 404 }
      );
    }

    // Fetch meetings for this class
    const { data: allMeetings, error: meetErr } = await supabase
      .from("class_meetings")
      .select("*")
      .eq("timetable_id", timetable.id);

    if (meetErr) {
      console.error("[schedule/lessons GET] meetings error:", meetErr);
      return NextResponse.json(
        { error: "Failed to load class meetings" },
        { status: 500 }
      );
    }

    const meetings = (allMeetings || []) as ClassMeeting[];
    const tt = timetable as SchoolTimetable;

    const termDates =
      termStartParam && termEndParam
        ? { start: termStartParam, end: termEndParam }
        : undefined;

    const fromDate = fromParam
      ? parseDate(fromParam)
      : parseDate(new Date().toISOString().split("T")[0]);

    switch (mode) {
      case "next": {
        const count = countParam ? parseInt(countParam, 10) : 10;
        const lessons = getNextLessons(
          classId,
          fromDate,
          Math.min(count, 50), // cap at 50
          tt,
          meetings,
          termDates
        );
        return NextResponse.json({ lessons });
      }

      case "count": {
        if (!toParam) {
          return NextResponse.json(
            { error: "'to' date is required for count mode" },
            { status: 400 }
          );
        }
        const toDate = parseDate(toParam);
        const lessonCount = countLessonsInRange(
          classId,
          fromDate,
          toDate,
          tt,
          meetings,
          termDates
        );
        return NextResponse.json({
          classId,
          from: fromParam || fromDate.toISOString().split("T")[0],
          to: toParam,
          lessonCount,
        });
      }

      case "calendar": {
        if (!toParam) {
          return NextResponse.json(
            { error: "'to' date is required for calendar mode" },
            { status: 400 }
          );
        }
        const toDate = parseDate(toParam);
        const calendar = getLessonCalendar(
          classId,
          fromDate,
          toDate,
          tt,
          meetings,
          termDates
        );
        return NextResponse.json({ calendar });
      }

      default:
        return NextResponse.json(
          { error: "Invalid mode. Use 'next', 'count', or 'calendar'." },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[schedule/lessons GET]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export { GET };
