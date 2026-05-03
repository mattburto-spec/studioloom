// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * Teacher-side skill_card_refs API scoped to a unit page.
 *
 *   GET    /api/teacher/unit-pages/[pageId]/skill-refs  → list refs + card data for this page
 *   POST   /api/teacher/unit-pages/[pageId]/skill-refs  → body {skill_card_id, subject_label?, gate_level?}
 *   DELETE /api/teacher/unit-pages/[pageId]/skill-refs?ref_id=<uuid>  → remove a ref
 *
 * This is the lesson-editor-side of what used to be on the skill-card edit
 * page. Teacher picks skill cards to pin to the lesson they're currently
 * editing; writes the same `skill_card_refs` row shape the student-side
 * reader (SkillRefsForPage) queries.
 *
 * Scope: authenticated teacher. No unit-ownership check in v1 — any teacher
 * can pin any accessible card to any page ID. Tighten when Access Model v2
 * lands (teacher ↔ unit ownership graph).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import type { CardType, SkillTier } from "@/types/skills";

const VALID_GATE_LEVELS = new Set([
  "suggested",
  "viewed",
  "quiz_passed",
  "demonstrated",
]);

interface RefRow {
  id: string;
  skill_card_id: string;
  subject_label: string | null;
  gate_level: string;
  display_order: number;
  created_at: string;
}

interface CardRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  tier: SkillTier | null;
  domain_id: string | null;
  estimated_min: number | null;
  card_type: CardType;
  is_published: boolean;
  is_built_in: boolean;
}

// ============================================================================
// GET — refs for this page with joined card data
// ============================================================================
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await context.params;
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;

    if (!pageId) {
      return NextResponse.json({ refs: [] });
    }

    const admin = createAdminClient();

    const { data: refs, error: refsError } = await admin
      .from("skill_card_refs")
      .select(
        "id, skill_card_id, subject_label, gate_level, display_order, created_at"
      )
      .eq("subject_type", "unit_page")
      .eq("subject_id", pageId)
      .order("display_order", { ascending: true });
    if (refsError) {
      console.error(
        "[teacher/unit-pages/[pageId]/skill-refs:GET] refs error:",
        refsError
      );
      return NextResponse.json(
        { error: "Failed to load refs" },
        { status: 500 }
      );
    }
    if (!refs || refs.length === 0) {
      return NextResponse.json({ refs: [] });
    }

    const cardIds = (refs as RefRow[]).map((r) => r.skill_card_id);
    const { data: cards } = await admin
      .from("skill_cards")
      .select(
        "id, slug, title, summary, tier, domain_id, estimated_min, card_type, is_published, is_built_in"
      )
      .in("id", cardIds);
    const cardById = new Map<string, CardRow>(
      (cards ?? []).map((c: CardRow) => [c.id, c])
    );

    // Teacher side returns ALL pinned refs — including to unpublished cards
    // they authored, so they can see "this lesson references my draft
    // 'Soldering safety'" in the panel. Student side filters to published.
    const out = (refs as RefRow[]).map((r) => {
      const card = cardById.get(r.skill_card_id);
      return {
        ref: {
          id: r.id,
          subject_label: r.subject_label,
          gate_level: r.gate_level,
          display_order: r.display_order,
          created_at: r.created_at,
        },
        card: card
          ? {
              id: card.id,
              slug: card.slug,
              title: card.title,
              summary: card.summary,
              tier: card.tier,
              domain_id: card.domain_id,
              estimated_min: card.estimated_min,
              card_type: card.card_type,
              is_published: card.is_published,
              is_built_in: card.is_built_in,
            }
          : null,
      };
    });

    return NextResponse.json({ refs: out });
  } catch (error) {
    console.error(
      "[teacher/unit-pages/[pageId]/skill-refs:GET] Error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST — pin a skill card to this page
// ============================================================================
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await context.params;
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;
    const teacherId = auth.teacherId;

    const body = (await request.json()) as {
      skill_card_id?: string;
      subject_label?: string;
      gate_level?: string;
      display_order?: number;
    };
    if (!body.skill_card_id) {
      return NextResponse.json(
        { error: "skill_card_id required" },
        { status: 400 }
      );
    }
    const gateLevel = body.gate_level ?? "suggested";
    if (!VALID_GATE_LEVELS.has(gateLevel)) {
      return NextResponse.json(
        { error: "Invalid gate_level" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Verify the card exists (don't enforce ownership — teachers can pin
    // any card they can read, including built-ins).
    const { data: card } = await admin
      .from("skill_cards")
      .select("id")
      .eq("id", body.skill_card_id)
      .maybeSingle();
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // Dedupe — a second pin returns the existing row.
    const { data: existing } = await admin
      .from("skill_card_refs")
      .select("*")
      .eq("skill_card_id", body.skill_card_id)
      .eq("subject_type", "unit_page")
      .eq("subject_id", pageId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ ref: existing, duplicate: true });
    }

    const { data: inserted, error: insertError } = await admin
      .from("skill_card_refs")
      .insert({
        skill_card_id: body.skill_card_id,
        subject_type: "unit_page",
        subject_id: pageId,
        subject_label: body.subject_label?.toString().trim() || null,
        gate_level: gateLevel,
        display_order: body.display_order ?? 0,
        created_by_teacher_id: teacherId,
      })
      .select()
      .single();
    if (insertError || !inserted) {
      console.error(
        "[teacher/unit-pages/[pageId]/skill-refs:POST] Insert error:",
        insertError
      );
      return NextResponse.json(
        { error: "Failed to pin card" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ref: inserted });
  } catch (error) {
    console.error(
      "[teacher/unit-pages/[pageId]/skill-refs:POST] Error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE — remove a ref by id
// ============================================================================
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await context.params;
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const refId = url.searchParams.get("ref_id");
    if (!refId) {
      return NextResponse.json(
        { error: "ref_id query param required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Verify the ref actually targets this page (defense against
    // mistargeted deletes + accidental leaks between lesson pages).
    const { data: ref } = await admin
      .from("skill_card_refs")
      .select("id, subject_type, subject_id")
      .eq("id", refId)
      .maybeSingle();
    if (!ref) {
      return NextResponse.json({ error: "Ref not found" }, { status: 404 });
    }
    if (ref.subject_type !== "unit_page" || ref.subject_id !== pageId) {
      return NextResponse.json(
        { error: "Ref does not belong to this page" },
        { status: 400 }
      );
    }

    const { error: deleteError } = await admin
      .from("skill_card_refs")
      .delete()
      .eq("id", refId);
    if (deleteError) {
      console.error(
        "[teacher/unit-pages/[pageId]/skill-refs:DELETE] Delete error:",
        deleteError
      );
      return NextResponse.json(
        { error: "Failed to remove ref" },
        { status: 500 }
      );
    }

    return NextResponse.json({ removed_ref_id: refId });
  } catch (error) {
    console.error(
      "[teacher/unit-pages/[pageId]/skill-refs:DELETE] Error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
