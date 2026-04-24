/**
 * GET /api/teacher/skills/unit-page-search
 *
 * Helper for the "Used in" picker on the skill card edit page. Returns a
 * flat list of {unit_id, unit_title, page_id, page_title} for pages in
 * the teacher's units — so they can pin a skill card to a specific
 * lesson without a tree-picker UI.
 *
 * Query params:
 *   ?q=<text>   — optional fuzzy match against unit title + page title
 *
 * Response: { pages: Array<{unit_id, unit_title, page_id, page_title}> }
 *
 * Scope: teacher's authored units only. Forked / assigned units don't
 * come through — if there's demand, broaden to include class_units the
 * teacher owns.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { getPageList } from "@/lib/unit-adapter";

interface FlatPage {
  unit_id: string;
  unit_title: string;
  page_id: string;
  page_title: string;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;
    const teacherId = auth.teacherId;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

    const admin = createAdminClient();

    // Teacher's authored units — match the existing "author_teacher_id OR
    // teacher_id" dual-ownership pattern for robustness against legacy rows.
    const { data: units } = await admin
      .from("units")
      .select("id, title, content_data")
      .or(`author_teacher_id.eq.${teacherId},teacher_id.eq.${teacherId}`)
      .order("updated_at", { ascending: false });

    const flat: FlatPage[] = [];
    for (const u of units ?? []) {
      const pages = getPageList(u.content_data);
      for (const p of pages) {
        if (!p.id || !p.title) continue;
        flat.push({
          unit_id: u.id,
          unit_title: u.title ?? "Untitled unit",
          page_id: p.id,
          page_title: p.title,
        });
      }
    }

    const filtered = q
      ? flat.filter(
          (f) =>
            f.unit_title.toLowerCase().includes(q) ||
            f.page_title.toLowerCase().includes(q)
        )
      : flat;

    // Cap response size — teachers with many units + many pages can
    // produce thousands of flat rows.
    return NextResponse.json({
      pages: filtered.slice(0, 200),
      truncated: filtered.length > 200,
      total_matched: filtered.length,
    });
  } catch (error) {
    console.error("[teacher/skills/unit-page-search:GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
