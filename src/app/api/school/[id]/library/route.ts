/**
 * GET /api/school/[id]/library
 *
 * Phase 4.6 — school library browse. Returns published units in [id]
 * authored by any teacher in the same school.
 *
 * Auth: any authenticated teacher attached to [id]. Implicit tier-
 * awareness: free/pro teachers in personal schools naturally see only
 * their own units (alone in school); school-tier teachers see all
 * colleagues' units. No explicit tier-gate needed.
 *
 * Query params:
 *   ?q=search      (matches title/description, case-insensitive)
 *   ?author_id=…   (filter by author teacher id)
 *   ?limit=N       (default 100, max 500)
 *
 * Response:
 *   { units: [...], count: N }
 *
 * Each unit row includes: id, title, description, thumbnail_url,
 * grade_level, duration_weeks, topic, author_teacher_id, author_name,
 * forked_from, forked_from_author_id, fork_count, created_at.
 *
 * Spec: docs/projects/access-model-v2-phase-4-brief.md §4.6.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: RouteContext) {
  try {
    const { id: schoolId } = await ctx.params;
    if (!UUID_RE.test(schoolId)) {
      return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Membership check: viewer must be attached to [id]. Cross-school
    // browse is denied (also covered by the implicit school_id filter,
    // but explicit deny gives a clean 403 instead of an empty list).
    const { data: viewer } = await admin
      .from("teachers")
      .select("school_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!viewer?.school_id || viewer.school_id !== schoolId) {
      return NextResponse.json(
        { error: "Forbidden — must be a member of this school" },
        { status: 403 }
      );
    }

    // Parse filters
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const authorIdParam = url.searchParams.get("author_id");
    const limitParam = parseInt(url.searchParams.get("limit") ?? "100", 10);
    const limit = Math.min(
      Math.max(Number.isFinite(limitParam) ? limitParam : 100, 1),
      500
    );

    let query = admin
      .from("units")
      .select(
        "id, title, description, thumbnail_url, grade_level, duration_weeks, topic, global_context, key_concept, author_teacher_id, author_name, school_name, tags, forked_from, forked_from_author_id, fork_count, created_at"
      )
      .eq("school_id", schoolId)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (q.length > 0) {
      // ILIKE on title OR description. Postgres-side filter; fine for
      // a few hundred units. Full-text + relevance ranking is a
      // FU-AV2-LIBRARY-FTS-RANK if usage justifies.
      query = query.or(
        `title.ilike.%${q}%,description.ilike.%${q}%,topic.ilike.%${q}%`
      );
    }
    if (authorIdParam && UUID_RE.test(authorIdParam)) {
      query = query.eq("author_teacher_id", authorIdParam);
    }

    const { data: units, error } = await query;
    if (error) {
      console.error("[library GET] query failed:", error);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    return NextResponse.json(
      { units: units ?? [], count: units?.length ?? 0 },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[library GET] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
