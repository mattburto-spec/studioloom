// Choice Cards — create a new library card (teacher unit-builder).
//
// POST /api/teacher/choice-cards
// Body: { id, label, hook_text, detail_md, image_url?, emoji?, bg_color?,
//         tags[], on_pick_action, ships_to_platform? }
//
// `id` is a kebab-case slug (e.g. "g8-brief-designer-mentor"). created_by
// is set server-side from the authenticated teacher's user id.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacher } from "@/lib/auth/require-teacher";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;

export const POST = withErrorHandler(
  "teacher/choice-cards:POST",
  async (request: NextRequest) => {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;
    const teacherId = auth.teacherId;

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

    const id = typeof b.id === "string" ? b.id : "";
    const label = typeof b.label === "string" ? b.label : "";
    const hook_text = typeof b.hook_text === "string" ? b.hook_text : "";
    const detail_md = typeof b.detail_md === "string" ? b.detail_md : "";
    const image_url = typeof b.image_url === "string" && b.image_url.length > 0 ? b.image_url : null;
    const emoji = typeof b.emoji === "string" && b.emoji.length > 0 ? b.emoji : null;
    const bg_color = typeof b.bg_color === "string" && b.bg_color.length > 0 ? b.bg_color : null;
    const ships_to_platform = b.ships_to_platform === true;
    const on_pick_action = b.on_pick_action;
    const tagsInput = Array.isArray(b.tags) ? b.tags : [];

    if (!SLUG_RE.test(id)) {
      return NextResponse.json(
        { error: "id must be kebab-case slug (a-z, 0-9, dashes), 2-80 chars" },
        { status: 400 },
      );
    }
    if (id === "_pitch-your-own") {
      return NextResponse.json(
        { error: "id '_pitch-your-own' is reserved" },
        { status: 400 },
      );
    }
    if (label.length === 0 || hook_text.length === 0 || detail_md.length === 0) {
      return NextResponse.json(
        { error: "label, hook_text, detail_md required" },
        { status: 400 },
      );
    }
    if (!on_pick_action || typeof on_pick_action !== "object") {
      return NextResponse.json(
        { error: "on_pick_action must be an object" },
        { status: 400 },
      );
    }
    const tags = tagsInput
      .filter((t): t is string => typeof t === "string" && t.length > 0)
      .slice(0, 20);

    const db = createAdminClient();
    const { data, error } = await db
      .from("choice_cards")
      .insert({
        id,
        label,
        hook_text,
        detail_md,
        image_url,
        emoji,
        bg_color,
        tags,
        on_pick_action,
        ships_to_platform,
        is_seeded: false,
        created_by: teacherId,
      })
      .select()
      .single();

    if (error || !data) {
      // 23505 = unique_violation on PK
      const status = error?.code === "23505" ? 409 : 500;
      return NextResponse.json(
        { error: error?.message ?? "Failed to create card" },
        { status },
      );
    }
    return NextResponse.json({ card: data }, { status: 201 });
  },
);
