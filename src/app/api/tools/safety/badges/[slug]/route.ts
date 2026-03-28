/**
 * GET /api/tools/safety/badges/[slug]
 *
 * Return a single badge definition by slug with learn content.
 * Public endpoint — no authentication required.
 *
 * URL params:
 *   slug: badge slug (e.g., "general-workshop-safety", "laser-cutter-safety")
 *
 * Returns:
 *   { badge: { id, name, slug, description, category, tier, color, icon_name, pass_threshold, expiry_months, retake_cooldown_minutes, topics, learn_content, question_count } }
 *
 * Note: question_pool is NOT included — questions come via start-test endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { findBadgeBySlug } from "@/lib/safety/badge-definitions";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
    const { slug } = await context.params;

    const badge = findBadgeBySlug(slug);
    if (!badge) {
      return NextResponse.json(
        { error: "Badge not found" },
        { status: 404 }
      );
    }

    // Strip question_pool
    const badgeData = {
      id: badge.id,
      name: badge.name,
      slug: badge.slug,
      description: badge.description,
      category: badge.category,
      tier: badge.tier,
      color: badge.color,
      icon_name: badge.icon_name,
      is_built_in: badge.is_built_in,
      pass_threshold: badge.pass_threshold,
      expiry_months: badge.expiry_months,
      retake_cooldown_minutes: badge.retake_cooldown_minutes,
      question_count: badge.question_count,
      topics: badge.topics,
      learn_content: badge.learn_content,
    };

    return NextResponse.json({ badge: badgeData });
}
