import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { parseICal, extractMeetings } from "@/lib/scheduling/ical-parser";

// ─────────────────────────────────────────────────────────────
// POST /api/teacher/timetable/import-ical
//
// Accepts either:
//   { ical_url: "https://..." }     — fetches from URL
//   { ical_content: "BEGIN:VCAL..." } — raw iCal text (file upload)
//
// Returns extracted meetings and holidays that the frontend
// can merge into the timetable config before saving.
// ─────────────────────────────────────────────────────────────

async function POST(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    let icalText = "";

    if (body.ical_content) {
      // Direct text from file upload
      icalText = body.ical_content;
    } else if (body.ical_url) {
      // Fetch from URL
      let url = body.ical_url as string;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
      }

      // Auto-detect Outlook published calendar HTML URLs and convert to .ics
      // Pattern: outlook.office365.com/owa/calendar/.../.../calendar.html
      if (url.includes("outlook.office365.com") && url.endsWith("/calendar.html")) {
        url = url.replace(/\/calendar\.html$/, "/calendar.ics");
      }
      // Also handle reachcalendar.html, S.html, or other Outlook variants
      if (url.includes("outlook.office365.com") && url.endsWith(".html")) {
        url = url.replace(/\.html$/, ".ics");
      }

      try {
        const response = await fetch(url, {
          headers: { Accept: "text/calendar" },
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (!response.ok) {
          return NextResponse.json(
            { error: `Failed to fetch calendar: ${response.status} ${response.statusText}` },
            { status: 400 }
          );
        }

        icalText = await response.text();
      } catch (fetchErr) {
        console.error("[import-ical] fetch error:", fetchErr);
        return NextResponse.json(
          { error: "Could not reach the calendar URL. Check that the link is correct and publicly accessible." },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Provide either ical_url or ical_content" },
        { status: 400 }
      );
    }

    if (!icalText.includes("BEGIN:VCALENDAR")) {
      return NextResponse.json(
        { error: "Not a valid iCal file. Expected BEGIN:VCALENDAR." },
        { status: 400 }
      );
    }

    // Parse the iCal
    const result = parseICal(icalText);

    // Load teacher's classes to match event names
    const supabase = createAdminClient();
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name")
      .eq("author_teacher_id", auth.teacherId);

    const meetings = extractMeetings(result.classEvents, classes || []);

    // Build enriched holiday list with labels (find original event name for each date)
    const holidayDetails: Array<{ date: string; label: string }> = [];
    const holidayDateSet = new Set<string>();
    for (const event of result.events) {
      const summaryLower = event.summary.toLowerCase();
      const matchesKeyword = ["holiday", "break", "no school", "no classes", "public holiday",
        "staff day", "pd day", "professional development", "inset day",
        "teacher only", "pupil free", "student free", "vacation",
        "mid-term", "midterm", "half term", "reading week"
      ].some((kw) => summaryLower.includes(kw));
      if (!matchesKeyword) continue;
      const startDate = event.dtstart.split("T")[0];
      if (!holidayDateSet.has(startDate)) {
        holidayDateSet.add(startDate);
        holidayDetails.push({ date: startDate, label: event.summary });
      }
      // Multi-day: add range dates with same label
      if (event.dtend) {
        const endDate = event.dtend.split("T")[0];
        const s = new Date(startDate);
        const e = new Date(endDate);
        const d = new Date(s);
        d.setDate(d.getDate() + 1);
        while (d < e) {
          const ds = d.toISOString().split("T")[0];
          if (!holidayDateSet.has(ds)) {
            holidayDateSet.add(ds);
            holidayDetails.push({ date: ds, label: event.summary });
          }
          d.setDate(d.getDate() + 1);
        }
      }
    }
    holidayDetails.sort((a, b) => a.date.localeCompare(b.date));

    // Build unmatched events with dates
    const unmatchedWithDates = result.classEvents
      .filter((e) => {
        const summaryLower = e.summary.toLowerCase();
        return !(classes || []).some((c) => {
          const nameLower = c.name.toLowerCase();
          return summaryLower.includes(nameLower) || nameLower.includes(summaryLower);
        });
      })
      .map((e) => ({ summary: e.summary, date: e.dtstart.split("T")[0] }));

    // Deduplicate unmatched by summary for the summary list
    const unmatchedUnique = unmatchedWithDates
      .map((e) => e.summary)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 20);

    return NextResponse.json({
      totalEvents: result.events.length,
      meetings,
      excludedDates: result.holidays,
      holidayDetails,
      unmatchedEvents: unmatchedUnique,
      unmatchedWithDates: unmatchedWithDates.slice(0, 50),
      // Class events summary for calendar preview
      classEventDates: result.classEvents
        .map((e) => ({ date: e.dtstart.split("T")[0], summary: e.summary }))
        .slice(0, 200),
    });
  } catch (err) {
    console.error("[import-ical POST]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export { POST };
