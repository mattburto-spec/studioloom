// audit-skip: TG.0C.5 task PATCH/DELETE; same auth pattern as parent
// route.ts. RLS gated by assessment_tasks policies + teacher-owns-unit
// pre-check.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireTeacherAuth,
  verifyTeacherHasUnit,
} from "@/lib/auth/verify-teacher-unit";
import { validateUpdateTaskInput } from "@/lib/tasks/validators";
import type { AssessmentTask } from "@/lib/tasks/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/teacher/tasks/[id]
 *
 * Partial update. If `criteria` or `linked_pages` is supplied, the existing
 * set is REPLACED (DELETE old + INSERT new — simpler than diffing for the
 * tiny cardinality at hand). All writes against service role; RLS is
 * gated by the verifyTeacherHasUnit pre-check.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacherAuth(request);
  if ("error" in auth) return auth.error;

  const { id: taskId } = await context.params;
  if (!taskId) {
    return NextResponse.json({ error: "task id required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validation = validateUpdateTaskInput(body);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.errors },
      { status: 400 }
    );
  }
  const patch = validation.value;

  const db = createAdminClient();

  // Look up the task to verify access via its unit_id
  const { data: existing, error: existingErr } = await db
    .from("assessment_tasks")
    .select(
      "id, unit_id, class_id, school_id, title, task_type, status, config, created_by, created_at, updated_at"
    )
    .eq("id", taskId)
    .maybeSingle();
  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (!existing.unit_id) {
    return NextResponse.json(
      { error: "Cross-unit tasks not editable in v1" },
      { status: 400 }
    );
  }

  const access = await verifyTeacherHasUnit(auth.teacherId, existing.unit_id);
  if (!access.hasAccess) {
    return NextResponse.json(
      { error: "Forbidden — no access to this unit" },
      { status: 403 }
    );
  }

  // Build the update payload, only including fields that were patched
  const updatePayload: Record<string, unknown> = {};
  if (patch.title !== undefined) updatePayload.title = patch.title;
  if (patch.status !== undefined) updatePayload.status = patch.status;
  if (patch.config !== undefined) updatePayload.config = patch.config;

  let updatedRow = existing;
  if (Object.keys(updatePayload).length > 0) {
    const { data: row, error: updateErr } = await db
      .from("assessment_tasks")
      .update(updatePayload)
      .eq("id", taskId)
      .select(
        "id, unit_id, class_id, school_id, title, task_type, status, config, created_by, created_at, updated_at"
      )
      .single();
    if (updateErr || !row) {
      return NextResponse.json(
        { error: updateErr?.message ?? "Failed to update task" },
        { status: 500 }
      );
    }
    updatedRow = row;
  }

  // Replace criterion weights if supplied
  if (patch.criteria !== undefined) {
    const { error: delErr } = await db
      .from("task_criterion_weights")
      .delete()
      .eq("task_id", taskId);
    if (delErr) {
      return NextResponse.json(
        { error: `Failed to clear criterion weights: ${delErr.message}` },
        { status: 500 }
      );
    }
    const weightRows = patch.criteria.map((c) => ({
      task_id: taskId,
      criterion_key: c.key,
      weight: c.weight ?? 100,
    }));
    if (weightRows.length > 0) {
      const { error: insErr } = await db
        .from("task_criterion_weights")
        .insert(weightRows);
      if (insErr) {
        return NextResponse.json(
          { error: `Failed to write criterion weights: ${insErr.message}` },
          { status: 500 }
        );
      }
    }
  }

  // Replace lesson links if supplied
  if (patch.linked_pages !== undefined) {
    const { error: delErr } = await db
      .from("task_lesson_links")
      .delete()
      .eq("task_id", taskId);
    if (delErr) {
      return NextResponse.json(
        { error: `Failed to clear lesson links: ${delErr.message}` },
        { status: 500 }
      );
    }
    if (patch.linked_pages.length > 0) {
      const linkRows = patch.linked_pages.map((lp) => ({
        task_id: taskId,
        unit_id: lp.unit_id,
        page_id: lp.page_id,
      }));
      const { error: insErr } = await db
        .from("task_lesson_links")
        .insert(linkRows);
      if (insErr) {
        return NextResponse.json(
          { error: `Failed to write lesson links: ${insErr.message}` },
          { status: 500 }
        );
      }
    }
  }

  // Re-fetch the denormalised shape
  const [weightsResult, linksResult] = await Promise.all([
    db
      .from("task_criterion_weights")
      .select("task_id, criterion_key, weight, rubric_descriptors")
      .eq("task_id", taskId),
    db
      .from("task_lesson_links")
      .select("task_id, unit_id, page_id")
      .eq("task_id", taskId),
  ]);

  const task: AssessmentTask = {
    id: updatedRow.id,
    unit_id: updatedRow.unit_id,
    class_id: updatedRow.class_id,
    school_id: updatedRow.school_id,
    title: updatedRow.title,
    task_type: updatedRow.task_type,
    status: updatedRow.status,
    config: updatedRow.config,
    created_by: updatedRow.created_by,
    created_at: updatedRow.created_at,
    updated_at: updatedRow.updated_at,
    criteria: (weightsResult.data ?? []).map((w) => w.criterion_key),
    linked_pages: (linksResult.data ?? []).map((l) => ({
      unit_id: l.unit_id,
      page_id: l.page_id,
    })),
  };

  return NextResponse.json({ task });
}

/**
 * DELETE /api/teacher/tasks/[id]
 *
 * Hard delete. ON DELETE CASCADE on task_criterion_weights + task_lesson_links
 * (and submissions, but TG.0C doesn't write any). Returns 204 No Content.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacherAuth(request);
  if ("error" in auth) return auth.error;

  const { id: taskId } = await context.params;
  if (!taskId) {
    return NextResponse.json({ error: "task id required" }, { status: 400 });
  }

  const db = createAdminClient();

  // Look up unit_id for the access check
  const { data: existing, error: existingErr } = await db
    .from("assessment_tasks")
    .select("id, unit_id")
    .eq("id", taskId)
    .maybeSingle();
  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (existing.unit_id) {
    const access = await verifyTeacherHasUnit(auth.teacherId, existing.unit_id);
    if (!access.hasAccess) {
      return NextResponse.json(
        { error: "Forbidden — no access to this unit" },
        { status: 403 }
      );
    }
  }

  const { error: deleteErr } = await db
    .from("assessment_tasks")
    .delete()
    .eq("id", taskId);
  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
