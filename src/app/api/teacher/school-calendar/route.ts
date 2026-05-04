// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";

// ─────────────────────────────────────────────────────────────────
// GET /api/teacher/school-calendar
// Returns all terms for the authenticated teacher,
// ordered by academic_year DESC, then term_order ASC
// ─────────────────────────────────────────────────────────────────

async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("school_calendar_terms")
      .select("*")
      .eq("teacher_id", auth.teacherId)
      .order("academic_year", { ascending: false })
      .order("term_order", { ascending: true });

    if (error) {
      console.error("[school-calendar GET]", error);
      return NextResponse.json(
        { error: "Failed to load calendar" },
        { status: 500 }
      );
    }

    return NextResponse.json({ terms: data || [] }, {
      headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error("[school-calendar GET]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// POST /api/teacher/school-calendar
// Upsert academic calendar for a teacher.
// Deletes all existing terms for the given academic_year,
// then inserts the new set.
//
// Body: {
//   academic_year: "2025-2026",
//   terms: [
//     { term_name: "Term 1", term_order: 1, start_date?: "2025-01-20", end_date?: "2025-03-21" },
//     { term_name: "Term 2", term_order: 2, start_date?: "2025-04-08", end_date?: "2025-06-20" }
//   ]
// }
// ─────────────────────────────────────────────────────────────────

interface TermInput {
  term_name: string;
  term_order: number;
  start_date?: string;
  end_date?: string;
}

interface CalendarRequest {
  academic_year: string;
  terms: TermInput[];
}

async function POST(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = (await request.json()) as CalendarRequest;

    if (!body.academic_year || !Array.isArray(body.terms)) {
      return NextResponse.json(
        { error: "Missing academic_year or terms" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Delete existing terms for this academic year
    const { error: deleteError } = await supabase
      .from("school_calendar_terms")
      .delete()
      .eq("teacher_id", auth.teacherId)
      .eq("academic_year", body.academic_year);

    if (deleteError) {
      console.error("[school-calendar POST delete]", deleteError);
      return NextResponse.json(
        { error: "Failed to clear existing terms" },
        { status: 500 }
      );
    }

    // Insert new terms
    const termsToInsert = body.terms.map((t) => ({
      teacher_id: auth.teacherId,
      academic_year: body.academic_year,
      term_name: t.term_name,
      term_order: t.term_order,
      start_date: t.start_date || null,
      end_date: t.end_date || null,
    }));

    const { data, error: insertError } = await supabase
      .from("school_calendar_terms")
      .insert(termsToInsert)
      .select();

    if (insertError) {
      console.error("[school-calendar POST insert]", insertError);
      return NextResponse.json(
        { error: "Failed to save terms" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Calendar saved",
      terms: data || [],
    });
  } catch (err) {
    console.error("[school-calendar POST]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export { GET, POST };
