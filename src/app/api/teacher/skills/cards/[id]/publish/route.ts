// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * POST /api/teacher/skills/cards/[id]/publish
 * POST /api/teacher/skills/cards/[id]/publish { action: "unpublish" }
 *
 * Flips is_published on a teacher-owned card. Built-in cards always
 * published, so hitting this on one returns 403.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/auth/require-teacher";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;
    const { teacherId } = auth;

    const { id } = await context.params;

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
        "id, title, body, category_id, domain_id, tier, demo_of_competency, is_built_in, created_by_teacher_id, is_published"
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
    if (card.created_by_teacher_id !== teacherId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Minimum publishable content. World-class skills library —
    // every published card carries the full competency definition:
    // title + category + domain + tier + demo_of_competency + ≥1 block.
    // learning_outcomes + framework_anchors are strongly encouraged
    // but not hard-gated (teachers can refine over time).
    if (action === "publish") {
      if (!card.title?.trim()) {
        return NextResponse.json(
          { error: "Card needs a title before publishing." },
          { status: 400 }
        );
      }
      if (!card.category_id || !card.domain_id) {
        return NextResponse.json(
          {
            error:
              "Card needs both a category (cognitive action) and a domain (subject area) before publishing.",
          },
          { status: 400 }
        );
      }
      if (!card.tier) {
        return NextResponse.json(
          { error: "Card needs a tier (bronze / silver / gold) before publishing." },
          { status: 400 }
        );
      }
      if (!card.demo_of_competency?.toString().trim()) {
        return NextResponse.json(
          {
            error:
              "Card needs a demo-of-competency line before publishing — one sentence using a controlled verb (show / demonstrate / produce / explain / argue / identify / compare / sketch / make / plan / deliver).",
          },
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
