/**
 * List All Available Badges for Teachers
 *
 * GET /api/teacher/badges/list
 *   Returns all available badges (public + built-in).
 *
 *   Returns: {
 *     badges: Array<{ id, name, slug, description, tier }>
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as Sentry from "@sentry/nextjs";
import { requireTeacher } from "@/lib/auth/require-teacher";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;

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
