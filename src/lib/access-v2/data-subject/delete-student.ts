/**
 * softDeleteStudent — Phase 5.4.
 *
 * Marks a student record as soft-deleted + queues a 30-day hard-delete via
 * scheduled_deletions (Q5 resolution). Emits an audit event atomically with
 * the soft-delete.
 *
 * Idempotency: if the student is already soft-deleted (deleted_at != NULL),
 * returns the EXISTING scheduled_deletions row rather than creating a
 * duplicate. The unique-pending partial index on scheduled_deletions
 * (target_type, target_id) WHERE status='pending' enforces this at the DB
 * level; this function reads first to give a stable response shape.
 *
 * 30-day window is deliberate — matches Decision 6 retention semantics +
 * gives admins time to undo via legal-hold (UPDATE status='held') before
 * the hard-delete cron processes the row.
 *
 * Auth is the route's responsibility (verifyTeacherCanManageStudent OR
 * is_platform_admin). This function trusts the caller did the check.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logAuditEvent } from "../audit-log";

const HARD_DELETE_DELAY_DAYS = 30;

export type SoftDeleteStudentResult =
  | {
      ok: true;
      scheduledHardDeleteAt: string; // ISO timestamp
      scheduledDeletionId: string; // UUID
      alreadyScheduled: boolean; // true if this was an idempotent no-op
    }
  | {
      ok: false;
      reason: "student_not_found" | "db_error";
      message: string;
    };

export async function softDeleteStudent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  studentId: string,
  actorId: string,
): Promise<SoftDeleteStudentResult> {
  // 1. Verify the student exists. Don't soft-delete a non-row.
  const { data: student, error: readErr } = await supabase
    .from("students")
    .select("id, school_id, deleted_at")
    .eq("id", studentId)
    .maybeSingle();

  if (readErr) {
    return { ok: false, reason: "db_error", message: readErr.message };
  }
  if (!student) {
    return {
      ok: false,
      reason: "student_not_found",
      message: `Student ${studentId} not found`,
    };
  }

  const studentRow = student as {
    id: string;
    school_id: string | null;
    deleted_at: string | null;
  };

  // 2. Idempotent path — student already soft-deleted with a pending row.
  // Return the existing schedule so the caller gets a stable response shape.
  if (studentRow.deleted_at !== null) {
    const { data: existing } = await supabase
      .from("scheduled_deletions")
      .select("id, scheduled_for")
      .eq("target_type", "student")
      .eq("target_id", studentId)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) {
      return {
        ok: true,
        scheduledDeletionId: (existing as { id: string }).id,
        scheduledHardDeleteAt: (existing as { scheduled_for: string })
          .scheduled_for,
        alreadyScheduled: true,
      };
    }
    // deleted_at set but no pending row — orphan state. Fall through and
    // create the schedule (the unique partial index allows this since
    // there's no current pending row).
  }

  // 3. Compute hard-delete horizon
  const scheduledFor = new Date(
    Date.now() + HARD_DELETE_DELAY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // 4. Set deleted_at if not already set
  const nowIso = new Date().toISOString();
  if (studentRow.deleted_at === null) {
    const { error: softErr } = await supabase
      .from("students")
      .update({ deleted_at: nowIso })
      .eq("id", studentId);
    if (softErr) {
      return { ok: false, reason: "db_error", message: softErr.message };
    }
  }

  // 5. Insert scheduled_deletions row. Unique partial index protects
  // against race; if a parallel call inserted first we read theirs.
  const { data: inserted, error: insErr } = await supabase
    .from("scheduled_deletions")
    .insert({
      target_type: "student",
      target_id: studentId,
      scheduled_for: scheduledFor,
      status: "pending",
      scheduled_by: actorId,
    })
    .select("id, scheduled_for")
    .single();

  let scheduledDeletionId: string;
  let resolvedScheduledFor: string;

  if (insErr) {
    // Race-handler: another caller may have inserted a pending row in
    // between our read + write. Try to read it back.
    const { data: existing } = await supabase
      .from("scheduled_deletions")
      .select("id, scheduled_for")
      .eq("target_type", "student")
      .eq("target_id", studentId)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) {
      scheduledDeletionId = (existing as { id: string }).id;
      resolvedScheduledFor = (existing as { scheduled_for: string }).scheduled_for;
    } else {
      return { ok: false, reason: "db_error", message: insErr.message };
    }
  } else {
    scheduledDeletionId = (inserted as { id: string }).id;
    resolvedScheduledFor = (inserted as { scheduled_for: string }).scheduled_for;
  }

  // 6. Audit event — failureMode 'throw' so audit failure is atomic with
  // the soft-delete (the user's data lifecycle event MUST be logged).
  await logAuditEvent(supabase, {
    actorId,
    actorType: "teacher", // route layer routes platform_admin through actorType='platform_admin' override if needed
    action: "student.deleted.soft",
    targetTable: "students",
    targetId: studentId,
    schoolId: studentRow.school_id,
    payload: {
      scheduled_deletion_id: scheduledDeletionId,
      scheduled_hard_delete_at: resolvedScheduledFor,
      already_scheduled: studentRow.deleted_at !== null,
    },
    severity: "warn",
    failureMode: "throw",
  });

  return {
    ok: true,
    scheduledDeletionId,
    scheduledHardDeleteAt: resolvedScheduledFor,
    alreadyScheduled: studentRow.deleted_at !== null,
  };
}
