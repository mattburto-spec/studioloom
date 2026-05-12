// Choice Cards block — student deck-fetch endpoint.
//
// GET /api/student/choice-cards/deck?ids=g8-brief-designer-mentor,g8-brief-studio-theme
// Returns: { cards: ChoiceCard[] }
//
// Students use token sessions + service-role (Lesson #4), not the
// Supabase authenticated role — so the choice_cards_read RLS policy
// (which only grants TO authenticated) doesn't help them. This route
// bridges: admin-client read, but gated by requireStudentSession so only
// authenticated students can fetch a deck.
//
// Order is preserved from the `ids` param to match teacher-configured
// deck layout.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";

const CARD_COLUMNS =
  "id, label, hook_text, detail_md, image_url, emoji, bg_color, tags, on_pick_action, ships_to_platform";

export async function GET(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;

  const idsParam = request.nextUrl.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json({ cards: [] });
  }
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 80)
    .slice(0, 50);
  if (ids.length === 0) {
    return NextResponse.json({ cards: [] });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("choice_cards")
    .select(CARD_COLUMNS)
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Preserve caller-supplied order.
  const byId = new Map((data ?? []).map((c) => [c.id, c]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  return NextResponse.json({ cards: ordered });
}
