import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import {
  getCycleDay,
  parseDate,
  type SchoolTimetable,
  type ClassMeeting,
} from "@/lib/scheduling/cycle-engine";

// ─────────────────────────────────────────────────────────────
// GET /api/teacher/schedule/today
//
// Returns ALL class meetings for today + next N days (default 7).
// No classId required — returns across all classes.
// Used by the teacher dashboard sidebar.
// ─────────────────────────────────────────────────────────────

async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const days = Math.min(parseInt(url.searchParams.get("days") || "7", 10), 30);

    const supabase = createAdminClient();

    // Fetch timetable
    const { data: timetable, error: ttErr } = await supabase
      .from("school_timetable")
      .select("*")
      .eq("teacher_id", auth.teacherId)
      .maybeSingle();

    if (ttErr || !timetable) {
      return NextResponse.json({ hasTimetable: false, entries: [] });
    }

    // Fetch ALL meetings for this teacher's timetable
    const { data: allMeetings, error: meetErr } = await supabase
      .from("class_meetings")
      .select("*")
      .eq("timetable_id", timetable.id);

    if (meetErr) {
      return NextResponse.json({ hasTimetable: true, entries: [] });
    }

    const meetings = (allMeetings || []) as ClassMeeting[];
    // Cast timetable — cycle_day_events flows through from DB automatically
    const tt = timetable as SchoolTimetable;

    // Fetch class names for display
    const classIds = [...new Set(meetings.map((m) => m.class_id))];
    const { data: classRows } = await supabase
      .from("classes")
      .select("id, name")
      .in("id", classIds.length > 0 ? classIds : ["__none__"]);

    const classNameMap = new Map<string, string>();
    for (const c of classRows || []) {
      classNameMap.set(c.id, c.name);
    }

    // Fetch class-unit mappings so we can link to teach pages
    const { data: classUnits } = await supabase
      .from("class_units")
      .select("class_id, unit_id, units!inner(id, title)")
      .in("class_id", classIds.length > 0 ? classIds : ["__none__"]);

    const classUnitMap = new Map<string, { unitId: string; unitTitle: string }>();
    for (const cu of classUnits || []) {
      // Take first unit per class for now
      if (!classUnitMap.has(cu.class_id)) {
        const unit = cu.units as unknown as { id: string; title: string };
        classUnitMap.set(cu.class_id, { unitId: unit.id, unitTitle: unit.title });
      }
    }

    // Build entries for today + next N days
    type Entry = {
      date: string;
      cycleDay: number;
      classId: string;
      className: string;
      period: number | null;
      room: string | null;
      unitId: string | null;
      unitTitle: string | null;
    };

    const entries: Entry[] = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const dateObj = parseDate(dateStr);

      // getCycleDay checks authoritative iCal events first, then falls back to computed
      const cycleDay = getCycleDay(dateObj, tt);
      if (cycleDay === null) continue; // weekend, holiday, or excluded

      // Find all meetings on this cycle day
      const dayMeetings = meetings.filter((m) => m.cycle_day === cycleDay);
      for (const m of dayMeetings) {
        const cu = classUnitMap.get(m.class_id);
        entries.push({
          date: dateStr,
          cycleDay,
          classId: m.class_id,
          className: classNameMap.get(m.class_id) || "Unknown",
          period: m.period_number ?? null,
          room: m.room ?? null,
          unitId: cu?.unitId ?? null,
          unitTitle: cu?.unitTitle ?? null,
        });
      }
    }

    // Sort by date, then period
    entries.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.period ?? 99) - (b.period ?? 99);
    });

    return NextResponse.json({ hasTimetable: true, entries });
  } catch (err) {
    console.error("[schedule/today GET]", err);
    return NextResponse.json({ hasTimetable: false, entries: [] });
  }
}

export { GET };
