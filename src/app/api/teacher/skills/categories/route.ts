/**
 * GET /api/teacher/skills/categories
 *
 * Returns the 8 seeded skill categories for the authoring UI. Thin, cached
 * by the browser via default Next fetch behaviour — the list is static.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

function createSupabaseServer(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
