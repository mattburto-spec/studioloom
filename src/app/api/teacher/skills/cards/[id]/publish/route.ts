/**
 * POST /api/teacher/skills/cards/[id]/publish
 * POST /api/teacher/skills/cards/[id]/publish { action: "unpublish" }
 *
 * Flips is_published on a teacher-owned card. Built-in cards always
 * published, so hitting this on one returns 403.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

function createSupabaseServer(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseServer(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let action: "publish" | "unpublish" = "publish";
    try {
      const body = await request.json();
      if (body?.action === "unpublish") action = "unpublish";
    } catch {
      // empty body fine — default to publish
    }

    const admin = createAdminClient();

    const { data: card } = await admin
      .from("skill_cards")
      .select(
        "id, title, body, category_id, difficulty, is_built_in, created_by_teacher_id, is_published"
      )
      .eq("id", id)
      .maybeSingle();

    if (!card) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (card.is_built_in) {
      return NextResponse.json(
        { error: "Built-in cards are always published." },
        { status: 403 }
      );
    }
    if (card.created_by_teacher_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Minimum publishable content: title + category + difficulty + ≥1 block.
    if (action === "publish") {
      if (!card.title?.trim()) {
        return NextResponse.json(
          { error: "Card needs a title before publishing." },
          { status: 400 }
        );
      }
      if (!card.category_id || !card.difficulty) {
        return NextResponse.json(
          { error: "Card needs a category and difficulty before publishing." },
          { status: 400 }
        );
      }
      if (!Array.isArray(card.body) || card.body.length === 0) {
        return NextResponse.json(
          { error: "Card needs at least one content block before publishing." },
          { status: 400 }
        );
      }
    }

    const { error: updateError } = await admin
      .from("skill_cards")
      .update({ is_published: action === "publish" })
      .eq("id", id);

    if (updateError) {
      console.error(
        "[teacher/skills/cards/[id]/publish:POST] Update error:",
        updateError
      );
      return NextResponse.json(
        { error: "Failed to update publish state" },
        { status: 500 }
      );
    }

    return NextResponse.json({ id, is_published: action === "publish" });
  } catch (error) {
    console.error("[teacher/skills/cards/[id]/publish:POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
