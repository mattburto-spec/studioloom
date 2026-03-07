import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

async function getStudentId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  return session?.student_id || null;
}

// GET: Load planning tasks for a unit
export async function GET(request: NextRequest) {
  const studentId = await getStudentId(request);
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    pageNumber: t.page_number,
    targetDate: t.target_date,
    timeLogged: t.time_logged,
  }));

  return NextResponse.json({ tasks });
}

// POST: Create a new planning task
export async function POST(request: NextRequest) {
  const studentId = await getStudentId(request);
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { unitId, title, pageNumber } = body;

  if (!unitId || !title) {
    return NextResponse.json(
      { error: "unitId and title required" },
      { status: 400 }
    );
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

  const { data, error } = await supabase
    .from("planning_tasks")
    .insert({
      student_id: studentId,
      unit_id: unitId,
      title,
      page_number: pageNumber || null,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    task: {
      id: data.id,
      title: data.title,
      status: data.status,
      pageNumber: data.page_number,
      targetDate: data.target_date,
      timeLogged: data.time_logged,
    },
  });
}

// PATCH: Update a task (status, title, etc.)
export async function PATCH(request: NextRequest) {
  const studentId = await getStudentId(request);
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { taskId, status, title } = body;

  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (title) updates.title = title;

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
  const studentId = await getStudentId(request);
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
