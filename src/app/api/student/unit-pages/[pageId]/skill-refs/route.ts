/**
 * GET /api/student/unit-pages/[pageId]/skill-refs
 *
 * Student-facing lookup for the "Skills for this lesson" panel. Given a
 * unit page ID (the one in the URL), returns the skill cards pinned to
 * that page with each card's state for this student.
 *
 * Only published cards surface; unpublished drafts are filtered out
 * (pinned drafts are author workflow, not student-visible).
 *
 * Response: {
 *   cards: [{
 *     card: { id, slug, title, summary, tier, domain_id, estimated_min, card_type },
 *     ref:  { id, gate_level, display_order },
 *     state: { state, freshness, last_passed_at }
 *   }]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import type { CardType, SkillTier } from "@/types/skills";

interface RefRow {
  id: string;
  skill_card_id: string;
  gate_level: string;
  display_order: number;
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
}

interface StateRow {
  skill_id: string;
  state: "untouched" | "viewed" | "quiz_passed" | "demonstrated" | "applied";
  freshness: "fresh" | "cooling" | "stale" | null;
  last_passed_at: string | null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await context.params;
    const session = await requireStudentSession(request);
    if (session instanceof NextResponse) return session;
    const studentId = session.studentId;

    if (!pageId) {
      return NextResponse.json({ cards: [] });
    }

    const admin = createAdminClient();

    const { data: refs, error: refsError } = await admin
      .from("skill_card_refs")
      .select("id, skill_card_id, gate_level, display_order")
      .eq("subject_type", "unit_page")
      .eq("subject_id", pageId)
      .order("display_order", { ascending: true });
    if (refsError) {
      console.error(
        "[student/unit-pages/[pageId]/skill-refs:GET] refs error:",
        refsError
      );
      return NextResponse.json(
        { error: "Failed to load refs" },
        { status: 500 }
      );
    }
    if (!refs || refs.length === 0) {
      return NextResponse.json({ cards: [] });
    }

    const cardIds = refs.map((r: RefRow) => r.skill_card_id);

    const { data: cards } = await admin
      .from("skill_cards")
      .select(
        "id, slug, title, summary, tier, domain_id, estimated_min, card_type, is_published"
      )
      .in("id", cardIds)
      .eq("is_published", true);
    const cardById = new Map<string, CardRow>(
      (cards ?? []).map((c: CardRow) => [c.id, c])
    );

    const { data: states } = await admin
      .from("student_skill_state")
      .select("skill_id, state, freshness, last_passed_at")
      .eq("student_id", studentId)
      .in("skill_id", cardIds);
    const stateByCard = new Map<string, StateRow>(
      (states ?? []).map((s: StateRow) => [s.skill_id, s])
    );

    // Join: one entry per ref, only if the card is published (unpublished
    // refs silently drop — teacher can still see them in the "Used in" panel).
    const out = (refs as RefRow[])
      .map((r) => {
        const card = cardById.get(r.skill_card_id);
        if (!card) return null;
        const state = stateByCard.get(r.skill_card_id);
        return {
          card: {
            id: card.id,
            slug: card.slug,
            title: card.title,
            summary: card.summary,
            tier: card.tier,
            domain_id: card.domain_id,
            estimated_min: card.estimated_min,
            card_type: card.card_type,
          },
          ref: {
            id: r.id,
            gate_level: r.gate_level,
            display_order: r.display_order,
          },
          state: {
            state: state?.state ?? "untouched",
            freshness: state?.freshness ?? null,
            last_passed_at: state?.last_passed_at ?? null,
          },
        };
      })
      .filter(Boolean);

    return NextResponse.json({ cards: out });
  } catch (error) {
    console.error(
      "[student/unit-pages/[pageId]/skill-refs:GET] Error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
