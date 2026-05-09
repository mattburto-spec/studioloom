/**
 * GET /api/teacher/skills/categories
 *
 * Returns the 8 seeded skill categories for the authoring UI. Thin, cached
 * by the browser via default Next fetch behaviour — the list is static.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/auth/require-teacher";

export async function GET(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("skill_categories")
    .select("id, label, description, display_order")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[teacher/skills/categories:GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to load categories" },
      { status: 500 }
    );
  }

  return NextResponse.json({ categories: data ?? [] });
}
