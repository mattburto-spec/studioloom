/**
 * SCAFFOLD — Phase 5.4
 *
 * Soft-deletes a student + queues 30-day hard-delete via scheduled_deletions
 * (table created in Phase 5.5 per Q5 resolution).
 *
 * Behaviour:
 *   1. UPDATE students SET deleted_at = now() WHERE id = studentId
 *   2. INSERT scheduled_deletions(target_type='student', target_id=studentId,
 *      scheduled_for=now()+30d, status='pending')
 *   3. logAuditEvent('student.deleted.soft', failureMode 'throw' — atomic)
 *   4. Return { scheduledHardDeleteAt, scheduledDeletionId }
 *
 * Legal-hold UX: future UPDATE scheduled_deletions SET status='held' WHERE ...
 * — Phase 5.5 cron honours the held flag.
 *
 * Auth gate at the route layer: verifyTeacherCanManageStudent OR is_platform_admin.
 * Confirmation pattern: requires ?confirm=true (defence in depth — clicking the
 * wrong link shouldn't soft-delete).
 */

export interface SoftDeleteStudentResult {
  scheduledHardDeleteAt: string;
  scheduledDeletionId: string;
}

export async function softDeleteStudent(
  _supabase: unknown,
  _studentId: string,
  _actorId: string,
): Promise<SoftDeleteStudentResult> {
  throw new Error(
    "[scaffold] softDeleteStudent not implemented — see docs/projects/access-model-v2-phase-5-brief.md §5.4",
  );
}
