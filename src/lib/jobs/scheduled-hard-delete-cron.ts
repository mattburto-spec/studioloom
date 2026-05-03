/**
 * SCAFFOLD — Phase 5.5 (Q5 resolution)
 *
 * Single cron consuming scheduled_deletions for both consumers:
 *   - student-delete endpoint (Phase 5.4) writes pending rows on DSR delete
 *   - retention cron (Phase 5.5 retention-enforcement) writes pending rows on horizon
 *
 * Behaviour:
 *   SELECT * FROM scheduled_deletions WHERE status='pending' AND scheduled_for < now()
 *   For each row WHERE status != 'held' (legal-hold guardrail per Q5/Q7):
 *     DELETE FROM <target_table> WHERE id = target_id  -- cascades via FK
 *     UPDATE scheduled_deletions SET status='completed', completed_at=now() WHERE id=row.id
 *     logAuditEvent('<target_type>.deleted.hard', failureMode 'throw')
 *
 * Returns { runId, summary: { processed, skipped_held } }.
 */

export interface ScheduledHardDeleteSummary {
  runId: string;
  summary: {
    processed: number;
    skipped_held: number;
  };
}

export async function run(
  _supabase: unknown,
): Promise<ScheduledHardDeleteSummary> {
  throw new Error(
    "[scaffold] scheduled-hard-delete-cron run() not implemented — see docs/projects/access-model-v2-phase-5-brief.md §5.5",
  );
}
