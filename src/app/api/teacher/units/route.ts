import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestUnit } from "@/lib/knowledge/ingest-unit";
import { recordFork } from "@/lib/knowledge/feedback";
import { getPageList } from "@/lib/unit-adapter";
import type { PageContent } from "@/types";

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

/**
 * GET /api/teacher/units?browse=true&search=...&grade=...&tag=...
 * Browse published units in the global repository.
 */
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const browse = searchParams.get("browse");

  if (browse !== "true") {
    return NextResponse.json({ error: "Use ?browse=true" }, { status: 400 });
  }

  const search = searchParams.get("search") || "";
  const grade = searchParams.get("grade") || "";
  const tag = searchParams.get("tag") || "";
  const sort = searchParams.get("sort") || "newest";

  const adminClient = createAdminClient();

  let query = adminClient
    .from("units")
    .select(
      "id, title, description, thumbnail_url, is_published, author_name, school_name, tags, grade_level, duration_weeks, topic, global_context, key_concept, fork_count, created_at"
    )
    .eq("is_published", true);

  if (search) {
    query = query.or(
      `title.ilike.%${search}%,topic.ilike.%${search}%,description.ilike.%${search}%`
    );
  }

  if (grade) {
    query = query.eq("grade_level", grade);
  }

  if (tag) {
    query = query.contains("tags", [tag]);
  }

  if (sort === "most-forked") {
    query = query.order("fork_count", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  query = query.limit(50);

  const { data: units, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ units: units || [] });
}

/**
 * POST /api/teacher/units
 * Repository actions: publish, unpublish, fork.
 * Body: { action: "publish"|"unpublish"|"fork", unitId: string, authorName?: string, schoolName?: string, tags?: string[] }
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action, unitId, authorName, schoolName, tags } = body as {
    action: string;
    unitId: string;
    authorName?: string;
    schoolName?: string;
    tags?: string[];
  };

  if (!action || !unitId) {
    return NextResponse.json(
      { error: "action and unitId required" },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  switch (action) {
    case "publish": {
      const { error } = await adminClient
        .from("units")
        .update({
          is_published: true,
          author_teacher_id: user.id,
          author_name: authorName || null,
          school_name: schoolName || null,
          tags: tags || [],
        })
        .eq("id", unitId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    case "unpublish": {
      const { error } = await adminClient
        .from("units")
        .update({ is_published: false })
        .eq("id", unitId)
        .eq("author_teacher_id", user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    case "fork": {
      // Get the source unit
      const { data: source } = await adminClient
        .from("units")
        .select("*")
        .eq("id", unitId)
        .eq("is_published", true)
        .single();

      if (!source) {
        return NextResponse.json(
          { error: "Unit not found or not published" },
          { status: 404 }
        );
      }

      // Create a copy for this teacher
      const { data: newUnit, error: insertError } = await adminClient
        .from("units")
        .insert({
          title: `${source.title} (forked)`,
          description: source.description,
          content_data: source.content_data,
          thumbnail_url: source.thumbnail_url,
          is_published: false,
          author_teacher_id: user.id,
          grade_level: source.grade_level,
          duration_weeks: source.duration_weeks,
          topic: source.topic,
          global_context: source.global_context,
          key_concept: source.key_concept,
          tags: source.tags,
          forked_from: source.id,
        })
        .select("id")
        .single();

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }

      // Increment fork count on source (non-critical)
      await adminClient
        .from("units")
        .update({ fork_count: (source.fork_count || 0) + 1 })
        .eq("id", unitId);

      // Ingest forked unit & boost source quality (non-critical)
      if (newUnit?.id) {
        const unitPages = getPageList(source.content_data);
        const pages: Record<string, PageContent> = {};
        for (const p of unitPages) {
          if (p.content) pages[p.id] = p.content;
        }
        ingestUnit(
          newUnit.id,
          {
            title: source.title,
            topic: source.topic,
            description: source.description,
            grade_level: source.grade_level,
            global_context: source.global_context,
            key_concept: source.key_concept,
            pages,
          },
          user.id,
          false
        ).catch(() => {});
        recordFork(unitId).catch(() => {});
      }

      return NextResponse.json({ success: true, unitId: newUnit?.id });
    }

    default:
      return NextResponse.json(
        { error: "Invalid action. Use publish, unpublish, or fork." },
        { status: 400 }
      );
  }
}
