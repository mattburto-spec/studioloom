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
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/auth/require-teacher";

export async function GET(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;

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
