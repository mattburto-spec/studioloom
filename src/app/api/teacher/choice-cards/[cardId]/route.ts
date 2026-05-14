// audit-skip: library content edits — `updated_at` + creator-or-admin
// authorization gate already constrains writes. Not security-sensitive.
//
// Choice Cards — update an existing library card (teacher unit-builder).
//
// PATCH /api/teacher/choice-cards/[cardId]
// Body: partial { label?, hook_text?, detail_md?, image_url?, emoji?,
//                bg_color?, tags?, on_pick_action?, ships_to_platform?,
//                brief_text?, brief_constraints?, brief_locks? }
//
// Only the card's creator (or platform admin) can update. Seeded cards
// (created_by = null) require platform admin.
//
// Phase F.C — `brief_text`, `brief_constraints`, `brief_locks` let a
// teacher retrofit a brief template onto an existing card (e.g. the
// 6 G8 seeded cards). When a student picks this card, the template
// populates their student_briefs row at render time (Phase F.D).
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/auth/require-teacher";
import {
  validateConstraints,
  validateLocks,
} from "@/lib/unit-brief/validators";

const FULL_COLUMNS =
  "id, label, hook_text, detail_md, image_url, emoji, bg_color, tags, on_pick_action, ships_to_platform, is_seeded, created_by, brief_text, brief_constraints, brief_locks, created_at, updated_at";

/**
 * GET /api/teacher/choice-cards/[cardId]
 *
 * Returns the full card row including the Phase F.C brief template
 * fields. Used by the brief-template editor modal when it opens.
 * Any authenticated teacher can read — cards are global library
 * content (write requires creator-or-admin per PATCH below).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;

  const { cardId } = await params;
  if (!cardId) {
    return NextResponse.json({ error: "cardId required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("choice_cards")
    .select(FULL_COLUMNS)
    .eq("id", cardId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  return NextResponse.json({ card: data });
}

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

  // Phase F.C — brief template fields (optional, partial-patch shape).
  if ("brief_text" in b) {
    if (b.brief_text === null) {
      patch.brief_text = null;
    } else if (typeof b.brief_text === "string") {
      patch.brief_text = b.brief_text;
    } else {
      return NextResponse.json(
        { error: "brief_text must be a string or null" },
        { status: 400 },
      );
    }
  }
  if ("brief_constraints" in b) {
    const validated = validateConstraints(b.brief_constraints);
    if (!validated.ok) {
      return NextResponse.json(
        { error: `brief_constraints: ${validated.error}` },
        { status: 400 },
      );
    }
    patch.brief_constraints = validated.value;
  }
  if ("brief_locks" in b) {
    const validated = validateLocks(b.brief_locks);
    if (!validated.ok) {
      return NextResponse.json(
        { error: `brief_locks: ${validated.error}` },
        { status: 400 },
      );
    }
    patch.brief_locks = validated.value;
  }

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
