import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Teacher Safety Alerts API — Phase 6A
 *
 * GET /api/teacher/safety/alerts
 *   → List moderation alerts for teacher's classes.
 *   Query: ?class_id=... (optional filter), ?reviewed=false (default: unreviewed only)
 *
 * PATCH /api/teacher/safety/alerts
 *   → Update teacher review on a moderation log row.
 *   Body: { id: string, action: 'false_positive' | 'acknowledged' | 'escalated' }
 *
 * RLS on student_content_moderation_log handles class filtering.
 */

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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("class_id");
  const reviewed = searchParams.get("reviewed") === "true";

  let query = supabase
    .from("student_content_moderation_log")
    .select(`
      id,
      class_id,
      student_id,
      content_source,
      moderation_layer,
      flags,
      overall_result,
      severity,
      action_taken,
      teacher_reviewed,
      teacher_action,
      teacher_reviewed_at,
      created_at
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (classId) {
    query = query.eq("class_id", classId);
  }

  if (!reviewed) {
    query = query.eq("teacher_reviewed", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[teacher/safety/alerts] GET error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ alerts: data || [] });
}

export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseServer(request);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, action } = body as { id: string; action: string };

  if (!id || !action) {
    return NextResponse.json(
      { error: "id and action are required" },
      { status: 400 }
    );
  }

  const validActions = ["false_positive", "acknowledged", "escalated"];
  if (!validActions.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${validActions.join(", ")}` },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("student_content_moderation_log")
    .update({
      teacher_reviewed: true,
      teacher_action: action,
      teacher_reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[teacher/safety/alerts] PATCH error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
