// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * PATCH /api/teacher/fabricators/[id]
 *
 * Currently supports one operation: toggle is_active.
 * Hard-delete is NOT exposed (D-INVITE-3 — deactivate only, preserves audit trail).
 *
 * Phase 8-1 + Round 2 audit (4 May 2026): school-scoped ownership.
 * Any teacher at the same school can deactivate the fab (replaces
 * the pre-flat-membership `invited_by_teacher_id = user.id` check).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAB_PRIVATE_CACHE_HEADERS } from "@/lib/fab/auth";
import {
  loadTeacherSchoolId,
  isOrchestrationError,
} from "@/lib/fabrication/lab-orchestration";
import { loadSchoolOwnedFabricator } from "@/lib/fabrication/fab-orchestration";
import { requireTeacher } from "@/lib/auth/require-teacher";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: FAB_PRIVATE_CACHE_HEADERS });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  let body: { is_active?: unknown };
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  const admin = createAdminClient();

  // School-scoped ownership check (Phase 8-1 + Round 2 audit).
  // Cross-school → 404 (no existence leak).
  const schoolResult = await loadTeacherSchoolId(admin, teacherId);
  if (isOrchestrationError(schoolResult)) {
    return privateJson(
      { error: schoolResult.error.message },
      schoolResult.error.status
    );
  }
  const fabResult = await loadSchoolOwnedFabricator(
    admin,
    schoolResult.schoolId,
    id
  );
  if (isOrchestrationError(fabResult)) {
    return privateJson(
      { error: fabResult.error.message },
      fabResult.error.status
    );
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.is_active === "boolean") {
    updates.is_active = body.is_active;
  }

  if (Object.keys(updates).length === 0) {
    return privateJson({ error: "No valid fields to update" }, 400);
  }

  const { error: updateError } = await admin
    .from("fabricators")
    .update(updates)
    .eq("id", id);

  if (updateError) {
    return privateJson({ error: `Update failed: ${updateError.message}` }, 500);
  }

  // On deactivation, also kill all active sessions so the Fabricator is
  // booted immediately, not on next expiry.
  if (updates.is_active === false) {
    await admin.from("fabricator_sessions").delete().eq("fabricator_id", id);
  }

  return privateJson({ ok: true });
}

export async function DELETE() {
  return privateJson(
    { error: "Hard-delete not supported. PATCH with is_active:false to deactivate." },
    405
  );
}
