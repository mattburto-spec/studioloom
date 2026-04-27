/**
 * GET /api/teacher/skills/domains
 *
 * Returns the 10 seeded subject-area domains for the authoring UI
 * (Design & Making, Visual Communication, Communication & Presenting,
 * Collaboration & Teamwork, Leadership & Influence, Project Management,
 * Finance & Enterprise, Research & Inquiry, Digital Literacy & Citizenship,
 * Self-Management & Resilience).
 *
 * Static list — browser fetch caching is fine.
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
    .from("skill_domains")
    .select("id, short_code, label, description, display_order")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[teacher/skills/domains:GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to load domains" },
      { status: 500 }
    );
  }

  return NextResponse.json({ domains: data ?? [] });
}
