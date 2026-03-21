/**
 * List All Available Badges for Teachers
 *
 * GET /api/teacher/badges/list
 *   Returns all available badges (public + built-in).
 *   No auth required on this endpoint (teachers need to know what badges exist).
 *
 *   Returns: {
 *     badges: Array<{ id, name, slug, description, tier }>
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as Sentry from "@sentry/nextjs";

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    // Fetch all badges
    const { data: badges, error } = await supabase
      .from("badges")
      .select("id, name, slug, description, tier")
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
