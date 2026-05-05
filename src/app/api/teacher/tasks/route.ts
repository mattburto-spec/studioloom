// audit-skip: TG.0C teacher CRUD on assessment_tasks; orchestration mirrors
// existing teacher routes (units, marking). RLS gated by assessment_tasks
// policies + teacher-owns-unit pre-check inside the route.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireTeacherAuth,
  verifyTeacherHasUnit,
} from "@/lib/auth/verify-teacher-unit";
import { validateCreateTaskInput } from "@/lib/tasks/validators";
import type { AssessmentTask } from "@/lib/tasks/types";

/**
 * GET /api/teacher/tasks?unit_id=<uuid>
 *
 * Lists all tasks for a unit, denormalising criteria + linked_pages into the
 * AssessmentTask shape so the panel can render in one round trip.
 */
export async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unit_id");
  if (!unitId) {
    return NextResponse.json(
      { error: "unit_id query parameter required" },
      { status: 400 }
    );
  }

  // Verify the teacher has access to this unit before reading its tasks
  const access = await verifyTeacherHasUnit(auth.teacherId, unitId);
  if (!access.hasAccess) {
    return NextResponse.json(
      { error: "Forbidden — no access to this unit" },
      { status: 403 }
    );
  }

  const db = createAdminClient();

  // Pull tasks, weights, and links in 3 parallel queries — small data, simple
  // join on the client side. Avoids PostgREST embed quirks.
  const tasksResult = await db
    .from("assessment_tasks")
    .select(
      "id, unit_id, class_id, school_id, title, task_type, status, config, created_by, created_at, updated_at"
    )
    .eq("unit_id", unitId)
    .order("created_at", { ascending: true });

  if (tasksResult.error) {
    return NextResponse.json(
      { error: tasksResult.error.message },
      { status: 500 }
    );
  }

  const tasks = tasksResult.data ?? [];
  if (tasks.length === 0) {
    return NextResponse.json({ tasks: [] });
  }

  const taskIds = tasks.map((t) => t.id);

  const [weightsResult, linksResult] = await Promise.all([
    db
      .from("task_criterion_weights")
      .select("task_id, criterion_key, weight, rubric_descriptors")
      .in("task_id", taskIds),
    db
      .from("task_lesson_links")
      .select("task_id, unit_id, page_id")
      .in("task_id", taskIds),
  ]);

  if (weightsResult.error) {
    return NextResponse.json(
      { error: weightsResult.error.message },
      { status: 500 }
    );
  }
  if (linksResult.error) {
    return NextResponse.json(
      { error: linksResult.error.message },
      { status: 500 }
    );
  }

  // Group children by task_id
  const weightsByTask = new Map<string, typeof weightsResult.data>();
  for (const w of weightsResult.data ?? []) {
    const arr = weightsByTask.get(w.task_id) ?? [];
    arr.push(w);
    weightsByTask.set(w.task_id, arr);
  }

  const linksByTask = new Map<string, typeof linksResult.data>();
  for (const l of linksResult.data ?? []) {
    const arr = linksByTask.get(l.task_id) ?? [];
    arr.push(l);
    linksByTask.set(l.task_id, arr);
  }

  const denormalised: AssessmentTask[] = tasks.map((t) => ({
    id: t.id,
    unit_id: t.unit_id,
    class_id: t.class_id,
    school_id: t.school_id,
    title: t.title,
    task_type: t.task_type,
    status: t.status,
    config: t.config,
    created_by: t.created_by,
    created_at: t.created_at,
    updated_at: t.updated_at,
    criteria: (weightsByTask.get(t.id) ?? []).map((w) => w.criterion_key),
    linked_pages: (linksByTask.get(t.id) ?? []).map((l) => ({
      unit_id: l.unit_id,
      page_id: l.page_id,
    })),
  }));

  return NextResponse.json({ tasks: denormalised });
}

