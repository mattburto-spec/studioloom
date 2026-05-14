// audit-skip: library content authoring — `choice_cards` rows carry
// `created_by` + `created_at` so authorship is intrinsically recorded.
// Not security-sensitive (no auth/role/key changes). Mirrors the
// audit-skip pattern on machine-profiles / unit-image upload routes.
//
// Choice Cards — create a new library card (teacher unit-builder).
//
// POST /api/teacher/choice-cards
// Body: { id, label, hook_text, detail_md, image_url?, emoji?, bg_color?,
//         tags[], on_pick_action, ships_to_platform?,
//         brief_text?, brief_constraints?, brief_locks? }
//
// `id` is a kebab-case slug (e.g. "g8-brief-designer-mentor"). created_by
// is set server-side from the authenticated teacher's user id.
//
// Phase F.C — `brief_text`, `brief_constraints`, `brief_locks` are
// optional brief-template fields. When a student picks this card,
// these populate their student_briefs row (Phase F.D).
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacher } from "@/lib/auth/require-teacher";
import {
  validateConstraints,
  validateLocks,
} from "@/lib/unit-brief/validators";

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

    // Phase F.C — optional brief template fields. Reuse the same
    // validators as /api/teacher/unit-brief so the shape stays
    // identical (one unified renderer downstream).
    const insertRow: Record<string, unknown> = {
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
    };

    if ("brief_text" in b) {
      if (b.brief_text === null) {
        insertRow.brief_text = null;
      } else if (typeof b.brief_text === "string") {
        insertRow.brief_text = b.brief_text;
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
      insertRow.brief_constraints = validated.value;
    }
    if ("brief_locks" in b) {
      const validated = validateLocks(b.brief_locks);
      if (!validated.ok) {
        return NextResponse.json(
          { error: `brief_locks: ${validated.error}` },
          { status: 400 },
        );
      }
      insertRow.brief_locks = validated.value;
    }

    const db = createAdminClient();
    const { data, error } = await db
      .from("choice_cards")
      .insert(insertRow)
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
