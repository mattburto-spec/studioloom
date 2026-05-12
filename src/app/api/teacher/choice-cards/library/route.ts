// Choice Cards — library search endpoint (teacher unit-builder picker).
//
// GET /api/teacher/choice-cards/library?tags=brief,g8&q=designer
// Returns: { cards: ChoiceCardSummary[] }
//
// Tags: comma-separated; matches if the row's tags array contains ANY of
// the requested tags (OR). q: case-insensitive ILIKE against label +
// hook_text. Returns the lightweight summary fields needed by the
// library picker grid.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacher } from "@/lib/auth/require-teacher";

const SUMMARY_COLUMNS =
  "id, label, hook_text, image_url, emoji, bg_color, tags, ships_to_platform, is_seeded";

export const GET = withErrorHandler(
  "teacher/choice-cards/library:GET",
  async (request: NextRequest) => {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;

    const url = request.nextUrl;
    const tagsParam = url.searchParams.get("tags");
    const q = url.searchParams.get("q")?.trim();

    const db = createAdminClient();
    let query = db
      .from("choice_cards")
      .select(SUMMARY_COLUMNS)
      .order("is_seeded", { ascending: false })
      .order("label", { ascending: true })
      .limit(200);

    if (tagsParam) {
      const tags = tagsParam.split(",").map((t) => t.trim()).filter(Boolean);
      if (tags.length > 0) {
        query = query.overlaps("tags", tags);
      }
    }

    if (q && q.length > 0) {
      // PostgREST or() pattern: label ILIKE %q% OR hook_text ILIKE %q%
      const safe = q.replace(/[%,()]/g, "");
      query = query.or(`label.ilike.%${safe}%,hook_text.ilike.%${safe}%`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ cards: data ?? [] });
  },
);
