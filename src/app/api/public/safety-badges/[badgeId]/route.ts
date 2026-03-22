/**
 * Public Single Safety Badge API
 *
 * GET /api/public/safety-badges/[badgeId]
 *   Returns a single badge with full content for projector view.
 *   No authentication required — badges are educational content.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ badgeId: string }> }
) {
  const { badgeId } = await params;

  try {
    const supabase = createAdminClient();

    const { data: badge, error } = await supabase
      .from("badges")
      .select(
        `id, name, slug, description, tier, icon_name, learn_content, learning_blocks, question_pool`
      )
      .eq("id", badgeId)
      .single();

    if (error || !badge) {
      return NextResponse.json(
        { error: "Badge not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ badge });
  } catch (err) {
    console.error("Error fetching badge:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
