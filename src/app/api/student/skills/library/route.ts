/**
 * GET /api/student/skills/library
 *
 * Student-facing catalogue index. Returns all published skill cards the
 * student can see, grouped by domain × tier, with each card's state (from
 * student_skill_state) + freshness already joined in.
 *
 * Query params (all optional):
 *   ?age_band=primary|middle|senior    — age-band overlap filter
 *   ?card_type=lesson|routine          — filter to lessons or routines
 *
 * Payload shape designed for the domain-ladder UI: one domain section
 * per domain with cards in the student's band, bucketed by tier.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import type { CardType, SkillTier } from "@/types/skills";

type CardTile = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  tier: SkillTier | null;
  domain_id: string | null;
  card_type: CardType;
  estimated_min: number | null;
  age_min: number | null;
  age_max: number | null;
  state: "untouched" | "viewed" | "quiz_passed" | "demonstrated" | "applied";
  freshness: "fresh" | "cooling" | "stale" | null;
  last_passed_at: string | null;
};

type DomainSection = {
  id: string;
  short_code: string;
  label: string;
  description: string;
  display_order: number;
  tiers: Record<SkillTier, CardTile[]>;
};

const VALID_BANDS = new Set(["primary", "middle", "senior"]);
const VALID_CARD_TYPES = new Set<CardType>(["lesson", "routine"]);

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStudentAuth(request);
    if (auth.error) return auth.error;
    const studentId = auth.studentId;

    const url = new URL(request.url);
    const ageBand = url.searchParams.get("age_band");
    const cardType = url.searchParams.get("card_type");

    const admin = createAdminClient();

    // 1. Domains (ordered lookup — small table, static)
    const { data: domains } = await admin
      .from("skill_domains")
      .select("id, short_code, label, description, display_order")
      .order("display_order", { ascending: true });
    if (!domains) {
      return NextResponse.json({ domains: [] });
    }

    // 2. Published cards. Students only see published + non-built-in is_published
    //    cards — built-ins also have is_published = true for the 3 seeds so they
    //    come through this filter too.
    let cardsQuery = admin
      .from("skill_cards")
      .select(
        "id, slug, title, summary, tier, domain_id, card_type, estimated_min, age_min, age_max"
      )
      .eq("is_published", true);

    if (cardType && VALID_CARD_TYPES.has(cardType as CardType)) {
      cardsQuery = cardsQuery.eq("card_type", cardType);
    }

    // Age-band overlap (same shape as the teacher list filter).
    if (ageBand && VALID_BANDS.has(ageBand)) {
      const bands: Record<string, { min: number; max: number }> = {
        primary: { min: 8, max: 11 },
        middle: { min: 11, max: 14 },
        senior: { min: 14, max: 18 },
      };
      const b = bands[ageBand];
      if (b) {
        cardsQuery = cardsQuery
          .or(`age_max.is.null,age_max.gte.${b.min}`)
          .or(`age_min.is.null,age_min.lte.${b.max}`);
      }
    }

    const { data: cards, error: cardsError } = await cardsQuery;
    if (cardsError) {
      console.error("[student/skills/library:GET] cards error:", cardsError);
      return NextResponse.json(
        { error: "Failed to load library" },
        { status: 500 }
      );
    }

    const cardIds = (cards ?? []).map((c) => c.id);

    // 3. Student's state per card. Absent row = untouched.
    type StateRow = {
      skill_id: string;
      state: CardTile["state"];
      freshness: CardTile["freshness"];
      last_passed_at: string | null;
    };
    const stateByCard: Map<string, StateRow> = new Map();
    if (cardIds.length > 0) {
      const { data: states } = await admin
        .from("student_skill_state")
        .select("skill_id, state, freshness, last_passed_at")
        .eq("student_id", studentId)
        .in("skill_id", cardIds);
      (states ?? []).forEach((s: StateRow) => stateByCard.set(s.skill_id, s));
    }

    // 4. Build domain sections with tier buckets. Ladders within a domain
    //    appear even if a tier has 0 cards — empty rows signal "still to come"
    //    (future authoring lands in the gap).
    const sections: DomainSection[] = (domains as DomainSection[]).map((d) => ({
      id: d.id,
      short_code: d.short_code,
      label: d.label,
      description: d.description,
      display_order: d.display_order,
      tiers: { bronze: [], silver: [], gold: [] },
    }));
    const sectionById = new Map(sections.map((s) => [s.id, s]));

    for (const raw of cards ?? []) {
      const row = raw as Omit<CardTile, "state" | "freshness" | "last_passed_at">;
      const state = stateByCard.get(row.id);
      const tile: CardTile = {
        ...row,
        state: state?.state ?? "untouched",
        freshness: state?.freshness ?? null,
        last_passed_at: state?.last_passed_at ?? null,
      };
      if (!row.domain_id) continue;
      const section = sectionById.get(row.domain_id);
      if (!section) continue;
      if (row.tier) {
        section.tiers[row.tier].push(tile);
      }
    }

    // 5. Sort cards within each tier alphabetically by title.
    for (const s of sections) {
      (["bronze", "silver", "gold"] as const).forEach((t) => {
        s.tiers[t].sort((a, b) => a.title.localeCompare(b.title));
      });
    }

    // 6. Filter out domains that are completely empty so the page doesn't
    //    render pages of "coming soon" blocks.
    const nonEmpty = sections.filter(
      (s) =>
        s.tiers.bronze.length + s.tiers.silver.length + s.tiers.gold.length >
        0
    );

    // 7. Compute a summary for the hero.
    const allTiles: CardTile[] = nonEmpty.flatMap((s) => [
      ...s.tiers.bronze,
      ...s.tiers.silver,
      ...s.tiers.gold,
    ]);
    const summary = {
      total: allTiles.length,
      viewed: allTiles.filter((t) =>
        ["viewed", "quiz_passed", "demonstrated", "applied"].includes(t.state)
      ).length,
      quiz_passed: allTiles.filter((t) =>
        ["quiz_passed", "demonstrated", "applied"].includes(t.state)
      ).length,
      demonstrated: allTiles.filter((t) =>
        ["demonstrated", "applied"].includes(t.state)
      ).length,
      applied: allTiles.filter((t) => t.state === "applied").length,
    };

    return NextResponse.json({ domains: nonEmpty, summary });
  } catch (error) {
    console.error("[student/skills/library:GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
