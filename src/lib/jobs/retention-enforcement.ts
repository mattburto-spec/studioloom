/**
 * SCAFFOLD — Phase 5.5
 *
 * Monthly job. Reads docs/data-classification-taxonomy.md retention_days per column.
 * Soft-deletes rows past the horizon + writes scheduled_deletions(status='pending')
 * for the eventual hard-delete (Phase 5.5 scheduled-hard-delete-cron does the DELETE
 * after another 30 days).
 *
 * Q7 sanity assertion: if any column the cron is about to touch has
 * retention_days='indefinite', ABORT the run + emit severity:'critical'
 * audit event. Don't trust the taxonomy reader silently.
 *
 * For each table in scope:
 *   UPDATE table SET deleted_at = now()
 *     WHERE deleted_at IS NULL AND created_at < now() - interval 'X days'
 * Then for each soft-deleted row, INSERT scheduled_deletions row.
 *
 * Logs every action to audit_events (action='retention.soft_delete',
 * severity='info', failureMode='throw').
 *
 * Returns { runId, summary: { tables: [{ table, soft_deleted }] } }.
 *
 * Cron pattern mirrors src/lib/jobs/cost-alert.ts — entry at scripts/ops/run-retention-enforcement.ts.
 */

export interface RetentionRunSummary {
  runId: string;
  summary: {
    tables: Array<{ table: string; soft_deleted: number }>;
  };
}

export async function run(_supabase: unknown): Promise<RetentionRunSummary> {
  throw new Error(
    "[scaffold] retention-enforcement run() not implemented — see docs/projects/access-model-v2-phase-5-brief.md §5.5",
  );
}
