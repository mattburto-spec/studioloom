/**
 * Public Safety Badges API
 *
 * GET /api/public/safety-badges
 *   Returns all built-in safety badges with full content.
 *   No authentication required.
 *
 *   Returns: {
 *     badges: Array<{
 *       id: string;
 *       name: string;
 *       slug: string;
 *       description: string;
 *       tier: 'bronze' | 'silver' | 'gold';
 *       learn_content: { title: string; sections: { title: string; content: string }[] };
 *       question_pool: Array<{ id: string; question: string; options: string[]; correct: number }>;
 *     }>
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as Sentry from "@sentry/nextjs";

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    // Fetch all built-in badges with learn content and questions
    const { data: badges, error } = await supabase
      .from("badges")
      .select(
        `
        id,
        name,
        slug,
        description,
        tier,
        learn_content,
        question_pool
      `
      )
      .eq("is_built_in", true)
      .order("tier", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      Sentry.captureException(error);
      return NextResponse.json(
        { error: "Failed to fetch badges" },
        { status: 500 }
      );
    }

    return NextResponse.json({ badges: badges || [] });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
