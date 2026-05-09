// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUILT_IN_BADGES } from "@/lib/safety/badge-definitions";
import { requireTeacher } from "@/lib/auth/require-teacher";

/**
 * POST /api/teacher/badges/seed
 *
 * Seed built-in badges from BUILT_IN_BADGES into the database.
 * Upserts each badge (creates if missing, skips if already exists).
 * Only callable by an authenticated user (any teacher can seed).
 *
 * Returns:
 * {
 *   seeded: number (how many badges were inserted),
 *   skipped: number (how many already existed),
 *   total: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;

    // Use admin client for write access
    const admin = createAdminClient();

    let seeded = 0;
    let skipped = 0;

    // Insert or skip each badge
    for (const badge of BUILT_IN_BADGES) {
      // Check if badge already exists
      const { data: existing } = await admin
        .from("badges")
        .select("id")
        .eq("id", badge.id)
        .single();

      if (existing) {
        // Badge already exists, skip
        skipped++;
        continue;
      }

      // Insert the badge
      const { error } = await admin.from("badges").insert([
        {
          id: badge.id,
          slug: badge.slug,
          name: badge.name,
          description: badge.description,
          category: badge.category,
          tier: badge.tier,
          icon_name: badge.icon_name,
          color: badge.color,
          is_built_in: true,
          created_by_teacher_id: null,
          pass_threshold: badge.pass_threshold,
          expiry_months: badge.expiry_months,
          retake_cooldown_minutes: badge.retake_cooldown_minutes,
          question_count: badge.question_count,
          topics: badge.topics,
          learn_content: badge.learn_content,
          question_pool: badge.question_pool,
        },
      ]);

      if (error) {
        console.error(`[badges/seed] Failed to insert badge ${badge.id}:`, error);
        // Continue with next badge instead of failing
        continue;
      }

      seeded++;
    }

    return NextResponse.json(
      {
        seeded,
        skipped,
        total: BUILT_IN_BADGES.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[badges/seed] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
