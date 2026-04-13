import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import { moderateAndLog } from "@/lib/content-safety/moderate-and-log";

// Reverse mapping for pre-migration-011 fallback
const PAGE_ID_TO_NUMBER: Record<string, number> = {
  A1: 1, A2: 2, A3: 3, A4: 4,
  B1: 5, B2: 6, B3: 7, B4: 8,
  C1: 9, C2: 10, C3: 11, C4: 12,
  D1: 13, D2: 14, D3: 15, D4: 16,
};

// GET: Load planning tasks for a unit
export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const unitId = request.nextUrl.searchParams.get("unitId");
  if (!unitId) {
    return NextResponse.json({ error: "unitId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("planning_tasks")
    .select("*")
    .eq("student_id", studentId)
    .eq("unit_id", unitId)
    .order("sort_order");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tasks = (data || []).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    pageId: t.page_id || null,
    startDate: t.start_date,
    targetDate: t.target_date,
    timeLogged: t.time_logged,
  }));

  return NextResponse.json({ tasks });
}

// POST: Create a new planning task
export async function POST(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const body = await request.json();
  const { unitId, title, pageId, startDate, targetDate } = body;

  if (!unitId || !title) {
    return NextResponse.json(
      { error: "unitId and title required" },
      { status: 400 }
    );
  }

  // Phase 5F: Fire-and-forget moderation — private planning content
  if (title.length > 0) {
    moderateAndLog(title, {
      classId: '',
      studentId,
      source: 'student_progress' as const,
    }).catch((err: unknown) => console.error('[planning] moderation error:', err));
  }

  const supabase = createAdminClient();

  // Get next sort order
  const { data: existing } = await supabase
    .from("planning_tasks")
    .select("sort_order")
    .eq("student_id", studentId)
    .eq("unit_id", unitId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.sort_order || 0) + 1;

  // Try with page_id (post-migration 011)
  const { data, error } = await supabase
    .from("planning_tasks")
    .insert({
      student_id: studentId,
      unit_id: unitId,
      title,
      page_id: pageId || null,
      start_date: startDate || null,
      target_date: targetDate || null,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error && (error.message?.includes("does not exist") || error.message?.includes("Could not find"))) {
    // Fallback: migration 011 not yet applied, use page_number
    const pageNumber = pageId ? PAGE_ID_TO_NUMBER[pageId] || null : null;

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("planning_tasks")
      .insert({
        student_id: studentId,
        unit_id: unitId,
        title,
        page_number: pageNumber,
        start_date: startDate || null,
        target_date: targetDate || null,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (fallbackError) {
      return NextResponse.json(
        { error: fallbackError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      task: {
        id: fallbackData.id,
        title: fallbackData.title,
        status: fallbackData.status,
        pageId: fallbackData.page_id || null,
        startDate: fallbackData.start_date,
        targetDate: fallbackData.target_date,
        timeLogged: fallbackData.time_logged,
      },
    });
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    task: {
      id: data.id,
      title: data.title,
      status: data.status,
      pageId: data.page_id || null,
      startDate: data.start_date,
      targetDate: data.target_date,
      timeLogged: data.time_logged,
    },
  });
}

// PATCH: Update a task (status, title, etc.)
export async function PATCH(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const body = await request.json();
  const { taskId, status, title, startDate, targetDate } = body;

  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (title) updates.title = title;
  if (startDate !== undefined) updates.start_date = startDate || null;
  if (targetDate !== undefined) updates.target_date = targetDate || null;

  // Phase 5F: Fire-and-forget moderation — private planning content
  if (title && title.length > 0) {
    moderateAndLog(title, {
      classId: '',
      studentId,
      source: 'student_progress' as const,
    }).catch((err: unknown) => console.error('[planning] moderation error:', err));
  }

  const { error } = await supabase
    .from("planning_tasks")
    .update(updates)
    .eq("id", taskId)
    .eq("student_id", studentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE: Remove a task
export async function DELETE(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const taskId = request.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("planning_tasks")
    .delete()
    .eq("id", taskId)
    .eq("student_id", studentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
