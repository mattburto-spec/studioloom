// audit-skip: library content edits — `updated_at` + creator-or-admin
// authorization gate already constrains writes. Not security-sensitive.
//
// Choice Cards — update an existing library card (teacher unit-builder).
//
// PATCH /api/teacher/choice-cards/[cardId]
// Body: partial { label?, hook_text?, detail_md?, image_url?, emoji?,
//                bg_color?, tags?, on_pick_action?, ships_to_platform? }
//
// Only the card's creator (or platform admin) can update. Seeded cards
// (created_by = null) require platform admin.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/auth/require-teacher";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const { cardId } = await params;
  if (!cardId) {
    return NextResponse.json({ error: "cardId required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const db = createAdminClient();
  const { data: existing, error: fetchErr } = await db
    .from("choice_cards")
    .select("id, created_by")
    .eq("id", cardId)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  // Authorization: creator OR platform admin.
  if (existing.created_by !== teacherId) {
    const { data: profile } = await db
      .from("user_profiles")
      .select("is_platform_admin")
      .eq("id", teacherId)
      .maybeSingle();
    if (profile?.is_platform_admin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const patch: Record<string, unknown> = {};
  if (typeof b.label === "string" && b.label.length > 0) patch.label = b.label;
  if (typeof b.hook_text === "string" && b.hook_text.length > 0) patch.hook_text = b.hook_text;
  if (typeof b.detail_md === "string" && b.detail_md.length > 0) patch.detail_md = b.detail_md;
  if ("image_url" in b) patch.image_url = typeof b.image_url === "string" && b.image_url.length > 0 ? b.image_url : null;
  if ("emoji" in b) patch.emoji = typeof b.emoji === "string" && b.emoji.length > 0 ? b.emoji : null;
  if ("bg_color" in b) patch.bg_color = typeof b.bg_color === "string" && b.bg_color.length > 0 ? b.bg_color : null;
  if (Array.isArray(b.tags)) {
    patch.tags = b.tags.filter((t): t is string => typeof t === "string" && t.length > 0).slice(0, 20);
  }
  if (b.on_pick_action !== undefined) {
    if (!b.on_pick_action || typeof b.on_pick_action !== "object") {
      return NextResponse.json(
        { error: "on_pick_action must be an object" },
        { status: 400 },
      );
    }
    patch.on_pick_action = b.on_pick_action;
  }
  if (typeof b.ships_to_platform === "boolean") patch.ships_to_platform = b.ships_to_platform;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no updatable fields in body" }, { status: 400 });
  }

  const { data, error } = await db
    .from("choice_cards")
    .update(patch)
    .eq("id", cardId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update card" },
      { status: 500 },
    );
  }
  return NextResponse.json({ card: data });
}
