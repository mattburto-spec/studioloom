import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestUnit } from "@/lib/knowledge/ingest-unit";
import { getPageList } from "@/lib/unit-adapter";

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
 * POST /api/teacher/knowledge/ingest
 * Ingest a unit into the knowledge base (called after save).
 * Body: { unitId: string }
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { unitId } = await request.json();
  if (!unitId) {
    return NextResponse.json({ error: "unitId required" }, { status: 400 });
  }

  // Load the unit (must belong to this teacher)
  const adminClient = createAdminClient();
  const { data: unit } = await adminClient
    .from("units")
    .select(
      "id, title, topic, description, grade_level, global_context, key_concept, content_data, is_published, author_teacher_id"
    )
    .eq("id", unitId)
    .single();

  if (!unit || unit.author_teacher_id !== user.id) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  try {
    // Convert page list to Record<string, PageContent> for ingest
    const unitPages = getPageList(unit.content_data);
    const pages: Record<string, import("@/types").PageContent> = {};
    for (const p of unitPages) {
      if (p.content) pages[p.id] = p.content;
    }
    const result = await ingestUnit(
      unitId,
      {
        title: unit.title,
        topic: unit.topic,
        description: unit.description,
        grade_level: unit.grade_level,
        global_context: unit.global_context,
        key_concept: unit.key_concept,
        pages,
      },
      user.id,
      unit.is_published || false
    );

    return NextResponse.json({ chunkCount: result.chunkCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed";
    console.error("[knowledge/ingest] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
