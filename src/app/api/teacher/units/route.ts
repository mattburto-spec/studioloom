import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
// Legacy knowledge pipeline helpers removed (Phase 0.4, 10 Apr 2026):
//   - ingest-unit.ts deleted (was dead code, wrote knowledge_chunks)
//   - recordFork() still in feedback.ts but not imported here
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
  const authorTeacherId = searchParams.get("authorTeacherId") || "";

  const adminClient = createAdminClient();

  let query = adminClient
    .from("units")
    .select(
      "id, title, description, thumbnail_url, is_published, author_teacher_id, author_name, school_name, tags, grade_level, duration_weeks, topic, global_context, key_concept, fork_count, created_at"
    )
    .eq("is_published", true);

  if (authorTeacherId) {
    query = query.eq("author_teacher_id", authorTeacherId);
  }

  if (search) {
    query = query.or(
      `title.ilike.%${search}%,topic.ilike.%${search}%,description.ilike.%${search}%,author_name.ilike.%${search}%,school_name.ilike.%${search}%`
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
 * Repository actions: publish, unpublish, fork, create.
 * Body: { action: "publish"|"unpublish"|"fork", unitId: string, ... }
 *    OR { action: "create", title: string, contentData: object, ... }
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
  const { action } = body as { action: string };

  if (!action) {
    return NextResponse.json(
      { error: "action required" },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  // --- "create" doesn't need unitId; everything else does ---
  if (action !== "create" && !body.unitId) {
    return NextResponse.json(
      { error: "unitId required for this action" },
      { status: 400 }
    );
  }
  const unitId: string | undefined = body.unitId;

  switch (action) {
    case "create": {
      const { title, contentData, description, gradeLevel, topic, unitType } =
        body as {
          title?: string;
          contentData?: unknown;
          description?: string;
          gradeLevel?: string;
          topic?: string;
          unitType?: string;
        };

      if (!title || !contentData || typeof contentData !== "object") {
        return NextResponse.json(
          { error: "title and contentData required for create" },
          { status: 400 }
        );
      }

      // TODO(access-v2 §4.0): replace with requireActorSession().schoolId once Phase 1 lands.
      // units.school_id was tightened to NOT NULL by mig 20260428222049_phase_0_8b; without
      // this lookup the insert below 500s. Direct lookup keeps blast radius minimal — full
      // 14-site audit (units + classes + students writers) belongs in access-v2 Phase 1.
      const { data: teacherRow } = await adminClient
        .from("teachers")
        .select("school_id")
        .eq("id", user.id)
        .single();
      if (!teacherRow?.school_id) {
        return NextResponse.json(
          { error: "Teacher missing school context" },
          { status: 500 }
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insertPayload: Record<string, any> = {
        title,
        description: description || null,
        content_data: contentData,
        school_id: teacherRow.school_id,
        author_teacher_id: user.id,
        teacher_id: user.id,
        grade_level: gradeLevel || null,
        topic: topic || null,
        unit_type: unitType || "design",
        is_published: false,
      };

      let { data: newUnit, error: insertError } = await adminClient
        .from("units")
        .insert(insertPayload)
        .select("id")
        .single();

      // Retry without unit_type if column doesn't exist yet (migration 051 not applied)
      if (insertError && (insertError.message.includes("unit_type") || insertError.code === "PGRST204")) {
        console.warn("[units:POST:create] unit_type column missing — retrying without it");
        delete insertPayload.unit_type;
        const retry = await adminClient
          .from("units")
          .insert(insertPayload)
          .select("id")
          .single();
        newUnit = retry.data;
        insertError = retry.error;
      }

      if (insertError) {
        console.error("[units:POST:create] insert failed:", insertError.message);
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, unitId: newUnit?.id });
    }

    case "publish": {
      const { authorName: authorNameOverride, schoolName: schoolNameOverride, tags } = body as {
        authorName?: string;
        schoolName?: string;
        tags?: string[];
      };

      // Pull the teacher's display_name / name / school so we never write the
      // literal string "Teacher" as attribution. The client may still override
      // either field, but by default we use what's in the profile.
      // display_name column may not exist yet (migration 090 not applied) —
      // retry without it if PostgREST complains.
      let teacherLookup = await adminClient
        .from("teachers")
        .select("name, display_name")
        .eq("id", user.id)
        .maybeSingle();

      if (
        teacherLookup.error &&
        (teacherLookup.error.message.includes("display_name") ||
          teacherLookup.error.code === "PGRST204" ||
          teacherLookup.error.code === "42703")
      ) {
        teacherLookup = await adminClient
          .from("teachers")
          .select("name")
          .eq("id", user.id)
          .maybeSingle() as typeof teacherLookup;
      }

      const teacher = teacherLookup.data as { name?: string | null; display_name?: string | null } | null;

      // Teacher profile sometimes stores school_name separately; if the client
      // didn't pass one, pull from teacher_profiles via profile API shape.
      let profileSchoolName: string | null = null;
      if (!schoolNameOverride) {
        const { data: profile } = await adminClient
          .from("teacher_profiles")
          .select("school_name")
          .eq("teacher_id", user.id)
          .maybeSingle();
        profileSchoolName = (profile as { school_name?: string | null } | null)?.school_name || null;
      }

      const resolvedAuthorName =
        authorNameOverride?.trim() ||
        teacher?.display_name?.trim() ||
        teacher?.name?.trim() ||
        null;

      const resolvedSchoolName = schoolNameOverride?.trim() || profileSchoolName || null;

      const { error } = await adminClient
        .from("units")
        .update({
          is_published: true,
          author_teacher_id: user.id,
          author_name: resolvedAuthorName,
          school_name: resolvedSchoolName,
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

      // TODO(access-v2 §4.0): replace with requireActorSession().schoolId once Phase 1 lands.
      // units.school_id was tightened to NOT NULL by mig 20260428222049_phase_0_8b.
      const { data: forkTeacherRow } = await adminClient
        .from("teachers")
        .select("school_id")
        .eq("id", user.id)
        .single();
      if (!forkTeacherRow?.school_id) {
        return NextResponse.json(
          { error: "Teacher missing school context" },
          { status: 500 }
        );
      }

      // Create a copy for this teacher
      const { data: newUnit, error: insertError } = await adminClient
        .from("units")
        .insert({
          title: source.title,
          description: source.description,
          content_data: source.content_data,
          thumbnail_url: source.thumbnail_url,
          is_published: false,
          school_id: forkTeacherRow.school_id,
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

      // Legacy knowledge pipeline helpers (ingestUnit, recordFork) removed in
      // Phase 0.4 (10 Apr 2026). Dimensions3 replacement TBD.
      return NextResponse.json({ success: true, unitId: newUnit?.id });
    }

    default:
      return NextResponse.json(
        { error: "Invalid action. Use create, publish, unpublish, or fork." },
        { status: 400 }
      );
  }
}