/**
 * POST /api/teacher/tasks
 *
 * Body: CreateTaskInput (validated via validateCreateTaskInput)
 *
 * Writes 1 row into assessment_tasks + N rows into task_criterion_weights
 * + 0..M rows into task_lesson_links. No DB transaction (Supabase JS client
 * doesn't expose them at this layer); on partial failure we attempt a
 * best-effort cleanup of the parent row so we don't leave orphan tasks
 * with no criteria.
 */
export async function POST(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validation = validateCreateTaskInput(body);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.errors },
      { status: 400 }
    );
  }
  const input = validation.value;

  // Verify the teacher has access to this unit
  const access = await verifyTeacherHasUnit(auth.teacherId, input.unit_id);
  if (!access.hasAccess) {
    return NextResponse.json(
      { error: "Forbidden — no access to this unit" },
      { status: 403 }
    );
  }

  // Resolve school_id from teachers.school_id (Lesson #72: teachers.id IS auth.users.id 1:1)
  const db = createAdminClient();
  const { data: teacherRow, error: teacherErr } = await db
    .from("teachers")
    .select("school_id")
    .eq("id", auth.teacherId)
    .maybeSingle();
  if (teacherErr) {
    return NextResponse.json({ error: teacherErr.message }, { status: 500 });
  }
  if (!teacherRow?.school_id) {
    return NextResponse.json(
      { error: "Teacher has no school_id; can't create tasks" },
      { status: 400 }
    );
  }

  // 1) Insert parent row
  const { data: taskRow, error: taskErr } = await db
    .from("assessment_tasks")
    .insert({
      unit_id: input.unit_id,
      class_id: input.class_id,
      school_id: teacherRow.school_id,
      title: input.title,
      task_type: input.task_type,
      status: input.status ?? "draft",
      config: input.config,
      created_by: auth.teacherId,
    })
    .select(
      "id, unit_id, class_id, school_id, title, task_type, status, config, created_by, created_at, updated_at"
    )
    .single();

  if (taskErr || !taskRow) {
    return NextResponse.json(
      { error: taskErr?.message ?? "Failed to insert task" },
      { status: 500 }
    );
  }

  // 2) Insert criterion weights
  const weightRows = input.criteria.map((c) => ({
    task_id: taskRow.id,
    criterion_key: c.key,
    weight: c.weight ?? 100,
  }));
  const { error: weightErr } = await db
    .from("task_criterion_weights")
    .insert(weightRows);
  if (weightErr) {
    // Best-effort cleanup so we don't leave the parent row orphaned
    await db.from("assessment_tasks").delete().eq("id", taskRow.id);
    return NextResponse.json(
      { error: `Failed to write criterion weights: ${weightErr.message}` },
      { status: 500 }
    );
  }

  // 3) Insert linked_pages (optional)
  if (input.linked_pages && input.linked_pages.length > 0) {
    const linkRows = input.linked_pages.map((lp) => ({
      task_id: taskRow.id,
      unit_id: lp.unit_id,
      page_id: lp.page_id,
    }));
    const { error: linkErr } = await db
      .from("task_lesson_links")
      .insert(linkRows);
    if (linkErr) {
      await db.from("assessment_tasks").delete().eq("id", taskRow.id);
      // weights cascade via FK (ON DELETE CASCADE), so we don't need to clean them up explicitly
      return NextResponse.json(
        { error: `Failed to write lesson links: ${linkErr.message}` },
        { status: 500 }
      );
    }
  }

  const task: AssessmentTask = {
    id: taskRow.id,
    unit_id: taskRow.unit_id,
    class_id: taskRow.class_id,
    school_id: taskRow.school_id,
    title: taskRow.title,
    task_type: taskRow.task_type,
    status: taskRow.status,
    config: taskRow.config,
    created_by: taskRow.created_by,
    created_at: taskRow.created_at,
    updated_at: taskRow.updated_at,
    criteria: input.criteria.map((c) => c.key),
    linked_pages: input.linked_pages ?? [],
  };

  return NextResponse.json({ task }, { status: 201 });
}
