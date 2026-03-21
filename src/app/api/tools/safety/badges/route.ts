/**
 * GET /api/tools/safety/badges
 *
 * Return all built-in badge definitions.
 * Public endpoint — no authentication required.
 *
 * Returns:
 *   { badges: [{ id, name, slug, description, category, tier, color, icon_name, pass_threshold, expiry_months, retake_cooldown_minutes, topics, learn_content, question_count }] }
 *
 * Note: question_pool is NOT included in the response.
 */

import { NextRequest, NextResponse } from "next/server";
import { BUILT_IN_BADGES } from "@/lib/safety/badge-definitions";
import { withErrorHandler } from "@/lib/api/error-handler";

export const GET = withErrorHandler("tools/safety/badges:GET", async () => {
  // Strip question_pool from response
  const badges = BUILT_IN_BADGES.map((badge) => ({
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
  }));

  return NextResponse.json({ badges });
});
