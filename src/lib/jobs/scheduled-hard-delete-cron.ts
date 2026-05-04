/**
 * Scheduled hard-delete cron — Phase 5.5 (Q5 resolution).
 *
 * Single cron consuming scheduled_deletions for both producers:
 *   - DELETE /api/v1/student/[id] writes pending rows on DSR delete (5.4).
 *   - retention-enforcement cron writes pending rows on horizon (5.5).
 *
 * Behaviour:
 *   SELECT * FROM scheduled_deletions
 *   WHERE status='pending' AND scheduled_for < now()
 *
 *   For each row:
 *     - If status='held' (set by admin via legal-hold UX) → skip.
 *     - DELETE FROM <target_table> WHERE id = target_id (cascades via FK).
 *       If DELETE fails (target already gone, FK constraint, etc.) → leave
 *       schedule as pending; log audit_event with the error; future runs
 *       see it again and either succeed (target resurfaced) or admin
 *       intervention sets status='held' / 'completed' manually.
 *     - On success: UPDATE scheduled_deletions SET status='completed',
 *       completed_at = now() WHERE id = row.id.
 *     - logAuditEvent action='<target_type>.deleted.hard', failureMode 'throw'.
 *
 * Returns { runId, summary: { processed, skipped_held, errored } }.
 *
 * Cron pattern mirrors src/lib/jobs/cost-alert.ts — entry point at
 * scripts/ops/run-scheduled-hard-delete.ts. Wired into nightly.yml.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logAuditEvent } from "../access-v2/audit-log";

// ─────────────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────────────

export interface ScheduledHardDeleteSummary {
  runId: string;
  startedAt: string;
  completedAt: string;
  summary: {
    processed: number;
    skipped_held: number;
    errored: number;
  };
}

interface ScheduledRow {
  id: string;
  target_type: "student" | "teacher" | "unit";
  target_id: string;
  status: "pending" | "completed" | "held";
  scheduled_for: string;
  scheduled_by: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// run()
// ─────────────────────────────────────────────────────────────────────

export async function run(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
): Promise<ScheduledHardDeleteSummary> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const nowIso = new Date().toISOString();

  // ── Read pending rows whose scheduled_for has passed ─────────
  // Service-role client only (RLS deny-by-default on writes; reads are
  // platform_admin / school_teacher policies — service role bypasses).
  const { data, error } = await supabase
    .from("scheduled_deletions")
    .select("id, target_type, target_id, status, scheduled_for, scheduled_by")
    .eq("status", "pending")
    .lt("scheduled_for", nowIso);

  if (error || !data) {
    // Read failed — emit critical audit + return.
    await logAuditEvent(supabase, {
      actorId: null,
      actorType: "system",
      action: "scheduled_hard_delete.read_failed",
      targetTable: "scheduled_deletions",
      payload: { run_id: runId, error: error?.message ?? "unknown" },
      severity: "critical",
      failureMode: "throw",
    });
    return {
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      summary: { processed: 0, skipped_held: 0, errored: 1 },
    };
  }

  // ── Process each row ────────────────────────────────────────
  const rows = data as unknown as ScheduledRow[];
  let processed = 0;
  let skippedHeld = 0;
  let errored = 0;

  for (const row of rows) {
    if (row.status === "held") {
      // Defensive — query already filtered status='pending'; this is
      // belt-and-braces in case the row flipped to held between read +
      // process. Skip + count.
      skippedHeld += 1;
      continue;
    }

    const result = await processRow(supabase, runId, row);
    if (result === "deleted") processed += 1;
    else if (result === "errored") errored += 1;
  }

  const completedAt = new Date().toISOString();

  // Phase 6.7-followup — emit audit_event so the admin dashboard's "Vercel
  // Cron Jobs" panel can show the last-fired time. Always emit, even on a
  // zero-work run — the dashboard wants to see "yes, the cron is alive".
  await logAuditEvent(supabase, {
    actorId: null,
    actorType: "system",
    action: "scheduled_hard_delete.run",
    severity: errored > 0 ? "warn" : "info",
    payload: {
      run_id: runId,
      started_at: startedAt,
      completed_at: completedAt,
      processed,
      skipped_held: skippedHeld,
      errored,
    },
    failureMode: "soft-warn",
  });

  return {
    runId,
    startedAt,
    completedAt,
    summary: { processed, skipped_held: skippedHeld, errored },
  };
}

async function processRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  runId: string,
  row: ScheduledRow,
): Promise<"deleted" | "errored"> {
  const targetTable = mapTargetTypeToTable(row.target_type);
  if (!targetTable) {
    await logAuditEvent(supabase, {
      actorId: null,
      actorType: "system",
      action: "scheduled_hard_delete.unknown_target_type",
      targetTable: "scheduled_deletions",
      targetId: row.id,
      payload: {
        run_id: runId,
        target_type: row.target_type,
        target_id: row.target_id,
      },
      severity: "critical",
      failureMode: "throw",
    });
    return "errored";
  }

  // ── DELETE the target row (cascades via FK) ─────────────────
  const { error: delErr } = await supabase
    .from(targetTable)
    .delete()
    .eq("id", row.target_id);

  if (delErr) {
    // Target couldn't be deleted (FK constraint failure, target already
    // gone, etc.). Leave schedule as pending; log audit; future runs
    // retry. If target_already_gone, the next run's DELETE returns 0
    // rows + no error — the .neq("status","completed") filter on next
    // pass picks it up and we either succeed or it stays pending until
    // an admin intervenes.
    await logAuditEvent(supabase, {
      actorId: null,
      actorType: "system",
      action: "scheduled_hard_delete.target_delete_failed",
      targetTable,
      targetId: row.target_id,
      payload: {
        run_id: runId,
        scheduled_deletion_id: row.id,
        error: delErr.message,
      },
      severity: "critical",
      failureMode: "throw",
    });
    return "errored";
  }

  // ── Mark schedule complete ──────────────────────────────────
  const { error: updErr } = await supabase
    .from("scheduled_deletions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", row.id);

  if (updErr) {
    // Target IS deleted but schedule wasn't marked — orphan state.
    // Surface via Sentry-tagged critical audit. Future runs see this
    // schedule as still pending; the DELETE will be a no-op (target
    // already gone) but the schedule eventually flips on re-run if
    // the UPDATE succeeds.
    await logAuditEvent(supabase, {
      actorId: null,
      actorType: "system",
      action: "scheduled_hard_delete.schedule_update_failed",
      targetTable: "scheduled_deletions",
      targetId: row.id,
      payload: {
        run_id: runId,
        target_type: row.target_type,
        target_id: row.target_id,
        error: updErr.message,
      },
      severity: "critical",
      failureMode: "soft-sentry",
    });
    // Still count as deleted — the actual user-data row IS gone.
    return "deleted";
  }

  // ── Audit the successful hard-delete ────────────────────────
  await logAuditEvent(supabase, {
    actorId: row.scheduled_by,
    actorType: "system",
    action: `${row.target_type}.deleted.hard`,
    targetTable,
    targetId: row.target_id,
    payload: {
      run_id: runId,
      scheduled_deletion_id: row.id,
      scheduled_for: row.scheduled_for,
    },
    severity: "warn",
    failureMode: "throw",
  });

  return "deleted";
}

function mapTargetTypeToTable(
  type: "student" | "teacher" | "unit",
): string | null {
  if (type === "student") return "students";
  if (type === "teacher") return "teachers";
  if (type === "unit") return "units";
  return null;
}
