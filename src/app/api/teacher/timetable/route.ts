import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";

// ─────────────────────────────────────────────────────────────
// GET /api/teacher/timetable
// Returns timetable config + class meetings for the authenticated teacher.
// ─────────────────────────────────────────────────────────────

async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const supabase = createAdminClient();

    // Fetch timetable
    const { data: timetable, error: ttError } = await supabase
      .from("school_timetable")
      .select("*")
      .eq("teacher_id", auth.teacherId)
      .maybeSingle();

    if (ttError) {
      console.error("[timetable GET] timetable query error:", ttError);
      return NextResponse.json(
        { error: "Failed to load timetable" },
        { status: 500 }
      );
    }

    if (!timetable) {
      return NextResponse.json({ timetable: null, meetings: [] });
    }

    // Fetch class meetings
    const { data: meetings, error: meetError } = await supabase
      .from("class_meetings")
      .select("*")
      .eq("timetable_id", timetable.id)
      .order("cycle_day", { ascending: true });

    if (meetError) {
      console.error("[timetable GET] meetings query error:", meetError);
      return NextResponse.json(
        { error: "Failed to load class meetings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      timetable,
      meetings: meetings || [],
    });
  } catch (err) {
    console.error("[timetable GET]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/teacher/timetable
// Upsert timetable config + class meetings (replaces existing).
//
// Body: {
//   cycle_length: 8,
//   cycle_type: "weekday",
//   anchor_date: "2026-03-23",
//   anchor_cycle_day: 3,
//   reset_each_term: false,
//   periods: [{ number: 1, label: "Period 1", start: "08:30", end: "09:30" }],
//   excluded_dates: ["2026-04-05"],
//   meetings: [
//     { class_id: "abc123", cycle_day: 2, period_number: 4, room: "D101" },
//     { class_id: "abc123", cycle_day: 6, period_number: 2, room: "D101" }
//   ]
// }
// ─────────────────────────────────────────────────────────────

interface MeetingInput {
  class_id: string;
  cycle_day: number;
  period_number?: number;
  room?: string;
}

interface TimetableRequest {
  cycle_length: number;
  cycle_type: "weekday" | "calendar";
  anchor_date: string;
  anchor_cycle_day: number;
  reset_each_term?: boolean;
  periods?: Array<{ number: number; label: string; start: string; end: string }>;
  excluded_dates?: string[];
  meetings: MeetingInput[];
}

async function POST(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = (await request.json()) as TimetableRequest;

    // Validate required fields
    if (
      !body.cycle_length ||
      !body.cycle_type ||
      !body.anchor_date ||
      !body.anchor_cycle_day ||
      !Array.isArray(body.meetings)
    ) {
      return NextResponse.json(
        { error: "Missing required fields: cycle_length, cycle_type, anchor_date, anchor_cycle_day, meetings" },
        { status: 400 }
      );
    }

    if (body.cycle_length < 2 || body.cycle_length > 20) {
      return NextResponse.json(
        { error: "cycle_length must be between 2 and 20" },
        { status: 400 }
      );
    }

    if (body.anchor_cycle_day < 1 || body.anchor_cycle_day > body.cycle_length) {
      return NextResponse.json(
        { error: `anchor_cycle_day must be between 1 and ${body.cycle_length}` },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check for existing timetable
    const { data: existing } = await supabase
      .from("school_timetable")
      .select("id")
      .eq("teacher_id", auth.teacherId)
      .maybeSingle();

    let timetableId: string;

    if (existing) {
      // Update existing timetable
      const { data: updated, error: updateErr } = await supabase
        .from("school_timetable")
        .update({
          cycle_length: body.cycle_length,
          cycle_type: body.cycle_type,
          anchor_date: body.anchor_date,
          anchor_cycle_day: body.anchor_cycle_day,
          reset_each_term: body.reset_each_term ?? false,
          periods: body.periods || [],
          excluded_dates: body.excluded_dates || [],
          source: "manual",
        })
        .eq("teacher_id", auth.teacherId)
        .select("id")
        .single();

      if (updateErr || !updated) {
        console.error("[timetable POST] update error:", updateErr);
        return NextResponse.json(
          { error: "Failed to update timetable" },
          { status: 500 }
        );
      }
      timetableId = updated.id;

      // Delete existing meetings for this timetable
      const { error: deleteErr } = await supabase
        .from("class_meetings")
        .delete()
        .eq("timetable_id", timetableId);

      if (deleteErr) {
        console.error("[timetable POST] delete meetings error:", deleteErr);
        return NextResponse.json(
          { error: "Failed to clear existing meetings" },
          { status: 500 }
        );
      }
    } else {
      // Insert new timetable
      const { data: created, error: createErr } = await supabase
        .from("school_timetable")
        .insert({
          teacher_id: auth.teacherId,
          cycle_length: body.cycle_length,
          cycle_type: body.cycle_type,
          anchor_date: body.anchor_date,
          anchor_cycle_day: body.anchor_cycle_day,
          reset_each_term: body.reset_each_term ?? false,
          periods: body.periods || [],
          excluded_dates: body.excluded_dates || [],
          source: "manual",
        })
        .select("id")
        .single();

      if (createErr || !created) {
        console.error("[timetable POST] create error:", createErr);
        return NextResponse.json(
          { error: "Failed to create timetable" },
          { status: 500 }
        );
      }
      timetableId = created.id;
    }

    // Insert class meetings
    if (body.meetings.length > 0) {
      const meetingsToInsert = body.meetings.map((m) => ({
        timetable_id: timetableId,
        class_id: m.class_id,
        cycle_day: m.cycle_day,
        period_number: m.period_number ?? null,
        room: m.room ?? null,
      }));

      const { error: meetErr } = await supabase
        .from("class_meetings")
        .insert(meetingsToInsert);

      if (meetErr) {
        console.error("[timetable POST] insert meetings error:", meetErr);
        return NextResponse.json(
          { error: "Failed to save class meetings" },
          { status: 500 }
        );
      }
    }

    // Return the full saved timetable
    const { data: finalTT } = await supabase
      .from("school_timetable")
      .select("*")
      .eq("id", timetableId)
      .single();

    const { data: finalMeetings } = await supabase
      .from("class_meetings")
      .select("*")
      .eq("timetable_id", timetableId)
      .order("cycle_day", { ascending: true });

    return NextResponse.json({
      message: "Timetable saved",
      timetable: finalTT,
      meetings: finalMeetings || [],
    });
  } catch (err) {
    console.error("[timetable POST]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export { GET, POST };
